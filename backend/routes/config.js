const express = require('express');
const { SLUR_LIST, OBFUSCATION_PATTERNS } = require('../slur-list');

const router = express.Router();

router.get('/profanity-rules', (req, res) => {
  // Return the slur list and patterns for client-side validation
  // Frontend should mirror backend validation
  res.json({
    slurList: SLUR_LIST,
    obfuscationPatterns: OBFUSCATION_PATTERNS.map(p => p.source)
  });
});

module.exports = router;
