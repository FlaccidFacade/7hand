// profanity-filter.test.js - Tests for profanity filtering

const { 
  normalizeText, 
  containsProfanity, 
  validateUsername, 
  validateDisplayName 
} = require('../profanity-filter');

describe('Profanity Filter', () => {
  describe('normalizeText', () => {
    it('should convert to lowercase', () => {
      expect(normalizeText('HELLO')).toBe('hello');
      expect(normalizeText('MiXeD')).toBe('mixed');
    });

    it('should strip diacritics', () => {
      expect(normalizeText('café')).toBe('cafe');
      expect(normalizeText('naïve')).toBe('naive');
      expect(normalizeText('señor')).toBe('senor');
      expect(normalizeText('Zürich')).toBe('zurich');
    });

    it('should collapse repeated characters', () => {
      expect(normalizeText('fuuuuck')).toBe('fuuck');
      expect(normalizeText('shiiiit')).toBe('shiit');
      expect(normalizeText('looool')).toBe('loool');
      // Should preserve double characters
      expect(normalizeText('good')).toBe('good');
      expect(normalizeText('book')).toBe('book');
    });

    it('should remove separators', () => {
      expect(normalizeText('hello world')).toBe('helloworld');
      expect(normalizeText('hello-world')).toBe('helloworld');
      expect(normalizeText('hello_world')).toBe('helloworld');
      expect(normalizeText('hello.world')).toBe('helloworld');
    });

    it('should handle empty or invalid input', () => {
      expect(normalizeText('')).toBe('');
      expect(normalizeText(null)).toBe('');
      expect(normalizeText(undefined)).toBe('');
    });

    it('should combine all normalizations', () => {
      expect(normalizeText('CaFÉ-WoRlD___123')).toBe('cafeworld123');
      expect(normalizeText('HEEELLLOOO')).toBe('heelloo');
    });
  });

  describe('containsProfanity', () => {
    it('should detect exact slur matches', () => {
      expect(containsProfanity('nigger')).toBe(true);
      expect(containsProfanity('faggot')).toBe(true);
      expect(containsProfanity('retard')).toBe(true);
    });

    it('should detect slurs with case variations', () => {
      expect(containsProfanity('NIGGER')).toBe(true);
      expect(containsProfanity('FaGgOt')).toBe(true);
      expect(containsProfanity('ReTaRd')).toBe(true);
    });

    it('should detect slurs with diacritics', () => {
      expect(containsProfanity('nîggér')).toBe(true);
      expect(containsProfanity('fággót')).toBe(true);
    });

    it('should detect slurs with repeated characters', () => {
      expect(containsProfanity('niiiigger')).toBe(true);
      expect(containsProfanity('faaaaaggot')).toBe(true);
      expect(containsProfanity('retaaaaard')).toBe(true);
    });

    it('should detect slurs with separators', () => {
      expect(containsProfanity('n i g g e r')).toBe(true);
      expect(containsProfanity('f-a-g-g-o-t')).toBe(true);
      expect(containsProfanity('r_e_t_a_r_d')).toBe(true);
    });

    it('should detect slurs embedded in usernames', () => {
      expect(containsProfanity('xXniggerXx')).toBe(true);
      expect(containsProfanity('pro_faggot_gamer')).toBe(true);
      expect(containsProfanity('retard123')).toBe(true);
    });

    it('should detect 1337 speak obfuscations', () => {
      expect(containsProfanity('n1gg3r')).toBe(true);
      expect(containsProfanity('f4gg0t')).toBe(true);
      expect(containsProfanity('r3t4rd')).toBe(true);
      expect(containsProfanity('n@z1')).toBe(true);
      expect(containsProfanity('h1tl3r')).toBe(true);
    });

    it('should detect various KKK spellings', () => {
      expect(containsProfanity('kkk')).toBe(true);
      expect(containsProfanity('KKK')).toBe(true);
      expect(containsProfanity('k_k_k')).toBe(true);
    });

    it('should not flag clean usernames', () => {
      expect(containsProfanity('player123')).toBe(false);
      expect(containsProfanity('coolgamer')).toBe(false);
      expect(containsProfanity('happyuser')).toBe(false);
      expect(containsProfanity('john_doe')).toBe(false);
    });

    it('should not flag words containing slurs as substrings', () => {
      // These might contain slur substrings but are legitimate words
      // Note: Current implementation DOES catch these - if you want to be
      // more lenient, you'd need to check word boundaries
      expect(containsProfanity('assassin')).toBe(false);
      expect(containsProfanity('classic')).toBe(false);
    });

    it('should handle empty or invalid input', () => {
      expect(containsProfanity('')).toBe(false);
      expect(containsProfanity(null)).toBe(false);
      expect(containsProfanity(undefined)).toBe(false);
    });
  });

  describe('validateUsername', () => {
    it('should accept clean usernames', () => {
      const result = validateUsername('player123');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject usernames with profanity', () => {
      const result = validateUsername('nigger123');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Username contains inappropriate content');
    });

    it('should not reveal which slur was detected', () => {
      const result = validateUsername('faggot');
      expect(result.error).toBe('Username contains inappropriate content');
      expect(result.error).not.toContain('faggot');
    });
  });

  describe('validateDisplayName', () => {
    it('should accept clean display names', () => {
      const result = validateDisplayName('Cool Player');
      expect(result.valid).toBe(true);
      expect(result.error).toBeNull();
    });

    it('should reject display names with profanity', () => {
      const result = validateDisplayName('The Retard');
      expect(result.valid).toBe(false);
      expect(result.error).toBe('Display name contains inappropriate content');
    });

    it('should handle names with spaces', () => {
      const result = validateDisplayName('Player Name');
      expect(result.valid).toBe(true);
    });
  });

  describe('Complex obfuscation tests', () => {
    it('should detect creative obfuscations', () => {
      expect(containsProfanity('n1gg@')).toBe(true);
      expect(containsProfanity('f@g')).toBe(true);
      expect(containsProfanity('wh0r3')).toBe(true);
      expect(containsProfanity('sl00t')).toBe(true);
      expect(containsProfanity('b!tch')).toBe(true);
    });

    it('should detect mixed obfuscation techniques', () => {
      expect(containsProfanity('N___1___G___G___E___R')).toBe(true);
      expect(containsProfanity('f.a.g.g.o.t')).toBe(true);
      expect(containsProfanity('REEEEETARD')).toBe(true);
    });
  });
});
