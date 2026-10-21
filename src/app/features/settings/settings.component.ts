import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormField, FormRoot } from '@angular/forms/signals';
import {
  type IntegerRange,
  PRODUCER_SETTINGS_LIMITS,
} from '@core/producer/consts/producer-settings.const';
import { SettingsFormService } from './settings-form.service';
import type { SettingsKey } from './settings.schema';

interface SettingsField extends IntegerRange {
  readonly key: SettingsKey;
  readonly label: string;
  readonly hint: string;
}

const FIELDS: readonly SettingsField[] = [
  {
    key: 'instrumentCount',
    label: 'Instrument count',
    hint: 'Number of fictional instruments to generate data for.',
    ...PRODUCER_SETTINGS_LIMITS.instrumentCount,
  },
  {
    key: 'updatesPerBatch',
    label: 'Updates per batch',
    hint: 'Market updates in each batch, across all instruments.',
    ...PRODUCER_SETTINGS_LIMITS.updatesPerBatch,
  },
  {
    key: 'batchIntervalMs',
    label: 'Batch interval, ms',
    hint: 'Requested time between batches.',
    ...PRODUCER_SETTINGS_LIMITS.batchIntervalMs,
  },
];

@Component({
  imports: [DecimalPipe, FormField, FormRoot],
  selector: 'app-settings',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SettingsFormService],
  styleUrl: './settings.component.scss',
  templateUrl: './settings.component.html',
})
export class SettingsComponent {
  protected readonly formService = inject(SettingsFormService);
  protected readonly fields = FIELDS;
}
