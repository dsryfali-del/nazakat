import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { AccountType, RiskInputs, RiskState, TradingMode } from '@/lib/types';
import { usePersistentState } from '@/lib/usePersistentState';
import { computeRisk } from '@/lib/risk';

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

  const risk = useMemo(() => computeRisk(riskInputs), [riskInputs]);

  const value: Ctx = {
    session,
    setSession,
    signOut: () => setSession(null),
    riskInputs,
    setRiskInputs,
    risk,
  };

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
