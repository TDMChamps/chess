const $ = window["$"];
const chessBoard = window["ChessBoard"];
const chess = window["Chess"];
const IO = window["io"];
const swal = window["sweetAlert"];

const game = new chess();

const socket = IO();

let board;

let games = [];

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

socket.on("connect", function () {
  getDeviceID();
});

const sounds = {
  start: new Audio("./../sounds/start.ogg"),
  move: new Audio("./../sounds/move.ogg"),
  capture: new Audio("./../sounds/capture.ogg"),
};

let move;

let state = {
  status: "",
  pgn: "",
  fen: "",
  side: "",
  turn: "",
};

const setStatus = (status) => {
  state.status = status;
  document.getElementById("status").innerText = status;
};

const setPgn = (pgn) => {
  state.pgn = pgn;
};

const setTurn = () => {
  state.turn = game.turn();
  document.getElementById("turn").innerText =
    state.turn == state.side ? "My turn" : "Opponent Turn";
};

const setFen = (fen) => {
  state.fen = fen;
  document.getElementById("fen").innerText = fen;
};

const setSide = (side) => {
  state.side = side;
  board.orientation(side === "w" ? "white" : "black");
  setTurn();
  sounds.start.play();
};

const updateMoves = (move) => {
  game.load(move.fen);
  board.position(move.fen);
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
  setTurn();
  $(".lastMove").removeClass("lastMove");

  $square(source).addClass("lastMove");
  $square(target).addClass("lastMove");

  if (captured) {
    sounds.capture.play();
  } else {
    sounds.move.play();
  }

  let status = "";

  let moveColor = "White";
  if (game.turn() === "b") {
    moveColor = "Black";
  }

  if (game.in_checkmate()) {
    status = "Game over, " + moveColor + " is in checkmate.";
  } else if (game.in_draw()) {
    status = "Game over, drawn position";
  } else {
    status = moveColor + " to move";

    if (game.in_check()) {
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
  setFen(game.fen());
  setPgn(game.pgn());

  if (!dontEmit)
    socket.emit("move", {
      fen: game.fen(),
      source: source,
      target: target,
      captured: move.captured,
    });
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

  updateStatus(null, source, target, move.captured);
};

const onSnapEnd = () => {
  board.position(game.fen());
};

const initBoard = (position) => {
  let config = {
    draggable: true,
    position,
    onDragStart: onDragStart,
    onDrop: onDrop,
    onSnapEnd: onSnapEnd,
  };

  board = ChessBoard("boardDiv", config);
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

socket.on("moveFromBackend", (move) => {
  updateMoves(move);
});

$("#join").on("click", () => {
  // initBoard("start");
});
const piece = (p) =>
  `<div class="square-55d63 white-1e1d7" style="width:89px;height:89px;"><img src="img/chesspieces/wikipedia/${p}.png" alt="" class="piece-417db" style="width:89px;height:89px;"></div>`;
$("#create").click(() => {
  swal
    .fire({
      title: "Choose a side",
      showDenyButton: true,
      confirmButtonText: piece("bK"),
      confirmButtonColor: "#fff",
      denyButtonText: piece("wK") + "<br>",
      denyButtonColor: "#fff",
    })
    .then((result) => {
      if (result.isConfirmed) {
        socket.emit("createGame", "b");
      } else if (result.isDenied) {
        socket.emit("createGame", "w");
      }
    });
});

const gameCard = (id, playerName, color) => `<div class="col">
  <div class="card">
    <div class="card-body">
      <h5 class="card-title">Challenger: ${playerName}</h5>
                    <p class="card-text">Match ID: #${id}</p>
      <button onclick='play(${id})' class="btn btn-outline">${color}</button>
    </div>
  </div>
</div>`;

const listGames = () => {
  const gameDiv = document.getElementById("games");
  gameDiv.innerHTML = "";
  for (const key in games) {
    gameDiv.innerHTML += gameCard(
      games[key].id,
      games[key].player1.name,
      games[key].b ? piece("wK") : piece("bK")
    );
  }
};
// $game;
