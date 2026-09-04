import type { Candle } from './types';

// Technical indicator primitives — pure functions over candle arrays.
// All operate on the close series unless noted. No look-ahead: callers pass
// the slice of candles available up to the evaluation bar.

export function ema(values: number[], period: number): number[] {
  if (values.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [];
  let prev = values[0];
  out.push(prev);
  for (let i = 1; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out.push(prev);
  }
  return out;
}

export function sma(values: number[], period: number): number[] {
  const out: number[] = new Array(values.length).fill(NaN);
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

// Wilder's ATR. Returns an array aligned to candles (NaN until warm).
export function atr(candles: Candle[], period = 14): number[] {
  const n = candles.length;
  const out: number[] = new Array(n).fill(NaN);
  if (n < 2) return out;
  const tr: number[] = [];
  for (let i = 0; i < n; i++) {
    if (i === 0) {
      tr.push(candles[0].high - candles[0].low);
    } else {
      const h = candles[i].high;
      const l = candles[i].low;
      const pc = candles[i - 1].close;
      tr.push(Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc)));
    }
  }
  // Seed with simple average of first `period` TRs, then Wilder smoothing.
  if (n <= period) return out;
  let prev = 0;
  for (let i = 0; i < period; i++) prev += tr[i];
  prev = prev / period;
  out[period - 1] = prev;
  for (let i = period; i < n; i++) {
    prev = (prev * (period - 1) + tr[i]) / period;
    out[i] = prev;
  }
  return out;
}

export function rollingHigh(candles: Candle[], period: number): number[] {
  const out: number[] = new Array(candles.length).fill(NaN);
  let dq: number[] = []; // indices
  for (let i = 0; i < candles.length; i++) {
    while (dq.length && candles[dq[dq.length - 1]].high <= candles[i].high) dq.pop();
    dq.push(i);
    while (dq[0] <= i - period) dq.shift();
    if (i >= period - 1) out[i] = candles[dq[0]].high;
  }
  return out;
}

export function rollingLow(candles: Candle[], period: number): number[] {
  const out: number[] = new Array(candles.length).fill(NaN);
  let dq: number[] = [];
  for (let i = 0; i < candles.length; i++) {
    while (dq.length && candles[dq[dq.length - 1]].low >= candles[i].low) dq.pop();
    dq.push(i);
    while (dq[0] <= i - period) dq.shift();
    if (i >= period - 1) out[i] = candles[dq[0]].low;
  }
  return out;
}

export function closes(candles: Candle[]): number[] {
  return candles.map((c) => c.close);
}
