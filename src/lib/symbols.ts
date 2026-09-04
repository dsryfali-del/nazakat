import type { SymbolMeta } from './types';

// The full asset universe. basePrice/volatility drive the synthetic data generator.
// This is the single source of truth for the watchlist across the app.
export const SYMBOLS: SymbolMeta[] = [
  { symbol: 'XAUUSD', label: 'Gold / USD', assetClass: 'commodities', basePrice: 2348, volatility: 0.006, decimals: 2 },
  { symbol: 'XAGUSD', label: 'Silver / USD', assetClass: 'commodities', basePrice: 27.4, volatility: 0.011, decimals: 3 },
  { symbol: 'AUDUSD', label: 'AUD / USD', assetClass: 'forex', basePrice: 0.6585, volatility: 0.004, decimals: 5 },
  { symbol: 'USDCAD', label: 'USD / CAD', assetClass: 'forex', basePrice: 1.3725, volatility: 0.0035, decimals: 5 },
  { symbol: 'USDJPY', label: 'USD / JPY', assetClass: 'forex', basePrice: 156.8, volatility: 0.004, decimals: 3 },
  { symbol: 'GBPUSD', label: 'GBP / USD', assetClass: 'forex', basePrice: 1.2715, volatility: 0.0045, decimals: 5 },
  { symbol: 'BTCUSD', label: 'Bitcoin / USD', assetClass: 'crypto', basePrice: 67250, volatility: 0.022, decimals: 1 },
  { symbol: 'US500', label: 'S&P 500 Index', assetClass: 'indices', basePrice: 5235, volatility: 0.007, decimals: 2 },
  { symbol: 'NVDA', label: 'NVIDIA Corp', assetClass: 'stocks', basePrice: 118.4, volatility: 0.018, decimals: 2 },
  { symbol: 'AAPL', label: 'Apple Inc', assetClass: 'stocks', basePrice: 192.3, volatility: 0.011, decimals: 2 },
  { symbol: 'MSFT', label: 'Microsoft Corp', assetClass: 'stocks', basePrice: 415.6, volatility: 0.010, decimals: 2 },
  { symbol: 'AMZN', label: 'Amazon.com Inc', assetClass: 'stocks', basePrice: 178.2, volatility: 0.013, decimals: 2 },
  { symbol: 'GOOGL', label: 'Alphabet Inc', assetClass: 'stocks', basePrice: 168.9, volatility: 0.012, decimals: 2 },
  { symbol: 'META', label: 'Meta Platforms', assetClass: 'stocks', basePrice: 498.5, volatility: 0.014, decimals: 2 },
  { symbol: 'AVGO', label: 'Broadcom Inc', assetClass: 'stocks', basePrice: 162.7, volatility: 0.015, decimals: 2 },
  { symbol: 'TSLA', label: 'Tesla Inc', assetClass: 'stocks', basePrice: 178.4, volatility: 0.024, decimals: 2 },
  { symbol: 'AMD', label: 'Advanced Micro Devices', assetClass: 'stocks', basePrice: 152.8, volatility: 0.019, decimals: 2 },
  { symbol: 'MU', label: 'Micron Technology', assetClass: 'stocks', basePrice: 108.6, volatility: 0.018, decimals: 2 },
  { symbol: 'AMAT', label: 'Applied Materials', assetClass: 'stocks', basePrice: 212.4, volatility: 0.016, decimals: 2 },
  { symbol: 'PLTR', label: 'Palantir Technologies', assetClass: 'stocks', basePrice: 28.6, volatility: 0.021, decimals: 2 },
  { symbol: 'SMCI', label: 'Super Micro Computer', assetClass: 'stocks', basePrice: 842, volatility: 0.035, decimals: 2 },
  { symbol: 'LRCX', label: 'Lam Research', assetClass: 'stocks', basePrice: 92.4, volatility: 0.016, decimals: 2 },
  { symbol: 'ASML', label: 'ASML Holding', assetClass: 'stocks', basePrice: 965.2, volatility: 0.015, decimals: 2 },
];

export const SYMBOL_MAP: Record<string, SymbolMeta> = Object.fromEntries(
  SYMBOLS.map((s) => [s.symbol, s]),
);

export const ASSET_CLASS_LABEL: Record<string, string> = {
  forex: 'Forex',
  commodities: 'Commodities',
  crypto: 'Crypto',
  indices: 'Indices',
  stocks: 'Stocks',
};
