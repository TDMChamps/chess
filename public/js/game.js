const $ = window["$"];
const chessBoard = window["ChessBoard"];
const chess = window["Chess"];
const IO = window["io"];
const swal = window["sweetAlert"];
let gameIDFromUrl = window["gameIDFromUrl"];

let game = new chess();

const socket = IO();

let board;

let games = [];
let currentGame;
let myID;
let state = {
  status: "",
  pgn: "",
  fen: "",
  side: "",
  turn: "",
};

let fromSquare;
let toSquare;
let piece;

const clickToMove = () => {
  const squareSelector = $(".square");
  squareSelector.on("click", (e) => {
    if (fromSquare) {
      const _toSquare = $(e.delegateTarget).data("square");
      const piece = game.get(_toSquare);
      if (piece && piece.color == state.side) {
        const _fromSquare = $(e.delegateTarget).data("square");
        const _piece = $(e.target).data("piece");
        onDragStart(_fromSquare, _piece, null, null);
      } else {
        onDrop(fromSquare, _toSquare);
      }
    } else {
      const _fromSquare = $(e.delegateTarget).data("square");
      const _piece = $(e.target).data("piece");
      onDragStart(_fromSquare, _piece, null, null);
    }
  });
};

let liveUsers = [];

const addLiveUser = (newUser) => {
  liveUsers.reverse();
  liveUsers.push(newUser);
  liveUsers.reverse();
  liveUsers = liveUsers.slice(0, 20);
  liveUsers.forEach((user) => {
    $("#liveUsers").html($("#liveUsers").html() + user + "<br>");
  });
};

const onlineBadge = (userID) => {
  return `<i class="bi bi-check-circle-fill" style="color:${
    userID ? "#38ab42" : "#bbbbbb"
  };font-size: 15px;" data-user-id=${userID}></i>`;
};

socket.on("connected", (user) => {
  updateOnlineBadge(user.deviceID, true);
  addLiveUser(`${user.name} joined`);
});

socket.on("disconnected", (user) => {
  updateOnlineBadge(user.deviceID, false);
  addLiveUser(`${user.name} left`);
});

const updateOnlineBadge = (userID, status) => {
  $("i[data-user-id=" + userID + "]").each(function () {
    var element = $(this);
    element.css("color", status ? "#38ab42" : "#bbbbbb");
  });
};

const generateDeviceID = () => {
  let roomID = "";
  let chars = "abcdefgijklmnopqrestuvwxyz0123456789";
  for (let i = 0; i < 10; i++) {
    roomID += chars[Math.floor(Math.random() * chars.length)];
  }
  return roomID;
};

