export interface Trade {
  userId: string;
  id?: string;
  symbol: string;
  side: string;
  entryPrice: number;
  exitPrice: number;
  stopLoss: number;
  takeProfit: number;
  quantity: number;
  strategy: string;
  notes: string;
  tradeDate: string;
  grossProfitUSD: number;
  grossProfitINR: number;
  fees: number;
  netProfitINR: number;
  // imageUrl?: string;
  imageUrls?: string[];
}


export interface UserProfile {
  id?: string;

  displayName: string;
  email: string;

  tradingGoal: string;
  preferredMarkets: string;

  maxDailyLoss: number;
  maxRiskPerTrade: number;
}