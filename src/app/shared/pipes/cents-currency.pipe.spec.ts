import { CentsCurrencyPipe } from './cents-currency.pipe';
import { UNAVAILABLE_SIGN } from './unavailable.const';

describe('CentsCurrencyPipe', (): void => {
  const pipe = new CentsCurrencyPipe();

  it('formats whole cents as dollars', (): void => {
    expect(pipe.transform(10_200)).toBe('$102.00');
    expect(pipe.transform(4)).toBe('$0.04');
  });

  it('rounds fractional cents only for display', (): void => {
    expect(pipe.transform(10_150)).toBe('$101.50');
    expect(pipe.transform(10_149.6)).toBe('$101.50');
    expect(pipe.transform(10_149.4)).toBe('$101.49');
  });

  it('groups thousands', (): void => {
    expect(pipe.transform(123_456_789)).toBe('$1,234,567.89');
  });

  it('shows an unavailable value for null', (): void => {
    expect(pipe.transform(null)).toBe(UNAVAILABLE_SIGN);
  });
});
