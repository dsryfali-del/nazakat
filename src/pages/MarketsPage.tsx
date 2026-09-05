import { useMemo } from 'react';
import { CandlestickChart } from 'lucide-react';
import { SYMBOLS, ASSET_CLASS_LABEL } from '@/lib/symbols';
import { generateSeries } from '@/lib/data';
import { useAllSignals, activeSignals } from '@/state/signals';
import { decimalsFor, fmtPct, fmtPrice } from '@/lib/format';
import { Disclaimer, DirectionTag, SectionTitle } from '@/components/ui';

export function MarketsPage() {
  const all = useAllSignals();
  const active = useMemo(() => activeSignals(all), [all]);

  // Per-symbol snapshot: last price, change %, top active setup if any.
  const rows = useMemo(() => {
    return SYMBOLS.map((s) => {
      const c = generateSeries(s.symbol);
      const last = c[c.length - 1].close;
      const prev = c[c.length - 2].close;
      const pct = ((last - prev) / prev) * 100;
      const best = active
        .filter((sig) => sig.symbol === s.symbol)
        .sort((a, b) => b.score - a.score)[0];
      return { meta: s, last, pct, best };
    });
  }, [active]);

  return (
    <div className="fade-in space-y-6">
      <SectionTitle title="Markets" subtitle="Demo watchlist across forex, commodities, crypto, indices, and stocks." />
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-terminal-700/60">
              <tr>
                <th className="text-left font-medium px-4 py-2.5">Symbol</th>
                <th className="text-left font-medium px-3 py-2.5">Class</th>
                <th className="text-right font-medium px-3 py-2.5">Last</th>
                <th className="text-right font-medium px-3 py-2.5">Change</th>
                <th className="text-left font-medium px-3 py-2.5">Top Setup</th>
                <th className="text-right font-medium px-3 py-2.5">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-terminal-700/40">
              {rows.map((r) => {
                const d = decimalsFor(r.meta.symbol);
                return (
                  <tr key={r.meta.symbol} className="hover:bg-terminal-800/40">
                    <td className="px-4 py-2.5">
                      <div className="mono text-slate-200 font-medium">{r.meta.symbol}</div>
                      <div className="text-[11px] text-slate-600">{r.meta.label}</div>
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{ASSET_CLASS_LABEL[r.meta.assetClass]}</td>
                    <td className="px-3 py-2.5 text-right mono text-slate-200">{fmtPrice(r.last, d)}</td>
                    <td className={`px-3 py-2.5 text-right mono ${r.pct >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>{fmtPct(r.pct)}</td>
                    <td className="px-3 py-2.5">
                      {r.best ? (
                        <div className="flex items-center gap-2">
                          <DirectionTag direction={r.best.direction} />
                          <span className="text-xs text-slate-500">{r.best.strategy}</span>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-600 flex items-center gap-1"><CandlestickChart className="w-3 h-3" /> No active setup</span>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">{r.best ? <span className="text-xs mono text-accent-300 font-medium">{(r.best.score / 10).toFixed(1)}/10</span> : <span className="text-xs text-slate-600">—</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}
