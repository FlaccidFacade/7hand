import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UserStats {
  gamesPlayed: number;
  gamesWon: number;
  gamesLost: number;
}

export interface User {
  id: string;
  username: string;
  displayName: string;
  coins: number;
  stats: UserStats;
  createdAt: string;
  lastActive: string;
}

export interface RegisterUserRequest {
  username: string;
  password: string;
  displayName?: string;
  email?: string;
}

export interface UpdateUserRequest {
  displayName?: string;
  email?: string;
  coins?: number;
  stats?: Partial<UserStats>;
}

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly apiUrl = '/api/user';

  constructor(private http: HttpClient) {}

  /**
   * Register a new user (POST /api/user)
   */
  registerUser(userData: RegisterUserRequest): Observable<User> {
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
}
