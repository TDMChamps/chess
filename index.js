const http = require("http");
const express = require("express");
const socketio = require("socket.io");
const path = require("path");
const socketHelper = require("./socketHelper");
const app = express();

app.set("view engine", "ejs");
app.use(express.static(path.join(__dirname, "public")));

app.get("/", function (req, res) {
  res.render(__dirname + "/public/index", { gameID: null });
});

app.get("/:gameID", function (req, res) {
  res.render(__dirname + "/public/index", { gameID: req.params.gameID });
});

const server = http.createServer(app);

socketHelper(socketio(server));

const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`App is running on port ${port}!`);
});
