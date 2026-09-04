// Correlation Engine — groups open positions into clusters, calculates
// same-direction combined risk, and flags clusters that exceed a threshold.

import type { AssetClass } from './types';

export type OpenPosition = {
  id: string;
  symbol: string;
  direction: 'BUY' | 'SELL';
  riskPct: number;
};

export type CorrelationCluster = {
  name: string;
  symbols: string[];
};

export const CLUSTERS: CorrelationCluster[] = [
  { name: 'Metals', symbols: ['XAUUSD', 'XAGUSD'] },
  { name: 'USD-Driven FX', symbols: ['AUDUSD', 'USDCAD', 'USDJPY', 'GBPUSD'] },
  { name: 'Tech / US Equities', symbols: ['US500', 'NVDA', 'AAPL', 'MSFT', 'AMZN', 'GOOGL', 'META', 'AVGO', 'TSLA', 'AMD', 'MU', 'AMAT', 'PLTR', 'SMCI', 'LRCX', 'ASML'] },
  { name: 'Crypto', symbols: ['BTCUSD'] },
];

const CLUSTER_MAP: Record<string, CorrelationCluster> = Object.fromEntries(
  CLUSTERS.flatMap((c) => c.symbols.map((s) => [s, c])),
);

export function clusterForSymbol(symbol: string): CorrelationCluster | undefined {
  return CLUSTER_MAP[symbol];
}

export type ClusterWarning = {
  cluster: CorrelationCluster;
  direction: 'BUY' | 'SELL';
  positions: OpenPosition[];
  combinedRiskPct: number;
  severity: 'REDUCE' | 'BLOCK';
};

export const DEFAULT_THRESHOLD = 1.5;

export function computeCorrelationWarnings(
  positions: OpenPosition[],
  threshold: number = DEFAULT_THRESHOLD,
): ClusterWarning[] {
  const warnings: ClusterWarning[] = [];

  for (const cluster of CLUSTERS) {
    const clusterPositions = positions.filter((p) => cluster.symbols.includes(p.symbol));
    if (clusterPositions.length < 2) continue;

    for (const dir of ['BUY', 'SELL'] as const) {
      const sameDir = clusterPositions.filter((p) => p.direction === dir);
      if (sameDir.length < 2) continue;

      const combinedRisk = sameDir.reduce((sum, p) => sum + p.riskPct, 0);
      if (combinedRisk <= threshold) continue;

      const severity: 'REDUCE' | 'BLOCK' = combinedRisk > threshold * 1.5 ? 'BLOCK' : 'REDUCE';
      warnings.push({
        cluster,
        direction: dir,
        positions: sameDir,
        combinedRiskPct: combinedRisk,
        severity,
      });
    }
  }

  return warnings;
}
