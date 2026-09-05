import { useEffect, useMemo, useState } from 'react';
import { FlaskConical, Play, Layers, DollarSign } from 'lucide-react';
import { SYMBOLS } from '@/lib/symbols';
import { runBacktest } from '@/lib/risk';
import { fetchCandlesForRange, TIMEFRAMES, type Timeframe } from '@/lib/marketData';
import { LineChart } from '@/components/LineChart';
import { fmtR } from '@/lib/format';
import { STRATEGY_LABEL } from '@/lib/labels';
import { DataBadge, Disclaimer, SectionTitle } from '@/components/ui';
import type { BacktestResult, Candle, StrategyId } from '@/lib/types';

const ENGINE_IDS: StrategyId[] = ['trend', 'breakout', 'meanrev'];

// Default date range: last 2 years of daily data.
const now = new Date();
const TODAY = new Date(now.getFullYear(), now.getMonth(), now.getDate());
const TWO_YEARS_AGO = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate());
function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Walk-forward split: 60% Training, 20% Validation, 20% Out-of-Sample.
type Phase = { name: string; start: number; end: number; color: string };

export function BacktestPage() {
  const [symbol, setSymbol] = useState(SYMBOLS[0].symbol);
  const [strategy, setStrategy] = useState<StrategyId>('trend');
  const [timeframe, setTimeframe] = useState<Timeframe>('D1');
  const [fromDate, setFromDate] = useState(toInputDate(TWO_YEARS_AGO));
  const [toDate, setToDate] = useState(toInputDate(TODAY));

  const [candles, setCandles] = useState<Candle[]>([]);
  const [source, setSource] = useState<'live' | 'demo' | 'loading'>('loading');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<WalkForwardResult | null>(null);
  const [ran, setRan] = useState(false);
  const [includeCosts, setIncludeCosts] = useState(true);

  // Fetch candle data when symbol/timeframe/date-range changes.
  useEffect(() => {
    let cancelled = false;
    setSource('loading');
    setCandles([]);
    (async () => {
      const fromMs = new Date(fromDate + 'T00:00:00Z').getTime();
      const toMs = new Date(toDate + 'T23:59:59Z').getTime();
      const res = await fetchCandlesForRange(symbol, timeframe, fromMs, toMs);
      if (cancelled) return;
      setCandles(res.candles);
      setSource(res.source);
    })();
    return () => { cancelled = true; };
  }, [symbol, timeframe, fromDate, toDate]);

  const run = () => {
    if (candles.length < 60) return;
    setRunning(true);
    // Defer so the UI can show a running state.
    setTimeout(() => {
      const wf = runWalkForward(symbol, candles, strategy, includeCosts);
      setResult(wf);
      setRan(true);
      setRunning(false);
    }, 50);
  };

  return (
    <div className="fade-in space-y-6">
      <SectionTitle
        title="Backtesting Lab"
        subtitle="MT5-style walk-forward testing: Train / Validate / Out-of-Sample split."
        right={<DataBadge source={source} />}
      />

      {/* Controls */}
      <div className="card p-4">
        <div className="flex flex-wrap items-end gap-4">
          <div className="min-w-[10rem]">
            <label className="label">Symbol</label>
            <select className="input" value={symbol} onChange={(e) => setSymbol(e.target.value)}>
              {SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.label}</option>)}
            </select>
          </div>
          <div className="min-w-[12rem]">
            <label className="label">Strategy Engine</label>
            <select className="input" value={strategy} onChange={(e) => setStrategy(e.target.value as StrategyId)}>
              {ENGINE_IDS.map((id) => <option key={id} value={id}>{STRATEGY_LABEL[id]}</option>)}
            </select>
          </div>
          <div className="min-w-[6rem]">
            <label className="label">Timeframe</label>
            <select className="input" value={timeframe} onChange={(e) => setTimeframe(e.target.value as Timeframe)}>
              {TIMEFRAMES.map((tf) => <option key={tf.id} value={tf.id}>{tf.id}</option>)}
            </select>
          </div>
          <div className="min-w-[8rem]">
            <label className="label">From Date</label>
            <input type="date" className="input mono text-xs" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
          </div>
          <div className="min-w-[8rem]">
            <label className="label">To Date</label>
            <input type="date" className="input mono text-xs" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </div>
          <button onClick={run} disabled={running || candles.length < 60 || source === 'loading'} className="btn-accent">
            <Play className="w-4 h-4" /> {running ? 'Running…' : 'Run Backtest'}
          </button>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="text-xs text-slate-400">Include trading costs</span>
              <button
                onClick={() => setIncludeCosts((v) => !v)}
                className={`relative w-9 h-5 rounded-full transition-colors ${includeCosts ? 'bg-accent-600' : 'bg-terminal-700'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${includeCosts ? 'left-4.5' : 'left-0.5'}`} style={{ transform: includeCosts ? 'translateX(16px)' : 'translateX(0)' }} />
              </button>
            </label>
          </div>
          <div className="flex-1" />
          <div className="text-xs text-slate-500">
            {candles.length > 0 ? `${candles.length} bars loaded` : 'Loading data…'}
          </div>
        </div>
      </div>

      {/* Phase split visualization */}
      {candles.length > 0 && <PhaseBar candles={candles} />}

      {!ran ? (
        <div className="card p-12 text-center">
          <FlaskConical className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">Pick a symbol, timeframe, and date range, then run a walk-forward backtest.</p>
          <p className="text-xs text-slate-600 mt-2">The backtest splits your date range into Training (60%), Validation (20%), and Out-of-Sample (20%) periods.</p>
        </div>
      ) : result ? (
        <WalkForwardResults symbol={symbol} strategy={strategy} result={result} source={source} />
      ) : null}

      <Disclaimer />
    </div>
  );
}

