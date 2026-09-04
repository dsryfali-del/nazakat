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
  priceaction: 'Price Action',
  orderflow: 'Order Flow (Proxy)',
  range: 'Range Trading',
  momentum: 'Momentum',
};

export const STRATEGY_SHORT: Record<string, string> = {
  trend: 'EMA20/EMA50',
  breakout: '20-bar high/low',
  meanrev: 'SMA(20) dev',
  priceaction: 'Swing retest',
  orderflow: 'CVD+VWAP proxy',
  range: '30-bar range',
  momentum: 'Displacement',
};
