import type { Candle, SymbolMeta } from './types';
import { SYMBOL_MAP } from './symbols';

// Deterministic seeded PRNG (mulberry32). Same seed → same series every run,
// so backtests are reproducible and the UI is stable across reloads.
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashString(str: string): number {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

// Seed incorporates symbol + a fixed "day" so the series is stable for a session
// but differs meaningfully between symbols. We anchor to a fixed epoch so the
// dataset is identical across reloads (pure demo data, not live).
const SEED_EPOCH = 1717200000000; // 2024-06-01
const BAR_MS = 60 * 60 * 1000; // hourly candles

// Cache generated series per symbol for the session.
const cache = new Map<string, Candle[]>();

/**
 * Generate deterministic mock OHLC candle data for a symbol.
 * This is the single data-fetching seam in the app — swap this function's body
 * for a real API call and every strategy / risk / backtest module keeps working.
 * Data is labeled "Demo data" everywhere it is presented.
 */
export function generateSeries(symbol: string, bars = 220): Candle[] {
  const meta = SYMBOL_MAP[symbol];
  if (!meta) throw new Error(`Unknown symbol: ${symbol}`);

  const cached = cache.get(symbol);
  if (cached && cached.length >= bars) return cached.slice(0, bars);

  const seed = hashString(symbol) ^ 0x9e3779b9;
  const rand = mulberry32(seed);

  // Build a gentle trend + noise random walk so strategies have something to find.
  const candles: Candle[] = [];
  let price = meta.basePrice * (0.85 + rand() * 0.3); // start near base, varied
  const vol = meta.volatility;
  // slow-moving drift component so trend-following can detect regimes
  let drift = 0;
  let driftPhase = 0;

  for (let i = 0; i < bars; i++) {
    // Occasionally shift the drift regime to create trend + range sections.
    if (i % 34 === 0) {
      driftPhase = (rand() - 0.5) * vol * 0.35;
    }
    drift = drift * 0.92 + driftPhase * 0.08;

    const shock = (rand() - 0.5) * 2 * vol * price;
    const open = price;
    const close = Math.max(0.0001, price + shock + drift * price);
    const wickUp = Math.abs(rand() - 0.5) * vol * price * 0.9;
    const wickDn = Math.abs(rand() - 0.5) * vol * price * 0.9;
    const high = Math.max(open, close) + wickUp;
    const low = Math.min(open, close) - wickDn;

    candles.push({
      time: SEED_EPOCH + i * BAR_MS,
      open,
      high,
      low,
      close,
      volume: Math.round(500 + rand() * 4500),
    });
    price = close;
  }

  cache.set(symbol, candles);
  return candles.slice(0, bars);
}

export function lastPrice(symbol: string): number {
  const s = generateSeries(symbol, 1);
  return s[s.length - 1]?.close ?? SYMBOL_MAP[symbol]?.basePrice ?? 0;
}

export function meta(symbol: string): SymbolMeta {
  return SYMBOL_MAP[symbol];
}
