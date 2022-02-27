const $ = window["$"];
const chessBoard = window["ChessBoard"];
const chess = window["Chess"];
const IO = window["io"];

const game = new chess();

const socket = IO();

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

let config = {
  draggable: true,
  position: "start",
  onDragStart: onDragStart,
  onDrop: onDrop,
  onSnapEnd: onSnapEnd,
};

const board = ChessBoard("boardDiv", config);

socket.on("welcome", (message) => {
  console.log(message);
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
  socket.emit("join");
});
