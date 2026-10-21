import {
  type FieldContext,
  max,
  min,
  required,
  schema,
  type SchemaPath,
  type SchemaPathTree,
  validate,
  type ValidationResult,
} from '@angular/forms/signals';
import {
  type IntegerRange,
  PRODUCER_SETTINGS_LIMITS,
} from '@core/producer/consts/producer-settings.const';
import type { ProducerSettings } from '@core/producer/producer.type';

export type SettingsKey = keyof ProducerSettings;

/** The form model. A cleared number input yields `null`, so every value is nullable until validated. */
export type SettingsDraft = Record<SettingsKey, number | null>;

const NUMBER = new Intl.NumberFormat('en-US');

/** Every setting is a required whole number within its limits. */
export const settingsSchema = schema<SettingsDraft>((path: SchemaPathTree<SettingsDraft>): void => {
  wholeNumberInRange(path.instrumentCount, PRODUCER_SETTINGS_LIMITS.instrumentCount);
  wholeNumberInRange(path.updatesPerBatch, PRODUCER_SETTINGS_LIMITS.updatesPerBatch);
  wholeNumberInRange(path.batchIntervalMs, PRODUCER_SETTINGS_LIMITS.batchIntervalMs);
});

/** True when no value in the draft is empty. Checks every field, so new settings need no change here. */
export function isComplete(draft: SettingsDraft): draft is ProducerSettings {
  return Object.values(draft).every((value: number | null): boolean => value !== null);
}

function wholeNumberInRange(path: SchemaPath<number | null>, range: IntegerRange): void {
  const message = `Enter a whole number from ${NUMBER.format(range.min)} to ${NUMBER.format(range.max)}.`;
  required(path, { message: 'Enter a value.' });
  validate(path, ({ value }: FieldContext<number | null>): ValidationResult => {
    const current = value();
    // An empty value is reported by `required`.
    return current === null || Number.isInteger(current) ? null : { kind: 'integer', message };
  });
  min(path, range.min, { message });
  max(path, range.max, { message });
}
