const fs = require("fs");
const path = require("path");
const http = require("http");
const { execSync } = require("child_process");

const express = require("express");
const { Server } = require("socket.io");
const morgan = require("morgan");
const cors = require("cors");
const { v4: uuidv4 } = require("uuid");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });
const PORT = process.env.PORT || 5000;
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");

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
  const opts = options.length ? `-o ${options.join(",")}` : "";
  try {
    execSync(`mount -t cifs ${process.env.MOUNT_SHARE} ${DATA_DIR} ${opts}`);
    // eslint-disable-next-line no-console
    console.log(`Mounted share ${process.env.MOUNT_SHARE} to ${DATA_DIR}`);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Failed to mount share:", err.message || err);
  }
}

app.post("/api/v2/post/", (req, res) => {
  const id = uuidv4();
  const dir = path.join(DATA_DIR, "boards");
  ensureDir(dir);
  const data = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body));
  fs.writeFileSync(path.join(dir, id), data);
  res.json({ id });
});

app.get("/api/v2/:id", (req, res) => {
  const filePath = path.join(DATA_DIR, "boards", req.params.id);
  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }
  res.sendFile(filePath);
});

app.post("/api/files/upload", (req, res) => {
  const prefix = req.query.prefix;
  const id = req.query.id;
  if (!prefix || !id) {
    return res.status(400).json({ error: "missing params" });
  }
  const dir = path.join(DATA_DIR, "files", prefix);
  ensureDir(dir);
  const data = Buffer.isBuffer(req.body)
    ? req.body
    : Buffer.from(JSON.stringify(req.body));
  fs.writeFileSync(path.join(dir, id), data);
  res.json({ saved: true });
});

app.get("/api/files", (req, res) => {
  const prefix = req.query.prefix;
  const id = req.query.id;
  if (!prefix || !id) {
    return res.status(400).end();
  }
  const filePath = path.join(DATA_DIR, "files", prefix, id);
  if (!fs.existsSync(filePath)) {
    return res.status(404).end();
  }
  res.sendFile(filePath);
});

io.on("connection", (socket) => {
  socket.emit("init-room");

  socket.on("join-room", (roomId) => {
    socket.join(roomId);
    const clients = Array.from(io.sockets.adapter.rooms.get(roomId) || []);
    if (clients.length === 1) {
      socket.emit("first-in-room");
    } else {
      socket.to(roomId).emit("new-user", socket.id);
    }
    io.to(roomId).emit("room-user-change", clients);
  });

  socket.on("server-broadcast", (roomId, encoded, iv) => {
    socket.to(roomId).emit("client-broadcast", encoded, iv);
  });

  socket.on("server-volatile-broadcast", (roomId, encoded, iv) => {
    socket.volatile.to(roomId).emit("client-broadcast", encoded, iv);
  });

  socket.on("user-follow", ({ userToFollow, action }) => {
    const followRoom = `follow@${userToFollow.socketId}`;
    if (action === "FOLLOW") {
      socket.join(followRoom);
    } else {
      socket.leave(followRoom);
    }
    const clients = Array.from(io.sockets.adapter.rooms.get(followRoom) || []);
    io.to(userToFollow.socketId).emit("user-follow-room-change", clients);
  });

  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (room === socket.id) {
        continue;
      }
      const clients = Array.from(io.sockets.adapter.rooms.get(room) || []);
      const idx = clients.indexOf(socket.id);
      if (idx >= 0) {
        clients.splice(idx, 1);
      }
      if (room.startsWith("follow@")) {
        const target = room.slice("follow@".length);
        io.to(target).emit("user-follow-room-change", clients);
      } else {
        socket.to(room).emit("room-user-change", clients);
      }
    }
  });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Backend listening on ${PORT}`);
});
