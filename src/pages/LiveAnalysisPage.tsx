import { useMemo, useState } from 'react';
import { Radio, AlertTriangle } from 'lucide-react';
import { useAllSignalsAsync, activeSignals } from '@/state/signals';
import { useApp } from '@/state/AppContext';
import { SYMBOL_MAP, ASSET_CLASS_LABEL, SYMBOLS } from '@/lib/symbols';
import { decimalsFor, fmtPrice } from '@/lib/format';
import { STRATEGY_LABEL, STRATEGY_SHORT } from '@/lib/labels';
import { DataBadge, DirectionTag, GatedSetup, NewsRiskBadge, RiskGateBanner, ScoreBadge, SectionTitle, Disclaimer } from '@/components/ui';
import { TradeCard } from '@/components/TradeCard';
import { useNewsRisk, activeNewsForSymbol } from '@/lib/news';
import type { Signal, RiskStatus, AssetClass } from '@/lib/types';

const ASSET_CLASSES: (AssetClass | 'all')[] = ['all', 'forex', 'commodities', 'crypto', 'indices', 'stocks'];

type SortKey = 'score' | 'symbol' | 'strategy';

export function LiveAnalysisPage() {
  const { risk, riskInputs } = useApp();
  const { signals: all, source } = useAllSignalsAsync();
  const newsEvents = useNewsRisk(SYMBOLS.map((s) => s.symbol));

  const [sortKey, setSortKey] = useState<SortKey>('score');
  const [assetFilter, setAssetFilter] = useState<AssetClass | 'all'>('all');

  const rows = useMemo(() => {
    let active = activeSignals(all);
    if (assetFilter !== 'all') {
      active = active.filter((s) => SYMBOL_MAP[s.symbol]?.assetClass === assetFilter);
    }
    const sorted = [...active];
    if (sortKey === 'score') sorted.sort((a, b) => b.score - a.score);
    else if (sortKey === 'symbol') sorted.sort((a, b) => a.symbol.localeCompare(b.symbol));
    else if (sortKey === 'strategy') sorted.sort((a, b) => a.strategy.localeCompare(b.strategy) || b.score - a.score);
    return sorted;
  }, [all, sortKey, assetFilter]);

  return (
    <div className="fade-in space-y-6">
      <SectionTitle
        title="Live Analysis"
        subtitle="Real-time scan of every symbol across all strategy engines — ranked by score."
        right={
          <div className="flex items-center gap-2">
            <NewsRiskBadge events={newsEvents} />
            <DataBadge source={source} />
          </div>
        }
      />

      <RiskGateBanner status={risk.status} />

      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-500">Sort</span>
            <select
              className="input w-auto text-xs"
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="score">Score (highest first)</option>
              <option value="symbol">Symbol (A–Z)</option>
              <option value="strategy">Strategy</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs uppercase tracking-wider text-slate-500">Class</span>
            <select
              className="input w-auto text-xs"
              value={assetFilter}
              onChange={(e) => setAssetFilter(e.target.value as AssetClass | 'all')}
            >
              {ASSET_CLASSES.map((c) => (
                <option key={c} value={c}>{c === 'all' ? 'All classes' : ASSET_CLASS_LABEL[c]}</option>
              ))}
            </select>
          </div>
          <div className="flex-1" />
          <div className="text-xs text-slate-500">
            {rows.length} active signal{rows.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {risk.status === 'BLOCKED' ? (
        <div className="card p-10 text-center">
          <AlertTriangle className="w-8 h-8 text-bear-400/60 mx-auto mb-3" />
          <p className="text-sm text-bear-300">Trade signals are blocked while risk status is BLOCKED.</p>
          <p className="text-xs text-slate-500 mt-1.5">Restore daily-loss or drawdown headroom in the Risk Center to re-enable.</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="card p-10 text-center">
          <Radio className="w-8 h-8 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400">No active signals match the current filter.</p>
          <p className="text-xs text-slate-600 mt-1.5">"NO TRADE" is a valid, disciplined outcome — the engines found no qualifying setups.</p>
        </div>
      ) : (
        <GatedSetup status={risk.status}>
          <div className="card overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-terminal-700/60">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Symbol</th>
                    <th className="text-left font-medium px-3 py-2.5">Strategy</th>
                    <th className="text-left font-medium px-3 py-2.5">Signal</th>
                    <th className="text-right font-medium px-3 py-2.5">Score</th>
                    <th className="text-right font-medium px-3 py-2.5">Entry</th>
                    <th className="text-right font-medium px-3 py-2.5">Stop</th>
                    <th className="text-right font-medium px-3 py-2.5">Target</th>
                    <th className="text-center font-medium px-3 py-2.5">Data</th>
                    <th className="text-left font-medium px-3 py-2.5">Trade Metrics</th>
                    <th className="text-left font-medium px-3 py-2.5">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-700/40">
                  {rows.map((s) => (
                    <AnalysisRow key={`${s.symbol}-${s.strategy}`} s={s} riskStatus={risk.status} globalSource={source} equity={riskInputs.currentEquity} />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </GatedSetup>
      )}

      <Disclaimer />
    </div>
  );
}

function AnalysisRow({ s, riskStatus, globalSource, equity }: { s: Signal; riskStatus: RiskStatus; globalSource: 'live' | 'demo' | 'loading'; equity: number }) {
  const d = decimalsFor(s.symbol);
  const meta = SYMBOL_MAP[s.symbol];
  const hasNewsRisk = activeNewsForSymbol(s.symbol).length > 0;
  const rowSource = globalSource === 'live' ? 'live' : 'demo';

  return (
    <tr className="hover:bg-terminal-800/40">
      <td className="px-4 py-2.5">
        <div className="mono text-slate-200 font-medium">{s.symbol}</div>
        <div className="text-[10px] text-slate-600">{meta?.label} · {ASSET_CLASS_LABEL[meta?.assetClass ?? 'forex']}</div>
      </td>
      <td className="px-3 py-2.5 text-slate-400">
        {STRATEGY_LABEL[s.strategy]}
        <div className="text-[10px] text-slate-600">{STRATEGY_SHORT[s.strategy]}</div>
      </td>
      <td className="px-3 py-2.5"><DirectionTag direction={s.direction} /></td>
      <td className="px-3 py-2.5 text-right"><ScoreBadge score={s.score} /></td>
      <td className="px-3 py-2.5 text-right mono text-slate-300">{fmtPrice(s.entry, d)}</td>
      <td className="px-3 py-2.5 text-right mono text-bear-400/90">{fmtPrice(s.stopLoss, d)}</td>
      <td className="px-3 py-2.5 text-right mono text-bull-400/90">{fmtPrice(s.takeProfit, d)}</td>
      <td className="px-3 py-2.5 text-center">
        <span className={`inline-flex items-center gap-1 text-[10px] ${rowSource === 'live' ? 'text-bull-400' : 'text-slate-500'}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${rowSource === 'live' ? 'bg-bull-400' : 'bg-slate-500'}`} />
          {rowSource === 'live' ? 'Live' : 'Demo'}
        </span>
      </td>
      <td className="px-3 py-2.5">
        <TradeCard signal={s} equity={equity} riskStatus={riskStatus} variant="row" />
      </td>
      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-[8rem]">
        {hasNewsRisk && (
          <span className="text-warn-400/80 flex items-center gap-1">
            <span className="w-1 h-1 rounded-full bg-warn-400" />
            News event nearby
          </span>
        )}
        {riskStatus === 'RED' && (
          <span className="text-bear-400/80 flex items-center gap-1 mt-0.5">
            <span className="w-1 h-1 rounded-full bg-bear-400" />
            Reduced confidence
          </span>
        )}
        {!hasNewsRisk && riskStatus !== 'RED' && <span className="text-slate-600">—</span>}
      </td>
    </tr>
  );
}
