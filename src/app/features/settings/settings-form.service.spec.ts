import { firstValueFrom } from 'rxjs';
import { TestBed } from '@angular/core/testing';
import { submit } from '@angular/forms/signals';
import { MarketFeedService } from '@core/feed/market-feed.service';
import { FakeProducerWorker, provideFakeProducerWorker } from '@core/feed/market-feed.testing.spec';
import { DEFAULT_PRODUCER_SETTINGS } from '@core/producer/consts/producer-settings.const';
import type { MarketRow, ProducerSettings } from '@core/producer/producer.type';
import { SettingsFormService } from './settings-form.service';

const CUSTOM: ProducerSettings = { instrumentCount: 3, updatesPerBatch: 20, batchIntervalMs: 100 };

const TRADED: MarketRow = {
  symbol: 'ALFA',
  lastPriceCents: 10_200,
  spreadCents: 4,
  volume: 40,
  vwapCents: 10_150,
  imbalance: 0.2,
};

describe('SettingsFormService', (): void => {
  let worker: FakeProducerWorker;
  let feed: MarketFeedService;

  beforeEach((): void => {
    worker = new FakeProducerWorker();
    TestBed.configureTestingModule({
      providers: [provideFakeProducerWorker(worker), SettingsFormService],
    });
    feed = TestBed.inject(MarketFeedService);
  });

  function createService(): SettingsFormService {
    return TestBed.inject(SettingsFormService);
  }

  it('starts from the defaults', (): void => {
    expect(createService().form().value()).toEqual(DEFAULT_PRODUCER_SETTINGS);
  });

  it('starts from the active run settings rather than the defaults', (): void => {
    feed.apply(CUSTOM);

    expect(createService().form().value()).toEqual(CUSTOM);
  });

  it('does not affect the producer while the draft is edited', (): void => {
    const service = createService();
    const postedBefore = worker.posted.length;

    service.form().value.set({ ...CUSTOM });

    expect(worker.posted).toHaveLength(postedBefore);
  });

  it('starts a new run with the draft on submit', async (): Promise<void> => {
    const service = createService();
    service.form().value.set({ ...CUSTOM });

    expect(await submit(service.form)).toBe(true);
    expect(worker.posted.at(-1)).toEqual({ type: 'start', runId: 2, settings: CUSTOM });
  });

  it('clears the previous run values and totals on submit', async (): Promise<void> => {
    const service = createService();
    worker.emit({ type: 'snapshot', runId: 1, rows: [TRADED] });
    service.form().value.set({ ...CUSTOM });

    await submit(service.form);

    const rows = await firstValueFrom(feed.rows$);
    expect(rows.map((row: MarketRow): string => row.symbol)).toEqual(['ALFA', 'BETA', 'GAMA']);
    expect(rows.every((row: MarketRow): boolean => row.volume === 0)).toBe(true);
    expect(rows[0]?.lastPriceCents).toBeNull();
  });

  it('starts a new run when the previous one is paused', async (): Promise<void> => {
    const service = createService();
    worker.emit({ type: 'status', runId: 1, status: 'paused' });

    await submit(service.form);

    expect(worker.posted.at(-1)).toMatchObject({ type: 'start', runId: 2 });
  });

  it('rejects an invalid draft and reveals its errors', async (): Promise<void> => {
    const service = createService();
    const postedBefore = worker.posted.length;
    service.form.instrumentCount().value.set(51);

    expect(await submit(service.form)).toBe(false);
    expect(worker.posted).toHaveLength(postedBefore);
  });

  it('marks the fields as pristine after a successful submit', async (): Promise<void> => {
    const service = createService();
    service.form.instrumentCount().markAsDirty();

    await submit(service.form);

    expect(service.form().dirty()).toBe(false);
  });

  it('restores the defaults without applying them', (): void => {
    feed.apply(CUSTOM);
    const service = createService();
    const postedBefore = worker.posted.length;

    service.restoreDefaults();

    expect(service.form().value()).toEqual(DEFAULT_PRODUCER_SETTINGS);
    expect(worker.posted).toHaveLength(postedBefore);
  });

  it('reports the applied state until the draft changes', async (): Promise<void> => {
    const service = createService();
    expect(service.applied()).toBe(false);

    await submit(service.form);
    expect(service.applied()).toBe(true);

    service.form.instrumentCount().value.set(7);
    expect(service.applied()).toBe(false);
  });

  it('computes the nominal rate across all instruments', (): void => {
    const service = createService();

    expect(service.nominalRate()).toBe(200);

    service.form.batchIntervalMs().value.set(10);
    expect(service.nominalRate()).toBeNull();
  });
});
