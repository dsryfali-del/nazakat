import type { Candle, Signal, StrategyId } from './types';
import { atr, closes, ema, rollingHigh, rollingLow, sma } from './indicators';
import { SYMBOL_MAP } from './symbols';

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

// ---- Price Action: fractal swing high/low with retest confirmation ----
function findSwingHighs(candles: Candle[]): { index: number; price: number }[] {
  const swings: { index: number; price: number }[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    if (
      candles[i].high > candles[i - 1].high && candles[i].high > candles[i - 2].high &&
      candles[i].high > candles[i + 1].high && candles[i].high > candles[i + 2].high
    ) {
      swings.push({ index: i, price: candles[i].high });
    }
  }
  return swings;
}

function findSwingLows(candles: Candle[]): { index: number; price: number }[] {
  const swings: { index: number; price: number }[] = [];
  for (let i = 2; i < candles.length - 2; i++) {
    if (
      candles[i].low < candles[i - 1].low && candles[i].low < candles[i - 2].low &&
      candles[i].low < candles[i + 1].low && candles[i].low < candles[i + 2].low
    ) {
      swings.push({ index: i, price: candles[i].low });
    }
  }
  return swings;
}

export const priceActionEngine: EngineFn = (symbol, candles) => {
  const n = candles.length;
  const last = candles[n - 1];
  const atrArr = atr(candles, 14);
  const atrVal = atrArr[n - 1] || (last.high - last.low);

  const swingHighs = findSwingHighs(candles);
  const swingLows = findSwingLows(candles);
  if (swingHighs.length === 0 && swingLows.length === 0) return NO_TRADE_BASE(symbol, 'priceaction', candles, atrVal);

  // Most recent swing high = resistance, most recent swing low = support
  const lastSwingHigh = swingHighs[swingHighs.length - 1];
  const lastSwingLow = swingLows[swingLows.length - 1];

  // BUY: price closes above resistance, then within 5 bars pulls back to within 0.3% and closes back above
  if (lastSwingHigh) {
    const level = lastSwingHigh.price;
    const breakoutBarIdx = findBreakoutBar(candles, lastSwingHigh.index, level, 'up');
    if (breakoutBarIdx !== -1) {
      const retest = findRetest(candles, breakoutBarIdx, level, 0.003, 'up', 5);
      if (retest) {
        const precision = 1 - Math.min(1, retest.distPct / 0.003);
        const score = clampScore(55 + precision * 40);
        const entry = last.close;
        const sl = entry - 1.5 * atrVal;
        const tp = entry + 2.5 * atrVal;
        return { symbol, strategy: 'priceaction', direction: 'BUY', score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
          reason: `Price broke above swing high (${fmt(level)}) and retested within ${(retest.distPct * 100).toFixed(2)}% — bullish retest confirmed.`, time: last.time };
      }
    }
  }

  // SELL: mirror at support
  if (lastSwingLow) {
    const level = lastSwingLow.price;
    const breakoutBarIdx = findBreakoutBar(candles, lastSwingLow.index, level, 'down');
    if (breakoutBarIdx !== -1) {
      const retest = findRetest(candles, breakoutBarIdx, level, 0.003, 'down', 5);
      if (retest) {
        const precision = 1 - Math.min(1, retest.distPct / 0.003);
        const score = clampScore(55 + precision * 40);
        const entry = last.close;
        const sl = entry + 1.5 * atrVal;
        const tp = entry - 2.5 * atrVal;
        return { symbol, strategy: 'priceaction', direction: 'SELL', score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
          reason: `Price broke below swing low (${fmt(level)}) and retested within ${(retest.distPct * 100).toFixed(2)}% — bearish retest confirmed.`, time: last.time };
      }
    }
  }

  return NO_TRADE_BASE(symbol, 'priceaction', candles, atrVal);
};

function findBreakoutBar(candles: Candle[], afterIdx: number, level: number, dir: 'up' | 'down'): number {
  for (let i = afterIdx + 1; i < candles.length; i++) {
    if (dir === 'up' && candles[i].close > level) return i;
    if (dir === 'down' && candles[i].close < level) return i;
  }
  return -1;
}

