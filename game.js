const SIZE = 7;
const CHARACTERS = [
  { id: "sol", name: "Solenne", title: "Dawn Runner", mark: "S", move: 3, ability: "Wayfinder: moves up to 3 spaces.", faces: [0, 1, 2, 3, 4, 5] },
  { id: "bryn", name: "Bryn", title: "Stone Keeper", mark: "B", move: 2, ability: "Stoneguard: +1 in defense duels.", faces: [0, 2, 2, 3, 4, 5], defense: 1 },
  { id: "vesper", name: "Vesper", title: "Star Caller", mark: "V", move: 2, ability: "Starfall: a 6 becomes a 7 in duels.", faces: [0, 1, 3, 4, 4, 6], critical: true },
];

const state = {
  board: [],
  pieces: [],
  currentPlayer: 1,
  selectedId: null,
  reachable: new Map(),
  round: 1,
  moveCount: 0,
  gameOver: false,
  lastMove: null,
};

const elements = {
  board: document.querySelector("#board"),
  roster: document.querySelector("#roster"),
  legendCard: document.querySelector("#legend-card"),
  legendStats: document.querySelector("#legend-stats"),
  selectionState: document.querySelector("#selection-state"),
  promptText: document.querySelector("#prompt-text"),
  cancel: document.querySelector("#cancel-selection"),
  round: document.querySelector("#round-number"),
  log: document.querySelector("#field-log"),
  toast: document.querySelector("#toast"),
};

function makeBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function createPieces() {
  return [1, 2].flatMap((player) => CHARACTERS.map((character, index) => ({
    ...character,
    player,
    x: player === 1 ? 0 : SIZE - 1,
    y: [1, 3, 5][index],
    alive: true,
  })));
}

function setupGame() {
  state.board = makeBoard();
  state.pieces = createPieces();
  for (const piece of state.pieces) state.board[piece.y][piece.x] = piece.id + piece.player;
  state.currentPlayer = 1;
  state.selectedId = null;
  state.reachable.clear();
  state.round = 1;
  state.moveCount = 0;
  state.gameOver = false;
  state.lastMove = null;
  elements.log.replaceChildren();
  elements.round.textContent = "01";
  elements.promptText.textContent = "Select one of your legends to see its moves.";
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "NO SELECTION";
  elements.legendCard.innerHTML = '<div class="empty-portrait" aria-hidden="true">✳</div><div class="legend-info"><p class="legend-name">Choose a legend</p><p class="legend-description">Their path and die will appear here.</p></div>';
  elements.legendStats.hidden = true;
  document.querySelector(".mini-die")?.remove();
  setDuelDisplay("·", "·", "—", "—", "A duel appears here when legends meet.");
  addLog("A new crossing begins. Player One moves first.");
  render();
  updateTurnStatus();
}

function keyFor(x, y) {
  return `${x},${y}`;
}

function getPiece(id) {
  return state.pieces.find((piece) => piece.id + piece.player === id);
}

function getSelected() {
  return state.pieces.find((piece) => piece.id + piece.player === state.selectedId) ?? null;
}

function findReachable(piece) {
  const queue = [{ x: piece.x, y: piece.y, distance: 0 }];
  const visited = new Map([[keyFor(piece.x, piece.y), 0]]);
  const reachable = new Map();
  const directions = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  while (queue.length) {
    const current = queue.shift();
    if (current.distance >= piece.move) continue;
    for (const [dx, dy] of directions) {
      const x = current.x + dx;
      const y = current.y + dy;
      if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) continue;
      const key = keyFor(x, y);
      const distance = current.distance + 1;
      if (visited.has(key) && visited.get(key) <= distance) continue;
      const occupantId = state.board[y][x];
      const occupant = occupantId ? getPiece(occupantId) : null;
      if (occupant && occupant.player === piece.player) continue;
      visited.set(key, distance);
      reachable.set(key, { x, y, occupant });
      if (!occupant) queue.push({ x, y, distance });
    }
  }
  return reachable;
}

function selectPiece(piece) {
  if (!piece?.alive || piece.player !== state.currentPlayer || state.gameOver) return;
  state.selectedId = piece.id + piece.player;
  state.reachable = findReachable(piece);
  elements.promptText.textContent = `Move ${piece.name} up to ${piece.move} spaces, or choose a rival to duel.`;
  elements.cancel.hidden = false;
  elements.selectionState.textContent = `PLAYER ${piece.player}`;
  render();
  renderLegend(piece);
}

function render() {
  renderBoard();
  renderRoster();
  updateTurnStatus();
}

