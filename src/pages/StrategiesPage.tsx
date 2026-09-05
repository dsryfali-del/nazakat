import { useMemo, useState } from 'react';
import { ChevronDown, Cpu, Ban } from 'lucide-react';
import { useAllSignalsAsync, activeSignals } from '@/state/signals';
import { useNewsRisk } from '@/lib/news';
import { SYMBOLS, SYMBOL_MAP, ASSET_CLASS_LABEL } from '@/lib/symbols';
import { useApp } from '@/state/AppContext';
import { ENGINES } from '@/lib/strategies';
import { DataBadge, DirectionTag, NewsRiskBadge, RiskGateBanner, SectionTitle, Disclaimer } from '@/components/ui';
import { TradeCard } from '@/components/TradeCard';
import { activeNewsForSymbol } from '@/lib/news';
import { STRATEGY_LABEL, STRATEGY_SHORT } from '@/lib/labels';
import { fmtPrice, decimalsFor } from '@/lib/format';
import type { Signal, StrategyId, RiskStatus } from '@/lib/types';

const ENGINE_IDS: StrategyId[] = ['trend', 'breakout', 'meanrev', 'priceaction', 'orderflow', 'range', 'momentum', 'liquidity', 'marketstructure', 'quantmulti'];

function ratingFromScore(score: number): string {
  return (score / 10).toFixed(1);
}