function findRetest(candles: Candle[], breakoutIdx: number, level: number, tolerance: number, dir: 'up' | 'down', maxBars: number): { distPct: number } | null {
  for (let i = breakoutIdx + 1; i < Math.min(candles.length, breakoutIdx + 1 + maxBars); i++) {
    const distPct = Math.abs(candles[i].low - level) / level;
    if (dir === 'up' && candles[i].low <= level * (1 + tolerance) && candles[i].close > level) {
      return { distPct };
    }
    if (dir === 'down' && candles[i].high >= level * (1 - tolerance) && candles[i].close < level) {
      return { distPct };
    }
  }
  return null;
}

// ---- Order Flow (proxy): CVD + VWAP + volume aggression ----
function computeVWAP(candles: Candle[], lookback: number): number {
  let pv = 0, vol = 0;
  const start = Math.max(0, candles.length - lookback);
  for (let i = start; i < candles.length; i++) {
    const tp = (candles[i].high + candles[i].low + candles[i].close) / 3;
    pv += tp * candles[i].volume;
    vol += candles[i].volume;
  }
  return vol > 0 ? pv / vol : candles[candles.length - 1].close;
}

export const orderFlowEngine: EngineFn = (symbol, candles) => {
  const n = candles.length;
  const last = candles[n - 1];
  const atrArr = atr(candles, 14);
  const atrVal = atrArr[n - 1] || (last.high - last.low);

  if (n < 20) return NO_TRADE_BASE(symbol, 'orderflow', candles, atrVal);

  // Proxy CVD: cumulative sum of ±volume over last 20 bars
  let cvd = 0;
  const cvdSeries: number[] = [];
  for (let i = n - 20; i < n; i++) {
    cvd += candles[i].close > candles[i].open ? candles[i].volume : -candles[i].volume;
    cvdSeries.push(cvd);
  }

  // CVD rising over last 5 bars?
  const cvdRising = cvdSeries.length >= 5 && cvdSeries[cvdSeries.length - 1] > cvdSeries[cvdSeries.length - 5];
  const cvdFalling = cvdSeries.length >= 5 && cvdSeries[cvdSeries.length - 1] < cvdSeries[cvdSeries.length - 5];

  const vwap = computeVWAP(candles, 20);

  // Volume aggression: current bar volume > 1.3x 20-bar average
  const avgVol = candles.slice(n - 20).reduce((s, c) => s + c.volume, 0) / 20;
  const volAggression = last.volume > avgVol * 1.3;

  const priceAboveVwap = last.close > vwap;
  const priceBelowVwap = last.close < vwap;

  const buyCond = cvdRising && priceAboveVwap && volAggression;
  const sellCond = cvdFalling && priceBelowVwap && volAggression;

  if (!buyCond && !sellCond) return NO_TRADE_BASE(symbol, 'orderflow', candles, atrVal);

  const dir = buyCond ? 'BUY' : 'SELL';

  // Score: alignment strength of all 3 conditions
  const cvdStrength = Math.abs(cvdSeries[cvdSeries.length - 1] - cvdSeries[cvdSeries.length - 5]) / Math.max(avgVol * 5, 1);
  const vwapDist = Math.abs(last.close - vwap) / vwap;
  const volRatio = last.volume / Math.max(avgVol, 1);
  let score = 45 + Math.min(cvdStrength * 200, 20) + Math.min(vwapDist * 300, 15) + Math.min((volRatio - 1.3) * 50, 15);
  score = clampScore(score);

  const entry = last.close;
  const sl = dir === 'BUY' ? entry - 1.5 * atrVal : entry + 1.5 * atrVal;
  const tp = dir === 'BUY' ? entry + 2.5 * atrVal : entry - 2.5 * atrVal;

  return {
    symbol, strategy: 'orderflow', direction: dir, score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
    reason: `Proxy CVD ${dir === 'BUY' ? 'rising' : 'falling'}, price ${dir === 'BUY' ? 'above' : 'below'} VWAP (${fmt(vwap)}), volume ${volRatio.toFixed(1)}x avg — proxy order flow confirms ${dir === 'BUY' ? 'buying' : 'selling'} pressure.`,
    time: last.time,
  };
};