function renderBoard() {
  const fragment = document.createDocumentFragment();
  const selected = getSelected();
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const cell = document.createElement("button");
      const occupantId = state.board[y][x];
      const occupant = occupantId ? getPiece(occupantId) : null;
      const target = state.reachable.get(keyFor(x, y));
      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", `Row ${y + 1}, column ${String.fromCharCode(65 + x)}${occupant ? `, ${occupant.name}, Player ${occupant.player}` : ""}`);
      cell.dataset.x = String(x);
      cell.dataset.y = String(y);
      if (x === 0) cell.classList.add("gate-west");
      if (x === SIZE - 1) cell.classList.add("gate-east");
      if (x === SIZE - 1 && state.currentPlayer === 1 || x === 0 && state.currentPlayer === 2) cell.classList.add("is-goal");
      if (target) cell.classList.add(target.occupant ? "is-duel" : "is-move");
      if (selected?.x === x && selected?.y === y) cell.classList.add("is-selected");
      if (state.lastMove?.x === x && state.lastMove?.y === y) cell.classList.add("is-last-move");
      if (occupant) {
        const pieceElement = document.createElement("span");
        pieceElement.className = `piece ${occupant.player === 2 ? "player-two" : ""} ${state.selectedId === occupantId ? "is-active" : ""}`;
        pieceElement.textContent = occupant.mark;
        cell.append(pieceElement);
      }
      cell.disabled = state.gameOver;
      cell.addEventListener("click", () => onCellClick(x, y));
      fragment.append(cell);
    }
  }
  elements.board.replaceChildren(fragment);
}

function renderRoster() {
  const fragment = document.createDocumentFragment();
  for (const piece of state.pieces.filter((item) => item.player === state.currentPlayer)) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `roster-item ${state.selectedId === piece.id + piece.player ? "is-active" : ""} ${piece.alive ? "" : "is-defeated"}`;
    button.disabled = !piece.alive || state.gameOver;
    button.innerHTML = `<span class="roster-sigil ${piece.player === 2 ? "player-two" : ""}">${piece.mark}</span><span class="roster-copy"><strong>${piece.name}</strong><small>${piece.alive ? piece.title : "Out of the crossing"}</small></span><span class="roster-move">${piece.alive ? `M${piece.move}` : "OUT"}</span>`;
    button.addEventListener("click", () => selectPiece(piece));
    fragment.append(button);
  }
  elements.roster.replaceChildren(fragment);
}

function renderLegend(piece) {
  document.querySelector(".mini-die")?.remove();
  const portraitClass = piece.player === 2 ? "legend-portrait player-two" : "legend-portrait";
  elements.legendCard.innerHTML = `<div class="${portraitClass}">${piece.mark}</div><div class="legend-info"><p class="legend-name">${piece.name}</p><p class="legend-description">${piece.title} · ${piece.ability}</p></div>`;
  elements.legendStats.hidden = false;
  elements.legendStats.innerHTML = `<span class="stat">MOVE <b>${piece.move}</b></span><span class="stat">DIE <b>D6</b></span><span class="stat">TEAM <b>${piece.player === 1 ? "I" : "II"}</b></span>`;
  const faces = piece.faces.map((value) => `<span class="mini-face ${value === 0 ? "is-miss" : ""}">${value === 0 ? "×" : value}</span>`).join("");
  elements.legendStats.insertAdjacentHTML("afterend", `<div class="mini-die" aria-label="${piece.name}'s die faces">${faces}</div>`);
}

function onCellClick(x, y) {
  if (state.gameOver) return;
  const occupantId = state.board[y][x];
  const occupant = occupantId ? getPiece(occupantId) : null;
  const selected = getSelected();
  const target = state.reachable.get(keyFor(x, y));

  if (selected && target) {
    if (target.occupant) resolveDuel(selected, target.occupant, x, y);
    else movePiece(selected, x, y);
    return;
  }
  if (occupant?.player === state.currentPlayer) {
    selectPiece(occupant);
    return;
  }
  if (selected) {
    state.selectedId = null;
    state.reachable.clear();
    elements.promptText.textContent = "That tile is out of reach. Choose a highlighted tile.";
    elements.cancel.hidden = true;
    elements.selectionState.textContent = "NO SELECTION";
    render();
    return;
  }
  showToast("Select one of your legends first.");
}

function movePiece(piece, x, y) {
  state.board[piece.y][piece.x] = null;
  piece.x = x;
  piece.y = y;
  state.board[y][x] = piece.id + piece.player;
  state.lastMove = { x, y };
  addLog(`${piece.name} advances across the field.`);
  if ((piece.player === 1 && x === SIZE - 1) || (piece.player === 2 && x === 0)) {
    finishGame(piece.player, `${piece.name} reached the opposing gate.`);
    return;
  }
  endTurn();
}

