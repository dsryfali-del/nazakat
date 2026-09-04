import type { Candle } from './types';
import { SYMBOL_MAP } from './symbols';
import { generateSeries } from './data';

// Twelve Data integration layer. The browser calls our Supabase edge function
// (which holds the server-side API key) and falls back to the mock generator
// on any failure. This is the async seam the Charts / Backtesting / Strategies
// pages use; generateSeries remains the synchronous mock fallback.

export type Timeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: 'M1', label: '1 min' },
  { id: 'M5', label: '5 min' },
  { id: 'M15', label: '15 min' },
  { id: 'H1', label: '1 hour' },
  { id: 'H4', label: '4 hour' },
  { id: 'D1', label: 'Daily' },
];

// Map our internal symbol → Twelve Data symbol.
export function tdSymbol(symbol: string): string {
  const map: Record<string, string> = {
    XAUUSD: 'XAU/USD',
    XAGUSD: 'XAG/USD',
    AUDUSD: 'AUD/USD',
    USDCAD: 'USD/CAD',
    USDJPY: 'USD/JPY',
    GBPUSD: 'GBP/USD',
    BTCUSD: 'BTC/USD',
    US500: 'SPY', // SPX is often premium-only; SPY is on the free tier
  };
  return map[symbol] ?? symbol; // stocks pass through unchanged
}

// Map our internal timeframe → Twelve Data interval.
export function tdInterval(tf: Timeframe): string {
  const map: Record<Timeframe, string> = {
    M1: '1min',
    M5: '5min',
    M15: '15min',
    H1: '1h',
    H4: '4h',
    D1: '1day',
  };
  return map[tf];
}

// Approximate milliseconds per bar, used to synthesize timestamps for mock
// fallback data when a timeframe is requested (so charts stay time-aware).
export function timeframeMs(tf: Timeframe): number {
  const map: Record<Timeframe, number> = {
    M1: 60 * 1000,
    M5: 5 * 60 * 1000,
    M15: 15 * 60 * 1000,
    H1: 60 * 60 * 1000,
    H4: 4 * 60 * 60 * 1000,
    D1: 24 * 60 * 60 * 1000,
  };
  return map[tf];
}

export type FetchResult = {
  candles: Candle[];
  source: 'live' | 'demo';
};

const EDGE_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/twelve-data`;
const HEADERS = {
  Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'Content-Type': 'application/json',
};

// In-memory cache for the session so repeated navigations don't refetch.
const cache = new Map<string, FetchResult>();

/**
 * Fetch candle data for a symbol + timeframe. Tries the live Twelve Data edge
 * function first; on any error (network, rate limit, missing key, malformed
 * response) silently falls back to the deterministic mock generator. Never
 * throws — always returns candles + a source flag.
 */
export async function fetchCandles(
  symbol: string,
  timeframe: Timeframe = 'H1',
  outputsize = 500,
  bypassCache = false,
): Promise<FetchResult> {
  const key = `${symbol}:${timeframe}:${outputsize}`;
  if (!bypassCache) {
    const cached = cache.get(key);
    if (cached) return cached;
  }

  try {
    const url = new URL(EDGE_URL);
    url.searchParams.set('symbol', tdSymbol(symbol));
    url.searchParams.set('interval', tdInterval(timeframe));
    url.searchParams.set('outputsize', String(outputsize));

    const resp = await fetch(url.toString(), { headers: HEADERS });
    if (!resp.ok) throw new Error(`edge function status ${resp.status}`);

    const json = await resp.json();
    if (json.error || !json.values || !Array.isArray(json.values)) {
      throw new Error(json.error || 'no values in response');
    }

    // Twelve Data returns newest-first; reverse to oldest-first for our engines.
    const candles: Candle[] = json.values
      .map((v: { datetime: string; open: string; high: string; low: string; close: string; volume?: string }) => ({
        time: new Date(v.datetime + 'Z').getTime(),
        open: parseFloat(v.open),
        high: parseFloat(v.high),
        low: parseFloat(v.low),
        close: parseFloat(v.close),
        volume: v.volume ? parseInt(v.volume, 10) : 0,
      }))
      .filter((c: Candle) => isFinite(c.open) && isFinite(c.close))
      .reverse();

    if (candles.length === 0) throw new Error('empty candle array');

    const result: FetchResult = { candles, source: 'live' };
    cache.set(key, result);
    return result;
  } catch {
    // Silent fallback — never surface errors to the user.
    const candles = generateMockForTimeframe(symbol, timeframe, outputsize);
    const result: FetchResult = { candles, source: 'demo' };
    cache.set(key, result);
    return result;
  }
}

// Generate mock data for a specific timeframe (time-aware version of the
// existing generator). Used as the fallback when live data is unavailable.
function generateMockForTimeframe(symbol: string, tf: Timeframe, bars: number): Candle[] {
  const meta = SYMBOL_MAP[symbol];
  if (!meta) return generateSeries(symbol, bars);

  // Reuse the existing generator's shape but stamp real timeframe timestamps.
  const base = generateSeries(symbol, Math.max(bars, 220));
  const barMs = timeframeMs(tf);
  const now = Date.now();
  const start = now - base.length * barMs;
  return base.slice(-bars).map((c, i) => ({
    ...c,
    time: start + i * barMs,
  }));
}

// Convenience: fetch with a date range (used by Backtesting). We pull a large
// outputsize and then slice by the requested dates client-side.
export async function fetchCandlesForRange(
  symbol: string,
  timeframe: Timeframe,
  fromMs: number,
  toMs: number,
): Promise<FetchResult> {
  // Estimate bars needed for the range; cap at Twelve Data max outputsize.
  const span = toMs - fromMs;
  const approxBars = Math.min(5000, Math.ceil(span / timeframeMs(timeframe)) + 60);
  const res = await fetchCandles(symbol, timeframe, approxBars);
  const filtered = res.candles.filter((c) => c.time >= fromMs && c.time <= toMs);
  return { candles: filtered.length > 20 ? filtered : res.candles, source: res.source };
}