// ---- Range Trading: 30-bar range with rejection / false-breakout fade ----
export const rangeEngine: EngineFn = (symbol, candles) => {
  const n = candles.length;
  const last = candles[n - 1];
  const atrArr = atr(candles, 14);
  const atrVal = atrArr[n - 1] || (last.high - last.low);

  if (n < 30) return NO_TRADE_BASE(symbol, 'range', candles, atrVal);

  const lookback = candles.slice(n - 30);
  const rangeHigh = Math.max(...lookback.map((c) => c.high));
  const rangeLow = Math.min(...lookback.map((c) => c.low));
  const rangeSize = rangeHigh - rangeLow;
  const rangePct = rangeSize / last.close;

  // Must be ranging: (high - low) / price <= 3%
  if (rangePct > 0.03) return NO_TRADE_BASE(symbol, 'range', candles, atrVal);

  // Force NO TRADE if ATR(14) > 1.5x its 20-period average (volatility expanding)
  if (n >= 34) {
    const atrSlice = atrArr.slice(n - 20);
    const validAtr = atrSlice.filter((v) => !Number.isNaN(v));
    if (validAtr.length > 0) {
      const avgAtr = validAtr.reduce((s, v) => s + v, 0) / validAtr.length;
      if (atrVal > avgAtr * 1.5) return NO_TRADE_BASE(symbol, 'range', candles, atrVal);
    }
  }

  const midpoint = (rangeHigh + rangeLow) / 2;
  const tolerance = 0.002; // 0.2%

  // False-breakout fade: price closed outside range within last 2 bars, then closed back inside
  for (let i = n - 2; i < n; i++) {
    if (candles[i].close < rangeLow && last.close > rangeLow) {
      const entry = last.close;
      const sl = entry - 1.5 * atrVal;
      const tp = entry + 2.5 * atrVal;
      const score = clampScore(58);
      return { symbol, strategy: 'range', direction: 'BUY', score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
        reason: `False breakdown below range low (${fmt(rangeLow)}) — price closed back inside, fade reversal long.`, time: last.time };
    }
    if (candles[i].close > rangeHigh && last.close < rangeHigh) {
      const entry = last.close;
      const sl = entry + 1.5 * atrVal;
      const tp = entry - 2.5 * atrVal;
      const score = clampScore(58);
      return { symbol, strategy: 'range', direction: 'SELL', score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
        reason: `False breakout above range high (${fmt(rangeHigh)}) — price closed back inside, fade reversal short.`, time: last.time };
    }
  }

  // BUY: price touched within 0.2% of range low and closed back above
  if (last.low <= rangeLow * (1 + tolerance) && last.close > rangeLow) {
    const entry = last.close;
    const sl = entry - 1.5 * atrVal;
    const tp = entry + 2.5 * atrVal;
    const proximity = 1 - Math.min(1, Math.abs(last.low - rangeLow) / (rangeLow * tolerance));
    const score = clampScore(50 + proximity * 20);
    return { symbol, strategy: 'range', direction: 'BUY', score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
      reason: `Price rejected at range low (${fmt(rangeLow)}) — range bounce long, midpoint target ${fmt(midpoint)}.`, time: last.time };
  }

  // SELL: price touched within 0.2% of range high and closed back below
  if (last.high >= rangeHigh * (1 - tolerance) && last.close < rangeHigh) {
    const entry = last.close;
    const sl = entry + 1.5 * atrVal;
    const tp = entry - 2.5 * atrVal;
    const proximity = 1 - Math.min(1, Math.abs(last.high - rangeHigh) / (rangeHigh * tolerance));
    const score = clampScore(50 + proximity * 20);
    return { symbol, strategy: 'range', direction: 'SELL', score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
      reason: `Price rejected at range high (${fmt(rangeHigh)}) — range fade short, midpoint target ${fmt(midpoint)}.`, time: last.time };
  }

  return NO_TRADE_BASE(symbol, 'range', candles, atrVal);
};

