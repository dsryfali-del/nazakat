import { Activity, LogOut } from 'lucide-react';
import { NAV_TABS, type TabId } from './nav';
import { useApp } from '@/state/AppContext';
import { ACCOUNT_LABEL, MODE_LABEL } from '@/lib/labels';

export function Sidebar({ active, onSelect }: { active: TabId; onSelect: (id: TabId) => void }) {
  const { session, signOut } = useApp();
  return (
    <aside className="w-60 shrink-0 bg-terminal-900 border-r border-terminal-700/70 flex flex-col h-screen sticky top-0">
      <div className="h-16 flex items-center gap-2.5 px-4 border-b border-terminal-700/70">
        <div className="w-9 h-9 rounded-lg bg-accent-600/20 border border-accent-500/40 flex items-center justify-center shrink-0">
          <Activity className="w-5 h-5 text-accent-400" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-slate-100 leading-tight truncate">AlphaEdge AI</div>
          <div className="text-[11px] text-slate-500 leading-tight">Trading OS</div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {NAV_TABS.map((t) => {
          const Icon = t.icon;
          const isActive = active === t.id;
          return (
            <button
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                isActive
                  ? 'bg-accent-600/15 text-accent-300 border border-accent-500/30'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-terminal-800 border border-transparent'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="flex-1 text-left truncate">{t.label}</span>
              {t.soon && <span className="text-[10px] text-slate-600 uppercase tracking-wide">soon</span>}
            </button>
          );
        })}
      </nav>

      <div className="p-3 border-t border-terminal-700/70">
        <div className="px-2 py-2 rounded-md bg-terminal-850 mb-2">
          <div className="text-[11px] text-slate-500 truncate">{session?.email}</div>
          <div className="text-xs text-slate-300 mt-0.5">
            {session ? ACCOUNT_LABEL[session.accountType] : '—'} · {session ? MODE_LABEL[session.tradingMode] : '—'}
          </div>
        </div>
        <button onClick={signOut} className="w-full flex items-center gap-2 px-3 py-2 rounded-md text-sm text-slate-400 hover:text-bear-400 hover:bg-terminal-800 transition-colors">
          <LogOut className="w-4 h-4" /> Sign out
        </button>
      </div>
    </aside>
  );
}
