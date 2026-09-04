import { useState } from 'react';
import { Activity, Lock, TrendingUp, Mail, User2 } from 'lucide-react';
import { useApp } from '@/state/AppContext';
import type { AccountType, TradingMode } from '@/lib/types';
import { usePersistentState } from '@/lib/usePersistentState';

type Step = 'auth' | 'account' | 'mode';

const ACCOUNT_OPTIONS = [
  { id: 'prop' as AccountType, label: 'Prop Firm', desc: 'Funded evaluation account' },
  { id: 'live' as AccountType, label: 'Live Broker', desc: 'Real-money brokerage account' },
  { id: 'demo' as AccountType, label: 'Demo', desc: 'Paper trading / practice' },
];

const MODE_OPTIONS = [
  { id: 'scalping' as TradingMode, label: 'Scalping', desc: 'Seconds to minutes' },
  { id: 'intraday' as TradingMode, label: 'Intraday', desc: 'Minutes to hours' },
  { id: 'swing' as TradingMode, label: 'Swing', desc: 'Days to weeks' },
];

export function AuthOnboarding() {
  const { setSession } = useApp();
  const [step, setStep] = useState<Step>('auth');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignup, setIsSignup] = useState(true);
  const [error, setError] = useState('');
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [registered, setRegistered] = usePersistentState<{ email: string; password: string } | null>('ae_user', null);

  const submitAuth = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!email.trim() || !password) {
      setError('Enter an email and password.');
      return;
    }
    const norm = email.trim().toLowerCase();
    if (isSignup) {
      setRegistered({ email: norm, password });
      setStep('account');
    } else if (registered && registered.email === norm && registered.password !== password) {
      setError('Incorrect password for that account.');
    } else {
      setStep('account');
    }
  };

  const finish = (mode: TradingMode) => {
    if (!accountType) return;
    setSession({ email: email.trim().toLowerCase(), accountType, tradingMode: mode });
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-terminal-950">
      <div className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <div className="w-10 h-10 rounded-lg bg-accent-600/20 border border-accent-500/40 flex items-center justify-center">
            <Activity className="w-5 h-5 text-accent-400" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-100 leading-tight">AlphaEdge AI</h1>
            <p className="text-xs text-slate-400">Trading OS</p>
          </div>
        </div>

        <div className="card fade-in">
          {step === 'auth' && (
            <form onSubmit={submitAuth} className="p-6">
              <h2 className="text-base font-semibold text-slate-100 mb-1">{isSignup ? 'Create your account' : 'Welcome back'}</h2>
              <p className="text-sm text-slate-400 mb-5">Local sign-in — your setup stays in this browser.</p>

              <label className="label">Email</label>
              <div className="relative mb-4">
                <Mail className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input className="input pl-9" type="email" placeholder="trader@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>

              <label className="label">Password</label>
              <div className="relative mb-4">
                <Lock className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
                <input className="input pl-9" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>

              {error && <p className="text-sm text-bear-400 mb-4">{error}</p>}

              <button type="submit" className="btn-accent w-full">{isSignup ? 'Continue' : 'Sign in'}</button>
              <p className="text-sm text-slate-400 text-center mt-4">
                {isSignup ? 'Already have an account?' : 'New here?'}{' '}
                <button type="button" className="text-accent-400 hover:text-accent-300" onClick={() => { setIsSignup(!isSignup); setError(''); }}>
                  {isSignup ? 'Sign in' : 'Create one'}
                </button>
              </p>
            </form>
          )}

          {step === 'account' && (
            <StepCard
              icon={<User2 className="w-5 h-5 text-accent-400" />}
              title="Choose your account type"
              subtitle="Sets your risk defaults and header badge."
              options={ACCOUNT_OPTIONS}
              renderLabel={(o) => o.label}
              renderDesc={(o) => o.desc}
              onSelect={(o) => { setAccountType(o.id); setStep('mode'); }}
            />
          )}

          {step === 'mode' && (
            <StepCard
              icon={<TrendingUp className="w-5 h-5 text-accent-400" />}
              title="Select your trading mode"
              subtitle="Tunes hold-time expectations across the app."
              options={MODE_OPTIONS}
              renderLabel={(o) => o.label}
              renderDesc={(o) => o.desc}
              onSelect={(o) => finish(o.id)}
            />
          )}
        </div>

        <p className="text-[11px] text-slate-600 text-center mt-6 px-6 leading-relaxed">
          Demo data only — not financial advice. AlphaEdge is a decision-support tool, not an automated trading bot.
        </p>
      </div>
    </div>
  );
}

function StepCard<T extends { id: string; label: string; desc: string }>({ icon, title, subtitle, options, renderLabel, renderDesc, onSelect }: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  options: T[];
  renderLabel: (o: T) => string;
  renderDesc: (o: T) => string;
  onSelect: (o: T) => void;
}) {
  return (
    <div className="p-6">
      <div className="flex items-center gap-3 mb-1">
        <div className="w-9 h-9 rounded-lg bg-accent-600/15 border border-accent-500/30 flex items-center justify-center">{icon}</div>
        <h2 className="text-base font-semibold text-slate-100">{title}</h2>
      </div>
      <p className="text-sm text-slate-400 mb-5 ml-12">{subtitle}</p>
      <div className="space-y-2.5">
        {options.map((o) => (
          <button key={o.id} onClick={() => onSelect(o)} className="w-full text-left p-3.5 rounded-md bg-terminal-900 border border-terminal-700 hover:border-accent-500 hover:bg-terminal-800 transition-colors">
            <div className="text-sm font-medium text-slate-200">{renderLabel(o)}</div>
            <div className="text-xs text-slate-500 mt-0.5">{renderDesc(o)}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
