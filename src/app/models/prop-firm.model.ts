export interface PropFirm {
  id?: string;
  userId?: string;
  firmName: string;
  accountName?: string;
  accountId?: string;
  accountType?: string;
  initialBalance: number;
  accountCurrency: string;
  accountSize?: number | null;
  /** Profit target as a PERCENTAGE of the account size (e.g. 8 = 8%). */
  profitTarget?: number | null;
  /** Maximum daily loss as a PERCENTAGE of the account size (e.g. 3 = 3%). */
  maximumDailyLoss?: number | null;
  /** Overall drawdown limit as a PERCENTAGE of the account size (e.g. 10 = 10%). */
  maximumOverallDrawdown?: number | null;
  startDate?: string | null;
  notes?: string;
  /** User-entered expense for this firm, always reported in INR. */
  amountSpent?: number | null;
  /** Manual lifecycle flag: 'Active', 'Failed' or 'Passed'. Never derived from P/L. */
  status?: string;
  /**
   * Total payouts actually received from the firm, in the firm's account currency.
   * Manual entry only - never derived from trades or amount spent.
   */
  payouts?: number | null;
  createdAt?: string;
  updatedAt?: string;
}
