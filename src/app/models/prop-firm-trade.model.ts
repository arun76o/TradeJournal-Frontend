import { Trade } from './trade.model';

export interface PropFirmTrade extends Trade {
  /** Owning prop firm. Never mixed with the regular `trades` collection. */
  propFirmId: string;
  /** Net profit/loss denominated in the prop firm account currency. */
  netProfit: number;
  /** Gross profit/loss denominated in the prop firm account currency. */
  grossProfit: number;
  createdAt?: string;
  updatedAt?: string;
}
