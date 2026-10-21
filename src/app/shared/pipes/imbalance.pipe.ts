import { Pipe, type PipeTransform } from '@angular/core';
import { UNAVAILABLE_SIGN } from './unavailable.const';

const SIGNED_RATIO = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  signDisplay: 'exceptZero',
});

/** Formats an order-book imbalance between -1 and +1 with an explicit sign. */
@Pipe({ name: 'imbalance' })
export class ImbalancePipe implements PipeTransform {
  transform(imbalance: number | null): string {
    return imbalance === null ? UNAVAILABLE_SIGN : SIGNED_RATIO.format(imbalance);
  }
}
