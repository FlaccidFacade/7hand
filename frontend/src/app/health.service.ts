import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, timer, switchMap, shareReplay } from 'rxjs';

export interface HealthStatus {
  api: string;
  apiVersion: string;
  db: string;
  dbVersion: string | null;
}

@Injectable({ providedIn: 'root' })
export class HealthService {
  constructor(private http: HttpClient) {}

  getHealth(intervalMs = 5000): Observable<HealthStatus> {
    return timer(0, intervalMs).pipe(
      switchMap(() => this.http.get<HealthStatus>('/api/health')),
      shareReplay(1)
    );
  }
}
