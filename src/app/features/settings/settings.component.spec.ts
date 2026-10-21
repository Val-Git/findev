import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeProducerWorker, provideFakeProducerWorker } from '@core/feed/market-feed.testing.spec';
import { SettingsComponent } from './settings.component';

describe('SettingsComponent', (): void => {
  let worker: FakeProducerWorker;
  let fixture: ComponentFixture<SettingsComponent>;
  let element: HTMLElement;

  function input(id: string): HTMLInputElement {
    return element.querySelector<HTMLInputElement>(`#${id}`)!;
  }

  async function type(id: string, value: string): Promise<void> {
    const field = input(id);
    field.value = value;
    field.dispatchEvent(new Event('input'));
    field.dispatchEvent(new Event('blur'));
    await fixture.whenStable();
  }

  async function apply(): Promise<void> {
    element.querySelector<HTMLButtonElement>('button[type="submit"]')!.click();
    await fixture.whenStable();
  }

  beforeEach(async (): Promise<void> => {
    worker = new FakeProducerWorker();
    TestBed.configureTestingModule({
      imports: [SettingsComponent],
      providers: [provideFakeProducerWorker(worker)],
    });
    fixture = TestBed.createComponent(SettingsComponent);
    element = fixture.nativeElement as HTMLElement;
    await fixture.whenStable();
  });

  it('shows the active settings and nominal rate', (): void => {
    expect(input('instrumentCount').value).toBe('5');
    expect(input('updatesPerBatch').value).toBe('100');
    expect(input('batchIntervalMs').value).toBe('500');
    expect(element.querySelector('.rate')?.textContent).toContain('200 updates per second');
  });

  it('mirrors the limits onto the inputs', (): void => {
    expect(input('batchIntervalMs').min).toBe('50');
    expect(input('batchIntervalMs').max).toBe('2000');
  });

  it('applies the edited settings', async (): Promise<void> => {
    await type('instrumentCount', '12');
    await apply();

    expect(worker.posted.at(-1)).toEqual({
      type: 'start',
      runId: 2,
      settings: { instrumentCount: 12, updatesPerBatch: 100, batchIntervalMs: 500 },
    });
    expect(element.querySelector('[role="status"]')?.textContent).toContain('Applied');
  });

  it('shows an error for an invalid value once the field is touched', async (): Promise<void> => {
    await type('updatesPerBatch', '2.5');

    expect(element.querySelector('[role="alert"]')?.textContent).toBe(
      'Enter a whole number from 1 to 1,000.',
    );
    expect(input('updatesPerBatch').getAttribute('aria-invalid')).toBe('true');
  });

  it('does not apply an invalid draft and reveals its errors', async (): Promise<void> => {
    const postedBefore = worker.posted.length;
    const field = input('instrumentCount');
    field.value = '';
    field.dispatchEvent(new Event('input'));

    await apply();

    expect(worker.posted).toHaveLength(postedBefore);
    expect(element.querySelector('[role="alert"]')?.textContent).toBe('Enter a value.');
    expect(document.activeElement).toBe(field);
  });
});
