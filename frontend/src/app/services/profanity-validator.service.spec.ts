// profanity-validator.service.spec.ts - Tests for profanity validator service

import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';
import { ProfanityValidatorService } from './profanity-validator.service';

describe('ProfanityValidatorService', () => {
  let service: ProfanityValidatorService;
  let httpMock: HttpTestingController;

  const mockRules = {
    slurList: ['nigger', 'faggot', 'retard', 'nazi'],
    obfuscationPatterns: [
      'n[i1!]gg[e3@]r',
      'f[a4@]gg[o0]',
      'r[e3@]t[a4@]rd',
      'n[a4@]z[i1!]'
    ]
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [ProfanityValidatorService]
    });
    service = TestBed.inject(ProfanityValidatorService);
    httpMock = TestBed.inject(HttpTestingController);

    // Intercept the initial loadRules() call from constructor
    const req = httpMock.expectOne('http://localhost:3000/api/config/profanity-rules');
    req.flush(mockRules);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should load rules from backend', (done) => {
    service.getRules().subscribe(rules => {
      expect(rules).toEqual(mockRules);
      done();
    });
  });

  describe('containsProfanity', () => {
    it('should detect exact slur matches', () => {
      expect(service.containsProfanity('nigger')).toBe(true);
      expect(service.containsProfanity('faggot')).toBe(true);
      expect(service.containsProfanity('retard')).toBe(true);
    });

    it('should detect slurs with case variations', () => {
      expect(service.containsProfanity('NIGGER')).toBe(true);
      expect(service.containsProfanity('FaGgOt')).toBe(true);
    });

    it('should detect slurs with repeated characters', () => {
      expect(service.containsProfanity('niiiigger')).toBe(true);
      expect(service.containsProfanity('faaaaaggot')).toBe(true);
    });

    it('should detect slurs with separators', () => {
      expect(service.containsProfanity('n i g g e r')).toBe(true);
      expect(service.containsProfanity('f-a-g-g-o-t')).toBe(true);
    });

    it('should detect 1337 speak obfuscations', () => {
      expect(service.containsProfanity('n1gg3r')).toBe(true);
      expect(service.containsProfanity('f4gg0t')).toBe(true);
      expect(service.containsProfanity('r3t4rd')).toBe(true);
    });

    it('should not flag clean usernames', () => {
      expect(service.containsProfanity('player123')).toBe(false);
      expect(service.containsProfanity('coolgamer')).toBe(false);
      expect(service.containsProfanity('john_doe')).toBe(false);
    });
  });

  describe('validateUsername', () => {
    it('should accept clean usernames', () => {
      const result = service.validateUsername('player123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject usernames with profanity', () => {
      const result = service.validateUsername('nigger123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username contains inappropriate content');
    });
  });

  describe('validateDisplayName', () => {
    it('should accept clean display names', () => {
      const result = service.validateDisplayName('Cool Player');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject display names with profanity', () => {
      const result = service.validateDisplayName('The Retard');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Display name contains inappropriate content');
    });
  });

  describe('areRulesLoaded', () => {
    it('should return true after rules are loaded', () => {
      expect(service.areRulesLoaded()).toBe(true);
    });
  });
});
