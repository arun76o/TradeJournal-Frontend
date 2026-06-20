import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Trade } from '../models/trade.model';

@Injectable({
  providedIn: 'root',
})
export class TradeService {
  private http = inject(HttpClient);

  private apiUrl = 'https://localhost:7265/api/Trades';

  // getTrades() {
  //   return this.http.get<any[]>(this.apiUrl);
  // }

  //   getTrades(userId: string) {
  //   return this.http.get<any[]>(`${this.apiUrl}/${userId}`);
  // }
  //   addTrade(trade: any) {
  //     return this.http.post(this.apiUrl, trade);
  //   }

  //   updateTrade(id: string, trade: any) {
  //     return this.http.put(`${this.apiUrl}/${id}`, trade);
  //   }

  //   deleteTrade(id: string) {
  //     return this.http.delete(`${this.apiUrl}/${id}`);
  //   }

  getTrades(userId: string) {
    return this.http.get<Trade[]>(`${this.apiUrl}/user/${userId}`);
  }

  addTrade(trade: Trade) {
    return this.http.post(this.apiUrl, trade);
  }

  updateTrade(id: string, trade: Trade) {
    return this.http.put(`${this.apiUrl}/${id}`, trade);
  }

  deleteTrade(id: string) {
    return this.http.delete(`${this.apiUrl}/delete/${id}`);
  }

  getUsdInrRate() {
    return this.http.get<any>('https://open.er-api.com/v6/latest/USD');
  }

  getTradeById(id: string) {
    return this.http.get<Trade>(`${this.apiUrl}/${id}`);
  }
}
