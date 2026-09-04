import { useMemo, useState } from 'react';
import { BookPlus, BookOpen, Trash2, Brain, TrendingUp, TrendingDown, AlertTriangle, Target, Zap } from 'lucide-react';
import { usePersistentState } from '@/lib/usePersistentState';
import { SYMBOLS } from '@/lib/symbols';
import { ENGINES } from '@/lib/strategies';
import { decimalsFor, fmtPrice, fmtR } from '@/lib/format';
import { STRATEGY_LABEL } from '@/lib/labels';
import { Disclaimer, EmptyState, SectionTitle } from '@/components/ui';
import type { Trade, StrategyId } from '@/lib/types';

const ENGINE_IDS = Object.keys(ENGINES) as (keyof typeof ENGINES)[];

export function JournalPage() {
  const [trades, setTrades] = usePersistentState<Trade[]>('ae_trades', []);
  const [form, setForm] = useState({
    asset: SYMBOLS[0].symbol, strategy: 'trend' as string, direction: 'BUY' as 'BUY' | 'SELL',
    entry: '', stopLoss: '', takeProfit: '', resultR: '', notes: '',
  });

  const stats = useMemo(() => computeStats(trades), [trades]);

  const addTrade = (e: React.FormEvent) => {
    e.preventDefault();
    const entry = parseFloat(form.entry);
    const resultR = parseFloat(form.resultR);
    if (!Number.isFinite(entry) || !Number.isFinite(resultR)) return;
    const trade: Trade = {
      id: crypto.randomUUID(),
      time: Date.now(),
      asset: form.asset,
      strategy: form.strategy,
      direction: form.direction,
      entry,
      stopLoss: parseFloat(form.stopLoss) || 0,
      takeProfit: parseFloat(form.takeProfit) || 0,
      resultR,
      notes: form.notes,
    };
    setTrades((p) => [trade, ...p]);
    setForm((f) => ({ ...f, entry: '', stopLoss: '', takeProfit: '', resultR: '', notes: '' }));
  };

  const remove = (id: string) => setTrades((p) => p.filter((t) => t.id !== id));

  return (
    <div className="fade-in space-y-6">
      <SectionTitle title="Trade Journal" subtitle="Log trades, track R-multiples, and review your edge over time." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatBox label="Total Trades" value={String(stats.total)} />
        <StatBox label="Win Rate" value={stats.total ? `${stats.winRate.toFixed(1)}%` : '—'} tone={stats.winRate >= 50 ? 'bull' : 'bear'} />
        <StatBox label="Profit Factor" value={stats.total ? stats.profitFactor.toFixed(2) : '—'} tone={stats.profitFactor >= 1 ? 'bull' : 'bear'} />
        <StatBox label="Average R" value={stats.total ? fmtR(stats.avgR) : '—'} tone={stats.avgR >= 0 ? 'bull' : 'bear'} />
      </div>

      <PerformanceCoach trades={trades} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <form onSubmit={addTrade} className="card lg:col-span-1">
          <div className="card-header"><h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><BookPlus className="w-4 h-4 text-accent-400" /> Log Trade</h3></div>
          <div className="p-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Asset</label>
                <select className="input" value={form.asset} onChange={(e) => setForm((f) => ({ ...f, asset: e.target.value }))}>
                  {SYMBOLS.map((s) => <option key={s.symbol} value={s.symbol}>{s.symbol}</option>)}
                </select>
              </div>
              <div>
                <label className="label">Direction</label>
                <select className="input" value={form.direction} onChange={(e) => setForm((f) => ({ ...f, direction: e.target.value as 'BUY' | 'SELL' }))}>
                  <option value="BUY">BUY</option>
                  <option value="SELL">SELL</option>
                </select>
              </div>
            </div>
            <div>
              <label className="label">Strategy</label>
              <select className="input" value={form.strategy} onChange={(e) => setForm((f) => ({ ...f, strategy: e.target.value }))}>
                {ENGINE_IDS.map((id) => <option key={id} value={id}>{STRATEGY_LABEL[id]}</option>)}
                <option value="manual">Manual / Discretionary</option>
              </select>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div><label className="label">Entry</label><input className="input-mono" type="number" step="any" value={form.entry} onChange={(e) => setForm((f) => ({ ...f, entry: e.target.value }))} placeholder="0.00" /></div>
              <div><label className="label">Stop</label><input className="input-mono" type="number" step="any" value={form.stopLoss} onChange={(e) => setForm((f) => ({ ...f, stopLoss: e.target.value }))} placeholder="0.00" /></div>
              <div><label className="label">Target</label><input className="input-mono" type="number" step="any" value={form.takeProfit} onChange={(e) => setForm((f) => ({ ...f, takeProfit: e.target.value }))} placeholder="0.00" /></div>
            </div>
            <div>
              <label className="label">Result (R-multiple)</label>
              <input className="input-mono" type="number" step="any" value={form.resultR} onChange={(e) => setForm((f) => ({ ...f, resultR: e.target.value }))} placeholder="e.g. 2.5 or -1" />
            </div>
            <div>
              <label className="label">Notes</label>
              <textarea className="input min-h-[60px] resize-y" value={form.notes} onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))} placeholder="Setup, context, mistakes…" />
            </div>
            <button type="submit" className="btn-accent w-full">Add to journal</button>
          </div>
        </form>

        <div className="card lg:col-span-2">
          <div className="card-header">
            <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><BookOpen className="w-4 h-4 text-accent-400" /> Trade Log</h3>
            {trades.length > 0 && <span className="text-xs text-slate-500">{trades.length} entries</span>}
          </div>
          {trades.length === 0 ? (
            <EmptyState title="No trades logged yet" hint="Use the form to record your first trade." />
          ) : (
            <div className="overflow-x-auto max-h-[34rem] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-slate-500 border-b border-terminal-700/60 sticky top-0 bg-terminal-850">
                  <tr>
                    <th className="text-left font-medium px-4 py-2.5">Asset</th>
                    <th className="text-left font-medium px-3 py-2.5">Dir</th>
                    <th className="text-left font-medium px-3 py-2.5">Strategy</th>
                    <th className="text-right font-medium px-3 py-2.5">Entry</th>
                    <th className="text-right font-medium px-3 py-2.5">Result</th>
                    <th className="text-left font-medium px-3 py-2.5">Notes</th>
                    <th className="px-3 py-2.5"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-terminal-700/40">
                  {trades.map((t) => {
                    const d = decimalsFor(t.asset);
                    return (
                      <tr key={t.id} className="hover:bg-terminal-800/40">
                        <td className="px-4 py-2.5 mono text-slate-200 font-medium">{t.asset}</td>
                        <td className="px-3 py-2.5">
                          <span className={`chip ${t.direction === 'BUY' ? 'bg-bull-500/15 text-bull-400' : 'bg-bear-500/15 text-bear-400'}`}>{t.direction}</span>
                        </td>
                        <td className="px-3 py-2.5 text-xs text-slate-400">{STRATEGY_LABEL[t.strategy] ?? 'Manual'}</td>
                        <td className="px-3 py-2.5 text-right mono text-slate-300">{fmtPrice(t.entry, d)}</td>
                        <td className={`px-3 py-2.5 text-right mono ${t.resultR >= 0 ? 'text-bull-400' : 'text-bear-400'}`}>{fmtR(t.resultR)}</td>
                        <td className="px-3 py-2.5 text-xs text-slate-500 max-w-xs truncate">{t.notes || '—'}</td>
                        <td className="px-3 py-2.5 text-right">
                          <button onClick={() => remove(t.id)} className="text-slate-600 hover:text-bear-400 transition-colors" aria-label="Delete trade">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
      <Disclaimer />
    </div>
  );
}

function computeStats(trades: Trade[]) {
  const total = trades.length;
  if (total === 0) return { total: 0, winRate: 0, profitFactor: 0, avgR: 0 };
  const wins = trades.filter((t) => t.resultR > 0);
  const losses = trades.filter((t) => t.resultR <= 0);
  const grossWin = wins.reduce((s, t) => s + t.resultR, 0);
  const grossLoss = Math.abs(losses.reduce((s, t) => s + t.resultR, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  return {
    total,
    winRate: (wins.length / total) * 100,
    profitFactor,
    avgR: trades.reduce((s, t) => s + t.resultR, 0) / total,
  };
}

function StatBox({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'bull' | 'bear' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-100';
  return (
    <div className="card p-4">
      <div className="text-xs uppercase tracking-wider text-slate-500 mb-2">{label}</div>
      <div className={`mono text-xl font-semibold ${color}`}>{value}</div>
    </div>
  );
}

type CoachInsight = {
  type: 'strength' | 'weakness' | 'warning' | 'tip';
  icon: React.ReactNode;
  title: string;
  detail: string;
};

type CoachAnalysis = {
  insights: CoachInsight[];
  bestStrategy: { name: string; winRate: number; avgR: number; trades: number } | null;
  worstStrategy: { name: string; winRate: number; avgR: number; trades: number } | null;
  buyWinRate: number;
  sellWinRate: number;
  currentStreak: { type: 'win' | 'loss' | 'none'; count: number };
  avgWinR: number;
  avgLossR: number;
  totalTrades: number;
};

function analyzeTrades(trades: Trade[]): CoachAnalysis {
  const total = trades.length;
  const insights: CoachInsight[] = [];

  if (total === 0) {
    return {
      insights: [],
      bestStrategy: null,
      worstStrategy: null,
      buyWinRate: 0,
      sellWinRate: 0,
      currentStreak: { type: 'none', count: 0 },
      avgWinR: 0,
      avgLossR: 0,
      totalTrades: 0,
    };
  }

  const sorted = [...trades].sort((a, b) => a.time - b.time);

  // Per-strategy stats.
  const stratMap: Record<string, { wins: number; losses: number; totalR: number; count: number }> = {};
  for (const t of sorted) {
    const key = t.strategy;
    if (!stratMap[key]) stratMap[key] = { wins: 0, losses: 0, totalR: 0, count: 0 };
    stratMap[key].count++;
    stratMap[key].totalR += t.resultR;
    if (t.resultR > 0) stratMap[key].wins++;
    else stratMap[key].losses++;
  }

  let bestStrategy: CoachAnalysis['bestStrategy'] = null;
  let worstStrategy: CoachAnalysis['worstStrategy'] = null;

  for (const [key, s] of Object.entries(stratMap)) {
    if (s.count < 2) continue;
    const wr = (s.wins / s.count) * 100;
    const avgR = s.totalR / s.count;
    const entry = { name: STRATEGY_LABEL[key as StrategyId] ?? 'Manual', winRate: wr, avgR, trades: s.count };
    if (!bestStrategy || avgR > bestStrategy.avgR) bestStrategy = entry;
    if (!worstStrategy || avgR < worstStrategy.avgR) worstStrategy = entry;
  }

  // Direction stats.
  const buys = sorted.filter((t) => t.direction === 'BUY');
  const sells = sorted.filter((t) => t.direction === 'SELL');
  const buyWinRate = buys.length > 0 ? (buys.filter((t) => t.resultR > 0).length / buys.length) * 100 : 0;
  const sellWinRate = sells.length > 0 ? (sells.filter((t) => t.resultR > 0).length / sells.length) * 100 : 0;

  // Streak detection.
  let streakType: 'win' | 'loss' | 'none' = 'none';
  let streakCount = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const isWin = sorted[i].resultR > 0;
    if (streakType === 'none') {
      streakType = isWin ? 'win' : 'loss';
      streakCount = 1;
    } else if ((streakType === 'win' && isWin) || (streakType === 'loss' && !isWin)) {
      streakCount++;
    } else {
      break;
    }
  }

  // Average win/loss R.
  const wins = sorted.filter((t) => t.resultR > 0);
  const losses = sorted.filter((t) => t.resultR <= 0);
  const avgWinR = wins.length > 0 ? wins.reduce((s, t) => s + t.resultR, 0) / wins.length : 0;
  const avgLossR = losses.length > 0 ? losses.reduce((s, t) => s + t.resultR, 0) / losses.length : 0;

  // --- Generate insights ---

  if (bestStrategy && bestStrategy.avgR > 0) {
    insights.push({
      type: 'strength',
      icon: <TrendingUp className="w-4 h-4 text-bull-400" />,
      title: `${bestStrategy.name} is your strongest engine`,
      detail: `${bestStrategy.winRate.toFixed(0)}% win rate, avg ${fmtR(bestStrategy.avgR)} over ${bestStrategy.trades} trades. Lean into this setup when it appears.`,
    });
  }

  if (worstStrategy && worstStrategy.avgR < 0 && worstStrategy.name !== bestStrategy?.name) {
    insights.push({
      type: 'weakness',
      icon: <TrendingDown className="w-4 h-4 text-bear-400" />,
      title: `${worstStrategy.name} is dragging your performance`,
      detail: `${worstStrategy.winRate.toFixed(0)}% win rate, avg ${fmtR(worstStrategy.avgR)} over ${worstStrategy.trades} trades. Review your entry criteria or pause this strategy.`,
    });
  }

  if (streakType === 'loss' && streakCount >= 3) {
    insights.push({
      type: 'warning',
      icon: <AlertTriangle className="w-4 h-4 text-warn-400" />,
      title: `${streakCount}-trade losing streak`,
      detail: 'Consider stepping back, reducing size, or reviewing your last few entries for a pattern. Don\'t chase to recover losses.',
    });
  }

  if (streakType === 'win' && streakCount >= 3) {
    insights.push({
      type: 'strength',
      icon: <Zap className="w-4 h-4 text-bull-400" />,
      title: `${streakCount}-trade winning streak`,
      detail: 'You\'re in sync with the market. Stay disciplined — don\'t increase risk just because you\'re winning. Keep position size consistent.',
    });
  }

  if (buys.length >= 3 && sells.length >= 3 && Math.abs(buyWinRate - sellWinRate) > 20) {
    const better = buyWinRate > sellWinRate ? 'BUY' : 'SELL';
    insights.push({
      type: 'tip',
      icon: <Target className="w-4 h-4 text-accent-400" />,
      title: `Your ${better} setups are outperforming`,
      detail: `Buy win rate: ${buyWinRate.toFixed(0)}%, Sell win rate: ${sellWinRate.toFixed(0)}%. Consider focusing on ${better} opportunities until the imbalance narrows.`,
    });
  }

  if (avgLossR < -1.5 && avgWinR > 0) {
    insights.push({
      type: 'warning',
      icon: <AlertTriangle className="w-4 h-4 text-warn-400" />,
      title: 'Your losses are larger than 1R on average',
      detail: `Avg loss: ${fmtR(avgLossR)}. You may be moving stops or holding through invalidations. Stick to your original stop-loss.`,
    });
  }

  if (total >= 5 && avgWinR > 0 && avgLossR < 0) {
    const rrRatio = Math.abs(avgWinR / avgLossR);
    if (rrRatio < 1) {
      insights.push({
        type: 'tip',
        icon: <Target className="w-4 h-4 text-accent-400" />,
        title: 'Your risk-reward ratio needs work',
        detail: `Avg win ${fmtR(avgWinR)} vs avg loss ${fmtR(avgLossR)} — ratio of ${rrRatio.toFixed(2)}:1. Aim for at least 1.5:1 by widening targets or tightening stops.`,
      });
    } else if (rrRatio >= 2) {
      insights.push({
        type: 'strength',
        icon: <TrendingUp className="w-4 h-4 text-bull-400" />,
        title: 'Excellent risk-reward discipline',
        detail: `Avg win ${fmtR(avgWinR)} vs avg loss ${fmtR(avgLossR)} — ratio of ${rrRatio.toFixed(2)}:1. Your winners are far outpacing losers. Keep it up.`,
      });
    }
  }

  if (total < 10) {
    insights.push({
      type: 'tip',
      icon: <Brain className="w-4 h-4 text-accent-400" />,
      title: 'Build more data',
      detail: `You have ${total} trade${total === 1 ? '' : 's'} logged. Insights become statistically meaningful at 20+ trades. Keep journaling every trade.`,
    });
  }

  return { insights, bestStrategy, worstStrategy, buyWinRate, sellWinRate, currentStreak: { type: streakType, count: streakCount }, avgWinR, avgLossR, totalTrades: total };
}

function PerformanceCoach({ trades }: { trades: Trade[] }) {
  const analysis = useMemo(() => analyzeTrades(trades), [trades]);

  if (trades.length === 0) {
    return (
      <div className="card">
        <div className="card-header">
          <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Brain className="w-4 h-4 text-accent-400" /> AI Performance Coach</h3>
        </div>
        <EmptyState title="No trades to analyze yet" hint="Log a few trades and the coach will surface patterns, strengths, and areas to improve." />
      </div>
    );
  }

  const { insights, bestStrategy, buyWinRate, sellWinRate, currentStreak, avgWinR, avgLossR, totalTrades } = analysis;

  return (
    <div className="card">
      <div className="card-header">
        <h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><Brain className="w-4 h-4 text-accent-400" /> AI Performance Coach</h3>
        <span className="text-xs text-slate-500">{totalTrades} trades analyzed</span>
      </div>
      <div className="p-4 space-y-4">
        {/* Quick metrics row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <CoachMetric label="Avg Win" value={fmtR(avgWinR)} tone="bull" />
          <CoachMetric label="Avg Loss" value={fmtR(avgLossR)} tone="bear" />
          <CoachMetric label="Buy WR" value={`${buyWinRate.toFixed(0)}%`} />
          <CoachMetric
            label="Streak"
            value={currentStreak.type === 'none' ? '—' : `${currentStreak.count}${currentStreak.type === 'win' ? 'W' : 'L'}`}
            tone={currentStreak.type === 'win' ? 'bull' : currentStreak.type === 'loss' ? 'bear' : 'neutral'}
          />
        </div>

        {/* Insights */}
        {insights.length > 0 ? (
          <div className="space-y-2.5">
            {insights.map((ins, i) => {
              const borderCls = ins.type === 'strength' ? 'border-bull-500/20' : ins.type === 'weakness' ? 'border-bear-500/20' : ins.type === 'warning' ? 'border-warn-500/20' : 'border-accent-500/20';
              const bgCls = ins.type === 'strength' ? 'bg-bull-500/5' : ins.type === 'weakness' ? 'bg-bear-500/5' : ins.type === 'warning' ? 'bg-warn-500/5' : 'bg-accent-500/5';
              return (
                <div key={i} className={`flex items-start gap-3 rounded-md border ${borderCls} ${bgCls} p-3`}>
                  <span className="shrink-0 mt-0.5">{ins.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-slate-200">{ins.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{ins.detail}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-500 text-center py-4">Log more trades to unlock deeper coaching insights.</p>
        )}

        {/* Best strategy highlight */}
        {bestStrategy && (
          <div className="flex items-center justify-between pt-3 border-t border-terminal-700/60 text-sm">
            <span className="text-slate-400">Best-performing engine</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-200 font-medium">{bestStrategy.name}</span>
              <span className="chip bg-bull-500/15 text-bull-400">{bestStrategy.winRate.toFixed(0)}% WR</span>
              <span className="chip bg-terminal-700 text-slate-400">{fmtR(bestStrategy.avgR)} avg</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function CoachMetric({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'bull' | 'bear' }) {
  const color = tone === 'bull' ? 'text-bull-400' : tone === 'bear' ? 'text-bear-400' : 'text-slate-200';
  return (
    <div className="bg-terminal-900 rounded-md p-3 border border-terminal-700/50">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className={`mono text-sm mt-0.5 ${color}`}>{value}</div>
    </div>
  );
}
