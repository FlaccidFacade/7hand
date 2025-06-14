const express = require('express');
const { connect, disconnect } = require('./db');
const app = express();
const PORT = 3000;

connect();

app.get('/', (req, res) => {
  res.send('Card Game Backend Running');
});

process.on('SIGINT', async () => {
  await disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