function setCookie(name, value, days) {
  var expires = "";
  if (days) {
    var date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

const getDeviceID = () => {
  if (document.cookie) {
    const cookies = document.cookie.split(";");
    for (let i = 0; i < cookies.length; i++) {
      const cookie = cookies[i].split("=");
      if (cookie[0] === "deviceID") {
        return cookie[1];
      }
    }
  }
  const deviceID = generateDeviceID();
  setCookie("deviceID", deviceID, 30);
  return deviceID;
};

const myGame = (gameDetails) => {
  if (gameDetails.status) {
    if (myID == gameDetails.w) {
      setSide("w");
    } else if (myID == gameDetails.b) {
      setSide("b");
    }
  }
};

const checkGame = (gameID) => {
  if (gameID) {
    socket.emit("getGame", gameID);
    socket.on("gameDetails", ({ gameDetails }) => {
      if (gameDetails) {
        gameIDFromUrl = gameID;
        window.history.pushState(`/${gameID}`, "Online Chess", `/${gameID}`);
        initBoard(gameDetails);
        currentGame = gameDetails;
        $("#games").hide();
        $("#create").hide();
        myGame(gameDetails);
        setPlayersNames(gameDetails);
      }
    });
  }
};

socket.on("connect", function () {
  myID = getDeviceID();
  checkGame(gameIDFromUrl);
  socket.on("myUsername", (userName) => {
    $("#myUsername").text(userName);
  });
});

const sounds = {
  start: new Audio("./../sounds/start.ogg"),
  move: new Audio("./../sounds/move.ogg"),
  capture: new Audio("./../sounds/capture.ogg"),
  check: new Audio("./../sounds/+.wav"),
  mate: new Audio("./../sounds/mate.wav"),
};

let move;

const setStatus = (status) => {
  state.status = status;
  document.getElementById("status").innerText = status;
};

const setPgn = (pgn) => {
  state.pgn = pgn;
  document.getElementById("pgn").innerText = pgn;
};

const setTurn = () => {
  state.turn = game.turn();
  document.getElementById("turn").innerText =
    state.turn == state.side ? "My turn" : "Opponent Turn";
};

const setFen = (fen) => {
  state.fen = fen;
  // document.getElementById("fen").innerText = fen;
};

const setSide = (side) => {
  state.side = side;
  board.orientation(side === "w" ? "white" : "black");
  setTurn();
  clickToMove();
  sounds.start.play().catch((err) => console.log(err));
};

const updateMoves = (move) => {
  game.move({
    from: move.source,
    to: move.target,
    promotion: "q",
  });
  board.move(`${move.source}-${move.target}`);
  updateStatus(1, move.source, move.target, move.captured);
};

const $square = (pos) => {
  return $("div[data-square=" + pos + "]");
};

const getPiecePositions = (piece) => {
  return []
    .concat(...game.board())
    .map((p, index) => {
      if (p !== null && p.type === piece.type && p.color === piece.color) {
        return index;
      }
    })
    .filter(Number.isInteger)
    .map((piece_index) => {
      const row = "abcdefgh"[piece_index % 8];
      const column = Math.ceil((64 - piece_index) / 8);
      return row + column;
    });
};

const updateStatus = (dontEmit, source, target, captured) => {
  if (state.side) {
    setTurn();
  }
  $(".lastMove").removeClass("lastMove");

  $square(source).addClass("lastMove");
  $square(target).addClass("lastMove");

  if (captured) {
    sounds.capture.play().catch((err) => console.log(err));
  } else {
    sounds.move.play().catch((err) => console.log(err));
  }

  let status = "";

  let moveColor = "White";
  if (game.turn() === "b") {
    moveColor = "Black";
  }

  if (game.in_checkmate()) {
    const pos = getPiecePositions({
      color: game.turn(),
      type: "k",
    });
    $square(pos).addClass("check");
    let winner = "Black";
    if (moveColor === winner) {
      winner = "White";
    }
    sounds.mate.play().catch((err) => console.log(err));
    swal
      .fire({
        title: winner + " Won!",
        confirmButtonText: "Got it",
      })
      .then(() => {});
    status = "Game over, " + moveColor + " is in checkmate.";
  } else if (game.in_draw()) {
    status = "Game over, drawn position";
  } else {
    status = moveColor + " to move";

    if (game.in_check()) {
      sounds.check.play().catch((err) => console.log(err));
      const pos = getPiecePositions({
        color: game.turn(),
        type: "k",
      });
      $square(pos).addClass("check");

      status += ", " + moveColor + " is in check";
    } else {
      $(".check").removeClass("check");
    }
  }

  setStatus(status);
  // setFen(game.fen());
  setPgn(game.pgn());

  if (!dontEmit)
    socket.emit("move", {
      gameIDFromUrl,
      fen: game.fen(),
      source: source,
      target: target,
      captured: move.captured,
    });
  onSnapEnd();
};

const onDragStart = (source, piece, position, orientation) => {
  $square(source).addClass("lastMove");
  if (game.game_over()) {
    $square(source).removeClass("lastMove");
    return false;
  }

  if (state.side !== game.turn()) {
    $square(source).removeClass("lastMove");
    return false;
  }

  if (
    (game.turn() === "w" && piece.search(/^b/) !== -1) ||
    (game.turn() === "b" && piece.search(/^w/) !== -1)
  ) {
    $square(source).removeClass("lastMove");
    return false;
  }

  fromSquare = source;

  const possibleMoves = game.moves({ square: source });

  $(".possibleMove").removeClass("possibleMove");
  $(".attack").removeClass("attack");

  possibleMoves.forEach((move) => {
    const originalMove = move;
    if (move.length === 3) move = move.slice(1);
    if (move.length === 4) {
      if (move.slice(-1) === "+" || move.slice(-1) === "#") {
        move = move.slice(1, 3);
      } else {
        move = move.slice(2, 4);
      }
    }
    if (move.length === 5) move = move.slice(2, 4);

    $square(move).addClass("possibleMove");
    if (originalMove.slice(1, 2) === "x") {
      $square(move).addClass("attack");
      $square(move).removeClass("possibleMove");
    }
  });
};

const onDrop = (source, target) => {
  move = game.move({
    from: source,
    to: target,
    promotion: "q",
  });

  if (move === null) return "snapback";
  $(".possibleMove").removeClass("possibleMove");
  $(".attack").removeClass("attack");

  fromSquare = toSquare = null;
  updateStatus(null, source, target, move.captured);
};

const onSnapEnd = () => {
  board.position(game.fen());
};

const setPlayersNames = (gameDetails) => {
  let names = ["???", "???"];

  let whitePlayer = gameDetails.w;
  let blackPlayer = gameDetails.b;

  if (!whitePlayer) {
    names[0] = `White: ??? `;
  } else {
    names[0] = `White: ${
      gameDetails.player1.deviceID == whitePlayer
        ? gameDetails.player1.name +
          " " +
          onlineBadge(gameDetails.player1.deviceID)
        : gameDetails.player2.name +
          " " +
          onlineBadge(gameDetails.player2.deviceID)
    }`;
  }
  if (!blackPlayer) {
    names[1] = `Black: ??? `;
  } else {
    names[1] = `Black: ${
      gameDetails.player1.deviceID == blackPlayer
        ? gameDetails.player1.name +
          " " +
          onlineBadge(gameDetails.player1.deviceID)
        : gameDetails.player2.name +
          " " +
          onlineBadge(gameDetails.player2.deviceID)
    }`;
  }
  board.orientation() === "black" && names.reverse();

  $("#player1").html(names[0]);
  $("#player2").html(names[1]);
};

const acceptMatch = (gameDetails) => {
  socket.emit("acceptMatch", gameDetails);
  gameDetails.w && board.orientation("flip");
};

const initBoard = (gameDetails) => {
  let config = {
    // draggable: true,
    position: gameDetails.fen,
    // onDragStart: null,
    // onDrop: onDrop,
    // onSnapEnd: onSnapEnd,
  };

  if (gameDetails.fen != "start") {
    game.load(gameDetails.fen);
  }

  // player2.pl;

  board = ChessBoard("boardDiv", config);

  if (!gameDetails.status && gameDetails.player1.deviceID != myID) {
    board.orientation(gameDetails.b ? "white" : "black");

    swal
      .fire({
        title: `${
          gameDetails.player1.name +
          " " +
          onlineBadge(gameDetails.player1.deviceID)
        } inving you`,
        showCancelButton: true,
        confirmButtonText: "Accpet",
        confirmButtonColor: "#b58862",
        cancelButtonText: "Just Watch the match",
      })
      .then((result) => {
        if (result.isConfirmed) {
          acceptMatch(gameDetails);
        }
      });
  }

  setPlayersNames(gameDetails);
};

socket.on("welcome", (message) => {
  console.log(message);
  games = message.games; //[];
  // Object.keys(message.games).forEach((key) => {
  //   games.push(message.games[key]);
  // });
  listGames();
});

socket.on("test", (data) => {
  console.log(data);
});

socket.on("setSide", (data) => {
  console.log({ data });
  setSide(data);
});

socket.on("gameAccepted", (gameDetails) => {
  setPlayersNames(gameDetails);
});

socket.on("moveFromBackend", (move) => {
  updateMoves(move);
});

$("#join").on("click", () => {
  // initBoard("start");
});
const pieceSquare = (p) =>
  `<div class="square-55d63 white-1e1d7" style="width:89px;height:89px;"><img src="img/chesspieces/wikipedia/${p}.png" alt="" class="piece-417db" style="width:89px;height:89px;"></div>`;
$("#create").click(() => {
  swal
    .fire({
      title: "Choose a side",
      showDenyButton: true,
      confirmButtonText: pieceSquare("bK"),
      confirmButtonColor: "#fff",
      denyButtonText: pieceSquare("wK") + "<br>",
      denyButtonColor: "#fff",
    })
    .then((result) => {
      if (result.isConfirmed) {
        socket.emit("createGame", "b");
      } else if (result.isDenied) {
        socket.emit("createGame", "w");
      }
      socket.on("matchCreated", ({ game }) => {
        window["gameIDFromUrl"] = game.id;
        checkGame(game.id);
        copyAndShareGame(game.id);
      });
    });
});

const gameCard = (id, player1, player2, color) => `<div class="col">
  <div class="card">
    <div class="card-body">
      <h5 class="card-title">${player1.name} ${onlineBadge(
  player1.deviceID
)} vs ${player2.name}  ${onlineBadge(player2.deviceID)}</h5>
      <p class="card-text">Match ID: #<a onclick="return play('${id}')" href="/${id}">${id}</a> </p>
      <button onclick="play('${id}')" class="btn btn-outline">${color}</button>
    </div>
  </div>
</div>`;

const listGames = () => {
  const gameDiv = document.getElementById("games");
  gameDiv.innerHTML = "";
  for (const key in games) {
    gameDiv.innerHTML += gameCard(
      games[key].id,
      games[key].player1,
      games[key].player2 ? games[key].player2 : { name: "???", deviceID: 0 },
      games[key].b ? pieceSquare("wK") : pieceSquare("bK")
    );
  }
};

const play = (gameID) => {
  // console.log({ gameID });
  checkGame(gameID);
  return false;
};

const copyMe = (TextToCopy) => {
  let TempText = document.createElement("input");
  TempText.value = TextToCopy;
  document.body.appendChild(TempText);
  TempText.select();

  document.execCommand("copy");
  document.body.removeChild(TempText);
};

const copyAndShareGame = (gameID) => {
  swal
    .fire({
      title: "Share or invite someone",
      confirmButtonText: "Click To Copy",
      confirmButtonColor: "#b58862",
      html: `<input type='text' class='swal2-input' value='${window.location.origin}/${gameID}' name='test'></input>`,
    })
    .then((result) => {
      if (result.isConfirmed) {
        copyMe(`${window.location.origin}/${gameID}`);
        const Toast = swal.mixin({
          toast: true,
          position: "top-right",
          showConfirmButton: false,
          timer: 1500,
          timerProgressBar: true,
        });
        Toast.fire({
          icon: "success",
          title: "Copied",
        });
      }
    });
};

$(window).resize((a, b) => {
  board && board.resize(a, b);
});
