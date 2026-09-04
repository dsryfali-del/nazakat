import { Settings as SettingsIcon, RefreshCw } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import { ACCOUNT_LABEL, MODE_LABEL } from '@/lib/labels';
import { Disclaimer, SectionTitle } from '@/components/ui';
import type { AccountType, TradingMode } from '@/lib/types';
import { usePersistentState } from '@/lib/usePersistentState';

export function SettingsPage() {
  const { session, setSession } = useApp();
  const [, setRegistered] = usePersistentState<{ email: string; password: string } | null>('ae_user', null);

  const resetRisk = () => {
    localStorage.removeItem('ae_risk');
    location.reload();
  };
  const clearJournal = () => {
    localStorage.removeItem('ae_trades');
    location.reload();
  };
  const wipeAll = () => {
    localStorage.removeItem('ae_session');
    localStorage.removeItem('ae_risk');
    localStorage.removeItem('ae_trades');
    localStorage.removeItem('ae_user');
    location.reload();
  };

  if (!session) return null;

  return (
    <div className="fade-in space-y-6 max-w-3xl">
      <SectionTitle title="Settings" subtitle="Account profile, preferences, and local data management." />

      <div className="card">
        <div className="card-header"><h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><SettingsIcon className="w-4 h-4 text-accent-400" /> Profile</h3></div>
        <div className="p-4 space-y-4">
          <div>
            <div className="label">Email</div>
            <div className="text-sm text-slate-200 mono">{session.email}</div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="label">Account Type</div>
              <div className="flex flex-wrap gap-2">
                {(['prop', 'live', 'demo'] as AccountType[]).map((t) => (
                  <button key={t} onClick={() => setSession({ ...session, accountType: t })}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${session.accountType === t ? 'bg-accent-600/20 text-accent-300 border-accent-500/40' : 'bg-terminal-900 text-slate-400 border-terminal-700 hover:border-accent-500/50'}`}>
                    {ACCOUNT_LABEL[t]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <div className="label">Trading Mode</div>
              <div className="flex flex-wrap gap-2">
                {(['scalping', 'intraday', 'swing'] as TradingMode[]).map((m) => (
                  <button key={m} onClick={() => setSession({ ...session, tradingMode: m })}
                    className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${session.tradingMode === m ? 'bg-accent-600/20 text-accent-300 border-accent-500/40' : 'bg-terminal-900 text-slate-400 border-terminal-700 hover:border-accent-500/50'}`}>
                    {MODE_LABEL[m]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h3 className="text-sm font-semibold text-slate-200 flex items-center gap-2"><RefreshCw className="w-4 h-4 text-accent-400" /> Local Data</h3></div>
        <div className="p-4 space-y-3">
          <DataRow label="Reset Risk Center inputs" desc="Restores balance, equity, and limits to defaults." onAction={resetRisk} actionLabel="Reset" />
          <DataRow label="Clear Trade Journal" desc="Removes all logged trades from this browser." onAction={clearJournal} actionLabel="Clear" />
          <DataRow label="Wipe all local data" desc="Signs you out and clears everything stored locally." onAction={wipeAll} actionLabel="Wipe" danger />
        </div>
      </div>

      <Disclaimer />
    </div>
  );
}

function DataRow({ label, desc, onAction, actionLabel, danger }: {
  label: string; desc: string; onAction: () => void; actionLabel: string; danger?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2 border-b border-terminal-700/40 last:border-0">
      <div>
        <div className="text-sm text-slate-200">{label}</div>
        <div className="text-xs text-slate-500 mt-0.5">{desc}</div>
      </div>
      <button onClick={onAction} className={danger ? 'btn-danger' : 'btn-ghost'}>{actionLabel}</button>
    </div>
  );
}
