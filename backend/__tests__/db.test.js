const { connect, disconnect, getPool } = require('../db');

describe('db module', () => {
  it('should throw if getPool is called before connect', () => {
    expect(() => getPool()).toThrow('Database pool not initialized');
  });

  // Integration test for connect/disconnect would require a real DB or a mock
});
