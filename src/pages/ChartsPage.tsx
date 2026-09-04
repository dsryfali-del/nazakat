import { useEffect, useMemo, useState } from 'react';
import { SYMBOLS, SYMBOL_MAP, ASSET_CLASS_LABEL } from '@/lib/symbols';
import { closes, ema } from '@/lib/indicators';
import { decimalsFor, fmtPrice, fmtPct } from '@/lib/format';
import { fetchCandles, TIMEFRAMES, type Timeframe } from '@/lib/marketData';
import { CandlestickChart } from '@/components/CandlestickChart';
import { DataBadge, Disclaimer, SectionTitle } from '@/components/ui';
import type { Candle } from '@/lib/types';

export function ChartsPage() {
  const [symbol, setSymbol] = useState(SYMBOLS[0].symbol);
  const [timeframe, setTimeframe] = useState<Timeframe>('H1');
  const [showEma, setShowEma] = useState(true);
  const [candles, setCandles] = useState<Candle[]>([]);
  const [source, setSource] = useState<'live' | 'demo' | 'loading'>('loading');

  useEffect(() => {
    let cancelled = false;
    setSource('loading');

    const load = async (bypass = false) => {
      const res = await fetchCandles(symbol, timeframe, 500, bypass);
      if (cancelled) return;
      setCandles(res.candles);
      setSource(res.source);
    };

    load(false);

    const interval = setInterval(() => load(true), 45_000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [symbol, timeframe]);

  const { e20, e50, last, prevClose, changePct } = useMemo(() => {
    if (candles.length < 2) {
      const z = 0;
      return { e20: [z], e50: [z], last: 0, prevClose: 0, changePct: 0 };
    }
    const c = closes(candles);
    const e20 = ema(c, 20);
    const e50 = ema(c, 50);
    const last = c[c.length - 1];
    const prevClose = c[c.length - 2] ?? last;
    return { e20, e50, last, prevClose, changePct: ((last - prevClose) / prevClose) * 100 };
  }, [candles]);

  const d = decimalsFor(symbol);
  const meta = SYMBOL_MAP[symbol];
  const up = changePct >= 0;
  const overlays = useMemo(() => {
    if (!showEma || candles.length === 0) return [];
    return [
      { values: e20, color: '#14b8a6', title: 'EMA20' },
      { values: e50, color: '#f43f5e', title: 'EMA50' },
    ];
  }, [showEma, e20, e50, candles.length]);

  return (
    <div className="fade-in space-y-6">
      <SectionTitle
        title="Charts"
        subtitle="Candlestick chart with EMA20/EMA50 overlay — real market data when available."
        right={<DataBadge source={source} />}
      />

      <div className="card">
        <div className="card-header flex-wrap gap-3">
          <div className="flex items-center gap-3 flex-wrap">
            <select className="input min-w-[14rem]" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.label}</option>)}
            </select>
            <select className="input w-auto" value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)}>
              {TIMEFRAMES.map((tf) => <option key={tf.id} value={tf.id}>{tf.label}</option>)}
            </select>
            <button
              onClick={() => setShowEma((v) => !v)}
              className={`btn text-xs ${showEma ? 'bg-accent-600/20 text-accent-300 border border-accent-500/40' : 'bg-terminal-750 text-slate-400 border border-terminal-700 hover:text-slate-200'}`}
            >
              EMA20/50
            </button>
            <div>
              <div className="text-sm text-slate-500">{meta?.label} · {ASSET_CLASS_LABEL[meta?.assetClass ?? 'forex']}</div>
              <div className="mono text-lg font-semibold text-slate-100">
                {fmtPrice(last, d)} <span className={up ? 'text-bull-400' : 'text-bear-400'}>{fmtPct(changePct)}</span>
              </div>
            </div>
          </div>
          {showEma && (
            <div className="flex items-center gap-4 text-xs">
              <Legend color="#14b8a6" label="EMA20" />
              <Legend color="#f43f5e" label="EMA50" />
            </div>
          )}
        </div>
        <div className="p-4">
          {candles.length > 0 ? (
            <CandlestickChart candles={candles} overlays={overlays} height={360} decimals={d} />
          ) : (
            <div className="flex items-center justify-center text-sm text-slate-500" style={{ height: 360 }}>
              Loading chart…
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Info label="Last" value={fmtPrice(last, d)} />
        <Info label="EMA20" value={e20.length > 0 ? fmtPrice(e20[e20.length - 1], d) : '—'} tone={last >= (e20[e20.length - 1] ?? 0) ? 'bull' : 'bear'} />
        <Info label="EMA50" value={e50.length > 0 ? fmtPrice(e50[e50.length - 1], d) : '—'} tone={last >= (e50[e50.length - 1] ?? 0) ? 'bull' : 'bear'} />
        <Info label="Trend Bias" value={e20.length > 0 && e50.length > 0 ? (e20[e20.length - 1] > e50[e50.length - 1] ? 'Bullish (E20>E50)' : 'Bearish (E20<E50)') : '—'} tone={e20.length > 0 && e50.length > 0 && e20[e20.length - 1] > e50[e50.length - 1] ? 'bull' : 'bear'} />
      </div>
      <Disclaimer />
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-1.5 text-slate-400">
      <span className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}

function Info({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'bull' | 'bear' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-200';
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">{label}</div>
      <div className={`mono text-sm font-medium ${color}`}>{value}</div>
    </div>
  );
}
