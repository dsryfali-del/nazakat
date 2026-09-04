import { Ban } from 'lucide-react';
import type { RiskStatus } from '@/lib/types';

// Shared small UI primitives used across pages.

export function StatusPill({ status, className = '' }: { status: RiskStatus; className?: string }) {
  const map: Record<RiskStatus, { label: string; cls: string; dot: string }> = {
    GREEN: { label: 'SAFE', cls: 'bg-bull-500/15 text-bull-400 border-bull-500/30', dot: 'bg-bull-400' },
    YELLOW: { label: 'CAUTION', cls: 'bg-warn-500/15 text-warn-400 border-warn-500/30', dot: 'bg-warn-400' },
    RED: { label: 'DANGER', cls: 'bg-bear-500/15 text-bear-400 border-bear-500/30', dot: 'bg-bear-400' },
    BLOCKED: { label: 'BLOCKED', cls: 'bg-bear-600/25 text-bear-400 border-bear-600/40', dot: 'bg-bear-500' },
  };
  const s = map[status];
  return (
    <span className={`pill border ${s.cls} ${className}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} ${status === 'BLOCKED' ? 'animate-pulse' : ''}`} />
      {s.label}
    </span>
  );
}

export function DirectionTag({ direction, className = '' }: { direction: 'BUY' | 'SELL' | 'NO TRADE'; className?: string }) {
  if (direction === 'NO TRADE') return <span className={`chip bg-terminal-700 text-slate-400 ${className}`}>NO TRADE</span>;
  const buy = direction === 'BUY';
  return (
    <span className={`chip ${buy ? 'bg-bull-500/15 text-bull-400' : 'bg-bear-500/15 text-bear-400'} ${className}`}>
      {direction}
    </span>
  );
}

export function ScoreBadge({ score, threshold = 80 }: { score: number; threshold?: number }) {
  const elite = score >= threshold;
  const good = score >= 60;
  const cls = elite ? 'bg-accent-600/20 text-accent-300 border-accent-500/40' : good ? 'bg-steel-500/15 text-steel-400 border-steel-500/30' : 'bg-terminal-700 text-slate-400 border-terminal-600';
  return <span className={`chip border ${cls}`}>{score}</span>;
}

export function DataBadge({ source, className = '' }: { source: 'live' | 'demo' | 'loading'; className?: string }) {
  if (source === 'loading') {
    return (
      <span className={`pill border bg-terminal-700 text-slate-400 border-terminal-600 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 animate-pulse" />
        Loading…
      </span>
    );
  }
  if (source === 'live') {
    return (
      <span className={`pill border bg-bull-500/15 text-bull-400 border-bull-500/30 ${className}`}>
        <span className="w-1.5 h-1.5 rounded-full bg-bull-400" />
        Live data
      </span>
    );
  }
  return (
    <span className={`pill border bg-terminal-700 text-slate-400 border-terminal-600 ${className}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
      Demo data
    </span>
  );
}

export function NewsRiskBadge({ events, className = '' }: { events: { title: string }[]; className?: string }) {
  if (events.length === 0) return null;
  const titles = events.map((e) => e.title).join(', ');
  return (
    <span
      className={`pill border bg-warn-500/15 text-warn-400 border-warn-500/30 cursor-help ${className}`}
      title={titles}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-warn-400 animate-pulse" />
      News risk
    </span>
  );
}

export function Disclaimer({ className = '' }: { className?: string }) {
  return (
    <div className={`text-[11px] text-slate-500 leading-relaxed ${className}`}>
      Demo data only — not financial advice. AlphaEdge shows analysis and recommendations; you execute trades manually. Past performance never guarantees future results.
    </div>
  );
}

export function RiskGateBanner({ status, onNavigate, className = '' }: { status: RiskStatus; onNavigate?: (tab: string) => void; className?: string }) {
  if (status === 'GREEN' || status === 'YELLOW') return null;
  const blocked = status === 'BLOCKED';
  const bg = blocked ? 'bg-bear-600/10 border-bear-600/40' : 'bg-bear-500/10 border-bear-500/30';
  const title = blocked ? 'Trading Blocked' : 'Risk Elevated — Trade With Caution';
  const msg = blocked
    ? 'Your daily-loss or max-drawdown limit is exhausted. All new trade setups are blocked until risk headroom is restored.'
    : 'Risk status is RED. New setups are flagged — only take A+ entries with reduced position size.';
  return (
    <div className={`card border ${bg} p-4 flex items-start gap-3 ${className}`}>
      <Ban className={`w-5 h-5 shrink-0 mt-0.5 ${blocked ? 'text-bear-400' : 'text-bear-400/80'}`} />
      <div className="flex-1">
        <p className={`text-sm font-medium ${blocked ? 'text-bear-300' : 'text-bear-400'}`}>{title}</p>
        <p className="text-xs text-slate-400 mt-1">{msg}</p>
        {onNavigate && (
          <button onClick={() => onNavigate('risk')} className="text-xs text-accent-400 hover:text-accent-300 mt-2">
            Open Risk Center →
          </button>
        )}
      </div>
    </div>
  );
}

export function GatedSetup({ status, children }: { status: RiskStatus; children: React.ReactNode }) {
  if (status === 'BLOCKED') {
    return (
      <div className="relative opacity-40 select-none">
        <div className="pointer-events-none blur-[1px]">{children}</div>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="chip bg-bear-600/20 text-bear-400 border border-bear-600/30">BLOCKED</span>
        </div>
      </div>
    );
  }
  if (status === 'RED') {
    return (
      <div className="relative">
        {children}
        <span className="absolute top-1.5 right-1.5 chip bg-bear-500/15 text-bear-400 border border-bear-500/30 text-[10px]">RISK RED</span>
      </div>
    );
  }
  return <>{children}</>;
}

export function ComingSoon({ title, description }: { title: string; description: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-24 px-6 fade-in">
      <div className="w-14 h-14 rounded-xl bg-terminal-800 border border-terminal-700 flex items-center justify-center mb-5">
        <span className="text-2xl text-bull-400 mono">α</span>
      </div>
      <h2 className="text-xl font-semibold text-slate-200">{title}</h2>
      <p className="text-sm text-slate-400 mt-2 max-w-md">{description}</p>
      <p className="text-xs text-slate-600 mt-6">Coming soon</p>
    </div>
  );
}

export function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="text-center py-16 px-6">
      <p className="text-sm text-slate-400">{title}</p>
      {hint && <p className="text-xs text-slate-600 mt-1.5">{hint}</p>}
    </div>
  );
}

export function SectionTitle({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">{title}</h1>
        {subtitle && <p className="text-sm text-slate-400 mt-0.5">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
