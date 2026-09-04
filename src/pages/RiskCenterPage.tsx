import { useMemo, useState } from 'react';
import { Calculator, ShieldCheck, Gauge, Ban, Layers, Plus, X, AlertTriangle } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { computeRisk, positionSize, RECOMMENDED_RISK } from '@/lib/risk';
import { fmtPctPlain, fmtPrice, fmtUsd } from '@/lib/format';
import { Disclaimer, SectionTitle, StatusPill } from '@/components/ui';
import { SYMBOLS, SYMBOL_MAP, ASSET_CLASS_LABEL } from '@/lib/symbols';
import { CLUSTERS, clusterForSymbol, type OpenPosition } from '@/lib/correlation';
import type { RiskInputs, RiskStatus } from '@/lib/types';

export function RiskCenterPage() {
  const { riskInputs, setRiskInputs, risk } = useApp();
  const [pos, setPos] = useState({ entry: '', stopLoss: '', takeProfit: '' });

  const update = (key: keyof RiskInputs, raw: string) => {
    const v = raw === '' ? 0 : parseFloat(raw);
    setRiskInputs((p) => ({ ...p, [key]: Number.isFinite(v) ? v : 0 }));
  };

  // Position-size calculator uses the recommended risk % unless BLOCKED.
  const blocked = risk.status === 'BLOCKED';
  const calc = useMemo(() => {
    if (blocked) return null;
    const entry = parseFloat(pos.entry);
    const sl = parseFloat(pos.stopLoss);
    const tp = parseFloat(pos.takeProfit);
    if (![entry, sl, tp].every((n) => Number.isFinite(n) && n > 0)) return null;
    if (entry === sl) return null;
    return positionSize({
      equity: riskInputs.currentEquity,
      riskPct: risk.recommendedRiskPct,
      entry, stopLoss: sl, takeProfit: tp,
    });
  }, [pos, blocked, riskInputs.currentEquity, risk.recommendedRiskPct]);

  return (
    <div className="fade-in space-y-6">
      <SectionTitle
        title="Risk Center"
        subtitle="Live guardrails, status, and position sizing for your account."
        right={<StatusPill status={risk.status} />}
      />

      {blocked && (
        <div className="card border-bear-600/40 bg-bear-600/10 p-4 flex items-start gap-3">
          <Ban className="w-5 h-5 text-bear-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-bear-300">Trading blocked — no new trades.</p>
            <p className="text-xs text-bear-400/80 mt-1">You have exhausted your daily-loss or max-drawdown limit. The position-size calculator is disabled until risk is restored.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="card lg:col-span-2">
          <div className="card-header"><h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Gauge className="w-4 h-4 text-accent-400" /> Account Risk Inputs</h3></div>
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Field label="Account Balance ($)" value={riskInputs.accountBalance} onChange={(v) => update('accountBalance', v)} mono />
            <Field label="Current Equity ($)" value={riskInputs.currentEquity} onChange={(v) => update('currentEquity', v)} mono />
            <Field label="Today's P/L ($)" value={riskInputs.todayPnl} onChange={(v) => update('todayPnl', v)} mono tone={riskInputs.todayPnl < 0 ? 'bear' : 'bull'} />
            <Field label="Daily-Loss Limit (%)" value={riskInputs.dailyLossLimitPct} onChange={(v) => update('dailyLossLimitPct', v)} mono />
            <Field label="Max Drawdown (%)" value={riskInputs.maxDrawdownPct} onChange={(v) => update('maxDrawdownPct', v)} mono />
            <Field label="Profit Target (%)" value={riskInputs.profitTargetPct} onChange={(v) => update('profitTargetPct', v)} mono />
          </div>
        </div>

        <div className="card flex flex-col">
          <div className="card-header"><h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent-400" /> Live Status</h3></div>
          <div className="p-4 space-y-3 flex-1">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-400">Status</span>
              <StatusPill status={risk.status} />
            </div>
            <Metric label="Current drawdown" value={fmtPctPlain(risk.currentDrawdownPct)} sub={`of ${riskInputs.maxDrawdownPct}%`} pct={ratio(risk.currentDrawdownPct, riskInputs.maxDrawdownPct)} tone="bear" />
            <Metric label="Daily-loss used" value={fmtPctPlain(risk.dailyLossUsedPct)} sub={`of ${riskInputs.dailyLossLimitPct}%`} pct={ratio(risk.dailyLossUsedPct, riskInputs.dailyLossLimitPct)} tone="bear" />
            <Metric label="Distance to target" value={fmtPctPlain(risk.distanceToProfitTargetPct)} sub={`of ${riskInputs.profitTargetPct}%`} pct={ratio(risk.distanceToProfitTargetPct, riskInputs.profitTargetPct)} tone="bull" />
            <div className="pt-2 border-t border-terminal-700/60 flex items-center justify-between">
              <span className="text-sm text-slate-400">Recommended risk / trade</span>
              <span className="mono text-sm font-semibold text-accent-300">{risk.recommendedRiskPct.toFixed(2)}%</span>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Calculator className="w-4 h-4 text-accent-400" /> Position-Size Calculator</h3>
          <span className="text-xs text-slate-500">Uses recommended {risk.recommendedRiskPct.toFixed(2)}% risk</span>
        </div>
        {blocked ? (
          <div className="p-8 text-center">
            <Ban className="w-8 h-8 text-bear-400/60 mx-auto mb-3" />
            <p className="text-sm text-bear-300">Calculator disabled while status is BLOCKED.</p>
            <p className="text-xs text-slate-500 mt-1">Restore your daily-loss or drawdown headroom to re-enable sizing.</p>
          </div>
        ) : (
          <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Entry Price" value={pos.entry} onChange={(v) => setPos((p) => ({ ...p, entry: v }))} mono placeholder="0.00" />
              <Field label="Stop-Loss" value={pos.stopLoss} onChange={(v) => setPos((p) => ({ ...p, stopLoss: v }))} mono placeholder="0.00" />
              <Field label="Take-Profit" value={pos.takeProfit} onChange={(v) => setPos((p) => ({ ...p, takeProfit: v }))} mono placeholder="0.00" />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <CalcCell label="Risk %" value={`${risk.recommendedRiskPct.toFixed(2)}%`} />
              <CalcCell label="$ Risk" value={calc ? fmtUsd(calc.dollarRisk) : '—'} tone="bear" />
              <CalcCell label="Position Size" value={calc ? fmtPrice(calc.positionSize, 4) : '—'} />
              <CalcCell label="R:R" value={calc ? calc.riskReward.toFixed(2) : '—'} tone="bull" />
            </div>
          </div>
        )}
      </div>

      <CorrelationEngine />
      <RiskTable />
      <Disclaimer />
    </div>
  );
}

function CorrelationEngine() {
  const { openPositions, setOpenPositions, correlationThreshold, setCorrelationThreshold, correlationWarnings } = useApp();
  const [newPos, setNewPos] = useState({ symbol: SYMBOLS[0].symbol, direction: 'BUY' as 'BUY' | 'SELL', riskPct: '0.5' });

  const addPosition = () => {
    const risk = parseFloat(newPos.riskPct);
    if (!Number.isFinite(risk) || risk <= 0) return;
    const pos: OpenPosition = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      symbol: newPos.symbol,
      direction: newPos.direction,
      riskPct: risk,
    };
    setOpenPositions((p) => [...p, pos]);
  };

  const removePosition = (id: string) => {
    setOpenPositions((p) => p.filter((pos) => pos.id !== id));
  };

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Layers className="w-4 h-4 text-accent-400" /> Correlation Engine</h3>
        <span className="text-xs text-slate-500">Same-direction risk within correlated clusters</span>
      </div>

      <div className="p-4 space-y-4">
        {/* Add position form */}
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="label">Symbol</label>
            <select
              className="input min-w-[12rem] text-xs"
              value={newPos.symbol}
              onChange={(e) => setNewPos((p) => ({ ...p, symbol: e.target.value }))}
            >
              {SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol} — {s.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Direction</label>
            <select
              className="input w-auto text-xs"
              value={newPos.direction}
              onChange={(e) => setNewPos((p) => ({ ...p, direction: e.target.value as 'BUY' | 'SELL' }))}
            >
              <option value="BUY">BUY</option>
              <option value="SELL">SELL</option>
            </select>
          </div>
          <div>
            <label className="label">Risk %</label>
            <input
              className="input-mono w-20 text-xs"
              type="number"
              step="0.1"
              min="0"
              value={newPos.riskPct}
              onChange={(e) => setNewPos((p) => ({ ...p, riskPct: e.target.value }))}
            />
          </div>
          <button onClick={addPosition} className="btn-accent">
            <Plus className="w-4 h-4" /> Add Position
          </button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <label className="text-xs text-slate-500">Threshold</label>
            <input
              className="input-mono w-16 text-xs"
              type="number"
              step="0.1"
              min="0"
              value={correlationThreshold}
              onChange={(e) => {
                const v = parseFloat(e.target.value);
                if (Number.isFinite(v) && v > 0) setCorrelationThreshold(v);
              }}
            />
            <span className="text-xs text-slate-600">%</span>
          </div>
        </div>

        {/* Open positions list */}
        {openPositions.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No open positions added. Add simulated trades above to check for correlation risk.</p>
        ) : (
          <div className="space-y-1.5">
            {openPositions.map((pos) => {
              const cluster = clusterForSymbol(pos.symbol);
              const meta = SYMBOL_MAP[pos.symbol];
              return (
                <div key={pos.id} className="flex items-center gap-3 px-3 py-2 rounded-md bg-terminal-900 border border-terminal-700/50">
                  <span className="mono text-sm text-slate-200 font-medium w-20">{pos.symbol}</span>
                  <span className={`chip ${pos.direction === 'BUY' ? 'bg-bull-500/15 text-bull-400' : 'bg-bear-500/15 text-bear-400'}`}>{pos.direction}</span>
                  <span className="mono text-xs text-slate-400">{pos.riskPct.toFixed(2)}% risk</span>
                  <span className="text-[10px] text-slate-600">{cluster?.name ?? 'Uncategorized'} · {ASSET_CLASS_LABEL[meta?.assetClass ?? 'forex']}</span>
                  <div className="flex-1" />
                  <button onClick={() => removePosition(pos.id)} className="text-slate-600 hover:text-bear-400 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              );
            })}
          </div>
        )}

        {/* Cluster warnings */}
        {correlationWarnings.length > 0 && (
          <div className="space-y-3 pt-2 border-t border-terminal-700/60">
            {correlationWarnings.map((w, i) => {
              const isBlock = w.severity === 'BLOCK';
              const bg = isBlock ? 'bg-bear-500/10 border-bear-500/30' : 'bg-warn-500/10 border-warn-500/30';
              const text = isBlock ? 'text-bear-400' : 'text-warn-400';
              return (
                <div key={i} className={`rounded-md border p-4 ${bg}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <AlertTriangle className={`w-4 h-4 ${text}`} />
                    <span className={`text-sm font-medium ${text}`}>{w.cluster.name} — {w.direction} cluster over threshold</span>
                    <span className={`chip border ${isBlock ? 'bg-bear-500/15 text-bear-400 border-bear-500/30' : 'bg-warn-500/15 text-warn-400 border-warn-500/30'}`}>{w.severity}</span>
                  </div>
                  <div className="text-xs text-slate-400 mb-2">
                    Combined same-direction risk: <span className={`mono font-medium ${text}`}>{w.combinedRiskPct.toFixed(2)}%</span>
                    {' '}({w.positions.length} positions · threshold {correlationThreshold.toFixed(1)}%)
                  </div>
                  <div className="flex flex-wrap gap-1.5 mb-2">
                    {w.positions.map((p) => (
                      <span key={p.id} className="chip bg-terminal-800 text-slate-300 border border-terminal-700 text-[10px]">
                        {p.symbol} {p.direction} {p.riskPct.toFixed(2)}%
                      </span>
                    ))}
                  </div>
                  <p className={`text-xs ${text}`}>
                    {isBlock
                      ? 'Significantly over threshold — BLOCK new entries in this cluster. Reduce existing exposure before adding more.'
                      : 'Moderately over threshold — REDUCE position size or close one of the correlated trades to bring combined risk below the threshold.'}
                  </p>
                </div>
              );
            })}
          </div>
        )}

        {/* Cluster summary (no warnings) */}
        {correlationWarnings.length === 0 && openPositions.length >= 2 && (
          <div className="pt-2 border-t border-terminal-700/60">
            <div className="flex items-center gap-2 text-xs text-bull-400">
              <span className="w-1.5 h-1.5 rounded-full bg-bull-400" />
              No correlation warnings — same-direction cluster risk is within the threshold.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function RiskTable() {
  const statuses: RiskStatus[] = ['GREEN', 'YELLOW', 'RED', 'BLOCKED'];
  return (
    <div className="card">
      <div className="card-header"><h3 className="text-sm font-semibold text-slate-200">Risk Status Reference</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-terminal-700/60">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="text-left font-medium px-3 py-2.5">Trigger</th>
              <th className="text-right font-medium px-3 py-2.5">Risk / Trade</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-terminal-700/40">
            {statuses.map((st) => (
              <tr key={st}>
                <td className="px-4 py-2.5"><StatusPill status={st} /></td>
                <td className="px-3 py-2.5 text-slate-400 text-xs">{TRIGGER_DESC[st]}</td>
                <td className="px-3 py-2.5 text-right mono text-slate-200">{RECOMMENDED_RISK[st].toFixed(2)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const TRIGGER_DESC: Record<RiskStatus, string> = {
  GREEN: 'Drawdown & daily-loss usage ≤ 40% of limits',
  YELLOW: 'Usage > 40% of a limit',
  RED: 'Usage > 70% of a limit',
  BLOCKED: 'Remaining daily-loss or max-drawdown ≤ 0',
};

function ratio(used: number, limit: number): number {
  if (limit <= 0) return 0;
  return Math.max(0, Math.min(1, used / limit));
}

function Field({ label, value, onChange, mono, tone, placeholder }: {
  label: string; value: number | string; onChange: (v: string) => void; mono?: boolean; tone?: 'bull' | 'bear'; placeholder?: string;
}) {
  const display = typeof value === 'number' ? (value === 0 && placeholder ? '' : String(value)) : value;
  const toneCls = tone === 'bear' ? 'text-bear-400' : tone === 'bull' ? 'text-bull-400' : 'text-slate-200';
  return (
    <div>
      <label className="label">{label}</label>
      <input
        className={`${mono ? 'input-mono' : 'input'} ${toneCls}`}
        type="number"
        step="any"
        value={display}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}

function Metric({ label, value, sub, pct, tone }: {
  label: string; value: string; sub: string; pct: number; tone: 'bull' | 'bear';
}) {
  const barColor = tone === 'bull' ? 'bg-bull-500' : 'bg-bear-500';
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-sm text-slate-400">{label}</span>
        <span className="text-xs text-slate-500"><span className={`mono ${tone === 'bear' ? 'text-bear-400' : 'text-bull-400'}`}>{value}</span> {sub}</span>
      </div>
      <div className="h-1.5 rounded-full bg-terminal-700 overflow-hidden">
        <div className={`h-full ${barColor} transition-all`} style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
}

function CalcCell({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'bull' | 'bear' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-200';
  return (
    <div className="bg-terminal-900 rounded-md p-3 border border-terminal-700/50">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mono text-sm mt-1 ${color}`}>{value}</div>
    </div>
  );
}
