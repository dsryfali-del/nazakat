import { TrendingDown, TrendingUp, Wallet, Percent, AlertTriangle } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { ACCOUNT_LABEL, MODE_LABEL } from '@/lib/labels';
import { fmtPct, fmtPctPlain, fmtUsd } from '@/lib/format';
import { StatusPill } from './ui';

// Persistent header: account badge, status pill, equity, drawdown, today's P/L.
export function Header() {
  const { session, riskInputs, risk, correlationWarnings } = useApp();
  const todayPnl = riskInputs.todayPnl;
  const up = todayPnl >= 0;
  const hasCorrelationRisk = correlationWarnings.length > 0;
  const correlationTooltip = correlationWarnings
    .map((w) => `${w.cluster.name} ${w.direction}: ${w.combinedRiskPct.toFixed(2)}% (${w.severity})`)
    .join('\n');

  return (
    <header className="h-16 sticky top-0 z-20 bg-terminal-900/95 backdrop-blur border-b border-terminal-700/70 flex items-center px-5 gap-5">
      <div className="flex items-center gap-2">
        <span className="pill bg-terminal-800 text-slate-300 border border-terminal-700">
          {session ? ACCOUNT_LABEL[session.accountType] : '—'}
        </span>
        <span className="pill bg-terminal-800 text-slate-400 border border-terminal-700 hidden sm:inline-flex">
          {session ? MODE_LABEL[session.tradingMode] : '—'}
        </span>
      </div>

      <div className="hidden md:flex items-center gap-2">
        {hasCorrelationRisk && (
          <span
            className="pill border bg-warn-500/15 text-warn-400 border-warn-500/30 cursor-help"
            title={correlationTooltip}
          >
            <AlertTriangle className="w-3 h-3" />
            Correlation risk
          </span>
        )}
        <StatusPill status={risk.status} />
      </div>

      <div className="flex-1" />

      <HeaderStat
        icon={<Wallet className="w-3.5 h-3.5" />}
        label="Equity"
        value={fmtUsd(riskInputs.currentEquity)}
      />
      <HeaderStat
        icon={<Percent className="w-3.5 h-3.5" />}
        label="Drawdown"
        value={fmtPctPlain(risk.currentDrawdownPct)}
        tone={risk.currentDrawdownPct > 0 ? 'bear' : 'neutral'}
      />
      <HeaderStat
        icon={up ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
        label="Today P/L"
        value={`${fmtUsd(todayPnl)} (${fmtPct(todayPnl === 0 ? 0 : (todayPnl / Math.max(riskInputs.accountBalance, 1)) * 100)})`}
        tone={up ? 'bull' : 'bear'}
      />
    </header>
  );
}

function HeaderStat({ icon, label, value, tone = 'neutral' }: {
  icon: React.ReactNode; label: string; value: string; tone?: 'neutral' | 'bull' | 'bear';
}) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-200';
  return (
    <div className="hidden lg:flex items-center gap-2.5 pl-5 border-l border-terminal-700/70">
      <div className="text-slate-500">{icon}</div>
      <div>
        <div className="text-[10px] uppercase tracking-wider text-slate-500 leading-none">{label}</div>
        <div className={`mono text-sm font-medium leading-tight mt-0.5 ${color}`}>{value}</div>
      </div>
    </div>
  );
}
