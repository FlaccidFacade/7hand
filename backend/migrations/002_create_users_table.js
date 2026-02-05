exports.up = (pgm) => {
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true },
    username: { type: 'varchar(20)', notNull: true, unique: true },
    display_name: { type: 'varchar(30)', notNull: true },
    email: { type: 'varchar(255)' },
    password_hash: { type: 'varchar(255)' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    last_active: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    coins: { type: 'integer', notNull: true, default: 0 },
    stats: { type: 'jsonb', notNull: true, default: '{"gamesPlayed":0,"gamesWon":0,"gamesLost":0}' }
  });

  // Create index on username for faster lookups
  pgm.createIndex('users', 'username');
  
  // Create index on last_active for cleanup queries
  pgm.createIndex('users', 'last_active');
};

exports.down = (pgm) => {
  pgm.dropTable('users');
};
