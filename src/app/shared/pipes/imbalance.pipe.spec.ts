import { ImbalancePipe } from './imbalance.pipe';
import { UNAVAILABLE_SIGN } from './unavailable.const';

describe('ImbalancePipe', (): void => {
  const pipe = new ImbalancePipe();

  it('shows a positive imbalance with a plus sign', (): void => {
    expect(pipe.transform(0.2)).toBe('+0.20');
    expect(pipe.transform(1)).toBe('+1.00');
  });

  it('shows a negative imbalance with a minus sign', (): void => {
    expect(pipe.transform(-0.35)).toBe('-0.35');
    expect(pipe.transform(-1)).toBe('-1.00');
  });

  it('shows zero without a sign, including values that round to zero', (): void => {
    expect(pipe.transform(0)).toBe('0.00');
    expect(pipe.transform(-0.001)).toBe('0.00');
  });

  it('shows an unavailable value for null', (): void => {
    expect(pipe.transform(null)).toBe(UNAVAILABLE_SIGN);
  });
});
