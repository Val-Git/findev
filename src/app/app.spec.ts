import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';

describe('App', (): void => {
  beforeEach(async (): Promise<void> => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('should create the app', (): void => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render navigation to the dashboard', async (): Promise<void> => {
    const fixture = TestBed.createComponent(App);
    await fixture.whenStable();
    const link = (fixture.nativeElement as HTMLElement).querySelector('nav a');
    expect(link?.getAttribute('href')).toBe('/dashboard');
  });
});
