import { type ComponentFixture, TestBed } from '@angular/core/testing';
import { FakeProducerWorker, provideFakeProducerWorker } from '@core/feed/market-feed.testing.spec';
import type { MarketRow } from '@core/producer/producer.type';
import { DashboardComponent } from './dashboard.component';

/** The worked example from the task: trades 10 @ $100 and 30 @ $102, bid/ask $101.96/$102. */
const ALFA_TRADED: MarketRow = {
  symbol: 'ALFA',
  lastPriceCents: 10_200,
  spreadCents: 4,
  volume: 40,
  vwapCents: 10_150,
  imbalance: 0.2,
};

describe('DashboardComponent', (): void => {
  let worker: FakeProducerWorker;
  let fixture: ComponentFixture<DashboardComponent>;
  let element: HTMLElement;

  function render(): void {
    fixture.detectChanges();
  }

  function cellTexts(rowIndex: number): string[] {
    const row = element.querySelectorAll('tbody tr')[rowIndex];
    return Array.from(row?.querySelectorAll('th, td') ?? [], (cell: Element): string =>
      cell.textContent.trim(),
    );
  }

  function button(): HTMLButtonElement {
    return element.querySelector<HTMLButtonElement>('.toolbar button')!;
  }

  beforeEach((): void => {
    worker = new FakeProducerWorker();
    TestBed.configureTestingModule({
      imports: [DashboardComponent],
      providers: [provideFakeProducerWorker(worker)],
    });
    fixture = TestBed.createComponent(DashboardComponent);
    element = fixture.nativeElement as HTMLElement;
    render();
  });

  it('shows unavailable values and zero volume before any data arrives', (): void => {
    expect(element.querySelectorAll('tbody tr')).toHaveLength(5);
    expect(cellTexts(0)).toEqual(['ALFA', '—', '—', '0', '—', '—']);
    expect(cellTexts(4)[0]).toBe('EPSN');
  });

  it('formats the metrics of a snapshot', (): void => {
    worker.emit({ type: 'snapshot', runId: 1, rows: [ALFA_TRADED] });
    render();

    expect(cellTexts(0)).toEqual(['ALFA', '$102.00', '$0.04', '40', '$101.50', '+0.20']);
  });

  it('ignores a snapshot from a replaced run', (): void => {
    worker.emit({ type: 'snapshot', runId: 0, rows: [ALFA_TRADED] });
    render();

    expect(cellTexts(0)).toEqual(['ALFA', '—', '—', '0', '—', '—']);
  });

  it('disables the control until the worker confirms the run', (): void => {
    expect(element.querySelector('.status')?.textContent).toBe('initializing');
    expect(button().disabled).toBe(true);
  });

  it('pauses a running producer', (): void => {
    worker.emit({ type: 'status', runId: 1, status: 'running' });
    render();

    expect(button().textContent).toBe('Pause');
    button().click();

    expect(worker.posted.at(-1)).toEqual({ type: 'pause' });
  });

  it('resumes a paused producer', (): void => {
    worker.emit({ type: 'status', runId: 1, status: 'paused' });
    render();

    expect(element.querySelector('.status')?.textContent).toBe('paused');
    expect(button().textContent).toBe('Resume');
    button().click();

    expect(worker.posted.at(-1)).toEqual({ type: 'resume' });
  });

  it('shows a producer error', (): void => {
    worker.emit({ type: 'error', runId: 1, message: 'Wasm failed to load' });
    worker.emit({ type: 'status', runId: 1, status: 'error' });
    render();

    expect(element.querySelector('[role="alert"]')?.textContent).toBe('Wasm failed to load');
    expect(button().disabled).toBe(true);
  });
});
