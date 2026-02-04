import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
}

export interface CookieConsent {
  timestamp: string;
  preferences: {
    essential: boolean;
    analytics: boolean;
    advertising: boolean;
    personalized: boolean;
  };
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  stats: UserStats;
  createdAt: string;
  lastActive: string;
  cookieConsent?: CookieConsent;
}

export interface CreateUserRequest {
  username: string;
  displayName?: string;
  email?: string;
}

export interface UpdateUserRequest {
  displayName?: string;
  email?: string;
  stats?: Partial<UserStats>;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = '/api/user';

  constructor(private http: HttpClient) {}

  /**
   * Create a new user
   */
  createUser(userData: CreateUserRequest): Observable<User> {
    return this.http.post<User>(this.apiUrl, userData);
  }

  /**
   * Get user by ID
   */
  getUserById(userId: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/${userId}`);
  }

  /**
   * Get user by username
   */
  getUserByUsername(username: string): Observable<User> {
    return this.http.get<User>(`${this.apiUrl}/username/${username}`);
  }

  /**
   * Get all users
   */
  getAllUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.apiUrl}s`);
  }

  /**
   * Update user
   */
  updateUser(userId: string, updates: UpdateUserRequest): Observable<User> {
    return this.http.patch<User>(`${this.apiUrl}/${userId}`, updates);
  }

  /**
   * Delete user
   */
  deleteUser(userId: string): Observable<{ success: boolean }> {
    return this.http.delete<{ success: boolean }>(`${this.apiUrl}/${userId}`);
  }

  /**
   * Update user activity timestamp
   */
  updateUserActivity(userId: string): Observable<{ success: boolean }> {
    return this.http.post<{ success: boolean }>(`${this.apiUrl}/${userId}/activity`, {});
  }

  /**
   * Update user cookie consent preferences
   */
  updateCookieConsent(userId: string, cookieConsent: CookieConsent): Observable<{ success: boolean; cookieConsent: CookieConsent }> {
    return this.http.patch<{ success: boolean; cookieConsent: CookieConsent }>(`${this.apiUrl}/${userId}/cookie-consent`, { cookieConsent });
  }
}
