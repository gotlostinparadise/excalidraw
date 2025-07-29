const express = require("express");
const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");
const morgan = require("morgan");
const cors = require("cors");
const { execSync } = require("child_process");

const app = express();
const PORT = process.env.PORT || 5000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');

app.use(morgan("dev"));
app.use(cors());
// Accept bodies even if the request lacks a Content-Type header, which
// happens when the frontend sends raw ArrayBuffer payloads. Using a function
// for the `type` option ensures the raw parser always runs.
app.use(express.raw({ type: () => true, limit: "50mb" }));

const ensureDir = (dir) => fs.mkdirSync(dir, { recursive: true });

if (process.env.MOUNT_SHARE) {
  ensureDir(DATA_DIR);
  const options = [];
  if (process.env.MOUNT_SHARE_USERNAME) {
    options.push(`username=${process.env.MOUNT_SHARE_USERNAME}`);
  }
  if (process.env.MOUNT_SHARE_PASSWORD) {
    options.push(`password=${process.env.MOUNT_SHARE_PASSWORD}`);
  }
  const opts = options.length ? `-o ${options.join(',')}` : '';
  try {
    execSync(`mount -t cifs ${process.env.MOUNT_SHARE} ${DATA_DIR} ${opts}`);
    console.log(`Mounted share ${process.env.MOUNT_SHARE} to ${DATA_DIR}`);
  } catch (err) {
    console.error('Failed to mount share:', err.message || err);
  }
}

app.post('/api/v2/post/', (req, res) => {
  const id = uuidv4();
  const dir = path.join(DATA_DIR, 'boards');
  ensureDir(dir);
  const data = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body));
  fs.writeFileSync(path.join(dir, id), data);
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
  const data = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body));
  fs.writeFileSync(path.join(dir, id), data);
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
