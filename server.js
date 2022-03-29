'use strict';

const express = require('express');

process.on('SIGINT', () => {
  console.info("Interrupted");
  process.exit(0);
})

// Constants
const PORT = 8080;
const HOST = '0.0.0.0';

// App
const app = express();

app.use(express.static('static'));

app.get('/api', (req, res) => {
  res.send('It is works');
});

app.listen(PORT, HOST);
console.log(`Running on http://${HOST}:${PORT}`);
