const express = require('express');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend static files
app.use(express.static(path.join(__dirname, 'frontend')));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'OK' });
});

// AI Logic
function generateResponse(question, mode) {
  if (mode === 'yoga') return `In Yoga, "${question}" relates to harmony between body, mind, and spirit.`;
  if (mode === 'philosophy') return `In Indian philosophy, "${question}" connects to Dharma, which represents duty and righteousness.`;
  if (mode === 'ayurveda') return `In Ayurveda, "${question}" is understood through balance of body energies (doshas).`;
  if (mode === 'vedic') return `In Vedic Mathematics, "${question}" can be solved using ancient fast calculation techniques.`;
  return `In Indian knowledge systems, "${question}" has deep cultural and philosophical meaning.`;
}

app.post('/ask', (req, res) => {
  const { question, mode } = req.body;
  const answer = generateResponse(question, mode);
  res.json({ answer });
});

// Default route
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
