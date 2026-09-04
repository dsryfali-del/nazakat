export const ACCOUNT_LABEL: Record<string, string> = {
  prop: 'Prop Firm',
  live: 'Live Broker',
  demo: 'Demo',
};

export const MODE_LABEL: Record<string, string> = {
  scalping: 'Scalping',
  intraday: 'Intraday',
  swing: 'Swing',
};

export const STRATEGY_LABEL: Record<string, string> = {
  trend: 'Trend Following',
  breakout: 'Breakout + Retest',
  meanrev: 'Mean Reversion',
};

export const STRATEGY_SHORT: Record<string, string> = {
  trend: 'EMA20/EMA50',
  breakout: '20-bar high/low',
  meanrev: 'SMA(20) dev',
};
