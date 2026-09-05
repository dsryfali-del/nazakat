import type { BacktestResult, BacktestTrade, Candle, RiskInputs, RiskState, RiskStatus, StrategyId } from './types';
import { runEngine } from './strategies';
import { atr as atrFn } from './indicators';

// Spread cost per symbol (in price units, subtracted from favorable side at entry).
const SPREAD_COSTS: Record<string, number> = {
  AUDUSD: 0.00015,
  USDCAD: 0.00015,
  GBPUSD: 0.00015,
  USDJPY: 0.015,
  XAUUSD: 0.25,
  XAGUSD: 0.02,
  BTCUSD: 15,
  US500: 0.5,
};
const DEFAULT_SPREAD = 0.02; // individual stocks and any unlisted symbol
const SLIPPAGE_PCT = 0.05; // 5% of ATR(14) at entry, applied unfavorably
const COMMISSION_RT = 0.0004; // 0.04% round-turn (0.02% entry + 0.02% exit)

function spreadFor(symbol: string): number {
  return SPREAD_COSTS[symbol] ?? DEFAULT_SPREAD;
}

// Compute the live risk picture from editable inputs. All percentages are
// expressed as positive numbers where "used" reflects how much of a limit is
// consumed. Status drives the recommended risk-per-trade and UI pill color.

export function computeRisk(r: RiskInputs): RiskState {
  const balance = r.accountBalance > 0 ? r.accountBalance : 1;
  const equity = r.currentEquity;

  const currentDrawdownPct = equity >= balance ? 0 : ((balance - equity) / balance) * 100;
  const dailyLossUsedPct = r.todayPnl >= 0 ? 0 : (Math.abs(r.todayPnl) / balance) * 100;
  const remainingDailyLossPct = Math.max(0, r.dailyLossLimitPct - dailyLossUsedPct);
  const remainingMaxDrawdownPct = Math.max(0, r.maxDrawdownPct - currentDrawdownPct);
  const targetEquity = balance * (1 + r.profitTargetPct / 100);
  const distanceToProfitTargetPct = equity >= targetEquity ? 0 : ((targetEquity - equity) / balance) * 100;

  const status = deriveStatus({
    remainingDailyLossPct,
    remainingMaxDrawdownPct,
    currentDrawdownPct,
    dailyLossUsedPct,
    maxDrawdownPct: r.maxDrawdownPct,
    dailyLossLimitPct: r.dailyLossLimitPct,
  });

  return {
    currentDrawdownPct,
    dailyLossUsedPct,
    remainingDailyLossPct,
    remainingMaxDrawdownPct,
    distanceToProfitTargetPct,
    status,
    recommendedRiskPct: RECOMMENDED_RISK[status],
  };
}

export const RECOMMENDED_RISK: Record<RiskStatus, number> = {
  GREEN: 0.5,
  YELLOW: 0.25,
  RED: 0.1,
  BLOCKED: 0,
};

function deriveStatus(args: {
  remainingDailyLossPct: number;
  remainingMaxDrawdownPct: number;
  currentDrawdownPct: number;
  dailyLossUsedPct: number;
  maxDrawdownPct: number;
  dailyLossLimitPct: number;
}): RiskStatus {
  if (args.remainingDailyLossPct <= 0 || args.remainingMaxDrawdownPct <= 0) return 'BLOCKED';
  const ddRatio = args.maxDrawdownPct > 0 ? args.currentDrawdownPct / args.maxDrawdownPct : 0;
  const dlRatio = args.dailyLossLimitPct > 0 ? args.dailyLossUsedPct / args.dailyLossLimitPct : 0;
  const worst = Math.max(ddRatio, dlRatio);
  if (worst > 0.7) return 'RED';
  if (worst > 0.4) return 'YELLOW';
  return 'GREEN';
}

export function positionSize(args: {
  equity: number;
  riskPct: number;
  entry: number;
  stopLoss: number;
  takeProfit: number;
}): { dollarRisk: number; positionSize: number; riskReward: number } {
  const dollarRisk = (args.equity * args.riskPct) / 100;
  const stopDist = Math.abs(args.entry - args.stopLoss);
  const tpDist = Math.abs(args.takeProfit - args.entry);
  const positionSize = stopDist > 0 ? dollarRisk / stopDist : 0;
  const riskReward = stopDist > 0 ? tpDist / stopDist : 0;
  return { dollarRisk, positionSize, riskReward };
}

