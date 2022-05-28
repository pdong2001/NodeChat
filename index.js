"use strict";
var port = process.env.PORT || 1337;
const express = require("express");
const fs = require("fs");
const ytdl = require("ytdl-core");
const app = express();
const http = require("http");
const server = http.Server(app);
const io = require("socket.io")(server);
const { v4: uuidV4 } = require("uuid"); 

app.set("view engine", "ejs");
app.set("views", "./views");
app.use(express.static("public"));

app.get("/", (req, res) => {
  res.redirect(`/${uuidV4()}`);
});

const rooms = {};
app.get("/:room", (req, res) => {
  res.render("room", { roomId: req.params.room });
});

app.get("/video/:id", function (req, res) {
  // Ensure there is a range given for the video
  const range = req.headers.range;
  if (!range) {
    res.status(400).send("Requires Range header");
    res.end();
    return;
  }
  // get video stats (about 61MB)
  const videoPath = req.params.id + ".mp4";
  const videoSize = fs.statSync(videoPath).size;
  // Parse Range
  // Example: "bytes=32324-"
  const CHUNK_SIZE = 10 ** 6; // 1MB
  const start = Number(range.replace(/\D/g, ""));
  const end = Math.min(start + CHUNK_SIZE, videoSize - 1);
  // Create headers
  const contentLength = end - start + 1;
  const headers = {
    "Content-Range": `bytes ${start}-${end}/${videoSize}`,
    "Accept-Ranges": "bytes",
    "Content-Length": contentLength,
    "Content-Type": "video/mp4",
  };

  // HTTP Status 206 for Partial Content
  res.writeHead(206, headers);

  // create video read stream for this particular chunk

  const videoStream = fs.createReadStream(videoPath, { start, end });
  videoStream.pipe(res);

  // Stream the video chunk to the client
});

io.on("connection", (socket) => {
  socket.on("join-room", (roomId, userId) => {
    if (!rooms[roomId]) {
      rooms[roomId] = { queue: [], playing: undefined, count: 0 };
    }
    const room = rooms[roomId];
    room.count++;
    socket.join(roomId);
    socket.to(roomId).emit("user-connected-change", room.count);
    socket.emit("user-connected-change", room.count);
    socket.on("disconnect", () => {
      room.count--;
      socket.to(roomId).emit("user-connected-change", room.count);
      io.in(roomId)
        .fetchSockets()
        .then((res) => {
          if (res.length == 0) {
            if (room.playing) {
              fs.unlink(room.playing.id + ".mp4", () => {});
            }
            delete rooms[roomId];
          }
        });
    });
    socket.on("timeupdate", (time) => {
      socket.to(roomId).emit("timeupdate", time);
    });
    socket.on('new-message', (sender, message) => {
        socket.to(roomId).emit('new-message', sender, message)
    })
    socket.on("paused", () => socket.to(roomId).emit("paused"));
    socket.on("new", (url) => {
      if (ytdl.validateURL(url)) {
        ytdl.getInfo(url, { quality: 140 }).then((info) => {
            const newItem = {
                title: info.videoDetails.title,
                url: url,
                id: uuidV4()
              }
            room.queue.push(newItem);
          socket.emit("new", newItem);
          socket.to(roomId).emit("new", newItem);
          if (!room.playing) {
            var item = room.queue[0];
            const wstream = fs.createWriteStream(item.id + ".mp4")
            const ys = ytdl(item.url, { quality: 140 });
            ys.pipe(wstream);
            ys.on("end", () => {
              if (!room.playing) {
                room.changedTime = Date.now();
                room.playing = item;
                socket.to("roomId").emit("play", room.playing);
                socket.emit("play", room.playing);
              }
            });
          }
        });
      }
    });
    if (room.queue) {
      room.queue.forEach((i) => {
        socket.emit("new", i);
      });
    }
    if (room.playing) {
      socket.emit("play", room.playing, Date.now() - room.changedTime);
    }
    socket.on("next", () => {
      room.queue.shift()
      if (room.playing) {
          fs.unlink(room.playing.id + ".mp4", () => {});
          room.playing = undefined;
        }
      if (room.queue && room.queue.length > 0) {
        if (room.changedTime < Date.now() - 1500) {
          const item = room.queue[0];
          const wstream = fs.createWriteStream(item.id + ".mp4");
          const ys = ytdl(item.url, { quality: 140 });
          ys.pipe(wstream);
          ys.on("end", () => {
            room.changedTime = Date.now();
            room.playing = item;
            socket.to("roomId").emit("play", room.playing);
            socket.emit("play", room.playing);
          });
        }
      }
      else
      {
        socket.to("roomId").emit("play", {});
        socket.emit("play", {});
      }
    });
  });
});

server.listen(port, () => {
  setInterval(() => {
    console.clear()
    console.log(rooms)
  }, 5000)
});
