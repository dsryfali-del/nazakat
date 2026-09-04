import {
  LayoutDashboard, CandlestickChart, Radio, LineChart, Cpu, FlaskConical,
  ShieldCheck, Building2, Banknote, ChartColumn, BookOpen, BarChart3, Settings,
  type LucideIcon,
} from 'lucide-react';

export type TabId =
  | 'dashboard' | 'markets' | 'analysis' | 'charts' | 'strategies'
  | 'backtest' | 'risk' | 'prop' | 'live' | 'stocks' | 'journal'
  | 'performance' | 'settings';

export type TabDef = { id: TabId; label: string; icon: LucideIcon; soon?: boolean };

export const NAV_TABS: TabDef[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'markets', label: 'Markets', icon: CandlestickChart },
  { id: 'analysis', label: 'Live Analysis', icon: Radio },
  { id: 'charts', label: 'Charts', icon: LineChart },
  { id: 'strategies', label: 'Strategies', icon: Cpu },
  { id: 'backtest', label: 'Backtesting', icon: FlaskConical },
  { id: 'risk', label: 'Risk Center', icon: ShieldCheck },
  { id: 'prop', label: 'Prop Firm', icon: Building2 },
  { id: 'live', label: 'Live Account', icon: Banknote },
  { id: 'stocks', label: 'Stocks', icon: ChartColumn },
  { id: 'journal', label: 'Trade Journal', icon: BookOpen },
  { id: 'performance', label: 'Performance', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];
