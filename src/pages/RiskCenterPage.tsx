import { useMemo, useState } from 'react';
import { Calculator, ShieldCheck, Gauge, Ban } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { computeRisk, positionSize, RECOMMENDED_RISK } from '@/lib/risk';
import { fmtPctPlain, fmtPrice, fmtUsd } from '@/lib/format';
import { Disclaimer, SectionTitle, StatusPill } from '@/components/ui';
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

      <RiskTable />
      <Disclaimer />
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
