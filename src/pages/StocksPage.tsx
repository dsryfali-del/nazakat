import { useMemo, useState } from 'react';
import { Building2, Info } from 'lucide-react';
import { SYMBOLS, SYMBOL_MAP } from '@/lib/symbols';
import { generateSeries } from '@/lib/data';
import { decimalsFor, fmtPct, fmtPrice } from '@/lib/format';
import { Disclaimer, SectionTitle } from '@/components/ui';
import type { SymbolMeta } from '@/lib/types';

// Stocks tab — tracked equity watchlist with a relative-strength ranking
// derived from the existing mock price data (period return vs. the group),
// plus a fundamentals placeholder per ticker.

const STOCK_SYMBOLS = SYMBOLS.filter((s) => s.assetClass === 'stocks');

type StockRow = {
  meta: SymbolMeta;
  last: number;
  prev: number;
  changePct: number;
  // relative strength over a 60-bar lookback vs. the stock group median
  rsScore: number;
  periodReturn: number;
};

export function StocksPage() {
  const [selected, setSelected] = useState<string>(STOCK_SYMBOLS[0].symbol);

  const rows = useMemo<StockRow[]>(() => {
    const lookback = 60;
    const computed = STOCK_SYMBOLS.map((s) => {
      const c = generateSeries(s.symbol);
      const last = c[c.length - 1].close;
      const prev = c[c.length - 2].close;
      const changePct = ((last - prev) / prev) * 100;
      const past = c[Math.max(0, c.length - 1 - lookback)].close;
      const periodReturn = ((last - past) / past) * 100;
      return { meta: s, last, prev, changePct, periodReturn };
    });
    const returns = computed.map((r) => r.periodReturn).sort((a, b) => a - b);
    // RS score: percentile rank of period return within the group, 0-100.
    return computed.map((r) => {
      const below = returns.filter((x) => x < r.periodReturn).length;
      const rsScore = Math.round((below / Math.max(1, returns.length - 1)) * 100);
      return { ...r, rsScore };
    }).sort((a, b) => b.rsScore - a.rsScore);
  }, []);

  const sel = rows.find((r) => r.meta.symbol === selected) ?? rows[0];
  const selMeta = SYMBOL_MAP[selected];

  return (
    <div className="fade-in space-y-6">
      <SectionTitle title="Stocks" subtitle="Tracked equities with relative-strength ranking — based on generated demo data." />

      {/* Relative strength ranking */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Building2 className="w-4 h-4 text-accent-400" /> Relative-Strength Ranking</h3>
          <span className="text-xs text-slate-500">60-bar return vs. group · demo data</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-terminal-700/60">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Rank</th>
                <th className="text-left font-medium px-3 py-2.5">Ticker</th>
                <th className="text-left font-medium px-3 py-2.5">Name</th>
                <th className="text-right font-medium px-3 py-2.5">Last</th>
                <th className="text-right font-medium px-3 py-2.5">Change</th>
                <th className="text-right font-medium px-3 py-2.5">60-bar Return</th>
                <th className="text-right font-medium px-3 py-2.5">RS Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-700/40">
              {rows.map((r, i) => {
                const d = decimalsFor(r.meta.symbol);
                const active = r.meta.symbol === selected;
                return (
                  <tr
                    key={r.meta.symbol}
                    onClick={() => setSelected(r.meta.symbol)}
                    className={`cursor-pointer transition-colors ${active ? 'bg-accent-600/10' : 'hover:bg-terminal-800/40'}`}
                  >
                    <td className="px-4 py-2.5 text-slate-500 mono">#{i + 1}</td>
                    <td className="px-3 py-2.5 mono text-slate-200 font-medium">{r.meta.symbol}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{r.meta.label}</td>
                    <td className="px-3 py-2.5 text-right mono text-slate-200">{fmtPrice(r.last, d)}</td>
                    <td className={`px-3 py-2.5 text-right mono ${r.changePct >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>{fmtPct(r.changePct)}</td>
                    <td className={`px-3 py-2.5 text-right mono ${r.periodReturn >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>{fmtPct(r.periodReturn)}</td>
                    <td className="px-3 py-2.5 text-right"><RsBadge score={r.rsScore} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Fundamentals placeholder for selected ticker */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200">{selMeta?.symbol} — Fundamentals</h3>
          <span className="text-xs text-slate-500">{selMeta?.label}</span>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <FundCell label="Last Price" value={fmtPrice(sel.last, decimalsFor(sel.meta.symbol))} />
            <FundCell label="Day Change" value={fmtPct(sel.changePct)} tone={sel.changePct >= 0 ? 'bull' : 'bear'} />
            <FundCell label="60-bar Return" value={fmtPct(sel.periodReturn)} tone={sel.periodReturn >= 0 ? 'bull' : 'bear'} />
            <FundCell label="RS Score" value={`${sel.rsScore}`} tone={sel.rsScore >= 70 ? 'bull' : sel.rsScore <= 30 ? 'bear' : 'neutral'} />
          </div>
          <div className="rounded-md bg-terminal-900 border border-terminal-700/50 p-4 flex items-start gap-3">
            <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm text-slate-300">Fundamentals not yet available</p>
              <p className="text-xs text-slate-500 mt-1">P/E, market cap, sector, earnings, and analyst ratings will be populated here once a fundamentals data source is connected. Price figures above are generated demo data.</p>
            </div>
          </div>
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}

function RsBadge({ score }: { score: number }) {
  const cls = score >= 70 ? 'bg-bull-500/15 text-bull-400 border-bull-500/30'
    : score <= 30 ? 'bg-bear-500/15 text-bear-400 border-bear-500/30'
    : 'bg-terminal-700 text-slate-400 border-terminal-600';
  return <span className={`chip border ${cls}`}>{score}</span>;
}

function FundCell({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'bull' | 'bear' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-200';
  return (
    <div className="bg-terminal-900 rounded-md p-3 border border-terminal-700/50">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mono text-sm mt-1 ${color}`}>{value}</div>
    </div>
  );
}
