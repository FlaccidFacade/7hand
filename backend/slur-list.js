// slur-list.js - Curated list of inappropriate terms for username filtering
// This file contains offensive terms for filtering purposes only

/**
 * List of prohibited terms
 * Keep this list lowercase - normalization happens before checking
 */
const SLUR_LIST = [
  // Racial slurs
  'nigger',
  'nigga',
  'niqqa',
  'kike',
  'chink',
  'gook',
  'spic',
  'wetback',
  'beaner',
  'paki',
  'coon',
  'jigaboo',
  'raghead',
  'towelhead',
  'redskin',
  'hymie',
  'zipperhead',
  
  // Homophobic slurs
  'faggot',
  'fag',
  'dyke',
  'tranny',
  'shemale',
  
  // Sexist slurs
  'cunt',
  'whore',
  'slut',
  'bitch',
  
  // Ableist slurs
  'retard',
  'retarded',
  'spastic',
  'mongo',
  'mongoloid',
  
  // Nazi/hate symbols
  'hitler',
  'nazi',
  'swastika',
  'kkk',
  '1488',
  '88',
  
  // Generic offensive
  'rape',
  'molest',
  'pedophile',
  'pedo',
  'kill',
  'murder',
  'terrorist',
];

/**
 * Patterns to detect obfuscation attempts
 * These are regex patterns that match common letter substitutions
 */
const OBFUSCATION_PATTERNS = [
  // 1337 speak and common substitutions
  /n[i1!]gg[e3@]r/i,
  /n[i1!]gg[a4@]/i,
  /f[a4@]gg[o0]/i,
  /f[a4@]g/i,
  /k[i1!]k[e3@]/i,
  /n[a4@]z[i1!]/i,
  /h[i1!]tl[e3@]r/i,
  /r[e3@]t[a4@]rd/i,
  /c[o0]nt/i,
  /wh[o0]r[e3@]/i,
  /sl[u0]t/i,
  /b[i1!]tch/i,
  /r[a4@]p[e3@]/i,
  /p[e3@]d[o0]/i,
  /[ck]{2,}k/i, // KKK with various spellings
];

module.exports = {
  SLUR_LIST,
  OBFUSCATION_PATTERNS
};
