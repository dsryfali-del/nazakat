import { useEffect, useState, useMemo } from 'react';
import { SYMBOLS } from '@/lib/symbols';
import { generateSeries } from '@/lib/data';
import { fetchCandles } from '@/lib/marketData';
import { runEngine } from '@/lib/strategies';
import type { Signal, StrategyId, Candle } from '@/lib/types';

// Scan the entire watchlist with all three engines and return every signal.
// This module provides both a synchronous hook (useAllSignals — returns
// Signal[] from demo data, for Dashboard/Markets) and an async hook
// (useAllSignalsAsync — fetches real Twelve Data with fallback, for
// Strategies). Both share the same engine logic.

const ENGINE_IDS: StrategyId[] = ['trend', 'breakout', 'meanrev'];

type AsyncSignalsState = {
  signals: Signal[];
  source: 'live' | 'demo' | 'loading';
};

// Synchronous hook — returns demo signals immediately. Used by Dashboard and
// Markets which don't need the live/demo badge.
export function useAllSignals(): Signal[] {
  return useMemo(() => computeSyncSignals(), []);
}

// Async hook — fetches real market data via Twelve Data with silent fallback
// to demo data. Returns signals, the data source, and a loading flag. Used by
// the Strategies page where the live/demo badge matters.
export function useAllSignalsAsync(): AsyncSignalsState {
  const [state, setState] = useState<AsyncSignalsState>({
    signals: computeSyncSignals(),
    source: 'loading',
  });

  useEffect(() => {
    let cancelled = false;

    // Start with synchronous demo data so the UI is populated immediately.
    setState({ signals: computeSyncSignals(), source: 'loading' });

    (async () => {
      const results = await Promise.all(
        SYMBOLS.map((s) => fetchCandles(s.symbol, 'H1', 220)),
      );

      if (cancelled) return;

      const out: Signal[] = [];
      let anyLive = false;

      for (let i = 0; i < SYMBOLS.length; i++) {
        const res = results[i];
        const candles: Candle[] = res.candles.length > 55 ? res.candles : generateSeries(SYMBOLS[i].symbol);
        if (res.source === 'live') anyLive = true;
        for (const eid of ENGINE_IDS) {
          out.push(runEngine(eid, SYMBOLS[i].symbol, candles));
        }
      }

      if (cancelled) return;
      setState({ signals: out, source: anyLive ? 'live' : 'demo' });
    })();

    return () => { cancelled = true; };
  }, []);

  return state;
}

function computeSyncSignals(): Signal[] {
  const out: Signal[] = [];
  for (const s of SYMBOLS) {
    const candles = generateSeries(s.symbol);
    for (const eid of ENGINE_IDS) {
      out.push(runEngine(eid, s.symbol, candles));
    }
  }
  return out;
}

// Active (tradeable) setups only, ranked by score descending.
export function activeSignals(signals: Signal[]): Signal[] {
  return signals
    .filter((s) => s.direction !== 'NO TRADE')
    .sort((a, b) => b.score - a.score);
}

// The single highest-scoring A+ setup (score >= 80), or null.
export function topOpportunity(signals: Signal[]): Signal | null {
  return activeSignals(signals).find((s) => s.score >= 80) ?? null;
}