export function StrategiesPage() {
  const { risk, riskInputs } = useApp();
  const { signals: all, source } = useAllSignalsAsync();
  const ranked = useMemo(() => activeSignals(all), [all]);
  const newsEvents = useNewsRisk(SYMBOLS.map((s) => s.symbol));

  const byStrategy = useMemo(() => {
    const map = {} as Record<StrategyId, Signal[]>;
    for (const id of ENGINE_IDS) map[id] = [];
    for (const s of all) map[s.strategy].push(s);
    for (const k of ENGINE_IDS) map[k].sort((a, b) => b.score - a.score);
    return map;
  }, [all]);

  // Sort engines by best active signal rating (highest first), or alphabetically if none active.
  const sortedEngineIds = useMemo(() => {
    const withBest = ENGINE_IDS.map((id) => {
      const active = byStrategy[id].filter((s) => s.direction !== 'NO TRADE');
      const best = active.length > 0 ? active[0] : null;
      return { id, bestScore: best?.score ?? -1, bestSignal: best };
    });
    const hasAny = withBest.some((e) => e.bestScore >= 0);
    if (!hasAny) {
      return withBest.sort((a, b) => STRATEGY_LABEL[a.id].localeCompare(STRATEGY_LABEL[b.id]));
    }
    return withBest.sort((a, b) => b.bestScore - a.bestScore);
  }, [byStrategy]);

  const [expandedId, setExpandedId] = useState<StrategyId | null>(null);

  const toggle = (id: StrategyId) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  return (
    <div className="fade-in space-y-6">
      <SectionTitle
        title="Strategies"
        subtitle="Seven engines scan every symbol in the watchlist. Real math — not curated numbers."
        right={<div className="flex items-center gap-2"><NewsRiskBadge events={newsEvents} /><DataBadge source={source} /></div>}
      />

      <RiskGateBanner status={risk.status} />

      {risk.status === 'BLOCKED' && (
        <div className="card p-10 text-center">
          <Ban className="w-8 h-8 text-bear-400/60 mx-auto mb-3" />
          <p className="text-sm text-bear-300">Trade setups are blocked while risk status is BLOCKED.</p>
          <p className="text-xs text-slate-500 mt-1.5">Restore daily-loss or drawdown headroom in the Risk Center to re-enable setups.</p>
        </div>
      )}

      <div className="space-y-2">
        {sortedEngineIds.map(({ id, bestSignal }) => {
          const engine = ENGINES[id];
          const signals = byStrategy[id];
          const activeCount = signals.filter((s) => s.direction !== 'NO TRADE').length;
          const isExpanded = expandedId === id;

          return (
            <div key={id} className="card overflow-hidden">
              <button
                onClick={() => toggle(id)}
                className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-terminal-800/40 transition-colors text-left"
              >
                <Cpu className="w-4 h-4 text-accent-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-slate-200">{engine.name}</h3>
                    <span className="text-[11px] text-slate-600">{engine.short}</span>
                  </div>
                  {bestSignal ? (
                    <div className="flex items-center gap-2 mt-1 text-xs">
                      <span className="mono text-slate-300">{bestSignal.symbol}</span>
                      <DirectionTag direction={bestSignal.direction} />
                      <span className="text-accent-300 mono font-medium">{ratingFromScore(bestSignal.score)}/10</span>
                      <span className="text-slate-600">· {activeCount} active</span>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-600 mt-1">No active setups · {activeCount} active</p>
                  )}
                </div>
                <ChevronDown className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
              </button>

              {isExpanded && (
                <div className="border-t border-terminal-700/60 divide-y divide-terminal-700/40 max-h-[28rem] overflow-y-auto">
                  {signals.map((s) => (
                    <SignalRow key={s.symbol} s={s} riskStatus={risk.status} equity={riskInputs.currentEquity} />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Ranked table remains, with /10 rating instead of 0-100 score */}
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200">Active Setups — Ranked by Rating</h3>
        </div>
        {risk.status === 'BLOCKED' ? null : ranked.length === 0 ? (
          <p className="text-sm text-slate-500 px-4 py-10 text-center">No active setups right now. "NO TRADE" is a valid, disciplined outcome.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-terminal-700/60">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Symbol</th>
                  <th className="text-left font-medium px-3 py-2.5">Engine</th>
                  <th className="text-left font-medium px-3 py-2.5">Dir</th>
                  <th className="text-right font-medium px-3 py-2.5">Rating</th>
                  <th className="text-right font-medium px-3 py-2.5">Entry</th>
                  <th className="text-right font-medium px-3 py-2.5">Stop</th>
                  <th className="text-right font-medium px-3 py-2.5">Target</th>
                  <th className="text-left font-medium px-3 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-700/40">
                {ranked.map((s) => (
                  <RankedRow key={`${s.symbol}-${s.strategy}`} s={s} riskStatus={risk.status} equity={riskInputs.currentEquity} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Disclaimer />
    </div>
  );
}

function SignalRow({ s, riskStatus, equity }: { s: Signal; riskStatus: RiskStatus; equity: number }) {
  const meta = SYMBOL_MAP[s.symbol];
  const active = s.direction !== 'NO TRADE';
  const hasNewsRisk = activeNewsForSymbol(s.symbol).length > 0;

  return (
    <div className={`px-4 py-2.5 ${active ? 'bg-terminal-800/30' : ''} ${riskStatus === 'RED' && active ? 'border-l-2 border-bear-500/40' : ''}`}>
      <div className="flex items-center gap-2 mb-1">
        <span className="text-sm mono text-slate-200 font-medium w-20">{s.symbol}</span>
        <DirectionTag direction={s.direction} />
        <span className="flex-1" />
        {active && riskStatus === 'RED' && <span className="chip bg-bear-500/15 text-bear-400 border border-bear-500/30 text-[9px]">FLAGGED</span>}
        {active && <span className="text-xs mono text-accent-300 font-medium">{ratingFromScore(s.score)}/10</span>}
      </div>
      {active ? (
        <>
          <TradeCard signal={s} equity={equity} riskStatus={riskStatus} variant="row" />
          {hasNewsRisk && (
            <div className="text-[10px] text-warn-400/80 mt-1.5 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-warn-400" />
              News event nearby — reduced confidence.
            </div>
          )}
        </>
      ) : (
        <div className="text-[11px] text-slate-600">{meta?.label} · {ASSET_CLASS_LABEL[meta?.assetClass ?? 'forex']}</div>
      )}
    </div>
  );
}

function RankedRow({ s, riskStatus, equity }: { s: Signal; riskStatus: RiskStatus; equity: number }) {
  const d = decimalsFor(s.symbol);
  const hasNewsRisk = activeNewsForSymbol(s.symbol).length > 0;
  return (
    <tr className={`hover:bg-terminal-800/40 ${riskStatus === 'RED' ? 'border-l-2 border-bear-500/30' : ''}`}>
      <td className="px-4 py-2.5 mono text-slate-200 font-medium">{s.symbol}</td>
      <td className="px-3 py-2.5 text-slate-400">{STRATEGY_LABEL[s.strategy]}<div className="text-[10px] text-slate-600">{STRATEGY_SHORT[s.strategy]}</div></td>
      <td className="px-3 py-2.5"><DirectionTag direction={s.direction} /></td>
      <td className="px-3 py-2.5 text-right"><span className="text-xs mono text-accent-300 font-medium">{ratingFromScore(s.score)}/10</span></td>
      <td className="px-3 py-2.5 text-right mono text-slate-300">{fmtPrice(s.entry, d)}</td>
      <td className="px-3 py-2.5 text-right mono text-bear-400/90">{fmtPrice(s.stopLoss, d)}</td>
      <td className="px-3 py-2.5 text-right mono text-bull-400/90">{fmtPrice(s.takeProfit, d)}</td>
      <td className="px-3 py-2.5 text-xs text-slate-400 max-w-md">
        {s.reason}
        {hasNewsRisk && <span className="block text-[10px] text-warn-400/80 mt-1">News event nearby — reduced confidence.</span>}
      </td>
    </tr>
  );
}
