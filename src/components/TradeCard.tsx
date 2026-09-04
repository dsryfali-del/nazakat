import type { Signal, RiskStatus, AssetClass } from '@/lib/types';
import { SYMBOL_MAP } from '@/lib/symbols';
import { decimalsFor, fmtPrice, fmtUsd, fmtNum } from '@/lib/format';
import { positionSize, RECOMMENDED_RISK } from '@/lib/risk';
import { STRATEGY_LABEL } from '@/lib/labels';
import { DirectionTag, ScoreBadge } from '@/components/ui';
import { activeNewsForSymbol } from '@/lib/news';
import { AlertTriangle } from 'lucide-react';

export type TradeCardVariant = 'full' | 'compact' | 'row';

// Compute lot-size label based on asset class contract specs (approximate/demo).
function lotSizeInfo(assetClass: AssetClass | undefined, posSize: number, symbol: string): { value: string; label: string } {
  if (assetClass === 'forex') {
    const lots = posSize / 100_000;
    return { value: fmtNum(lots, 2), label: 'lots (100k units)' };
  }
  if (assetClass === 'commodities') {
    if (symbol === 'XAUUSD') {
      const lots = posSize / 100;
      return { value: fmtNum(lots, 2), label: 'lots (100 oz)' };
    }
    const lots = posSize / 1000;
    return { value: fmtNum(lots, 2), label: 'lots (1k oz)' };
  }
  if (assetClass === 'crypto') {
    return { value: fmtNum(posSize, 4), label: 'BTC' };
  }
  if (assetClass === 'indices') {
    return { value: fmtNum(posSize, 2), label: 'units' };
  }
  // stocks: 1 unit = 1 share
  return { value: fmtNum(posSize, 0), label: 'shares' };
}

function ratingFromScore(score: number): string {
  return (score / 10).toFixed(1);
}

export type TradeCardProps = {
  signal: Signal;
  equity: number;
  riskStatus: RiskStatus;
  variant?: TradeCardVariant;
};

export function TradeMetrics({ signal, equity, riskStatus }: { signal: Signal; equity: number; riskStatus: RiskStatus }) {
  const riskPct = RECOMMENDED_RISK[riskStatus];
  const calc = positionSize({
    equity,
    riskPct,
    entry: signal.entry,
    stopLoss: signal.stopLoss,
    takeProfit: signal.takeProfit,
  });
  return { riskPct, ...calc };
}

export function TradeCard({ signal, equity, riskStatus, variant = 'full' }: TradeCardProps) {
  const d = decimalsFor(signal.symbol);
  const meta = SYMBOL_MAP[signal.symbol];
  const metrics = TradeMetrics({ signal, equity, riskStatus });
  const lotInfo = lotSizeInfo(meta?.assetClass, metrics.positionSize, signal.symbol);
  const hasNewsRisk = activeNewsForSymbol(signal.symbol).length > 0;
  const rating = ratingFromScore(signal.score);

  if (variant === 'compact') {
    return (
      <div className="rounded-md bg-terminal-900 border border-terminal-700/50 p-2.5 space-y-2">
        <div className="flex items-center gap-2">
          <span className="mono text-sm text-slate-200 font-medium">{signal.symbol}</span>
          <DirectionTag direction={signal.direction} />
          <span className="flex-1" />
          <span className="text-xs mono text-accent-300 font-medium">{rating}/10</span>
          <ScoreBadge score={signal.score} />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <Metric label="Entry" value={fmtPrice(signal.entry, d)} />
          <Metric label="SL" value={fmtPrice(signal.stopLoss, d)} tone="bear" />
          <Metric label="TP" value={fmtPrice(signal.takeProfit, d)} tone="bull" />
        </div>
        <div className="grid grid-cols-3 gap-2 text-[11px]">
          <Metric label="$ Risk" value={fmtUsd(metrics.dollarRisk)} tone="bear" />
          <Metric label="Size" value={lotInfo.value} sub={lotInfo.label} />
          <Metric label="R:R" value={metrics.riskReward.toFixed(2)} tone="bull" />
        </div>
        {hasNewsRisk && <NewsNote />}
      </div>
    );
  }

  if (variant === 'row') {
    return (
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px]">
        <span className="mono text-slate-300">R:R {metrics.riskReward.toFixed(2)}</span>
        <span className="mono text-bear-400/80">${metrics.dollarRisk.toFixed(0)}</span>
        <span className="text-slate-500">{lotInfo.value} {lotInfo.label}</span>
        <span className="text-accent-300 mono">{rating}/10</span>
        {hasNewsRisk && <span className="text-warn-400/80 flex items-center gap-0.5"><span className="w-1 h-1 rounded-full bg-warn-400" />News</span>}
      </div>
    );
  }

  // full variant — used in Dashboard Top Opportunity and expanded cards
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="mono text-lg font-semibold text-slate-100">{signal.symbol}</span>
        <DirectionTag direction={signal.direction} />
        <span className="text-xs text-slate-500">{STRATEGY_LABEL[signal.strategy]}</span>
        <span className="flex-1" />
        <div className="flex items-center gap-2">
          <span className="text-sm mono text-accent-300 font-medium">{rating}<span className="text-slate-600 text-xs">/10</span></span>
          <ScoreBadge score={signal.score} />
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Metric label="Entry" value={fmtPrice(signal.entry, d)} />
        <Metric label="Stop" value={fmtPrice(signal.stopLoss, d)} tone="bear" />
        <Metric label="Target" value={fmtPrice(signal.takeProfit, d)} tone="bull" />
      </div>
      <div className="grid grid-cols-4 gap-2">
        <Metric label="Risk %" value={`${metrics.riskPct.toFixed(2)}%`} />
        <Metric label="$ Risk" value={fmtUsd(metrics.dollarRisk)} tone="bear" />
        <Metric label={lotInfo.label} value={lotInfo.value} />
        <Metric label="R:R" value={metrics.riskReward.toFixed(2)} tone="bull" />
      </div>
      {hasNewsRisk && <NewsNote />}
    </div>
  );
}

function Metric({ label, value, sub, tone = 'neutral' }: { label: string; value: string; sub?: string; tone?: 'neutral' | 'bull' | 'bear' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-200';
  return (
    <div className="bg-terminal-900 rounded-md p-2.5 border border-terminal-700/50">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mono text-sm mt-0.5 ${color}`}>{value}</div>
      {sub && <div className="text-[9px] text-slate-600 mt-0.5">{sub}</div>}
    </div>
  );
}

function NewsNote() {
  return (
    <div className="text-[10px] text-warn-400/80 flex items-center gap-1">
      <AlertTriangle className="w-3 h-3" />
      News event nearby — reduced confidence
    </div>
  );
}
