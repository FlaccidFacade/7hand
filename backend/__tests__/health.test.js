const { getHealthStatus } = require('../health');

describe('getHealthStatus', () => {
  it('should return api up and db down if db throws', async () => {
    const logger = { error: jest.fn() };
    // Mock getPool to throw
    jest.mock('../db', () => ({ getPool: () => { throw new Error('fail'); } }));
    const status = await getHealthStatus(logger);
    expect(status.api).toBe('up');
    expect(status.db).toBe('down');
    expect(logger.error).toHaveBeenCalled();
  });
});
