const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const path = require("path");
const socketHelper = require("./socketHelper");

const app = express();

app.use(express.static(path.join(__dirname, "public")));

const server = http.createServer(app);

socketHelper(socketio(server));

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Server is up on port ${port}!`);
});
