export const formatCurrencyAmount = (
  amount?: number,
  currency = 'IDR',
  locale = 'id-ID',
) => {
  const value = amount || 0;
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency,
      maximumFractionDigits: currency === 'IDR' ? 0 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toLocaleString(locale)}`;
  }
};
