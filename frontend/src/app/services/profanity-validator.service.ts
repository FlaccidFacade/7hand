// profanity-validator.service.ts - Frontend profanity validation service
// Mirrors backend validation logic

import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, tap } from 'rxjs/operators';

interface ProfanityRules {
  slurList: string[];
  obfuscationPatterns: string[];
}

interface ValidationResult {
  valid: boolean;
  error: string | null;
}

@Injectable({
  providedIn: 'root'
})
export class ProfanityValidatorService {
  private apiUrl = 'http://localhost:3000/api';
  private rules$ = new BehaviorSubject<ProfanityRules | null>(null);

  constructor(private http: HttpClient) {
    // Load rules on service initialization
    this.loadRules().subscribe();
  }

  /**
   * Load profanity rules from backend
   */
  loadRules(): Observable<ProfanityRules> {
    return this.http.get<ProfanityRules>(`${this.apiUrl}/config/profanity-rules`).pipe(
      tap(rules => this.rules$.next(rules))
    );
  }

  /**
   * Normalize text for profanity checking (mirrors backend logic)
   */
  private normalizeText(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    // Convert to lowercase
    let normalized = text.toLowerCase();

    // Strip diacritics/accents
    normalized = normalized.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

    // Collapse repeated characters (3+ consecutive → 2)
    normalized = normalized.replace(/(.)\1{2,}/g, '$1$1');

    // Remove separators
    normalized = normalized.replace(/[\s._-]/g, '');

    return normalized;
  }

  /**
   * Check if text contains profanity
   */
  containsProfanity(text: string): boolean {
    const rules = this.rules$.value;
    if (!rules || !text || typeof text !== 'string') {
      return false;
    }

    const normalized = this.normalizeText(text);

    // Check against slur list
    for (const slur of rules.slurList) {
      if (normalized.includes(slur)) {
        return true;
      }
    }

    // Check against obfuscation patterns
    const textWithoutSpaces = text.replace(/[\s._-]/g, '');
    for (const patternStr of rules.obfuscationPatterns) {
      const pattern = new RegExp(patternStr, 'i');
      if (pattern.test(textWithoutSpaces)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Validate text against profanity filter
   */
  validateText(text: string, fieldName: string = 'Text'): ValidationResult {
    if (this.containsProfanity(text)) {
      return {
        valid: false,
        error: `${fieldName} contains inappropriate content`
      };
    }

    return {
      valid: true,
      error: null
    };
  }

  /**
   * Validate username
   */
  validateUsername(username: string): ValidationResult {
    return this.validateText(username, 'Username');
  }

  /**
   * Validate display name
   */
  validateDisplayName(displayName: string): ValidationResult {
    return this.validateText(displayName, 'Display name');
  }

  /**
   * Check if rules are loaded
   */
  areRulesLoaded(): boolean {
    return this.rules$.value !== null;
  }

  /**
   * Get rules as observable
   */
  getRules(): Observable<ProfanityRules | null> {
    return this.rules$.asObservable();
  }
}
