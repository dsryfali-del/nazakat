import { Banknote, Wallet, TrendingUp, TrendingDown, Plug, Inbox } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { fmtPct, fmtPctPlain, fmtUsd } from '@/lib/format';
import { ACCOUNT_LABEL, MODE_LABEL } from '@/lib/labels';
import { Disclaimer, EmptyState, SectionTitle, StatusPill } from '@/components/ui';

// Live Account tab — UI-only for now, no real broker connection. Displays the
// account overview using existing account state and a placeholder for open
// positions / orders that a future broker integration would populate.

export function LiveAccountPage() {
  const { session, riskInputs, risk } = useApp();
  const balance = riskInputs.accountBalance;
  const equity = riskInputs.currentEquity;
  const todayPnl = riskInputs.todayPnl;
  const up = todayPnl >= 0;

  // Margin display uses a notional "in-use" derived from a fixed assumption
  // (none in use for a demo state) — clearly labeled as illustrative.
  const marginUsed = 0;
  const freeMargin = equity - marginUsed;
  const marginLevel = marginUsed > 0 ? (equity / marginUsed) * 100 : 0;

  return (
    <div className="fade-in space-y-6">
      <SectionTitle
        title="Live Account"
        subtitle="Broker account overview — no live connection yet. Figures reflect your local account state."
        right={<StatusPill status={risk.status} />}
      />

      {/* Broker connection banner */}
      <div className="card p-4 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-terminal-800 border border-terminal-700 flex items-center justify-center shrink-0">
          <Plug className="w-5 h-5 text-slate-500" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-200">No broker connected</p>
          <p className="text-xs text-slate-500 mt-0.5">Broker integration (MetaTrader, OANDA, Interactive Brokers, etc.) is planned for a future release. Values below come from your local account settings.</p>
        </div>
        <button className="btn-ghost" disabled>Connect broker</button>
      </div>

      {/* Account overview */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Wallet className="w-4 h-4" />} label="Balance" value={fmtUsd(balance)} sub="Account balance" />
        <StatCard icon={<Banknote className="w-4 h-4" />} label="Equity" value={fmtUsd(equity)} sub={`Drawdown ${fmtPctPlain(risk.currentDrawdownPct)}`} tone={risk.currentDrawdownPct > 0 ? 'bear' : 'neutral'} />
        <StatCard
          icon={up ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          label="Today's P/L"
          value={fmtUsd(todayPnl)}
          sub={fmtPct(todayPnl === 0 ? 0 : (todayPnl / Math.max(balance, 1)) * 100)}
          tone={up ? 'bull' : 'bear'}
        />
        <StatCard icon={<Banknote className="w-4 h-4" />} label="Free Margin" value={fmtUsd(freeMargin)} sub={marginUsed > 0 ? `Level ${marginLevel.toFixed(0)}%` : 'No positions open'} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Open positions placeholder */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Inbox className="w-4 h-4 text-accent-400" /> Open Positions</h3>
            <span className="text-xs text-slate-500">0 active</span>
          </div>
          <EmptyState title="No open positions" hint="Once a broker is connected, live positions will appear here with real-time P/L." />
        </div>

        {/* Pending orders placeholder */}
        <div className="card">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Inbox className="w-4 h-4 text-accent-400" /> Pending Orders</h3>
            <span className="text-xs text-slate-500">0 pending</span>
          </div>
          <EmptyState title="No pending orders" hint="Limit and stop orders from a connected broker will be listed here." />
        </div>
      </div>

      {/* Account profile */}
      <div className="card">
        <div className="card-header"><h3 className="text-sm font-semibold text-slate-200">Account Profile</h3></div>
        <div className="p-4 grid grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
          <ProfileRow label="Account type" value={session ? ACCOUNT_LABEL[session.accountType] : '—'} />
          <ProfileRow label="Trading mode" value={session ? MODE_LABEL[session.tradingMode] : '—'} />
          <ProfileRow label="Daily-loss limit" value={`${riskInputs.dailyLossLimitPct}%`} />
          <ProfileRow label="Max drawdown" value={`${riskInputs.maxDrawdownPct}%`} />
          <ProfileRow label="Profit target" value={`${riskInputs.profitTargetPct}%`} />
          <ProfileRow label="Recommended risk" value={`${risk.recommendedRiskPct.toFixed(2)}%`} />
          <ProfileRow label="Margin used" value={fmtUsd(marginUsed)} />
          <ProfileRow label="Status" value={<StatusPill status={risk.status} />} />
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}

function StatCard({ icon, label, value, sub, tone = 'neutral' }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; tone?: 'neutral' | 'bull' | 'bear';
}) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-100';
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

function ProfileRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wider text-slate-500 mb-1">{label}</div>
      <div className="text-sm text-slate-200">{value}</div>
    </div>
  );
}
