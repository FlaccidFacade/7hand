const express = require('express');
const { getHealthStatus } = require('../health');
const logger = require('../logger');

const router = express.Router();

router.get('/', async (req, res) => {
  const status = await getHealthStatus(logger);
  res.json(status);
});

module.exports = router;
