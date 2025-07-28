const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const morgan = require('morgan');

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

app.use(morgan('dev'));
app.use(express.raw({ type: '*/*', limit: '50mb' }));

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

app.post('/api/v2/post/', (req, res) => {
  const id = uuidv4();
  const dir = path.join(DATA_DIR, 'boards');
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, id), req.body);
  res.json({ id });
});

app.get('/api/v2/:id', (req, res) => {
  const filePath = path.join(DATA_DIR, 'boards', req.params.id);
  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }
  res.sendFile(filePath);
});

app.post('/api/files/upload', (req, res) => {
  const prefix = req.query.prefix;
  const id = req.query.id;
  if (!prefix || !id) return res.status(400).json({ error: 'missing params' });
  const dir = path.join(DATA_DIR, 'files', prefix);
  ensureDir(dir);
  fs.writeFileSync(path.join(dir, id), req.body);
  res.json({ saved: true });
});

app.get('/api/files', (req, res) => {
  const prefix = req.query.prefix;
  const id = req.query.id;
  if (!prefix || !id) return res.status(400).end();
  const filePath = path.join(DATA_DIR, 'files', prefix, id);
  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }
  res.sendFile(filePath);
});

app.listen(PORT, () => {
  console.log(`Backend listening on ${PORT}`);
});