type WalkForwardResult = {
  training: BacktestResult;
  validation: BacktestResult;
  outOfSample: BacktestResult;
  phases: Phase[];
  allCandles: Candle[];
};

function runWalkForward(symbol: string, candles: Candle[], strategy: StrategyId, includeCosts: boolean): WalkForwardResult {
  const n = candles.length;
  const trainEnd = Math.floor(n * 0.6);
  const valEnd = Math.floor(n * 0.8);

  const training = runBacktest(symbol, candles.slice(0, trainEnd), strategy, { includeCosts });
  const validation = runBacktest(symbol, candles.slice(trainEnd, valEnd), strategy, { includeCosts });
  const outOfSample = runBacktest(symbol, candles.slice(valEnd), strategy, { includeCosts });

  const phases: Phase[] = [
    { name: 'Training', start: 0, end: trainEnd, color: '#6366f1' },
    { name: 'Validation', start: trainEnd, end: valEnd, color: '#fbbf24' },
    { name: 'Out-of-Sample', start: valEnd, end: n, color: '#14b8a6' },
  ];

  return { training, validation, outOfSample, phases, allCandles: candles };
}

function PhaseBar({ candles }: { candles: Candle[] }) {
  const n = candles.length;
  const trainEnd = Math.floor(n * 0.6);
  const valEnd = Math.floor(n * 0.8);
  return (
    <div className="card p-3">
      <div className="flex items-center gap-2 mb-2 text-xs text-slate-400">
        <Layers className="w-3.5 h-3.5 text-accent-400" />
        Walk-forward split
      </div>
      <div className="flex h-6 rounded-md overflow-hidden text-[10px] font-medium">
        <div className="bg-accent-600/30 text-accent-300 flex items-center justify-center" style={{ width: '60%' }}>
          Training 60%
        </div>
        <div className="bg-warn-500/25 text-warn-400 flex items-center justify-center" style={{ width: '20%' }}>
          Validation 20%
        </div>
        <div className="bg-bull-500/25 text-bull-400 flex items-center justify-center" style={{ width: '20%' }}>
          Out-of-Sample 20%
        </div>
      </div>
    </div>
  );
}

