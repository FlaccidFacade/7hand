exports.up = (pgm) => {
  pgm.createTable('lobbies', {
    id: { type: 'uuid', primaryKey: true },
    users: { type: 'jsonb', notNull: true },
    gamestate: { type: 'jsonb' },
    created_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    last_activity: { type: 'timestamp', notNull: true, default: pgm.func('now()') },
    started: { type: 'boolean', notNull: true, default: false }
  });
};

exports.down = (pgm) => {
  pgm.dropTable('lobbies');
};
