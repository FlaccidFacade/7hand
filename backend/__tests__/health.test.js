const { getHealthStatus } = require('../health');

describe('getHealthStatus', () => {
  it('should return api up and db down if db throws', async () => {
    const logger = { error: jest.fn() };
    jest.resetModules();
    jest.doMock('../db', () => ({ getPool: () => { throw new Error('fail'); } }));
    const { getHealthStatus } = require('../health');
    const status = await getHealthStatus(logger);
    expect(status.api).toBe('up');
    expect(status.db).toBe('down');
    expect(logger.error).toHaveBeenCalled();
  });

  it('should return db up and correct version if db works', async () => {
    const logger = { error: jest.fn() };
    const fakePool = { query: jest.fn().mockResolvedValue({ rows: [{ version: 'PostgreSQL 16' }] }) };
    jest.resetModules();
    jest.doMock('../db', () => ({ getPool: () => fakePool }));
    const { getHealthStatus } = require('../health');
    const status = await getHealthStatus(logger);
    expect(status.db).toBe('up');
    expect(status.dbVersion).toBe('PostgreSQL 16');
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('should handle missing logger gracefully', async () => {
    const fakePool = { query: jest.fn().mockResolvedValue({ rows: [{ version: 'PostgreSQL 16' }] }) };
    jest.resetModules();
    jest.doMock('../db', () => ({ getPool: () => fakePool }));
    const { getHealthStatus } = require('../health');
    const status = await getHealthStatus();
    expect(status.db).toBe('up');
    expect(status.dbVersion).toBe('PostgreSQL 16');
  });
});
