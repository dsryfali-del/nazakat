import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { AccountType, RiskInputs, RiskState, TradingMode } from '@/lib/types';
import { usePersistentState } from '@/lib/usePersistentState';
import { computeRisk } from '@/lib/risk';
import type { OpenPosition } from '@/lib/correlation';
import { computeCorrelationWarnings, DEFAULT_THRESHOLD } from '@/lib/correlation';

// Central app state: auth/session, risk inputs, derived risk status. Persisted
// locally so a returning user keeps their setup. This is a local-state auth
// model (no server round-trip) — sufficient for a decision-support tool.

type Session = { email: string; accountType: AccountType; tradingMode: TradingMode } | null;

type Ctx = {
  session: Session;
  setSession: (s: Session) => void;
  signOut: () => void;
  riskInputs: RiskInputs;
  setRiskInputs: (v: RiskInputs | ((p: RiskInputs) => RiskInputs)) => void;
  risk: RiskState;
  openPositions: OpenPosition[];
  setOpenPositions: (v: OpenPosition[] | ((p: OpenPosition[]) => OpenPosition[])) => void;
  correlationThreshold: number;
  setCorrelationThreshold: (v: number) => void;
  correlationWarnings: ReturnType<typeof computeCorrelationWarnings>;
};

const AppCtx = createContext<Ctx | null>(null);

const DEFAULT_RISK: RiskInputs = {
  accountBalance: 100000,
  currentEquity: 100000,
  todayPnl: 0,
  dailyLossLimitPct: 5,
  maxDrawdownPct: 10,
  profitTargetPct: 10,
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = usePersistentState<Session>('ae_session', null);
  const [riskInputs, setRiskInputs] = usePersistentState<RiskInputs>('ae_risk', DEFAULT_RISK);
  const [openPositions, setOpenPositions] = useState<OpenPosition[]>([]);
  const [correlationThreshold, setCorrelationThreshold] = useState(DEFAULT_THRESHOLD);

  const risk = useMemo(() => computeRisk(riskInputs), [riskInputs]);
  const correlationWarnings = useMemo(
    () => computeCorrelationWarnings(openPositions, correlationThreshold),
    [openPositions, correlationThreshold],
  );

  const value: Ctx = {
    session,
    setSession,
    signOut: () => setSession(null),
    riskInputs,
    setRiskInputs,
    risk,
    openPositions,
    setOpenPositions,
    correlationThreshold,
    setCorrelationThreshold,
    correlationWarnings,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
