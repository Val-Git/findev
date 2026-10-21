import { Pipe, type PipeTransform } from '@angular/core';
import { UNAVAILABLE_SIGN } from './unavailable.const';

const USD = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Formats integer or fractional cents as dollars. Prices are rounded only here, for display. */
@Pipe({ name: 'centsCurrency' })
export class CentsCurrencyPipe implements PipeTransform {
  transform(cents: number | null): string {
    return cents === null ? UNAVAILABLE_SIGN : USD.format(cents / 100);
  }
}