function resolveDuel(attacker, defender, x, y) {
  const attackerRoll = roll(attacker);
  const defenderRoll = roll(defender);
  const attackerScore = attackerRoll.score;
  const defenderScore = defenderRoll.score + (defender.defense ?? 0);
  const attackerWins = attackerScore > defenderScore;
  const winner = attackerWins ? attacker : defender;
  const loser = attackerWins ? defender : attacker;
  const outcome = attackerWins ? `${attacker.name} wins the duel.` : `${defender.name} holds the ground.`;

  setDuelDisplay(attackerRoll.face, defenderRoll.face, attacker.name, defender.name, `${attackerScore} vs ${defenderScore} · ${outcome}`);
  loser.alive = false;
  state.board[loser.y][loser.x] = null;
  if (attackerWins) {
    state.board[attacker.y][attacker.x] = null;
    attacker.x = x;
    attacker.y = y;
    state.board[y][x] = attacker.id + attacker.player;
  }
  state.lastMove = { x: attackerWins ? x : attacker.x, y: attackerWins ? y : attacker.y };
  addLog(`${attacker.name} rolled ${attackerRoll.face}; ${defender.name} rolled ${defenderRoll.face}. ${outcome}`);
  if (attackerWins && ((attacker.player === 1 && x === SIZE - 1) || (attacker.player === 2 && x === 0))) {
    finishGame(attacker.player, `${attacker.name} claims the opposing gate.`);
    return;
  }
  const remaining = state.pieces.filter((piece) => piece.player === loser.player && piece.alive);
  if (remaining.length === 0) {
    finishGame(winner.player, `${winner.name} is the last legend standing.`);
    return;
  }
  endTurn();
}

function roll(piece) {
  const face = piece.faces[Math.floor(Math.random() * piece.faces.length)];
  let score = face;
  if (piece.critical && face === 6) score = 7;
  return { face: face === 0 ? "×" : face, score };
}

function endTurn() {
  state.moveCount += 1;
  if (state.currentPlayer === 2) state.round += 1;
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  state.selectedId = null;
  state.reachable.clear();
  elements.round.textContent = String(state.round).padStart(2, "0");
  elements.promptText.textContent = `Player ${state.currentPlayer}, select a legend to move.`;
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "NO SELECTION";
  render();
}

function finishGame(player, message) {
  state.gameOver = true;
  state.selectedId = null;
  state.reachable.clear();
  elements.promptText.textContent = `Player ${player} wins. ${message}`;
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "GAME OVER";
  addLog(`Player ${player} wins the crossing.`);
  render();
  showToast(`Player ${player} wins the crossing.`);
}

function updateTurnStatus() {
  const one = document.querySelector("#player-one-chip");
  const two = document.querySelector("#player-two-chip");
  one.classList.toggle("is-current", state.currentPlayer === 1 && !state.gameOver);
  two.classList.toggle("is-current", state.currentPlayer === 2 && !state.gameOver);
  document.querySelector("#player-one-status").textContent = state.gameOver ? "Match ended" : state.currentPlayer === 1 ? "Your turn" : "Waiting";
  document.querySelector("#player-two-status").textContent = state.gameOver ? "Match ended" : state.currentPlayer === 2 ? "Your turn" : "Waiting";
}

function setDuelDisplay(attacker, defender, attackerName, defenderName, result) {
  document.querySelector("#attacker-die").textContent = attacker;
  document.querySelector("#defender-die").textContent = defender;
  document.querySelector("#attacker-label").textContent = attackerName;
  document.querySelector("#defender-label").textContent = defenderName;
  document.querySelector("#duel-result").textContent = result;
  for (const id of ["#attacker-die", "#defender-die"]) {
    const die = document.querySelector(id);
    die.classList.remove("is-roll");
    void die.offsetWidth;
    die.classList.add("is-roll");
  }
}

function addLog(message) {
  const item = document.createElement("li");
  const time = document.createElement("time");
  time.textContent = String(elements.log.children.length + 1).padStart(2, "0");
  item.append(time, document.createTextNode(message));
  elements.log.prepend(item);
  while (elements.log.children.length > 6) elements.log.lastElementChild.remove();
}

let toastTimer;
function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => elements.toast.classList.remove("is-visible"), 1800);
}

elements.cancel.addEventListener("click", () => {
  state.selectedId = null;
  state.reachable.clear();
  elements.promptText.textContent = "Select one of your legends to see its moves.";
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "NO SELECTION";
  render();
  elements.legendCard.innerHTML = '<div class="empty-portrait" aria-hidden="true">✳</div><div class="legend-info"><p class="legend-name">Choose a legend</p><p class="legend-description">Their path and die will appear here.</p></div>';
  elements.legendStats.hidden = true;
  document.querySelector(".mini-die")?.remove();
});

document.querySelector("#new-game").addEventListener("click", setupGame);
setupGame();