const request = require('supertest');
const express = require('express');
const { getHealthStatus } = require('../health');

const app = express();
app.get('/health', async (req, res) => {
  const status = await getHealthStatus({ error: () => {} });
  res.json(status);
});

describe('GET /health', () => {
  it('should return api up', async () => {
    const res = await request(app).get('/health');
    expect(res.body.api).toBe('up');
  });
});
