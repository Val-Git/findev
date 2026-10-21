import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { type FieldTree, form, type ValidationError } from '@angular/forms/signals';
import { DEFAULT_PRODUCER_SETTINGS } from '@core/producer/consts/producer-settings.const';
import { isComplete, type SettingsDraft, settingsSchema } from './settings.schema';

describe('settingsSchema', (): void => {
  function createForm(draft: Partial<SettingsDraft>): FieldTree<SettingsDraft> {
    return TestBed.runInInjectionContext((): FieldTree<SettingsDraft> =>
      form(signal<SettingsDraft>({ ...DEFAULT_PRODUCER_SETTINGS, ...draft }), settingsSchema),
    );
  }

  function batchIntervalErrors(value: number | null): string[] {
    return createForm({ batchIntervalMs: value })
      .batchIntervalMs()
      .errors()
      .map((error: ValidationError): string => error.kind);
  }

  it('accepts the defaults', (): void => {
    expect(createForm({})().valid()).toBe(true);
  });

  it('accepts both ends of the range', (): void => {
    expect(batchIntervalErrors(50)).toEqual([]);
    expect(batchIntervalErrors(2000)).toEqual([]);
  });

  it('rejects values outside the range', (): void => {
    expect(batchIntervalErrors(49)).toEqual(['min']);
    expect(batchIntervalErrors(2001)).toEqual(['max']);
  });

  it('rejects an empty value', (): void => {
    expect(batchIntervalErrors(null)).toEqual(['required']);
  });

  it('rejects a fractional value', (): void => {
    expect(batchIntervalErrors(100.5)).toEqual(['integer']);
  });

  it('applies the limits of each setting', (): void => {
    expect(createForm({ instrumentCount: 51 }).instrumentCount().invalid()).toBe(true);
    expect(createForm({ updatesPerBatch: 1001 }).updatesPerBatch().invalid()).toBe(true);
    expect(createForm({ updatesPerBatch: 0 }).updatesPerBatch().invalid()).toBe(true);
  });

  it('describes the allowed range in the error message', (): void => {
    const [error] = createForm({ batchIntervalMs: 10 }).batchIntervalMs().errors();

    expect(error?.message).toBe('Enter a whole number from 50 to 2,000.');
  });

  it('asks for a value when the field is empty', (): void => {
    const [error] = createForm({ instrumentCount: null }).instrumentCount().errors();

    expect(error?.message).toBe('Enter a value.');
  });
});

describe('isComplete', (): void => {
  it('accepts a draft with every value set', (): void => {
    expect(isComplete({ ...DEFAULT_PRODUCER_SETTINGS })).toBe(true);
  });

  it.each(['instrumentCount', 'updatesPerBatch', 'batchIntervalMs'] as const)(
    'rejects a draft with an empty %s',
    (key: keyof SettingsDraft): void => {
      expect(isComplete({ ...DEFAULT_PRODUCER_SETTINGS, [key]: null })).toBe(false);
    },
  );
});
