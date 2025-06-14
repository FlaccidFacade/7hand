module.exports = {
  migrationFolder: './migrations',
  direction: 'up',
  databaseUrl:
    process.env.DATABASE_URL ||
    `postgres://${process.env.DB_USER || 'cardgame'}:${process.env.DB_PASSWORD || 'cardgamepass'}@${process.env.DB_HOST || 'db'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'cardgamedb'}`,
};
