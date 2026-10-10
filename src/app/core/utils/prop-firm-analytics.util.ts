import { PropFirmTrade } from '../../models/prop-firm-trade.model';
import { Trade } from '../../models/trade.model';
import {
  computeDashboardStats,
  computeDrawdown,
  DashboardStats,
} from './trade-analytics.util';

export const PROP_FIRM_CURRENCIES = [
  'USD',
  'INR',
  'EUR',
  'GBP',
  'AUD',
  'CAD',
  'CHF',
  'JPY',
  'SGD',
  'AED',
  'ZAR',
];

export type PropTradeStatus = 'WIN' | 'LOSS' | 'BREAKEVEN';

export type PropFirmStatus = 'Active' | 'Failed' | 'Passed';

export const PROP_FIRM_STATUSES: PropFirmStatus[] = ['Active', 'Failed', 'Passed'];

/**
 * Single source of truth for reading the manual lifecycle flag. Unknown or legacy values
 * fall back to 'Active'; a status is never derived from trading profit or loss.
 */
export function normalizePropFirmStatus(raw: string | null | undefined): PropFirmStatus {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === 'failed') return 'Failed';
  if (value === 'passed') return 'Passed';
  return 'Active';
}

/** P&L of a prop firm trade, denominated in the firm's account currency. */
export function getPropTradePnL(trade: PropFirmTrade): number {
  return Number(trade.netProfit ?? 0);
}

export function getPropTradeGross(trade: PropFirmTrade): number {
  return Number(trade.grossProfit ?? 0);
}

export function getPropTradeStatus(trade: PropFirmTrade): PropTradeStatus {
  const pnl = getPropTradePnL(trade);
  if (pnl > 0) return 'WIN';
  if (pnl < 0) return 'LOSS';
  return 'BREAKEVEN';
}

/**
 * Adapter that lets the existing analytics helpers run over prop firm trades.
 *
 * The shared helpers in trade-analytics.util.ts read `netProfitINR`; prop firm trades
 * carry an account-currency `netProfit`. This maps ONLY the supplied firm's trades so the
 * existing functions can be reused without modifying them. Regular trades are never passed
 * through here and prop firm trades never reach the regular dashboard.
 */
export function toAnalyticsTrades(trades: PropFirmTrade[]): Trade[] {
  return trades.map((t) => ({
    ...t,
    netProfitINR: getPropTradePnL(t),
  }));
}

export function computePropFirmStats(trades: PropFirmTrade[]): DashboardStats {
  return computeDashboardStats(toAnalyticsTrades(trades));
}

/**
 * Balance curve starting from the firm's initial balance.
 *
 * computeEquityCurve() returns cumulative P&L only, which renders as a single isolated
 * point for a one-trade account. The starting balance is therefore prepended here so
 * index 0 is always the initial balance and every later point is the balance after one
 * closed trade. Trades are ordered by trade date with a stable secondary key so trades
 * sharing a date can never jump between renders.
 */
export function computeFirmEquity(
  trades: PropFirmTrade[],
  initialBalance: number
): { labels: string[]; data: number[] } {
  const ordered = trades
    .map((trade, index) => ({ trade, index }))
    .sort((a, b) => {
      const byDate =
        new Date(a.trade.tradeDate).getTime() - new Date(b.trade.tradeDate).getTime();
      if (byDate !== 0) return byDate;

      const aCreated = a.trade.createdAt ?? '';
      const bCreated = b.trade.createdAt ?? '';
      if (aCreated !== bCreated) return aCreated < bCreated ? -1 : 1;

      return a.index - b.index;
    });

  const start = Number.isFinite(initialBalance) ? initialBalance : 0;
  const labels: string[] = ['Start'];
  const data: number[] = [start];

  let balance = start;
  for (const { trade } of ordered) {
    balance += getPropTradePnL(trade);
    labels.push(new Date(trade.tradeDate).toLocaleDateString());
    data.push(balance);
  }

  return { labels, data };
}

/**
 * Converts a stored limit percentage (3 => 3%) into a monetary amount.
 * Returns null when either the percentage or the account size is missing or unusable,
 * so callers can render "Not configured" instead of dividing by zero.
 */
export function computeLimitAmount(accountSize: number, percent: number | null): number | null {
  if (percent === null || !Number.isFinite(percent) || percent <= 0) return null;
  if (!Number.isFinite(accountSize) || accountSize <= 0) return null;
  return (accountSize * percent) / 100;
}

/** Limit usage percentage. Never negative, and null when the limit is not configured. */
export function computeLimitUsage(used: number, limit: number | null): number | null {
  if (limit === null || !Number.isFinite(limit) || limit <= 0) return null;
  const safeUsed = Number.isFinite(used) ? Math.max(0, used) : 0;
  return (safeUsed / limit) * 100;
}

/** Largest peak-to-trough fall measured on cumulative journal P&L. */
export function computeFirmDrawdown(trades: PropFirmTrade[]) {
  return computeDrawdown(toAnalyticsTrades(trades));
}

/** Largest fall measured from the initial balance (typical prop firm rule basis). */
export function computeDrawdownFromInitial(
  trades: PropFirmTrade[],
  initialBalance: number
): number {
  const equity = computeFirmEquity(trades, initialBalance);
  if (equity.data.length === 0) return 0;
  const lowest = Math.min(...equity.data);
  return Math.max(0, initialBalance - lowest);
}

/** Sum of P&L for trades logged today (journal-based, not live equity). */
export function computeTodayPnL(trades: PropFirmTrade[]): number {
  const today = new Date();
  return trades
    .filter((t) => {
      const d = new Date(t.tradeDate);
      return (
        d.getFullYear() === today.getFullYear() &&
        d.getMonth() === today.getMonth() &&
        d.getDate() === today.getDate()
      );
    })
    .reduce((s, t) => s + getPropTradePnL(t), 0);
}

export function formatFirmCurrency(value: number, currency: string): string {
  const code = (currency || '').toUpperCase() || 'INR';
  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(Number.isFinite(value) ? value : 0);
  } catch {
    return `${code} ${(Number.isFinite(value) ? value : 0).toFixed(2)}`;
  }
}

export function getCurrencySymbol(currency: string): string {
  const code = (currency || '').toUpperCase() || 'INR';
  try {
    const parts = new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: code,
    }).formatToParts(1);
    return parts.find((p) => p.type === 'currency')?.value ?? code;
  } catch {
    return code;
  }
}