// ---- Momentum: displacement bar + shallow pullback ----
export const momentumEngine: EngineFn = (symbol, candles) => {
  const n = candles.length;
  const last = candles[n - 1];
  const atrArr = atr(candles, 14);
  const atrVal = atrArr[n - 1] || (last.high - last.low);

  if (n < 12) return NO_TRADE_BASE(symbol, 'momentum', candles, atrVal);

  // Find displacement bar: body > 1.5x average body of prior 10 candles
  const lookback = candles.slice(n - 11, n - 1); // 10 bars before last
  const avgBody = lookback.reduce((s, c) => s + Math.abs(c.close - c.open), 0) / 10;
  const avgVol = lookback.reduce((s, c) => s + c.volume, 0) / 10;

  // Check bars from most recent going back up to 5 for a displacement bar
  for (let i = n - 1; i >= Math.max(n - 5, 11); i--) {
    const bar = candles[i];
    const body = Math.abs(bar.close - bar.open);
    const isBullish = bar.close > bar.open;
    const isBearish = bar.close < bar.open;
    if (body <= avgBody * 1.5) continue;
    if (bar.volume <= avgVol * 1.3) continue;

    // Displacement bar found — check pullback in subsequent bars
    const dispRange = bar.high - bar.low;
    const retracementLevel = isBullish ? bar.high - dispRange * 0.5 : bar.low + dispRange * 0.5;

    let pullbackValid = false;
    let pullbackPct = 1; // how much of the displacement was retraced (lower = better)
    for (let j = i + 1; j < n; j++) {
      if (isBullish) {
        const retraced = (bar.high - candles[j].low) / dispRange;
        if (candles[j].low <= retracementLevel && candles[j].close > retracementLevel) {
          pullbackValid = true;
          pullbackPct = Math.min(pullbackPct, retraced);
        }
      } else {
        const retraced = (candles[j].high - bar.low) / dispRange;
        if (candles[j].high >= retracementLevel && candles[j].close < retracementLevel) {
          pullbackValid = true;
          pullbackPct = Math.min(pullbackPct, retraced);
        }
      }
    }

    if (!pullbackValid) continue;

    const dir = isBullish ? 'BUY' : 'SELL';
    const displacementStrength = body / Math.max(avgBody, 1e-9);
    const shallowness = 1 - Math.min(1, pullbackPct / 0.5);
    let score = 50 + Math.min((displacementStrength - 1.5) * 30, 25) + shallowness * 20;
    score = clampScore(score);

    const entry = last.close;
    const sl = dir === 'BUY' ? entry - 1.5 * atrVal : entry + 1.5 * atrVal;
    const tp = dir === 'BUY' ? entry + 2.5 * atrVal : entry - 2.5 * atrVal;

    return {
      symbol, strategy: 'momentum', direction: dir, score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
      reason: `Displacement bar (${displacementStrength.toFixed(1)}x avg body, ${dir === 'BUY' ? 'bullish' : 'bearish'}) with volume ${bar.volume > 0 ? (bar.volume / Math.max(avgVol, 1)).toFixed(1) : '—'}x avg. Pullback retraced ${(pullbackPct * 100).toFixed(0)}% — ${dir === 'BUY' ? 'shallow pullback held above 50% level' : 'shallow pullback held below 50% level'}.`,
      time: last.time,
    };
  }

  return NO_TRADE_BASE(symbol, 'momentum', candles, atrVal);
};

// ---- Liquidity / SMC: equal highs/lows, sweeps, and BOS ----
function findLiquidityPools(swings: { index: number; price: number }[], tolerance: number): { index: number; price: number }[] {
  const pools: { index: number; price: number }[] = [];
  for (let i = 0; i < swings.length; i++) {
    for (let j = i + 1; j < swings.length; j++) {
      if (Math.abs(swings[i].price - swings[j].price) / Math.max(swings[i].price, 1e-9) <= tolerance) {
        const avg = (swings[i].price + swings[j].price) / 2;
        pools.push({ index: Math.max(swings[i].index, swings[j].index), price: avg });
      }
    }
  }
  return pools;
}

