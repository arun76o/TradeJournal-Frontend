import { Trade } from '../../models/trade.model';

export interface DashboardStats {
  totalTrades: number;
  winningTrades: number;
  losingTrades: number;
  breakevenTrades: number;
  winRate: number;
  netProfit: number;
  netLoss: number;
  totalPnL: number;
  profitFactor: number;
  averageRR: number;
  bestTrade: number;
  worstTrade: number;
  currentMonthPnL: number;
}

export interface MonthlyPnL {
  month: string;
  profit: number;
  loss: number;
  net: number;
}

export interface StrategyStats {
  strategy: string;
  trades: number;
  winRate: number;
  totalPnL: number;
  avgPnL: number;
}

export interface DayOfWeekPnL {
  day: string;
  dayIndex: number;
  pnl: number;
  trades: number;
}

export function getTradePnL(trade: Trade): number {
  return trade.netProfitINR;
}

export function getTradeStatus(trade: Trade): 'WIN' | 'LOSS' | 'BREAKEVEN' {
  const pnl = getTradePnL(trade);
  if (pnl > 0) return 'WIN';
  if (pnl < 0) return 'LOSS';
  return 'BREAKEVEN';
}

export function calculateRiskReward(trade: Trade): number {
  const entry = Number(trade.entryPrice);
  const exit = Number(trade.exitPrice);
  const sl = Number(trade.stopLoss);
  if (!entry || !exit || !sl) return 0;

  const reward = Math.abs(exit - entry);
  const risk = Math.abs(entry - sl);
  return risk > 0 ? reward / risk : 0;
}

export function computeDashboardStats(trades: Trade[]): DashboardStats {
  const pnls = trades.map(getTradePnL);
  const wins = trades.filter((t) => getTradePnL(t) > 0);
  const losses = trades.filter((t) => getTradePnL(t) < 0);
  const breakeven = trades.filter((t) => getTradePnL(t) === 0);

  const netProfit = wins.reduce((s, t) => s + getTradePnL(t), 0);
  const netLoss = Math.abs(losses.reduce((s, t) => s + getTradePnL(t), 0));
  const totalPnL = pnls.reduce((s, p) => s + p, 0);

  const now = new Date();
  const currentMonthPnL = trades
    .filter((t) => {
      const d = new Date(t.tradeDate);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })
    .reduce((s, t) => s + getTradePnL(t), 0);

  const rrValues = trades.map(calculateRiskReward).filter((r) => r > 0);

  return {
    totalTrades: trades.length,
    winningTrades: wins.length,
    losingTrades: losses.length,
    breakevenTrades: breakeven.length,
    winRate: trades.length > 0 ? Math.round((wins.length / trades.length) * 100) : 0,
    netProfit,
    netLoss,
    totalPnL,
    profitFactor: netLoss > 0 ? netProfit / netLoss : netProfit > 0 ? Infinity : 0,
    averageRR: rrValues.length > 0 ? rrValues.reduce((a, b) => a + b, 0) / rrValues.length : 0,
    bestTrade: pnls.length > 0 ? Math.max(...pnls) : 0,
    worstTrade: pnls.length > 0 ? Math.min(...pnls) : 0,
    currentMonthPnL,
  };
}

export function computeEquityCurve(trades: Trade[]): { labels: string[]; data: number[] } {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
  );
  let cumulative = 0;
  const labels: string[] = [];
  const data: number[] = [];

  sorted.forEach((trade) => {
    cumulative += getTradePnL(trade);
    labels.push(new Date(trade.tradeDate).toLocaleDateString());
    data.push(cumulative);
  });

  return { labels, data };
}

export function computeMonthlyPnL(trades: Trade[]): MonthlyPnL[] {
  const map = new Map<string, MonthlyPnL>();

  trades.forEach((trade) => {
    const d = new Date(trade.tradeDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
    const pnl = getTradePnL(trade);

    if (!map.has(key)) {
      map.set(key, { month: label, profit: 0, loss: 0, net: 0 });
    }
    const entry = map.get(key)!;
    if (pnl >= 0) entry.profit += pnl;
    else entry.loss += Math.abs(pnl);
    entry.net += pnl;
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => v);
}

export function computeDailyPnL(trades: Trade[]): { labels: string[]; data: number[] } {
  const map = new Map<string, number>();

  trades.forEach((trade) => {
    const key = new Date(trade.tradeDate).toLocaleDateString();
    map.set(key, (map.get(key) ?? 0) + getTradePnL(trade));
  });

  const sorted = Array.from(map.entries()).sort(
    ([a], [b]) => new Date(a).getTime() - new Date(b).getTime()
  );

  return {
    labels: sorted.map(([k]) => k),
    data: sorted.map(([, v]) => v),
  };
}

export function computeStrategyStats(trades: Trade[]): StrategyStats[] {
  const map = new Map<string, Trade[]>();

  trades.forEach((trade) => {
    const key = trade.strategy || 'Unassigned';
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(trade);
  });

  return Array.from(map.entries())
    .map(([strategy, group]) => {
      const wins = group.filter((t) => getTradePnL(t) > 0).length;
      const totalPnL = group.reduce((s, t) => s + getTradePnL(t), 0);
      return {
        strategy,
        trades: group.length,
        winRate: group.length > 0 ? Math.round((wins / group.length) * 100) : 0,
        totalPnL,
        avgPnL: group.length > 0 ? totalPnL / group.length : 0,
      };
    })
    .sort((a, b) => b.totalPnL - a.totalPnL);
}

export function computeDayOfWeekHeatmap(trades: Trade[]): DayOfWeekPnL[] {
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const result: DayOfWeekPnL[] = days.map((day, i) => ({
    day,
    dayIndex: i,
    pnl: 0,
    trades: 0,
  }));

  trades.forEach((trade) => {
    const idx = new Date(trade.tradeDate).getDay();
    result[idx].pnl += getTradePnL(trade);
    result[idx].trades += 1;
  });

  return result;
}

export function computeDrawdown(trades: Trade[]): { maxDrawdown: number; maxDrawdownPercent: number } {
  const sorted = [...trades].sort(
    (a, b) => new Date(a.tradeDate).getTime() - new Date(b.tradeDate).getTime()
  );

  let peak = 0;
  let cumulative = 0;
  let maxDrawdown = 0;

  sorted.forEach((trade) => {
    cumulative += getTradePnL(trade);
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;
    if (dd > maxDrawdown) maxDrawdown = dd;
  });

  const maxDrawdownPercent = peak > 0 ? (maxDrawdown / peak) * 100 : 0;
  return { maxDrawdown, maxDrawdownPercent };
}

export function computeWeeklyStats(trades: Trade[]): { week: string; pnl: number; trades: number }[] {
  const map = new Map<string, { pnl: number; trades: number }>();

  trades.forEach((trade) => {
    const d = new Date(trade.tradeDate);
    const startOfWeek = new Date(d);
    startOfWeek.setDate(d.getDate() - d.getDay());
    const key = startOfWeek.toLocaleDateString();
    if (!map.has(key)) map.set(key, { pnl: 0, trades: 0 });
    const entry = map.get(key)!;
    entry.pnl += getTradePnL(trade);
    entry.trades += 1;
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
    .map(([week, v]) => ({ week, ...v }));
}
