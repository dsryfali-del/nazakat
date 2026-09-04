// Manual News Engine — self-contained, no live API.
// Hardcoded high-impact economic events + symbol→currency mapping.
// Used by Dashboard and Strategies to surface "News risk" warnings.

export type NewsEvent = {
  time: number; // epoch ms
  currency: string; // USD, EUR, GBP, etc.
  title: string;
};

// Upcoming high-impact economic events (realistic example dates).
// Times are in UTC.
const EVENT_DEFS: { date: string; time: string; currency: string; title: string }[] = [
  { date: '2026-09-02', time: '12:30', currency: 'USD', title: 'US Non-Farm Payrolls' },
  { date: '2026-09-02', time: '14:00', currency: 'USD', title: 'FOMC Rate Decision' },
  { date: '2026-09-03', time: '09:00', currency: 'EUR', title: 'ECB Interest Rate Decision' },
  { date: '2026-09-04', time: '12:30', currency: 'USD', title: 'US CPI Release' },
  { date: '2026-09-05', time: '07:00', currency: 'GBP', title: 'BoE Interest Rate Decision' },
  { date: '2026-09-05', time: '12:30', currency: 'USD', title: 'US Core PCE Price Index' },
  { date: '2026-09-09', time: '12:30', currency: 'USD', title: 'US Retail Sales' },
  { date: '2026-09-10', time: '23:50', currency: 'JPY', title: 'Japan GDP Release' },
  { date: '2026-09-11', time: '12:30', currency: 'USD', title: 'US PPI Release' },
  { date: '2026-09-12', time: '09:30', currency: 'GBP', title: 'UK CPI Release' },
  { date: '2026-09-16', time: '12:30', currency: 'USD', title: 'FOMC Rate Decision' },
  { date: '2026-09-18', time: '11:00', currency: 'GBP', title: 'BoE Monetary Policy Summary' },
  { date: '2026-09-23', time: '12:30', currency: 'USD', title: 'US Durable Goods Orders' },
  { date: '2026-09-25', time: '12:30', currency: 'USD', title: 'US GDP (Final)' },
  { date: '2026-09-30', time: '12:30', currency: 'USD', title: 'US Personal Income & Spending' },
];

export const NEWS_EVENTS: NewsEvent[] = EVENT_DEFS.map((e) => ({
  time: new Date(`${e.date}T${e.time}:00Z`).getTime(),
  currency: e.currency,
  title: e.title,
}));

// Map each symbol to the currencies it's exposed to.
const SYMBOL_CURRENCY_MAP: Record<string, string[]> = {
  XAUUSD: ['USD'],
  XAGUSD: ['USD'],
  AUDUSD: ['AUD', 'USD'],
  USDCAD: ['USD', 'CAD'],
  USDJPY: ['USD', 'JPY'],
  GBPUSD: ['GBP', 'USD'],
  EURUSD: ['EUR', 'USD'],
  BTCUSD: ['USD'],
  US500: ['USD'],
  // US tech stocks are all USD-denominated
  NVDA: ['USD'],
  AAPL: ['USD'],
  MSFT: ['USD'],
  AMZN: ['USD'],
  GOOGL: ['USD'],
  META: ['USD'],
  AVGO: ['USD'],
  TSLA: ['USD'],
  AMD: ['USD'],
  MU: ['USD'],
  AMAT: ['USD'],
  PLTR: ['USD'],
  SMCI: ['USD'],
  LRCX: ['USD'],
  ASML: ['USD', 'EUR'],
};

export function currenciesForSymbol(symbol: string): string[] {
  return SYMBOL_CURRENCY_MAP[symbol] ?? ['USD'];
}

// 30-minute window (before or after the event time).
const WINDOW_MS = 30 * 60 * 1000;

export function activeNewsForSymbol(symbol: string, now: number = Date.now()): NewsEvent[] {
  const curs = currenciesForSymbol(symbol);
  return NEWS_EVENTS.filter(
    (e) => curs.includes(e.currency) && Math.abs(now - e.time) <= WINDOW_MS,
  );
}

export function activeNewsForAnySymbol(symbols: string[], now: number = Date.now()): NewsEvent[] {
  return NEWS_EVENTS.filter(
    (e) =>
      Math.abs(now - e.time) <= WINDOW_MS &&
      symbols.some((s) => currenciesForSymbol(s).includes(e.currency)),
  );
}

import { useEffect, useState } from 'react';

// React hook: re-evaluates active news risk every 60 seconds.
export function useNewsRisk(symbols: string[]): NewsEvent[] {
  const [events, setEvents] = useState<NewsEvent[]>(() => activeNewsForAnySymbol(symbols));
  useEffect(() => {
    const update = () => setEvents(activeNewsForAnySymbol(symbols));
    update();
    const id = setInterval(update, 60_000);
    return () => clearInterval(id);
  }, [symbols.join(',')]);
  return events;
}