export const liquidityEngine: EngineFn = (symbol, candles) => {
  const n = candles.length;
  const last = candles[n - 1];
  const atrArr = atr(candles, 14);
  const atrVal = atrArr[n - 1] || (last.high - last.low);

  const recentCandles = candles.slice(Math.max(0, n - 20));
  const swingHighs = findSwingHighs(recentCandles).map((s) => ({ ...s, index: s.index + Math.max(0, n - 20) }));
  const swingLows = findSwingLows(recentCandles).map((s) => ({ ...s, index: s.index + Math.max(0, n - 20) }));

  const highPools = findLiquidityPools(swingHighs, 0.0015);
  const lowPools = findLiquidityPools(swingLows, 0.0015);

  if (highPools.length === 0 && lowPools.length === 0) return NO_TRADE_BASE(symbol, 'liquidity', candles, atrVal);

  // Check for sweep of a low pool, then bullish BOS within 5 bars
  for (const pool of lowPools) {
    for (let i = pool.index; i < n; i++) {
      // Sweep: wick below pool level, close back above
      if (candles[i].low < pool.price && candles[i].close > pool.price) {
        // Look for bullish BOS (close above most recent swing high) within next 5 bars
        const recentSwingHigh = swingHighs.filter((s) => s.index < i).pop();
        if (recentSwingHigh) {
          for (let j = i; j < Math.min(n, i + 6); j++) {
            if (candles[j].close > recentSwingHigh.price) {
              const entry = last.close;
              const sl = pool.price - atrVal * 0.3; // SL beyond swept level
              const tp = entry + 2.5 * atrVal;
              // Find nearest opposing pool for TP, else use 2.5x ATR
              const opposingPool = highPools.filter((p) => p.price > entry).sort((a, b) => a.price - b.price)[0];
              const finalTp = opposingPool ? opposingPool.price : tp;
              const sweepPrecision = 1 - Math.min(1, Math.abs(candles[i].low - pool.price) / (pool.price * 0.003));
              let score = clampScore(55 + sweepPrecision * 25 + Math.min((j - i) === 0 ? 15 : 5, 15));
              return { symbol, strategy: 'liquidity', direction: 'BUY', score, entry, stopLoss: sl, takeProfit: finalTp, atr: atrVal,
                reason: `Liquidity sweep of equal lows (${fmt(pool.price)}) — wick below, close back above. Bullish BOS above swing high (${fmt(recentSwingHigh.price)}) confirms reversal.`, time: last.time };
            }
          }
        }
      }
    }
  }

  // Mirror: sweep of high pool, then bearish BOS
  for (const pool of highPools) {
    for (let i = pool.index; i < n; i++) {
      if (candles[i].high > pool.price && candles[i].close < pool.price) {
        const recentSwingLow = swingLows.filter((s) => s.index < i).pop();
        if (recentSwingLow) {
          for (let j = i; j < Math.min(n, i + 6); j++) {
            if (candles[j].close < recentSwingLow.price) {
              const entry = last.close;
              const sl = pool.price + atrVal * 0.3;
              const tp = entry - 2.5 * atrVal;
              const opposingPool = lowPools.filter((p) => p.price < entry).sort((a, b) => b.price - a.price)[0];
              const finalTp = opposingPool ? opposingPool.price : tp;
              const sweepPrecision = 1 - Math.min(1, Math.abs(candles[i].high - pool.price) / (pool.price * 0.003));
              let score = clampScore(55 + sweepPrecision * 25 + Math.min((j - i) === 0 ? 15 : 5, 15));
              return { symbol, strategy: 'liquidity', direction: 'SELL', score, entry, stopLoss: sl, takeProfit: finalTp, atr: atrVal,
                reason: `Liquidity sweep of equal highs (${fmt(pool.price)}) — wick above, close back below. Bearish BOS below swing low (${fmt(recentSwingLow.price)}) confirms reversal.`, time: last.time };
            }
          }
        }
      }
    }
  }

  return NO_TRADE_BASE(symbol, 'liquidity', candles, atrVal);
};

// ---- Market Structure: swing sequence HH/HL/LH/LL with continuation BOS ----
function classifySwings(highs: { index: number; price: number }[], lows: { index: number; price: number }[]) {
  const all = [
    ...highs.map((s) => ({ ...s, type: 'H' as const })),
    ...lows.map((s) => ({ ...s, type: 'L' as const })),
  ].sort((a, b) => a.index - b.index);
  const labels: { index: number; price: number; type: 'H' | 'L'; label: string }[] = [];
  for (let i = 0; i < all.length; i++) {
    const sameType = labels.filter((l) => l.type === all[i].type);
    if (sameType.length < 1) { labels.push({ ...all[i], label: 'INIT' }); continue; }
    const prev = sameType[sameType.length - 1];
    if (all[i].type === 'H') {
      labels.push({ ...all[i], label: all[i].price > prev.price ? 'HH' : 'LH' });
    } else {
      labels.push({ ...all[i], label: all[i].price > prev.price ? 'HL' : 'LL' });
    }
  }
  return labels;
}

