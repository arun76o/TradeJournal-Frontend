import { PropFirmTrade } from '../../models/prop-firm-trade.model';
import { Trade } from '../../models/trade.model';
import {
  computeDashboardStats,
  computeDrawdown,
  computeEquityCurve,
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

/** Balance curve starting from the firm's initial balance. */
export function computeFirmEquity(
  trades: PropFirmTrade[],
  initialBalance: number
): { labels: string[]; data: number[] } {
  const curve = computeEquityCurve(toAnalyticsTrades(trades));
  return {
    labels: curve.labels,
    data: curve.data.map((v) => initialBalance + v),
  };
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