function WalkForwardResults({ symbol, strategy, result, source }: {
  symbol: string;
  strategy: StrategyId;
  result: WalkForwardResult;
  source: 'live' | 'demo' | 'loading';
}) {
  return (
    <>
      <div className={`card p-3 text-xs ${source === 'live' ? 'bg-bull-500/5 border-bull-500/20 text-bull-400/80' : 'bg-warn-500/5 border-warn-500/20 text-warn-400/80'}`}>
        {source === 'live'
          ? 'Backtest run on real historical market data from Twelve Data. Results are for analysis only — not financial advice.'
          : 'Backtest run on generated demo data (live data unavailable). Results are illustrative only.'}
      </div>

      {/* Three columns of results side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <PhaseResults phase="Training" res={result.training} color="accent" />
        <PhaseResults phase="Validation" res={result.validation} color="warn" />
        <PhaseResults phase="Out-of-Sample" res={result.outOfSample} color="bull" />
      </div>

      {/* Robustness check */}
      <RobustnessCheck training={result.training} validation={result.validation} oos={result.outOfSample} />

      {/* Equity curves overlaid */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200">Equity Curves by Phase (cumulative R)</h3>
          <span className="text-xs text-slate-500">{STRATEGY_LABEL[strategy]} · {symbol}</span>
        </div>
        <div className="p-4 space-y-4">
          <EquitySection title="Training" data={result.training.equityCurve} color="#6366f1" />
          <EquitySection title="Validation" data={result.validation.equityCurve} color="#fbbf24" />
          <EquitySection title="Out-of-Sample" data={result.outOfSample.equityCurve} color="#14b8a6" />
        </div>
      </div>

      {/* Trade logs — one per phase, collapsible feel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <TradeLogCard title="Training Trades" trades={result.training.trades} maxH={320} />
        <TradeLogCard title="Validation Trades" trades={result.validation.trades} maxH={320} />
        <TradeLogCard title="OOS Trades" trades={result.outOfSample.trades} maxH={320} />
      </div>
    </>
  );
}

function PhaseResults({ phase, res, color }: { phase: string; res: BacktestResult; color: 'accent' | 'warn' | 'bull' }) {
  const ring = color === 'accent' ? 'border-accent-500/30' : color === 'warn' ? 'border-warn-500/30' : 'border-bull-500/30';
  const label = color === 'accent' ? 'text-accent-300' : color === 'warn' ? 'text-warn-400' : 'text-bull-400';
  return (
    <div className={`card border ${ring}`}>
      <div className="card-header">
        <h3 className={`text-sm font-semibold ${label}`}>{phase}</h3>
        <span className="text-xs text-slate-500">{res.totalTrades} trades</span>
      </div>
      <div className="p-4 space-y-3">
        <MetricRow label="Win Rate" value={res.totalTrades ? `${res.winRate.toFixed(1)}%` : '—'} tone={res.winRate >= 50 ? 'bull' : 'bear'} />
        <MetricRow label="Profit Factor" value={res.profitFactor.toFixed(2)} tone={res.profitFactor >= 1 ? 'bull' : 'bear'} />
        <MetricRow label="Expectancy" value={fmtR(res.expectancy)} tone={res.expectancy >= 0 ? 'bull' : 'bear'} />
        <MetricRow label="Max DD (R)" value={res.maxDrawdownR.toFixed(2)} tone="bear" />
        <MetricRow label="Wins / Losses" value={`${res.wins} / ${res.losses}`} />
        <MetricRow label="Total Costs" value={`${res.totalCosts.toFixed(0)}`} tone="bear" />
      </div>
    </div>
  );
}

function RobustnessCheck({ training, validation, oos }: { training: BacktestResult; validation: BacktestResult; oos: BacktestResult }) {
  const trainWR = training.winRate;
  const oosWR = oos.winRate;
  const trainPF = training.profitFactor;
  const oosPF = oos.profitFactor;
  const wrDegradation = trainWR > 0 ? ((trainWR - oosWR) / trainWR) * 100 : 0;
  const pfDegradation = trainPF > 0 ? ((trainPF - oosPF) / trainPF) * 100 : 0;
  const robust = wrDegradation < 25 && pfDegradation < 25 && oos.expectancy > 0;
  const partial = !robust && oos.expectancy > 0;
  const verdict = robust ? 'Robust' : partial ? 'Partial' : 'Overfit';
  const vColor = robust ? 'text-bull-400' : partial ? 'text-warn-400' : 'text-bear-400';
  const vBg = robust ? 'bg-bull-500/10 border-bull-500/20' : partial ? 'bg-warn-500/10 border-warn-500/20' : 'bg-bear-500/10 border-bear-500/20';

  return (
    <div className={`card p-4 border ${vBg}`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Strategy Robustness</h3>
        <span className={`chip border ${vBg} ${vColor}`}>{verdict}</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
        <Metric label="Win Rate Degradation" value={`${wrDegradation.toFixed(1)}%`} tone={wrDegradation < 25 ? 'bull' : 'bear'} />
        <Metric label="PF Degradation" value={`${pfDegradation.toFixed(1)}%`} tone={pfDegradation < 25 ? 'bull' : 'bear'} />
        <Metric label="OOS Expectancy" value={fmtR(oos.expectancy)} tone={oos.expectancy > 0 ? 'bull' : 'bear'} />
        <Metric label="OOS Win Rate" value={oos.totalTrades > 0 ? `${oosWR.toFixed(1)}%` : '—'} tone={oosWR >= 50 ? 'bull' : 'bear'} />
      </div>
      <p className="text-xs text-slate-500 mt-3">
        {robust
          ? 'Strategy holds up well on unseen data — performance degradation is minimal.'
          : partial
          ? 'Strategy shows some degradation out-of-sample but remains profitable. Consider tightening entry rules.'
          : 'Strategy shows significant performance drop on unseen data — likely overfit to the training period.'}
      </p>
    </div>
  );
}

function EquitySection({ title, data, color }: { title: string; data: number[]; color: string }) {
  return (
    <div>
      <div className="text-xs text-slate-400 mb-1.5 flex items-center gap-2">
        <span className="w-3 h-0.5 rounded" style={{ backgroundColor: color }} />
        {title}
      </div>
      {data.length > 0 ? (
        <LineChart series={[{ values: data, color, width: 2 }]} showZeroLine height={140} />
      ) : (
        <p className="text-xs text-slate-600 text-center py-8">No trades in this period.</p>
      )}
    </div>
  );
}

function TradeLogCard({ title, trades, maxH }: { title: string; trades: BacktestResult['trades']; maxH: number }) {
  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-slate-200">{title}</h3>
        <span className="text-xs text-slate-500">{trades.length}</span>
      </div>
      {trades.length === 0 ? (
        <p className="text-sm text-slate-500 px-4 py-8 text-center">No trades generated.</p>
      ) : (
        <div className="overflow-y-auto" style={{ maxHeight: maxH }}>
          <table className="w-full text-xs">
            <thead className="text-[10px] uppercase tracking-wider text-slate-500 border-b border-terminal-700/60 sticky top-0 bg-terminal-850">
              <tr>
                <th className="text-left font-medium px-3 py-2">#</th>
                <th className="text-left font-medium px-2 py-2">Dir</th>
                <th className="text-right font-medium px-2 py-2">R</th>
                <th className="text-left font-medium px-2 py-2">Outcome</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-700/40">
              {trades.map((t) => (
                <tr key={t.index} className="hover:bg-terminal-800/40">
                  <td className="px-3 py-1.5 text-slate-500 mono">{t.index}</td>
                  <td className="px-2 py-1.5"><span className={`chip ${t.direction === 'BUY' ? 'bg-bull-500/15 text-bull-400' : 'bg-bear-500/15 text-bear-400'}`}>{t.direction}</span></td>
                  <td className={`px-2 py-1.5 text-right mono ${t.rMultiple >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>{fmtR(t.rMultiple)}</td>
                  <td className="px-2 py-1.5">
                    <span className={`chip ${t.outcome === 'win' ? 'bg-bull-500/15 text-bull-400' : t.outcome === 'loss' ? 'bg-bear-500/15 text-bear-400' : 'bg-terminal-700 text-slate-400'}`}>{t.outcome}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function MetricRow({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'bull' | 'bear' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-200';
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-slate-500">{label}</span>
      <span className={`mono text-sm font-medium ${color}`}>{value}</span>
    </div>
  );
}

function Metric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'bull' | 'bear' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-200';
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mono text-sm mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
