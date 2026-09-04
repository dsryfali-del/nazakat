import { useMemo } from 'react';
import { BarChart3, PieChart, Layers, TrendingUp } from 'lucide-react';
import { usePersistentState } from '@/lib/usePersistentState';
import { LineChart } from '@/components/LineChart';
import { fmtPct, fmtR } from '@/lib/format';
import { STRATEGY_LABEL } from '@/lib/labels';
import { Disclaimer, EmptyState, SectionTitle } from '@/components/ui';
import type { Trade } from '@/lib/types';

// Performance tab — derives everything from the Trade Journal data
// (localStorage 'ae_trades'). Shows equity curve over time, win rate,
// expectancy, R-multiple distribution, and breakdowns by symbol & strategy.

export function PerformancePage() {
  const [trades] = usePersistentState<Trade[]>('ae_trades', []);

  const stats = useMemo(() => computeStats(trades), [trades]);

  if (trades.length === 0) {
    return (
      <div className="fade-in space-y-6">
        <SectionTitle title="Performance" subtitle="Analytics computed from your Trade Journal entries." />
        <div className="card">
          <EmptyState title="No trades to analyze yet" hint="Log trades in the Trade Journal and your performance analytics will appear here." />
        </div>
        <Disclaimer />
      </div>
    );
  }

  return (
    <div className="fade-in space-y-6">
      <SectionTitle title="Performance" subtitle="Analytics computed from your Trade Journal entries." />

      {/* Top-line stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Total Trades" value={String(stats.total)} />
        <Stat label="Win Rate" value={`${stats.winRate.toFixed(1)}%`} tone={stats.winRate >= 50 ? 'bull' : 'bear'} />
        <Stat label="Expectancy" value={fmtR(stats.expectancy)} tone={stats.expectancy >= 0 ? 'bull' : 'bear'} />
        <Stat label="Profit Factor" value={stats.profitFactor.toFixed(2)} tone={stats.profitFactor >= 1 ? 'bull' : 'bear'} />
      </div>

      {/* Equity curve */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent-400" /> Equity Curve (cumulative R)</h3>
          <span className="text-xs text-slate-500">{stats.total} trades</span>
        </div>
        <div className="p-4">
          <LineChart series={[{ values: stats.equityCurve, color: '#6366f1', width: 2 }]} showZeroLine height={240} />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* R-multiple distribution */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-accent-400" /> R-Multiple Distribution</h3>
          </div>
          <div className="p-4">
            <RDist buckets={stats.rBuckets} />
          </div>
        </div>

        {/* Breakdown by symbol */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Layers className="w-4 h-4 text-accent-400" /> By Symbol</h3>
          </div>
          <BreakdownTable rows={stats.bySymbol} />
        </div>
      </div>

      {/* Breakdown by strategy */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><PieChart className="w-4 h-4 text-accent-400" /> By Strategy</h3>
        </div>
        <BreakdownTable rows={stats.byStrategy} labelFn={(k) => STRATEGY_LABEL[k] ?? k} />
      </div>

      <Disclaimer />
    </div>
  );
}

type Stats = {
  total: number;
  winRate: number;
  expectancy: number;
  profitFactor: number;
  equityCurve: number[];
  rBuckets: { label: string; count: number }[];
  bySymbol: BreakdownRow[];
  byStrategy: BreakdownRow[];
};

type BreakdownRow = {
  key: string;
  trades: number;
  winRate: number;
  avgR: number;
  totalR: number;
};

function computeStats(trades: Trade[]): Stats {
  const total = trades.length;
  const wins = trades.filter((t) => t.resultR > 0).length;
  const winRate = total > 0 ? (wins / total) * 100 : 0;
  const grossWin = trades.filter((t) => t.resultR > 0).reduce((s, t) => s + t.resultR, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.resultR <= 0).reduce((s, t) => s + t.resultR, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  const expectancy = total > 0 ? trades.reduce((s, t) => s + t.resultR, 0) / total : 0;

  // Equity curve in chronological order (oldest first).
  const sorted = [...trades].sort((a, b) => a.time - b.time);
  const equityCurve: number[] = [];
  let cum = 0;
  for (const t of sorted) { cum += t.resultR; equityCurve.push(cum); }

  // R-multiple distribution buckets.
  const bucketDefs = [
    { label: '≤ -3R', min: -Infinity, max: -3 },
    { label: '-3 to -2R', min: -3, max: -2 },
    { label: '-2 to -1R', min: -2, max: -1 },
    { label: '-1 to 0R', min: -1, max: 0 },
    { label: '0 to +1R', min: 0, max: 1 },
    { label: '+1 to +2R', min: 1, max: 2 },
    { label: '+2 to +3R', min: 2, max: 3 },
    { label: '> +3R', min: 3, max: Infinity },
  ];
  const rBuckets = bucketDefs.map((b) => ({
    label: b.label,
    count: trades.filter((t) => t.resultR > b.min && t.resultR <= b.max).length,
  }));

  const bySymbol = groupBreakdown(trades, (t) => t.asset);
  const byStrategy = groupBreakdown(trades, (t) => t.strategy);

  return { total, winRate, expectancy, profitFactor, equityCurve, rBuckets, bySymbol, byStrategy };
}

function groupBreakdown(trades: Trade[], keyFn: (t: Trade) => string): BreakdownRow[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades) {
    const k = keyFn(t);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  const rows: BreakdownRow[] = [];
  for (const [key, ts] of map) {
    const w = ts.filter((t) => t.resultR > 0).length;
    rows.push({
      key,
      trades: ts.length,
      winRate: (w / ts.length) * 100,
      avgR: ts.reduce((s, t) => s + t.resultR, 0) / ts.length,
      totalR: ts.reduce((s, t) => s + t.resultR, 0),
    });
  }
  return rows.sort((a, b) => b.totalR - a.totalR);
}

function RDist({ buckets }: { buckets: { label: string; count: number }[] }) {
  const max = Math.max(1, ...buckets.map((b) => b.count));
  return (
    <div className="space-y-2">
      {buckets.map((b) => {
        const pct = (b.count / max) * 100;
        const isWin = b.label.includes('+');
        const isLoss = b.label.includes('-') && !b.label.includes('+');
        const color = isWin ? 'bg-bull-500' : isLoss ? 'bg-bear-500' : 'bg-terminal-600';
        return (
        <div key={b.label} className="flex items-center gap-3">
          <div className="w-20 text-xs text-slate-500 mono text-right shrink-0">{b.label}</div>
          <div className="flex-1 h-5 rounded bg-terminal-900 overflow-hidden">
            <div className={`h-full ${color} transition-all flex items-center justify-end px-1.5`} style={{ width: `${Math.max(pct, b.count > 0 ? 6 : 0)}%` }}>
              {b.count > 0 && <span className="text-[10px] text-white mono">{b.count}</span>}
            </div>
          </div>
        </div>
      );
      })}
    </div>
  );
}

function BreakdownTable({ rows, labelFn }: { rows: BreakdownRow[]; labelFn?: (k: string) => string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-terminal-700/60">
          <tr>
            <th className="text-left font-medium px-4 py-2.5">{labelFn ? 'Strategy' : 'Symbol'}</th>
            <th className="text-right font-medium px-3 py-2.5">Trades</th>
            <th className="text-right font-medium px-3 py-2.5">Win Rate</th>
            <th className="text-right font-medium px-3 py-2.5">Avg R</th>
            <th className="text-right font-medium px-3 py-2.5">Total R</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-terminal-700/40">
          {rows.map((r) => (
            <tr key={r.key} className="hover:bg-terminal-800/40">
              <td className="px-4 py-2.5 text-slate-200">{labelFn ? labelFn(r.key) : <span className="mono">{r.key}</span>}</td>
              <td className="px-3 py-2.5 text-right mono text-slate-300">{r.trades}</td>
              <td className={`px-3 py-2.5 text-right mono ${r.winRate >= 50 ? 'text-bull-400' : 'text-bear-400'}`}>{fmtPct(r.winRate)}</td>
              <td className={`px-3 py-2.5 text-right mono ${r.avgR >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>{fmtR(r.avgR)}</td>
              <td className={`px-3 py-2.5 text-right mono ${r.totalR >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>{fmtR(r.totalR)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Stat({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'bull' | 'bear' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-100';
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">{label}</div>
      <div className={`mono text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}
