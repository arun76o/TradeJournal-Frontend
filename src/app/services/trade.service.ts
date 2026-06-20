import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Trade } from '../models/trade.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class TradeService {
  private http = inject(HttpClient);

  private apiUrl = `${environment.apiUrl}/Trades`;



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
