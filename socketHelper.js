const cookie = require("cookie");
const randonName = require("random-name");

const middleware = (connection, next) => {
  const cookief = connection.handshake.headers.cookie;
  if (cookief) {
    const cookies = cookie.parse(cookief);
    connection.deviceID = cookies["deviceID"];
  }
  next();
};

const socketHelper = (io) => {
  const generateGameID = () => {
    let roomID = "";
    let chars = "abcdefgijklmnopqrestuvwxyz0123456789";
    for (let i = 0; i < 6; i++) {
      roomID += chars[Math.floor(Math.random() * chars.length)];
    }
    return roomID;
  };

  let players = {};
  let games = {};

  const createAndJoinGame = (client, side) => {
    const gameID = generateGameID();
    client.join(gameID);
    games[gameID] = {
      id: gameID,
      player1: players[client.deviceID],
      [side]: client.deviceID,
      status: 0,
      fen: "start",
    };
    io.emit("welcome", { games });
    io.emit("matchCreated", { game: games[gameID] });
  };

  const joinGame = (client, gameID) => {
    if (games[gameID]) {
      client.join(gameID);
    }
  };

  const acceptGameChallenge = (io, client, gameID) => {
    if (client.deviceID !== games[gameID].player1.deviceID) {
      if (!games[gameID].status) {
        games[gameID].status = 1;
        games[gameID].player2 = players[client.deviceID];

        side = games[gameID]["w"] ? "b" : "w";
        games[gameID][side] = client.deviceID;

        io.to(games[gameID].player2.deviceID).emit("setSide", side);
        io.to(games[gameID].player1.deviceID).emit(
          "setSide",
          side === "w" ? "b" : "w"
        );

        io.to(gameID).emit("gameAccepted", games[gameID]);
      }
    }
  };

  const isPlaying = (client, gameID) => {
    const game = games[gameID];
    if (!game) {
      return false;
    }
    return client.deviceID == game.w || client.deviceID == game.b;
  };

  const addUserIdentity = (client) => {
    const deviceID = client.deviceID;

    if (players[deviceID]) {
      players[deviceID].id = client.id;
      players[deviceID].deviceID = deviceID;
    } else {
      players[deviceID] = {
        id: client.id,
        deviceID: deviceID,
        name: randonName.place(),
      };
    }
    client.join(deviceID);
    return players[deviceID];
  };
  io.use(middleware);

  io.on("connection", (client) => {
    const user = addUserIdentity(client);
    console.log("new connection added " + user.name);
    console.log("deviceID " + client.deviceID);

    client.on("join", () => {
      client.join("room1");
      // client.join("room1");
      players.add(client.id);

      if (players.size === 2) {
        io.to([...players][0]).emit("setSide", "w");
        io.to([...players][1]).emit("setSide", "b");
      }
    });

    client.on("acceptMatch", (gameDetails) => {
      acceptGameChallenge(io, client, gameDetails.id);
    });

    client.on("getGame", (gameID) => {
      if (games[gameID]) {
        joinGame(client, gameID);
        io.to(client.deviceID).emit("gameDetails", {
          gameDetails: games[gameID],
        });
      } else {
        io.to(client.deviceID).emit("gameDetails", {
          gameDetails: null,
        });
      }
    });

    client.on("createGame", (side) => {
      createAndJoinGame(client, side);
    });

    client.emit("welcome", {
      message: "Welcome " + user.name + " from the server",
      games: games,
    });

    client.on("disconnect", () => {
      console.log("client disconected " + client.id);
      //   client.to("room1").emit("test", { message: "Bye from the server" });
      //   players.delete(client.id);
    });

    client.on("move", (move) => {
      const gameID = move.gameIDFromUrl;
      if (isPlaying(client, gameID)) {
        games[gameID].fen = move.fen;
        client.to(gameID).emit("moveFromBackend", move);
      }
    });
  });
};
module.exports = socketHelper;
