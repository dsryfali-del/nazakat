// Number/price formatting helpers. All financial numerics render in monospace.

export function fmtPrice(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtUsd(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  const sign = n < 0 ? '-' : '';
  return `${sign}$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function fmtPct(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(decimals)}%`;
}

export function fmtPctPlain(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  return `${n.toFixed(decimals)}%`;
}

export function fmtR(n: number): string {
  if (!isFinite(n)) return '—';
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}R`;
}

export function fmtNum(n: number, decimals = 2): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtCompact(n: number): string {
  if (!isFinite(n)) return '—';
  return n.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 1 });
}

export function decimalsFor(symbol: string): number {
  // mirror the symbol metadata decimals for price rendering
  if (symbol.includes('JPY')) return 3;
  if (['XAUUSD', 'XAGUSD', 'US500'].includes(symbol)) return 2;
  if (['BTCUSD'].includes(symbol)) return 1;
  if (symbol.length === 6 && symbol.endsWith('USD') && !symbol.startsWith('USD')) return 5;
  return 2;
}
