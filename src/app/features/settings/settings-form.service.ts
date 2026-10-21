import { computed, inject, Injectable, linkedSignal, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { type FieldTree, form } from '@angular/forms/signals';
import { MarketFeedService } from '@core/feed/market-feed.service';
import { DEFAULT_PRODUCER_SETTINGS } from '@core/producer/consts/producer-settings.const';
import { isComplete, type SettingsDraft, settingsSchema } from './settings.schema';

// eslint-disable-next-line @angular-eslint/use-injectable-provided-in -- scoped to the settings page
@Injectable()
export class SettingsFormService {
  private readonly feed = inject(MarketFeedService);
  private readonly activeSettings = toSignal(this.feed.settings$, { requireSync: true });
  private readonly draftSettings = signal<SettingsDraft>({ ...this.activeSettings() });

  readonly form = form(this.draftSettings, settingsSchema, {
    submission: {
      action: (field: FieldTree<SettingsDraft>): Promise<undefined> => {
        const draft = field().value();
        if (isComplete(draft)) {
          this.feed.apply({ ...draft });
          field().reset();
          this.applied.set(true);
        }
        return Promise.resolve(undefined);
      },
      onInvalid: (field: FieldTree<SettingsDraft>): void => {
        field().errorSummary()[0]?.fieldTree().focusBoundControl();
      },
    },
  });

  /** True right after the draft is applied, until it is edited again. */
  readonly applied = linkedSignal<SettingsDraft, boolean>({
    source: this.draftSettings,
    computation: (): boolean => false,
  });

  /** Updates per second across all instruments for the draftSettings, or `null` while it is invalid. */
  readonly nominalRate = computed((): number | null => {
    const draft = this.draftSettings();
    return this.form().valid() && isComplete(draft)
      ? (draft.updatesPerBatch * 1000) / draft.batchIntervalMs
      : null;
  });

  /** Fills the draftSettings with the defaults without applying them. */
  restoreDefaults(): void {
    this.draftSettings.set({ ...DEFAULT_PRODUCER_SETTINGS });
  }
}
