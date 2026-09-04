// Shared domain types for AlphaEdge AI Trading OS

export type Candle = {
  time: number; // epoch ms
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type AssetClass = 'forex' | 'commodities' | 'crypto' | 'indices' | 'stocks';

export type SymbolMeta = {
  symbol: string;
  label: string;
  assetClass: AssetClass;
  basePrice: number;
  volatility: number; // relative per-bar volatility
  decimals: number;
};

export type Direction = 'BUY' | 'SELL' | 'NO TRADE';

export type StrategyId = 'trend' | 'breakout' | 'meanrev';

export type Signal = {
  symbol: string;
  strategy: StrategyId;
  direction: Direction;
  score: number; // 0-100
  entry: number;
  stopLoss: number;
  takeProfit: number;
  atr: number;
  reason: string;
  time: number;
};

export type RiskStatus = 'GREEN' | 'YELLOW' | 'RED' | 'BLOCKED';

export type Timeframe = 'M1' | 'M5' | 'M15' | 'H1' | 'H4' | 'D1';

export type AccountType = 'prop' | 'live' | 'demo';
export type TradingMode = 'scalping' | 'intraday' | 'swing';

export type AppSession = {
  email: string;
  accountType: AccountType;
  tradingMode: TradingMode;
};

export type Trade = {
  id: string;
  time: number;
  asset: string;
  strategy: string;
  direction: 'BUY' | 'SELL';
  entry: number;
  stopLoss: number;
  takeProfit: number;
  resultR: number; // R-multiple
  notes: string;
};

export type RiskInputs = {
  accountBalance: number;
  currentEquity: number;
  todayPnl: number;
  dailyLossLimitPct: number;
  maxDrawdownPct: number;
  profitTargetPct: number;
};

export type RiskState = {
  currentDrawdownPct: number;
  dailyLossUsedPct: number;
  remainingDailyLossPct: number;
  remainingMaxDrawdownPct: number;
  distanceToProfitTargetPct: number;
  status: RiskStatus;
  recommendedRiskPct: number;
};

export type BacktestTrade = {
  index: number;
  direction: 'BUY' | 'SELL';
  entryBar: number;
  entryPrice: number;
  exitBar: number;
  exitPrice: number;
  outcome: 'win' | 'loss' | 'timeout';
  rMultiple: number;
  reason: string;
};

export type BacktestResult = {
  totalTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  profitFactor: number;
  expectancy: number; // avg R
  maxDrawdownR: number;
  trades: BacktestTrade[];
  equityCurve: number[]; // cumulative R per trade
};
