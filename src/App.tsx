import { useState } from 'react';
import { AppProvider, useApp } from '@/state/AppContext';
import { AuthOnboarding } from '@/components/AuthOnboarding';
import { Sidebar } from '@/components/Sidebar';
import { Header } from '@/components/Header';
import { NAV_TABS, type TabId } from '@/components/nav';
import { LiveAnalysisPage } from '@/pages/LiveAnalysisPage';
import { DashboardPage } from '@/pages/DashboardPage';
import { StrategiesPage } from '@/pages/StrategiesPage';
import { RiskCenterPage } from '@/pages/RiskCenterPage';
import { JournalPage } from '@/pages/JournalPage';
import { BacktestPage } from '@/pages/BacktestPage';
import { ChartsPage } from '@/pages/ChartsPage';
import { MarketsPage } from '@/pages/MarketsPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { PropFirmPage } from '@/pages/PropFirmPage';
import { LiveAccountPage } from '@/pages/LiveAccountPage';
import { StocksPage } from '@/pages/StocksPage';
import { PerformancePage } from '@/pages/PerformancePage';

function Shell() {
  const { session } = useApp();
  const [tab, setTab] = useState<TabId>('dashboard');

  if (!session) return <AuthOnboarding />;

  const navigate = (id: string) => setTab(id as TabId);

  return (
    <div className="flex min-h-screen bg-terminal-950">
      <Sidebar active={tab} onSelect={setTab} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Header />
        <main className="flex-1 p-5 lg:p-6 max-w-[1500px] w-full mx-auto">
          {tab === 'dashboard' && <DashboardPage onNavigate={navigate} />}
          {tab === 'markets' && <MarketsPage />}
          {tab === 'analysis' && <LiveAnalysisPage />}
          {tab === 'charts' && <ChartsPage />}
          {tab === 'strategies' && <StrategiesPage />}
          {tab === 'backtest' && <BacktestPage />}
          {tab === 'risk' && <RiskCenterPage />}
          {tab === 'prop' && <PropFirmPage />}
          {tab === 'live' && <LiveAccountPage />}
          {tab === 'stocks' && <StocksPage />}
          {tab === 'journal' && <JournalPage />}
          {tab === 'performance' && <PerformancePage />}
          {tab === 'settings' && <SettingsPage />}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
