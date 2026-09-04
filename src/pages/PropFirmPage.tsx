import { Target, ShieldAlert, TrendingDown, Ban, Gauge, Trophy } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { fmtPctPlain, fmtUsd } from '@/lib/format';
import { Disclaimer, SectionTitle, StatusPill } from '@/components/ui';

// Prop Firm tab reuses the Risk Center calculations (computeRisk via useApp).
// It reframes the same numbers as prop-firm rule tracking: profit target
// progress, daily-loss rule, drawdown breach monitoring, and trading status.

export function PropFirmPage() {
  const { riskInputs, risk } = useApp();
  const blocked = risk.status === 'BLOCKED';

  const balance = riskInputs.accountBalance;
  const equity = riskInputs.currentEquity;
  const targetEquity = balance * (1 + riskInputs.profitTargetPct / 100);
  const profitProgress = Math.min(100, Math.max(0, ((equity - balance) / (targetEquity - balance)) * 100));

  const dailyLossUsedPct = risk.dailyLossUsedPct;
  const dailyLossLimitPct = riskInputs.dailyLossLimitPct;
  const dailyLossUsedRatio = dailyLossLimitPct > 0 ? dailyLossUsedPct / dailyLossLimitPct : 0;

  const ddUsedPct = risk.currentDrawdownPct;
  const ddLimitPct = riskInputs.maxDrawdownPct;
  const ddUsedRatio = ddLimitPct > 0 ? ddUsedPct / ddLimitPct : 0;

  return (
    <div className="fade-in space-y-6">
      <SectionTitle
        title="Prop Firm"
        subtitle="Evaluation rule tracking — profit target, daily-loss, and drawdown guardrails."
        right={<StatusPill status={risk.status} />}
      />

      {blocked && (
        <div className="card border-bear-600/40 bg-bear-600/10 p-4 flex items-start gap-3">
          <Ban className="w-5 h-5 text-bear-400 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-bear-300">Trading blocked — no new trades permitted.</p>
            <p className="text-xs text-bear-400/80 mt-1">A prop-firm rule has been breached. Restore your daily-loss or drawdown headroom before placing new trades.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Profit target progress */}
        <div className="card p-5 flex flex-col">
          <div className="flex items-center gap-2 text-slate-400 mb-3">
            <Trophy className="w-4 h-4 text-accent-400" />
            <span className="text-xs uppercase tracking-wider">Profit Target</span>
          </div>
          <div className="mono text-2xl font-semibold text-slate-100">{fmtUsd(equity)}</div>
          <div className="text-xs text-slate-500 mt-1">of <span className="mono">{fmtUsd(targetEquity)}</span> target ({riskInputs.profitTargetPct}%)</div>
          <div className="mt-4 mb-2">
            <div className="h-2 rounded-full bg-terminal-700 overflow-hidden">
              <div className="h-full bg-accent-500 transition-all" style={{ width: `${profitProgress}%` }} />
            </div>
          </div>
          <div className="text-xs text-slate-400 mt-auto pt-3">
            {profitProgress >= 100
              ? <span className="text-bull-400">Target reached — evaluation passed.</span>
              : <span><span className="mono text-accent-300">{fmtPctPlain(profitProgress)}</span> complete · <span className="mono">{fmtPctPlain(risk.distanceToProfitTargetPct)}</span> to go</span>}
          </div>
        </div>

        {/* Daily-loss rule */}
        <RuleCard
          icon={<TrendingDown className="w-4 h-4 text-bear-400" />}
          title="Daily-Loss Rule"
          usedLabel="Loss used today"
          usedValue={fmtPctPlain(dailyLossUsedPct)}
          limitLabel={`of ${dailyLossLimitPct}% limit`}
          remainingValue={fmtPctPlain(risk.remainingDailyLossPct)}
          ratio={dailyLossUsedRatio}
          tone="bear"
          breach={risk.remainingDailyLossPct <= 0}
          breachText="Daily-loss limit breached — trading halted for the day."
        />

        {/* Drawdown breach monitoring */}
        <RuleCard
          icon={<ShieldAlert className="w-4 h-4 text-warn-400" />}
          title="Max Drawdown"
          usedLabel="Current drawdown"
          usedValue={fmtPctPlain(ddUsedPct)}
          limitLabel={`of ${ddLimitPct}% limit`}
          remainingValue={fmtPctPlain(risk.remainingMaxDrawdownPct)}
          ratio={ddUsedRatio}
          tone="bear"
          breach={risk.remainingMaxDrawdownPct <= 0}
          breachText="Max drawdown breached — account at risk of failure."
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Gauge className="w-4 h-4 text-accent-400" /> Rule Summary</h3></div>
          <div className="p-4 space-y-3 text-sm">
            <SummaryRow label="Account balance" value={fmtUsd(balance)} />
            <SummaryRow label="Current equity" value={fmtUsd(equity)} />
            <SummaryRow label="Today's P/L" value={fmtUsd(riskInputs.todayPnl)} tone={riskInputs.todayPnl >= 0 ? 'bull' : 'bear'} />
            <SummaryRow label="Profit target" value={fmtUsd(targetEquity)} />
            <SummaryRow label="Recommended risk / trade" value={`${risk.recommendedRiskPct.toFixed(2)}%`} tone="accent" />
            <SummaryRow label="Trading status" value={<StatusPill status={risk.status} />} />
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Target className="w-4 h-4 text-accent-400" /> Evaluation Phases</h3></div>
          <div className="p-4 space-y-3">
            <PhaseRow phase="Phase 1" desc="Hit profit target without breaching drawdown" done={profitProgress >= 100} />
            <PhaseRow phase="Phase 2" desc="Repeat consistency over a second period" done={false} />
            <PhaseRow phase="Funded" desc="Live funded account upon passing both phases" done={false} />
          </div>
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}

function RuleCard({ icon, title, usedLabel, usedValue, limitLabel, remainingValue, ratio, tone, breach, breachText }: {
  icon: React.ReactNode; title: string; usedLabel: string; usedValue: string; limitLabel: string;
  remainingValue: string; ratio: number; tone: 'bear' | 'warn'; breach: boolean; breachText: string;
}) {
  const barColor = breach ? 'bg-bear-600' : tone === 'bear' ? 'bg-bear-500' : 'bg-warn-500';
  return (
    <div className={`card p-5 flex flex-col ${breach ? 'border-bear-600/40' : ''}`}>
      <div className="flex items-center gap-2 text-slate-400 mb-3">
        {icon}
        <span className="text-xs uppercase tracking-wider">{title}</span>
      </div>
      <div className="mono text-2xl font-semibold text-slate-100">{usedValue}</div>
      <div className="text-xs text-slate-500 mt-1">{usedLabel} · {limitLabel}</div>
      <div className="mt-4 mb-2">
        <div className="h-2 rounded-full bg-terminal-700 overflow-hidden">
          <div className={`h-full ${barColor} transition-all`} style={{ width: `${Math.min(100, ratio * 100)}%` }} />
        </div>
      </div>
      {breach ? (
        <p className="text-xs text-bear-400 mt-auto pt-3">{breachText}</p>
      ) : (
        <p className="text-xs text-slate-400 mt-auto pt-3"><span className="mono">{remainingValue}</span> remaining</p>
      )}
    </div>
  );
}

function SummaryRow({ label, value, tone = 'neutral' }: { label: string; value: React.ReactNode; tone?: 'neutral' | 'bull' | 'bear' | 'accent' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : tone === 'accent' ? 'text-accent-300' : 'text-slate-200';
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className={`mono ${color}`}>{value}</span>
    </div>
  );
}

function PhaseRow({ phase, desc, done }: { phase: string; desc: string; done: boolean }) {
  return (
    <div className="flex items-start gap-3 p-3 rounded-md bg-terminal-900 border border-terminal-700/50">
      <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 text-xs ${done ? 'bg-bull-500/20 text-bull-400 border border-bull-500/40' : 'bg-terminal-700 text-slate-500 border border-terminal-600'}`}>
        {done ? '✓' : '○'}
      </div>
      <div>
        <div className="text-sm text-slate-200">{phase}</div>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
    </div>
  );
}
