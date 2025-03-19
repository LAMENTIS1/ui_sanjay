// server.js
const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// Serve static files (assuming you have a public folder where your frontend files are)
app.use(express.static(path.join(__dirname, 'public')));

// API route
app.post('/api', (req, res) => {
  res.json({
    text: 'Hello, world!',  // You can modify this to handle more complex logic
  });
});

// Start server
app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