export const marketStructureEngine: EngineFn = (symbol, candles) => {
  const n = candles.length;
  const last = candles[n - 1];
  const atrArr = atr(candles, 14);
  const atrVal = atrArr[n - 1] || (last.high - last.low);

  const swingHighs = findSwingHighs(candles);
  const swingLows = findSwingLows(candles);
  if (swingHighs.length < 2 || swingLows.length < 2) return NO_TRADE_BASE(symbol, 'marketstructure', candles, atrVal);

  const labeled = classifySwings(swingHighs, swingLows);
  const recentHighs = labeled.filter((l) => l.type === 'H').slice(-3);
  const recentLows = labeled.filter((l) => l.type === 'L').slice(-3);

  const bullishStructure = recentHighs.length >= 2 && recentLows.length >= 2 &&
    recentHighs[recentHighs.length - 1].label === 'HH' && recentLows[recentLows.length - 1].label === 'HL';
  const bearishStructure = recentHighs.length >= 2 && recentLows.length >= 2 &&
    recentHighs[recentHighs.length - 1].label === 'LH' && recentLows[recentLows.length - 1].label === 'LL';

  if (!bullishStructure && !bearishStructure) return NO_TRADE_BASE(symbol, 'marketstructure', candles, atrVal);

  // Change of Character: price broke the most recent HL (uptrend) or LH (downtrend)
  if (bullishStructure) {
    const lastHL = recentLows[recentLows.length - 1];
    if (last.close < lastHL.price) return NO_TRADE_BASE(symbol, 'marketstructure', candles, atrVal);
    // Continuation BOS: close above most recent HH
    const lastHH = recentHighs[recentHighs.length - 1];
    if (last.close > lastHH.price) {
      const consecutiveBull = recentHighs.filter((h) => h.label === 'HH').length + recentLows.filter((l) => l.label === 'HL').length;
      let score = clampScore(55 + Math.min(consecutiveBull * 8, 30));
      const entry = last.close;
      const sl = entry - 1.5 * atrVal;
      const tp = entry + 2.5 * atrVal;
      return { symbol, strategy: 'marketstructure', direction: 'BUY', score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
        reason: `Bullish market structure (HH+HL, ${consecutiveBull} consecutive). Continuation BOS above ${fmt(lastHH.price)}.`, time: last.time };
    }
  }

  if (bearishStructure) {
    const lastLH = recentHighs[recentHighs.length - 1];
    if (last.close > lastLH.price) return NO_TRADE_BASE(symbol, 'marketstructure', candles, atrVal);
    const lastLL = recentLows[recentLows.length - 1];
    if (last.close < lastLL.price) {
      const consecutiveBear = recentHighs.filter((h) => h.label === 'LH').length + recentLows.filter((l) => l.label === 'LL').length;
      let score = clampScore(55 + Math.min(consecutiveBear * 8, 30));
      const entry = last.close;
      const sl = entry + 1.5 * atrVal;
      const tp = entry - 2.5 * atrVal;
      return { symbol, strategy: 'marketstructure', direction: 'SELL', score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
        reason: `Bearish market structure (LH+LL, ${consecutiveBear} consecutive). Continuation BOS below ${fmt(lastLL.price)}.`, time: last.time };
    }
  }

  return NO_TRADE_BASE(symbol, 'marketstructure', candles, atrVal);
};

