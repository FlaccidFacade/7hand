const express = require('express');
const app = express();
const PORT = 3000;

app.get('/', (req, res) => {
  res.send('Card Game Backend Running');
});

app.listen(PORT, () => {
  console.log(`Backend listening on port ${PORT}`);
});
