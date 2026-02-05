import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class CookieService {
  /**
   * Get a cookie value by name
   */
  getCookie(name: string): string | null {
    const nameEQ = name + '=';
    const cookies = document.cookie.split(';');
    
    for (let cookie of cookies) {
      cookie = cookie.trim();
      if (cookie.indexOf(nameEQ) === 0) {
        return decodeURIComponent(cookie.substring(nameEQ.length));
      }
    }
    return null;
  }

  /**
   * Set a cookie
   * @param name Cookie name
   * @param value Cookie value
   * @param days Days until expiration (default: 365 days / 1 year)
   * @param path Cookie path (default: '/')
   */
  setCookie(name: string, value: string, days: number = 365, path: string = '/'): void {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = 'expires=' + date.toUTCString();
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=${path};SameSite=Lax`;
  }

  /**
   * Delete a cookie
   */
  deleteCookie(name: string, path: string = '/'): void {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=${path};`;
  }

  /**
   * Check if a cookie exists
   */
  hasCookie(name: string): boolean {
    return this.getCookie(name) !== null;
  }
}
