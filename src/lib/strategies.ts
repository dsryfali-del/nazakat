import type { Candle, Signal, StrategyId } from './types';
import { atr, closes, ema, rollingHigh, rollingLow, sma } from './indicators';

// Each engine is a pure function: given the candle series available up to "now"
// (the last bar), return a Signal. No look-ahead — only the passed slice is used.
// Scoring is heuristic and bounded 0-100. Direction is NO TRADE when conditions
// are not met. SL/TP use ATR(14): SL = entry ∓ 1.5×ATR, TP = entry ± 2.5×ATR.

export type EngineFn = (symbol: string, candles: Candle[]) => Signal;

const NO_TRADE_BASE = (symbol: string, strategy: StrategyId, candles: Candle[], atrVal: number): Signal => {
  const last = candles[candles.length - 1];
  return {
    symbol,
    strategy,
    direction: 'NO TRADE',
    score: 0,
    entry: last.close,
    stopLoss: last.close,
    takeProfit: last.close,
    atr: atrVal,
    reason: 'No setup conditions met.',
    time: last.time,
  };
};

// ---- Trend Following: EMA20/EMA50 crossover with confirmation ----
export const trendEngine: EngineFn = (symbol, candles) => {
  const n = candles.length;
  const last = candles[n - 1];
  const atrArr = atr(candles, 14);
  const atrVal = atrArr[n - 1] || (last.high - last.low);
  const c = closes(candles);
  const e20 = ema(c, 20);
  const e50 = ema(c, 50);

  const e20Now = e20[n - 1];
  const e50Now = e50[n - 1];
  const e20Prev = e20[n - 2] ?? e20Now;
  const rising = e20Now > e20Prev;
  const falling = e20Now < e20Prev;
  const price = last.close;

  const buyCond = e20Now > e50Now && price > e20Now && rising;
  const sellCond = e20Now < e50Now && price < e20Now && falling;

  if (!buyCond && !sellCond) return NO_TRADE_BASE(symbol, 'trend', candles, atrVal);

  const dir = buyCond ? 'BUY' : 'SELL';
  const separation = Math.abs(e20Now - e50Now) / Math.max(e50Now, 1e-9);
  const slopeStrength = Math.abs(e20Now - e20Prev) / Math.max(e20Now, 1e-9);
  const distFromEma = Math.abs(price - e20Now) / Math.max(e20Now, 1e-9);

  // Score: separation (trend strength) + slope (momentum) + healthy distance from EMA
  let score = 40 + separation * 1800 + slopeStrength * 6000 + distFromEma * 1200;
  score = clampScore(score);

  const entry = price;
  const sl = dir === 'BUY' ? entry - 1.5 * atrVal : entry + 1.5 * atrVal;
  const tp = dir === 'BUY' ? entry + 2.5 * atrVal : entry - 2.5 * atrVal;

  return {
    symbol,
    strategy: 'trend',
    direction: dir,
    score,
    entry,
    stopLoss: sl,
    takeProfit: tp,
    atr: atrVal,
    reason:
      dir === 'BUY'
        ? `EMA20 above EMA50, price holding above EMA20 and EMA20 rising — uptrend confirmed.`
        : `EMA20 below EMA50, price holding below EMA20 and EMA20 falling — downtrend confirmed.`,
    time: last.time,
  };
};