// ---- Quantitative Multi-Factor: weighted blend of normalized sub-scores ----
export const quantMultiEngine: EngineFn = (symbol, candles) => {
  const n = candles.length;
  const last = candles[n - 1];
  const atrArr = atr(candles, 14);
  const atrVal = atrArr[n - 1] || (last.high - last.low);

  if (n < 60) return NO_TRADE_BASE(symbol, 'quantmulti', candles, atrVal);

  const c = closes(candles);
  const e20 = ema(c, 20);
  const e50 = ema(c, 50);
  const e20Now = e20[n - 1];
  const e50Now = e50[n - 1];

  // 1. Trend alignment: EMA20 vs EMA50 spread strength (normalized 0-100)
  const spread = (e20Now - e50Now) / Math.max(e50Now, 1e-9);
  const trendRaw = 50 + Math.tanh(spread * 30) * 50; // -1..1 → 0..100
  const trendScore = Math.max(0, Math.min(100, trendRaw));

  // 2. Momentum: rate of change over 10 bars (normalized)
  const roc = (c[n - 1] - c[n - 11]) / Math.max(c[n - 11], 1e-9);
  const momentumScore = Math.max(0, Math.min(100, 50 + Math.tanh(roc * 25) * 50));

  // 3. Volatility regime: current ATR percentile vs 60-bar history
  const atrHistory = atrArr.slice(n - 60).filter((v) => !Number.isNaN(v));
  const atrPercentile = atrHistory.length > 0
    ? atrHistory.filter((v) => v <= atrVal).length / atrHistory.length * 100
    : 50;
  // Lower volatility regime = better for trending (inverse)
  const volScore = Math.max(0, Math.min(100, 100 - atrPercentile));

  // 4. Structure quality: count consecutive HH/HL or LH/LL
  const swingHighs = findSwingHighs(candles);
  const swingLows = findSwingLows(candles);
  const labeled = classifySwings(swingHighs, swingLows);
  const recentLabels = labeled.slice(-6);
  let bullCount = 0, bearCount = 0;
  for (const l of recentLabels) {
    if (l.label === 'HH' || l.label === 'HL') bullCount++;
    if (l.label === 'LH' || l.label === 'LL') bearCount++;
  }
  const structRaw = bullCount > bearCount ? 50 + (bullCount / recentLabels.length) * 50 : 50 - (bearCount / recentLabels.length) * 50;
  const structScore = Math.max(0, Math.min(100, structRaw));

  // 5. RR quality: distance to next key level / stop distance
  const stopDist = atrVal * 1.5;
  const rewardDist = atrVal * 2.5;
  const rrRaw = rewardDist / Math.max(stopDist, 1e-9);
  const rrScore = Math.max(0, Math.min(100, Math.min(rrRaw / 2, 1) * 100));

  // Weighted blend
  const blended = trendScore * 0.25 + momentumScore * 0.20 + volScore * 0.15 + structScore * 0.25 + rrScore * 0.15;

  // Direction = majority sign of weighted sub-scores (above 50 = bullish)
  const bullWeight = (trendScore > 50 ? 0.25 : 0) + (momentumScore > 50 ? 0.20 : 0) + (structScore > 50 ? 0.25 : 0) + (rrScore > 50 ? 0.15 : 0) + (volScore > 50 ? 0.15 : 0);
  const bearWeight = (trendScore < 50 ? 0.25 : 0) + (momentumScore < 50 ? 0.20 : 0) + (structScore < 50 ? 0.25 : 0) + (rrScore < 50 ? 0.15 : 0) + (volScore < 50 ? 0.15 : 0);

  if (blended < 50) return NO_TRADE_BASE(symbol, 'quantmulti', candles, atrVal);

  const dir = bullWeight >= bearWeight ? 'BUY' : 'SELL';
  const score = clampScore(blended);

  const entry = last.close;
  const sl = dir === 'BUY' ? entry - 1.5 * atrVal : entry + 1.5 * atrVal;
  const tp = dir === 'BUY' ? entry + 2.5 * atrVal : entry - 2.5 * atrVal;

  return {
    symbol, strategy: 'quantmulti', direction: dir, score, entry, stopLoss: sl, takeProfit: tp, atr: atrVal,
    reason: `Multi-factor blend ${score}/100 — trend ${trendScore.toFixed(0)} (${(0.25 * 100).toFixed(0)}%), momentum ${momentumScore.toFixed(0)} (${(0.20 * 100).toFixed(0)}%), vol regime ${volScore.toFixed(0)} (${(0.15 * 100).toFixed(0)}%), structure ${structScore.toFixed(0)} (${(0.25 * 100).toFixed(0)}%), RR ${rrScore.toFixed(0)} (${(0.15 * 100).toFixed(0)}%).`,
    time: last.time,
  };
};

export const ENGINES: Record<StrategyId, { fn: EngineFn; name: string; short: string }> = {
  trend: { fn: trendEngine, name: 'Trend Following', short: 'EMA20/EMA50' },
  breakout: { fn: breakoutEngine, name: 'Breakout + Retest', short: '20-bar high/low' },
  meanrev: { fn: meanRevEngine, name: 'Mean Reversion', short: 'SMA(20) deviation' },
  priceaction: { fn: priceActionEngine, name: 'Price Action', short: 'Swing retest' },
  orderflow: { fn: orderFlowEngine, name: 'Order Flow (Proxy)', short: 'CVD+VWAP proxy' },
  range: { fn: rangeEngine, name: 'Range Trading', short: '30-bar range' },
  momentum: { fn: momentumEngine, name: 'Momentum', short: 'Displacement' },
  liquidity: { fn: liquidityEngine, name: 'Liquidity / SMC', short: 'SMC sweeps' },
  marketstructure: { fn: marketStructureEngine, name: 'Market Structure', short: 'HH/HL structure' },
  quantmulti: { fn: quantMultiEngine, name: 'Quantitative Multi-Factor', short: 'Multi-factor blend' },
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
