import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, from, switchMap } from 'rxjs';
import { Auth } from '@angular/fire/auth';
import { PropFirm } from '../models/prop-firm.model';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root',
})
export class PropFirmService {
  private http = inject(HttpClient);
  private auth = inject(Auth);

  private apiUrl = `${environment.apiUrl}/PropFirms`;

  private async getAuthHeaders(): Promise<HttpHeaders> {
    const user = this.auth.currentUser;
    if (!user) throw new Error('Not authenticated');
    const token = await user.getIdToken();
    return new HttpHeaders({
      Authorization: `Bearer ${token}`,
    });
  }

  getPropFirms(): Observable<PropFirm[]> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<PropFirm[]>(this.apiUrl, { headers })
      )
    );
  }

  getPropFirm(id: string): Observable<PropFirm> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.get<PropFirm>(`${this.apiUrl}/${id}`, { headers })
      )
    );
  }

  addPropFirm(propFirm: PropFirm): Observable<any> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.post(this.apiUrl, propFirm, { headers })
      )
    );
  }

  updatePropFirm(id: string, propFirm: PropFirm): Observable<any> {
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.put(`${this.apiUrl}/${id}`, propFirm, { headers })
      )
    );
  }

  /**
   * Deleting a firm that still has trades returns HTTP 409 until the caller
   * explicitly re-sends the request with `force = true`.
   */
  deletePropFirm(id: string, force = false): Observable<any> {
    const suffix = force ? '?force=true' : '';
    return from(this.getAuthHeaders()).pipe(
      switchMap((headers) =>
        this.http.delete(`${this.apiUrl}/${id}${suffix}`, { headers })
      )
    );
  }
}
