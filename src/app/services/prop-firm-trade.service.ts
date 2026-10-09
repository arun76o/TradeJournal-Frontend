import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { PropFirmTrade } from '../models/prop-firm-trade.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PropFirmTradeService {
  private http = inject(HttpClient);
  private auth = inject(Auth);

  private apiUrl = `${environment.apiUrl}/PropFirmTrades`;

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getTrades(propFirmId: string): Observable<PropFirmTrade[]> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<PropFirmTrade[]>(`${this.apiUrl}/${propFirmId}`, {
          headers,
        })
      )
    );
  }

  getTrade(propFirmId: string, tradeId: string): Observable<PropFirmTrade> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<PropFirmTrade>(
          `${this.apiUrl}/${propFirmId}/${tradeId}`,
          { headers }
        )
      )
    );
  }

  addTrade(trade: PropFirmTrade): Observable<any> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) => this.http.post(this.apiUrl, trade, { headers }))
    );
  }

  updateTrade(
    propFirmId: string,
    tradeId: string,
    trade: PropFirmTrade
  ): Observable<any> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.put(`${this.apiUrl}/${propFirmId}/${tradeId}`, trade, {
          headers,
        })
      )
    );
  }

  deleteTrade(propFirmId: string, tradeId: string): Observable<any> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.delete(`${this.apiUrl}/${propFirmId}/${tradeId}`, { headers })
      )
    );
  }

  /** Full USD base table used to convert into the prop firm account currency. */
  getUsdRates(): Observable<any> {
    return this.http.get<any>('https://open.er-api.com/v6/latest/USD');
  }
}
