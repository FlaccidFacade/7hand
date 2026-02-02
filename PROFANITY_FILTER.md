# Profanity Filter Implementation

This document describes the username and display name profanity filtering system implemented for the 7hand card game.

## Overview

The profanity filter prevents users from creating accounts with inappropriate usernames or display names. It follows these key principles:

- ✅ **Backend is authoritative** - All validation happens on the server
- ✅ **Frontend mirrors backend** - Client-side validation provides immediate feedback
- ✅ **Shared configuration** - Same rules used on both frontend and backend
- ✅ **Generic error messages** - Don't reveal which specific slur was detected
- ❌ **No auto-renaming** - Users must choose a different name themselves
- ❌ **No silent acceptance** - Always reject inappropriate content
- ❌ **No third-party dependencies** - Self-contained, no external API calls

## Architecture

### Backend (Node.js/Express)

#### Files Created

1. **`backend/slur-list.js`**
   - Contains curated list of prohibited terms
   - Includes regex patterns for obfuscation detection
   - Shared with frontend via API endpoint

2. **`backend/profanity-filter.js`**
   - Core filtering logic
   - Text normalization functions
   - Validation functions

3. **`backend/__tests__/profanity-filter.test.js`**
   - Comprehensive test suite
   - Tests normalization, detection, and validation

#### Modified Files

- **`backend/user.js`** - Integrated profanity checking into User.validate() method
- **`backend/index.js`** - Added `/api/config/profanity-rules` endpoint

### Frontend (Angular)

#### Files Created

1. **`frontend/src/app/services/profanity-validator.service.ts`**
   - Fetches rules from backend
   - Mirrors backend normalization logic
   - Provides validation functions

2. **`frontend/src/app/services/profanity-validator.service.spec.ts`**
   - Test suite for frontend service

#### Modified Files

- **`frontend/src/app/components/registration-form/registration-form.ts`** - Added profanity validators
- **`frontend/src/app/components/registration-form/registration-form.html`** - Added profanity error messages

## How It Works

### 1. Text Normalization

Before checking against the slur list, text is normalized to catch obfuscation attempts:

```javascript
normalizeText("CaFÉ-WoRlD___123") → "cafeworld123"
```

Normalization steps:
1. **Lowercase** - `HELLO` → `hello`
2. **Strip diacritics** - `café` → `cafe`
3. **Collapse repeated chars** - `fuuuuck` → `fuuck` (3+ → 2)
4. **Remove separators** - `h-e-l-l-o` → `hello`

### 2. Detection Methods

Two complementary approaches:

**Exact Match (after normalization)**
```javascript
containsProfanity("n___i___g___g___e___r") // true
containsProfanity("NIIIIGGER") // true
containsProfanity("nîggér") // true
```

**Regex Patterns (1337 speak)**
```javascript
containsProfanity("n1gg3r") // true
containsProfanity("f4gg0t") // true
containsProfanity("r3t4rd") // true
```

### 3. Validation Flow

**Frontend:**
1. User types username
2. On blur/change, validate against loaded rules
3. Show generic error if inappropriate
4. Prevent form submission if invalid

**Backend:**
1. Receive user creation request
2. Run User.validate() which includes profanity check
3. Return 400 error with generic message if inappropriate
4. Reject account creation

## API Endpoint

### GET `/api/config/profanity-rules`

Returns the slur list and obfuscation patterns for client-side validation.

**Response:**
```json
{
  "slurList": ["slur1", "slur2", ...],
  "obfuscationPatterns": ["pattern1", "pattern2", ...]
}
```

**Usage:**
```typescript
// Frontend loads rules on initialization
this.http.get('/api/config/profanity-rules')
  .subscribe(rules => this.applyRules(rules));
```

## Example Usage

### Backend Validation

```javascript
const { validateUsername } = require('./profanity-filter');

const result = validateUsername('player123');
// { valid: true, error: null }

const result2 = validateUsername('badword123');
// { valid: false, error: 'Username contains inappropriate content' }
```

### Frontend Validation

```typescript
// In component
ngOnInit() {
  this.profanityValidator.getRules().subscribe(rules => {
    if (rules) {
      this.addProfanityValidators();
    }
  });
}

// Custom validator
profanityValidatorFn(control: AbstractControl) {
  const result = this.profanityValidator.validateUsername(control.value);
  return result.valid ? null : { profanity: true };
}
```

## Testing

### Run Backend Tests

```bash
cd backend
npm test profanity-filter.test.js
```

### Run Frontend Tests

```bash
cd frontend
npm test -- --include='**/profanity-validator.service.spec.ts'
```

## Test Coverage

The test suite covers:

- ✅ Basic normalization (lowercase, diacritics, repeated chars)
- ✅ Exact slur detection
- ✅ Case variation detection
- ✅ Diacritic evasion
- ✅ Repeated character evasion
- ✅ Separator evasion (spaces, hyphens, underscores)
- ✅ 1337 speak obfuscation
- ✅ Embedded slurs in usernames
- ✅ Clean username acceptance
- ✅ Generic error messages

## Updating the Slur List

To add or modify prohibited terms:

1. Edit `backend/slur-list.js`
2. Add terms to `SLUR_LIST` array (lowercase)
3. Add obfuscation patterns to `OBFUSCATION_PATTERNS` if needed
4. Run tests to verify
5. Frontend will automatically fetch updated rules on next load

**Example:**
```javascript
// backend/slur-list.js
const SLUR_LIST = [
  // ... existing terms
  'newbadword',
];

const OBFUSCATION_PATTERNS = [
  // ... existing patterns
  /n[e3@]wb[a4@]dw[o0]rd/i,
];
```

## Security Considerations

1. **Don't log filtered usernames** - Could expose slurs in logs
2. **Generic error messages** - Don't tell users which slur triggered the filter
3. **Backend is final authority** - Never trust client-side validation alone
4. **No shadow banning** - Explicitly reject, don't silently accept
5. **Regular updates** - Keep slur list current with evolving language

## Performance

- **Backend:** O(n) where n = number of slurs + patterns (~50ms for typical username)
- **Frontend:** Same complexity, cached rules reduce API calls
- **No external API calls:** All validation is local/self-contained

## Future Enhancements

Potential improvements (not currently implemented):

- Word boundary detection to reduce false positives
- Machine learning-based detection
- User-reported inappropriate names
- Admin dashboard for managing slur list
- Severity levels (warn vs block)
- Localization for multiple languages

## Compliance

This implementation helps meet content moderation requirements for:

- App store guidelines (Apple App Store, Google Play)
- Platform terms of service
- Community standards
- Regional regulations (EU, US, etc.)

## Support

For questions or issues:
- Review test files for examples
- Check implementation in `backend/profanity-filter.js`
- See frontend integration in `registration-form.ts`
