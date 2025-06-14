module.exports = {
  migrationFolder: './migrations',
  direction: 'up',
  databaseUrl: process.env.DATABASE_URL || 'postgres://cardgame:cardgamepass@db:5432/cardgamedb',
};