// Walk the series bar by bar with no look-ahead. On a signal, look forward up
// to maxHold bars for SL/TP; close at maxHold if neither hits. No trade overlap.
export function runBacktest(
  symbol: string,
  candles: Candle[],
  strategyId: StrategyId,
  options: { warmup?: number; maxHold?: number; includeCosts?: boolean } = {},
): BacktestResult {
  const warmup = options.warmup ?? 55;
  const maxHold = options.maxHold ?? 15;
  const includeCosts = options.includeCosts ?? true;
  const spread = spreadFor(symbol);
  const trades: BacktestTrade[] = [];
  let totalCosts = 0;

  const atrArr = atrFn(candles, 14);

  let i = warmup;
  while (i < candles.length - 1) {
    const slice = candles.slice(0, i + 1);
    const sig = runEngine(strategyId, symbol, slice);
    if (sig.direction === 'NO TRADE') {
      i++;
      continue;
    }
    const rawEntry = sig.entry;
    const sl = sig.stopLoss;
    const tp = sig.takeProfit;
    const dir = sig.direction;
    const atrVal = atrArr[i] || (candles[i].high - candles[i].low);

    // Apply costs to entry: spread + slippage (unfavorable direction)
    const slip = includeCosts ? atrVal * SLIPPAGE_PCT : 0;
    const entry = includeCosts
      ? dir === 'BUY' ? rawEntry + spread / 2 + slip : rawEntry - spread / 2 - slip
      : rawEntry;

    let exitBar = -1;
    let exitPrice = entry;
    let outcome: 'win' | 'loss' | 'timeout' = 'timeout';
    let reason = 'Time stop — neither SL nor TP hit within holding window.';

    for (let j = i + 1; j < Math.min(candles.length, i + 1 + maxHold); j++) {
      const bar = candles[j];
      if (dir === 'BUY') {
        if (bar.low <= sl) { exitBar = j; exitPrice = sl; outcome = 'loss'; reason = 'Stop-loss hit.'; break; }
        if (bar.high >= tp) { exitBar = j; exitPrice = tp; outcome = 'win'; reason = 'Take-profit hit.'; break; }
      } else {
        if (bar.high >= sl) { exitBar = j; exitPrice = sl; outcome = 'loss'; reason = 'Stop-loss hit.'; break; }
        if (bar.low <= tp) { exitBar = j; exitPrice = tp; outcome = 'win'; reason = 'Take-profit hit.'; break; }
      }
    }
    if (exitBar === -1) {
      exitBar = Math.min(candles.length - 1, i + maxHold);
      exitPrice = candles[exitBar].close;
    }

    // Apply slippage to exit (unfavorable direction)
    const exitSlip = includeCosts ? atrVal * SLIPPAGE_PCT : 0;
    const finalExit = includeCosts
      ? dir === 'BUY' ? exitPrice - exitSlip : exitPrice + exitSlip
      : exitPrice;

    const riskPerUnit = Math.abs(entry - sl);
    const pnl = dir === 'BUY' ? finalExit - entry : entry - finalExit;

    // Commission: 0.04% round-turn on notional (entry price × position size)
    // Position size derived from a standard $10k account risking 1% per trade
    const notional = entry * (10000 * 0.01 / Math.max(riskPerUnit, 1e-9));
    const commission = includeCosts ? notional * COMMISSION_RT : 0;
    // Convert commission to R-multiple impact
    const commissionR = riskPerUnit > 0 ? commission / (riskPerUnit * (10000 * 0.01 / Math.max(riskPerUnit, 1e-9))) : 0;

    const rMultiple = riskPerUnit > 0 ? pnl / riskPerUnit - commissionR : 0;

    totalCosts += includeCosts ? (spread + slip + exitSlip) * (10000 * 0.01 / Math.max(riskPerUnit, 1e-9)) + commission : 0;

    trades.push({
      index: trades.length + 1, direction: dir, entryBar: i, entryPrice: entry,
      exitBar, exitPrice: finalExit, outcome, rMultiple, reason,
    });
    i = exitBar + 1;
  }

  return summarize(trades, totalCosts);
}

function summarize(trades: BacktestTrade[], totalCosts = 0): BacktestResult {
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.rMultiple > 0).length;
  const losses = trades.filter((t) => t.rMultiple <= 0).length;
  const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const grossWin = trades.filter((t) => t.rMultiple > 0).reduce((s, t) => s + t.rMultiple, 0);
  const grossLoss = Math.abs(trades.filter((t) => t.rMultiple <= 0).reduce((s, t) => s + t.rMultiple, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : grossWin > 0 ? 99 : 0;
  const expectancy = totalTrades > 0 ? trades.reduce((s, t) => s + t.rMultiple, 0) / totalTrades : 0;

  const equityCurve: number[] = [];
  let cum = 0, peak = 0, maxDd = 0;
  for (const t of trades) {
    cum += t.rMultiple;
    equityCurve.push(cum);
    peak = Math.max(peak, cum);
    maxDd = Math.max(maxDd, peak - cum);
  }

  return { totalTrades, wins, losses, winRate, profitFactor, expectancy, maxDrawdownR: maxDd, totalCosts, sharpe: computeSharpe(trades), sortino: computeSortino(trades), trades, equityCurve };
}

function computeSharpe(trades: BacktestTrade[]): number | null {
  if (trades.length < 2) return null;
  const rs = trades.map((t) => t.rMultiple);
  const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
  const variance = rs.reduce((s, r) => s + (r - mean) ** 2, 0) / (rs.length - 1);
  const std = Math.sqrt(variance);
  if (std === 0) return null;
  return mean / std;
}

function computeSortino(trades: BacktestTrade[]): number | null {
  if (trades.length < 2) return null;
  const rs = trades.map((t) => t.rMultiple);
  const mean = rs.reduce((s, r) => s + r, 0) / rs.length;
  const downsideSum = rs.reduce((s, r) => s + Math.min(r, 0) ** 2, 0);
  const downsideDev = Math.sqrt(downsideSum / rs.length);
  if (downsideDev === 0) return null;
  return mean / downsideDev;
}
