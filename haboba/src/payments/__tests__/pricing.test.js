import { formatCurrency, formatPerMonth, formatPerUnit } from '../pricing';

describe('pricing helpers', () => {
  it('formats currency with provided code', () => {
    const value = formatCurrency(19.99, 'USD', 'en-US');
    expect(value).toContain('$');
    expect(value).toContain('19.99');
  });

  it('formats per-month values from numeric product price', () => {
    const perMonth = formatPerMonth(
      { price: 39.99, currencyCode: 'USD', priceString: '$39.99' },
      6,
      'en-US'
    );
    expect(perMonth).toContain('/mo');
    expect(perMonth).toContain('6.67');
  });

  it('formats per-unit values from numeric product price', () => {
    const perUnit = formatPerUnit(
      { price: 29.99, currencyCode: 'USD', priceString: '$29.99' },
      10,
      'en-US'
    );
    expect(perUnit).toContain('/each');
    expect(perUnit).toContain('3.00');
  });

  it('falls back to priceString when numeric value is missing', () => {
    const perMonth = formatPerMonth({ priceString: '£39.99' }, 6);
    expect(perMonth).toBe('£39.99/mo');
  });
});