// ---- Breakout + Retest: close breaks the 20-bar high/low ----
export const breakoutEngine: EngineFn = (symbol, candles) => {
  const n = candles.length;
  const last = candles[n - 1];
  const atrArr = atr(candles, 14);
  const atrVal = atrArr[n - 1] || (last.high - last.low);
  const highs = rollingHigh(candles, 20);
  const lows = rollingLow(candles, 20);

  // Rolling window excludes the current bar: use the prior bar's 20-bar high/low.
  const prevHigh = highs[n - 2];
  const prevLow = lows[n - 2];
  if (Number.isNaN(prevHigh) || Number.isNaN(prevLow)) return NO_TRADE_BASE(symbol, 'breakout', candles, atrVal);

  const breakoutUp = last.close > prevHigh;
  const breakoutDn = last.close < prevLow;

  if (!breakoutUp && !breakoutDn) return NO_TRADE_BASE(symbol, 'breakout', candles, atrVal);

  const dir = breakoutUp ? 'BUY' : 'SELL';
  const rangeSize = prevHigh - prevLow;
  const breakoutSize = dir === 'BUY' ? last.close - prevHigh : prevLow - last.close;
  const strength = breakoutSize / Math.max(rangeSize, 1e-9);

  let score = 45 + strength * 350 + (rangeSize / last.close) * 800;
  // small confirmation bonus: close near the high (bullish) / low (bearish) of the bar
  const barRange = last.high - last.low;
  const closePos = barRange > 0 ? (last.close - last.low) / barRange : 0.5;
  if (dir === 'BUY') score += (closePos - 0.5) * 30;
  else score += (0.5 - closePos) * 30;
  score = clampScore(score);

  const entry = last.close;
  const sl = dir === 'BUY' ? entry - 1.5 * atrVal : entry + 1.5 * atrVal;
  const tp = dir === 'BUY' ? entry + 2.5 * atrVal : entry - 2.5 * atrVal;

  return {
    symbol,
    strategy: 'breakout',
    direction: dir,
    score,
    entry,
    stopLoss: sl,
    takeProfit: tp,
    atr: atrVal,
    reason:
      dir === 'BUY'
        ? `Close broke above the 20-bar high (${fmt(prevHigh)}) — breakout to the upside.`
        : `Close broke below the 20-bar low (${fmt(prevLow)}) — breakdown to the downside.`,
    time: last.time,
  };
};

// ---- Mean Reversion: 2%+ deviation from 20-period SMA ----
export const meanRevEngine: EngineFn = (symbol, candles) => {
  const n = candles.length;
  const last = candles[n - 1];
  const atrArr = atr(candles, 14);
  const atrVal = atrArr[n - 1] || (last.high - last.low);
  const c = closes(candles);
  const s20 = sma(c, 20);
  const smaNow = s20[n - 1];
  if (Number.isNaN(smaNow)) return NO_TRADE_BASE(symbol, 'meanrev', candles, atrVal);

  const price = last.close;
  const deviation = (price - smaNow) / smaNow; // positive = above (overbought)
  const oversold = deviation <= -0.02;
  const overbought = deviation >= 0.02;

  if (!oversold && !overbought) return NO_TRADE_BASE(symbol, 'meanrev', candles, atrVal);

  const dir = oversold ? 'BUY' : 'SELL';
  const magnitude = Math.abs(deviation);
  let score = 40 + (magnitude - 0.02) * 1400;
  // dampen extreme dislocations that may be trend changes, not reversion
  if (magnitude > 0.06) score -= (magnitude - 0.06) * 600;
  score = clampScore(score);

  const entry = price;
  const sl = dir === 'BUY' ? entry - 1.5 * atrVal : entry + 1.5 * atrVal;
  const tp = dir === 'BUY' ? entry + 2.5 * atrVal : entry - 2.5 * atrVal;

  return {
    symbol,
    strategy: 'meanrev',
    direction: dir,
    score,
    entry,
    stopLoss: sl,
    takeProfit: tp,
    atr: atrVal,
    reason:
      dir === 'BUY'
        ? `Price is ${(magnitude * 100).toFixed(2)}% below the 20-period SMA — oversold, reversion long.`
        : `Price is ${(magnitude * 100).toFixed(2)}% above the 20-period SMA — overbought, reversion short.`,
    time: last.time,
  };
};

export const ENGINES: Record<StrategyId, { fn: EngineFn; name: string; short: string }> = {
  trend: { fn: trendEngine, name: 'Trend Following', short: 'EMA20/EMA50' },
  breakout: { fn: breakoutEngine, name: 'Breakout + Retest', short: '20-bar high/low' },
  meanrev: { fn: meanRevEngine, name: 'Mean Reversion', short: 'SMA(20) deviation' },
};

export function runEngine(strategy: StrategyId, symbol: string, candles: Candle[]): Signal {
  return ENGINES[strategy].fn(symbol, candles);
}

export function clampScore(s: number): number {
  return Math.max(0, Math.min(100, Math.round(s)));
}

function fmt(n: number): string {
  return n.toLocaleString('en-US', { maximumFractionDigits: 5 });
}
