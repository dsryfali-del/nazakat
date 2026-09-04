import { useMemo, useState } from 'react';
import { Cpu, ListOrdered, Layers, Ban } from 'lucide-react';
import { useAllSignalsAsync, activeSignals } from '@/state/signals';
import { useNewsRisk } from '@/lib/news';
import { SYMBOLS, SYMBOL_MAP, ASSET_CLASS_LABEL } from '@/lib/symbols';
import { useApp } from '@/state/AppContext';
import { ENGINES } from '@/lib/strategies';
import { decimalsFor, fmtPrice } from '@/lib/format';
import { STRATEGY_LABEL, STRATEGY_SHORT } from '@/lib/labels';
import { DataBadge, DirectionTag, NewsRiskBadge, RiskGateBanner, ScoreBadge, SectionTitle, Disclaimer } from '@/components/ui';
import { TradeCard } from '@/components/TradeCard';
import { activeNewsForSymbol } from '@/lib/news';
import type { Signal, StrategyId, RiskStatus } from '@/lib/types';

const ENGINE_IDS: StrategyId[] = ['trend', 'breakout', 'meanrev', 'priceaction', 'orderflow', 'range', 'momentum'];

export function StrategiesPage() {
  const { risk, riskInputs } = useApp();
  const { signals: all, source } = useAllSignalsAsync();
  const ranked = useMemo(() => activeSignals(all), [all]);
  const newsEvents = useNewsRisk(SYMBOLS.map((s) => s.symbol));

  const [filter, setFilter] = useState<'all' | StrategyId>('all');
  const shown = filter === 'all' ? ranked : ranked.filter((s) => s.strategy === filter);

  const byStrategy = useMemo(() => {
    const map = {} as Record<StrategyId, Signal[]>;
    for (const id of ENGINE_IDS) map[id] = [];
    for (const s of all) map[s.strategy].push(s);
    for (const k of ENGINE_IDS) map[k].sort((a, b) => b.score - a.score);
    return map;
  }, [all]);

  return (
    <div className="fade-in space-y-6">
      <SectionTitle
        title="Strategies"
        subtitle="Seven engines scan every symbol in the watchlist. Real math — not curated numbers."
        right={<div className="flex items-center gap-2"><NewsRiskBadge events={newsEvents} /><DataBadge source={source} /></div>}
      />

      <RiskGateBanner status={risk.status} />

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {ENGINE_IDS.map((id) => (
          <EngineColumn key={id} id={id} signals={byStrategy[id]} riskStatus={risk.status} equity={riskInputs.currentEquity} />
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><ListOrdered className="w-4 h-4 text-accent-400" /> Active Setups — Ranked by Score</h3>
          <div className="flex items-center gap-1.5 flex-wrap">
            <FilterChip label="All" active={filter === 'all'} onClick={() => setFilter('all')} />
            {ENGINE_IDS.map((id) => <FilterChip key={id} label={STRATEGY_LABEL[id]} active={filter === id} onClick={() => setFilter(id)} />)}
          </div>
        </div>
        {risk.status === 'BLOCKED' ? (
          <div className="card p-10 text-center">
            <Ban className="w-8 h-8 text-bear-400/60 mx-auto mb-3" />
            <p className="text-sm text-bear-300">Trade setups are blocked while risk status is BLOCKED.</p>
            <p className="text-xs text-slate-500 mt-1.5">Restore daily-loss or drawdown headroom in the Risk Center to re-enable setups.</p>
          </div>
        ) : shown.length === 0 ? (
          <p className="text-sm text-slate-500 px-4 py-10 text-center">No active setups match this filter right now. "NO TRADE" is a valid, disciplined outcome.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-terminal-700/60">
                <tr>
                  <th className="text-left font-medium px-4 py-2.5">Symbol</th>
                  <th className="text-left font-medium px-3 py-2.5">Engine</th>
                  <th className="text-left font-medium px-3 py-2.5">Dir</th>
                  <th className="text-right font-medium px-3 py-2.5">Score</th>
                  <th className="text-right font-medium px-3 py-2.5">Entry</th>
                  <th className="text-right font-medium px-3 py-2.5">Stop</th>
                  <th className="text-right font-medium px-3 py-2.5">Target</th>
                  <th className="text-left font-medium px-3 py-2.5">Reason</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-terminal-700/40">
                {shown.map((s) => (
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

function EngineColumn({ id, signals, riskStatus, equity }: { id: StrategyId; signals: Signal[]; riskStatus: RiskStatus; equity: number }) {
  const engine = ENGINES[id];
  const active = signals.filter((s) => s.direction !== 'NO TRADE');

  return (
    <div className="card flex flex-col">
      <div className="card-header">
        <div>
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Cpu className="w-4 h-4 text-accent-400" /> {engine.name}</h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{engine.short} · {active.length} active</p>
        </div>
        <Layers className="w-4 h-4 text-slate-600" />
      </div>
      <div className="divide-y divide-terminal-700/40 max-h-[28rem] overflow-y-auto">
        {signals.map((s) => (
          <SignalRow key={s.symbol} s={s} riskStatus={riskStatus} equity={equity} />
        ))}
      </div>
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
        {active && <ScoreBadge score={s.score} />}
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
      <td className="px-3 py-2.5 text-right"><ScoreBadge score={s.score} /></td>
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

function FilterChip({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
        active ? 'bg-accent-600/20 text-accent-300 border border-accent-500/40' : 'text-slate-400 hover:text-slate-200 border border-transparent'
      }`}
    >
      {label}
    </button>
  );
}
