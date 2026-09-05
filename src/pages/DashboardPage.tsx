import { Activity, ArrowRight, Crosshair, Gauge, ShieldAlert, TrendingDown, TrendingUp, Wallet } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { useAllSignals, topOpportunity, activeSignals } from '@/state/signals';
import { SYMBOL_MAP, SYMBOLS } from '@/lib/symbols';
import { fmtPct, fmtPctPlain, fmtPrice, fmtUsd } from '@/lib/format';
import { decimalsFor } from '@/lib/format';
import { STRATEGY_LABEL } from '@/lib/labels';
import { Disclaimer, DirectionTag, GatedSetup, NewsRiskBadge, RiskGateBanner, SectionTitle, StatusPill } from '@/components/ui';
import { TradeCard } from '@/components/TradeCard';
import { useNewsRisk } from '@/lib/news';
import type { Signal, RiskStatus } from '@/lib/types';

export function DashboardPage({ onNavigate }: { onNavigate: (tab: string) => void }) {
  const { riskInputs, risk } = useApp();
  const signals = useAllSignals();
  const top = topOpportunity(signals);
  const active = activeSignals(signals).slice(0, 6);
  const newsEvents = useNewsRisk(SYMBOLS.map((s) => s.symbol));

  return (
    <div className="fade-in space-y-6">
      <SectionTitle
        title="Dashboard"
        subtitle="Live snapshot of your account health and the best current setup."
        right={
          <div className="flex items-center gap-2">
            <NewsRiskBadge events={newsEvents} />
            <StatusPill status={risk.status} />
          </div>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={<Wallet className="w-4 h-4" />} label="Equity" value={fmtUsd(riskInputs.currentEquity)} sub={`Balance ${fmtUsd(riskInputs.accountBalance)}`} />
        <StatCard icon={<TrendingDown className="w-4 h-4" />} label="Drawdown" value={fmtPctPlain(risk.currentDrawdownPct)} sub={`Limit ${riskInputs.maxDrawdownPct}% · ${fmtPctPlain(risk.remainingMaxDrawdownPct)} left`} tone={risk.currentDrawdownPct > 0 ? 'bear' : 'neutral'} />
        <StatCard
          icon={riskInputs.todayPnl >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          label="Today P/L"
          value={fmtUsd(riskInputs.todayPnl)}
          sub={fmtPct(riskInputs.todayPnl === 0 ? 0 : (riskInputs.todayPnl / Math.max(riskInputs.accountBalance, 1)) * 100)}
          tone={riskInputs.todayPnl >= 0 ? 'bull' : 'bear'}
        />
        <StatCard icon={<Gauge className="w-4 h-4" />} label="Risk Used" value={fmtPctPlain(Math.max(risk.dailyLossUsedPct, risk.currentDrawdownPct))} sub={`Rec. ${risk.recommendedRiskPct.toFixed(2)}% / trade`} tone={risk.status === 'GREEN' ? 'bull' : risk.status === 'BLOCKED' ? 'bear' : 'warn'} />
      </div>

      <RiskGateBanner status={risk.status} onNavigate={onNavigate} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <GatedSetup status={risk.status}>
          <TopOpportunityCard top={top} onNavigate={onNavigate} />
        </GatedSetup>
        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Activity className="w-4 h-4 text-accent-400" /> Active Setups</h3>
            <button onClick={() => onNavigate('strategies')} className="text-xs text-accent-400 hover:text-accent-300 flex items-center gap-1">
              All strategies <ArrowRight className="w-3 h-3" />
            </button>
          </div>
          {risk.status === 'BLOCKED' ? (
            <div className="px-4 py-10 text-center">
              <p className="text-sm text-bear-400">New setups are blocked while risk status is BLOCKED.</p>
              <p className="text-xs text-slate-500 mt-1.5">Restore daily-loss or drawdown headroom in the Risk Center to re-enable trade setups.</p>
            </div>
          ) : active.length === 0 ? (
            <p className="text-sm text-slate-500 px-4 py-8 text-center">No active setups detected across the watchlist right now.</p>
          ) : (
            <div className="divide-y divide-terminal-700/60">
              {active.map((s) => <ActiveRow key={`${s.symbol}-${s.strategy}`} s={s} riskStatus={risk.status} />)}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-warn-400" /> Risk Guardrails</h3>
          <div className="space-y-2.5 text-sm">
            <GuardRow label="Daily-loss remaining" value={fmtPctPlain(risk.remainingDailyLossPct)} limit={`of ${riskInputs.dailyLossLimitPct}%`} ok={risk.remainingDailyLossPct > 0} />
            <GuardRow label="Max drawdown remaining" value={fmtPctPlain(risk.remainingMaxDrawdownPct)} limit={`of ${riskInputs.maxDrawdownPct}%`} ok={risk.remainingMaxDrawdownPct > 0} />
            <GuardRow label="Distance to profit target" value={fmtPctPlain(risk.distanceToProfitTargetPct)} limit={`of ${riskInputs.profitTargetPct}%`} ok />
          </div>
          <button onClick={() => onNavigate('risk')} className="btn-ghost w-full mt-4">Open Risk Center</button>
        </div>
        <div className="card p-4">
          <h3 className="text-sm font-semibold text-slate-200 mb-3 flex items-center gap-2"><Crosshair className="w-4 h-4 text-accent-400" /> Quick Actions</h3>
          <div className="grid grid-cols-2 gap-2.5">
            <QuickAction label="Strategies" onClick={() => onNavigate('strategies')} />
            <QuickAction label="Risk Center" onClick={() => onNavigate('risk')} />
            <QuickAction label="Trade Journal" onClick={() => onNavigate('journal')} />
            <QuickAction label="Backtesting" onClick={() => onNavigate('backtest')} />
            <QuickAction label="Charts" onClick={() => onNavigate('charts')} />
            <QuickAction label="Markets" onClick={() => onNavigate('markets')} />
          </div>
          <Disclaimer className="mt-4 pt-3 border-t border-terminal-700/60" />
        </div>
      </div>
    </div>
  );
}

function TopOpportunityCard({ top, onNavigate }: { top: Signal | null; onNavigate: (t: string) => void }) {
  const { riskInputs, risk } = useApp();
  if (!top) {
    return (
      <div className="card p-5 flex flex-col">
        <h3 className="text-sm font-semibold text-slate-200 mb-3">Top Opportunity</h3>
        <div className="flex-1 flex flex-col items-center justify-center text-center py-8">
          <div className="w-12 h-12 rounded-full bg-terminal-800 border border-terminal-700 flex items-center justify-center mb-3">
            <Activity className="w-5 h-5 text-slate-600" />
          </div>
          <p className="text-sm font-medium text-slate-300">NO A+ SETUP FOUND</p>
          <p className="text-xs text-slate-500 mt-1.5 max-w-[15rem]">No active setup scores 80 or above. We don't force low-quality trades.</p>
        </div>
        <button onClick={() => onNavigate('strategies')} className="btn-ghost w-full mt-2">Review all setups</button>
      </div>
    );
  }
  return (
    <div className="card p-5 flex flex-col border-accent-500/30">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-slate-200">Top Opportunity</h3>
        <span className="text-[10px] text-slate-600">approximate · demo</span>
      </div>
      <TradeCard signal={top} equity={riskInputs.currentEquity} riskStatus={risk.status} variant="full" />
      <p className="text-xs text-slate-400 leading-relaxed mt-3 flex-1">{top.reason}</p>
      <button onClick={() => onNavigate('strategies')} className="btn-accent w-full mt-4">View full setup</button>
    </div>
  );
}

function ActiveRow({ s, riskStatus }: { s: Signal; riskStatus: RiskStatus }) {
  const { riskInputs } = useApp();
  return (
    <div className="px-4 py-2.5 hover:bg-terminal-800/50">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-20 text-sm mono text-slate-200 font-medium">{s.symbol}</div>
        <DirectionTag direction={s.direction} />
        <div className="text-xs text-slate-500 hidden sm:block">{STRATEGY_LABEL[s.strategy]}</div>
        <div className="flex-1" />
        {riskStatus === 'RED' && <span className="chip bg-bear-500/15 text-bear-400 border border-bear-500/30 text-[10px]">FLAGGED</span>}
        <span className="text-xs mono text-accent-300 font-medium">{(s.score / 10).toFixed(1)}/10</span>
      </div>
      <TradeCard signal={s} equity={riskInputs.currentEquity} riskStatus={riskStatus} variant="row" />
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone = 'neutral' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'neutral' | 'bull' | 'bear' | 'warn';
}) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : tone === 'warn' ? 'text-warn-400' : 'text-slate-100';
  return (
    <div className="card p-4">
      <div className="flex items-center gap-2 text-slate-400 mb-2">
        {icon}
        <span className="text-xs uppercase tracking-wider">{label}</span>
      </div>
      <div className={`mono text-xl font-semibold ${color}`}>{value}</div>
      {sub && <div className={`text-xs mt-1 ${tone === 'bear' ? 'text-bear-400/80' : 'text-slate-500'}`}>{sub}</div>}
    </div>
  );
}

function Cell({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'bull' | 'bear' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-200';
  return (
    <div className="bg-terminal-900 rounded-md p-2.5 border border-terminal-700/50">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mono text-sm mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}

function GuardRow({ label, value, limit, ok }: { label: string; value: string; limit: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-slate-400">{label}</span>
      <span className="flex items-center gap-2">
        <span className={`mono ${ok ? 'text-slate-200' : 'text-bear-400'}`}>{value}</span>
        <span className="text-xs text-slate-600">{limit}</span>
      </span>
    </div>
  );
}

function QuickAction({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="p-3 rounded-md bg-terminal-900 border border-terminal-700 hover:border-accent-500/50 hover:bg-terminal-800 text-sm text-slate-300 transition-colors text-left">
      {label}
    </button>
  );
}
