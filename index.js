const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const path = require("path");

const app = express();

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);
const io = socketio(server);

let players = new Set();

io.on("connection", (client) => {
  console.log("new connection added " + client.id);

  client.on("join", (sk) => {
    client.join("room1");
    // client.join("room1");
    players.add(client.id);

    if (players.size === 2) {
      io.to([...players][0]).emit("setSide", "w");
      io.to([...players][1]).emit("setSide", "b");
    }
  });

  client.emit("welcome", { message: "Welcome from the server" });

  client.on("disconnect", () => {
    console.log("client disconected " + client.id);
    client.to("room1").emit("test", { message: "Bye from the server" });
    players.delete(client.id);
  });

  client.on("move", (move) => {
    client.to("room1").emit("moveFromBackend", move);
  });
});

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Server is up on port ${port}!`);
});
