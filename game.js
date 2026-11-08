const SIZE = 7;
const BENCH_SIZE = 6;

const UNIT_TEMPLATES = [
  { id: "striker", name: "Striker", title: "Frontline Hunter", mark: "S", move: 3, faces: [0, 1, 2, 3, 4, 5], ability: "Rush: can move 3 spaces and pressure the lane." },
  { id: "guardian", name: "Guardian", title: "Shield Bearer", mark: "G", move: 2, faces: [0, 2, 2, 3, 4, 5], defense: 1, ability: "Aegis: +1 defense in duels." },
  { id: "seer", name: "Seer", title: "Star Oracle", mark: "O", move: 2, faces: [0, 1, 3, 4, 4, 6], critical: true, ability: "Astral: a 6 becomes a 7 in a duel." },
  { id: "watcher", name: "Watcher", title: "Signal Scout", mark: "W", move: 2, faces: [0, 1, 2, 4, 5, 5], ability: "Insight: reads the lane and attacks from range." },
  { id: "breaker", name: "Breaker", title: "Rift Fist", mark: "R", move: 3, faces: [0, 2, 2, 3, 4, 6], ability: "Break: a heavier rush unit for the front line." },
  { id: "mender", name: "Mender", title: "Hearth Sage", mark: "M", move: 2, faces: [0, 1, 2, 3, 3, 4], ability: "Support: keeps the bench ready for the next push." },
];

const SPAWN_POSITIONS = {
  1: [{ x: 0, y: 1 }, { x: 0, y: 5 }],
  2: [{ x: SIZE - 1, y: 1 }, { x: SIZE - 1, y: 5 }],
};

const GOAL_POSITIONS = {
  1: { x: SIZE - 1, y: Math.floor(SIZE / 2) },
  2: { x: 0, y: Math.floor(SIZE / 2) },
};

const DIRECTIONS = [
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

const state = {
  board: [],
  units: [],
  currentPlayer: 1,
  selectedId: null,
  reachable: new Map(),
  round: 1,
  gameOver: false,
  lastMove: null,
  moveCount: 0,
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

function keyFor(x, y) {
  return `${x},${y}`;
}

function makeBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
}

function createUnits() {
  return [1, 2].flatMap((player) =>
    UNIT_TEMPLATES.map((template, index) => ({
      ...template,
      player,
      id: `${template.id}-${player}-${index}`,
      name: `${template.name} ${index + 1}`,
      alive: true,
      x: null,
      y: null,
      location: null,
    }))
  );
}

function isSpawnTile(x, y, player) {
  return SPAWN_POSITIONS[player].some((spot) => spot.x === x && spot.y === y);
}

function isGoalTile(x, y, player) {
  const goal = GOAL_POSITIONS[player];
  return goal.x === x && goal.y === y;
}

function getOccupant(x, y) {
  if (x < 0 || y < 0 || x >= SIZE || y >= SIZE) return null;
  const unitId = state.board[y][x];
  return unitId ? state.units.find((unit) => unit.id === unitId) ?? null : null;
}

function getSelected() {
  return state.selectedId ? state.units.find((unit) => unit.id === state.selectedId) ?? null : null;
}

function setupGame() {
  state.board = makeBoard();
  state.units = createUnits();
  state.currentPlayer = 1;
  state.selectedId = null;
  state.reachable = new Map();
  state.round = 1;
  state.moveCount = 0;
  state.gameOver = false;
  state.lastMove = null;

  elements.log.replaceChildren();
  elements.round.textContent = "01";
  elements.promptText.textContent = "Select one of your units from the bench or board.";
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "NO SELECTION";
  elements.legendCard.innerHTML = '<div class="empty-portrait" aria-hidden="true">✳</div><div class="legend-info"><p class="legend-name">Choose a unit</p><p class="legend-description">Bench, lane cover, and duel details appear here.</p></div>';
  elements.legendStats.hidden = true;
  document.querySelector(".mini-die")?.remove();
  setDuelDisplay("·", "·", "—", "—", "A duel appears here when units meet.");
  addLog("The field is set. Player One opens the match.");
  render();
  updateTurnStatus();
}

function collectReachable(unit) {
  const reachable = new Map();

  if (!unit.location) {
    for (const spawn of SPAWN_POSITIONS[unit.player]) {
      if (!getOccupant(spawn.x, spawn.y)) {
        reachable.set(keyFor(spawn.x, spawn.y), { x: spawn.x, y: spawn.y, occupant: null });
      }
    }
    return reachable;
  }

  const queue = [{ x: unit.x, y: unit.y, steps: 0 }];
  const visited = new Set([keyFor(unit.x, unit.y)]);

  while (queue.length) {
    const current = queue.shift();
    for (const [dx, dy] of DIRECTIONS) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const nextKey = keyFor(nx, ny);
      const nextSteps = current.steps + 1;

      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE) continue;
      if (visited.has(nextKey)) continue;
      if (nextSteps > unit.move) continue;

      const occupant = getOccupant(nx, ny);
      if (occupant && occupant.player === unit.player) continue;

      visited.add(nextKey);
      reachable.set(nextKey, { x: nx, y: ny, occupant });

      if (!occupant) {
        queue.push({ x: nx, y: ny, steps: nextSteps });
      }
    }
  }

  return reachable;
}

function selectUnit(unit) {
  if (!unit || !unit.alive || state.gameOver) return;
  if (unit.player !== state.currentPlayer) {
    showToast("It is not that side's turn.");
    return;
  }

  state.selectedId = unit.id;
  state.reachable = collectReachable(unit);
  elements.promptText.textContent = unit.location
    ? `${unit.name} can move to a connected space or strike a rival.`
    : `${unit.name} is in the bench. Choose an open spawn tile for your side.`;
  elements.cancel.hidden = false;
  elements.selectionState.textContent = `PLAYER ${unit.player}`;
  render();
  renderLegend(unit);
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
      const key = keyFor(x, y);
      const cell = document.createElement("button");
      const occupant = getOccupant(x, y);
      const target = state.reachable.get(key);
      const isSelected = selected && selected.x === x && selected.y === y;
      const lastMove = state.lastMove && state.lastMove.x === x && state.lastMove.y === y;

      cell.type = "button";
      cell.className = "cell";
      cell.setAttribute("role", "gridcell");
      cell.setAttribute("aria-label", occupant ? `${occupant.name}, Player ${occupant.player}` : `Tile ${x + 1}, ${y + 1}`);

      if (isSpawnTile(x, y, 1) || isSpawnTile(x, y, 2)) cell.classList.add("is-spawn");
      if (isGoalTile(x, y, 1) || isGoalTile(x, y, 2)) cell.classList.add("is-goal");
      if (target) cell.classList.add(target.occupant ? "is-duel" : "is-move");
      if (isSelected) cell.classList.add("is-selected");
      if (lastMove) cell.classList.add("is-last-move");

      if (occupant) {
        const piece = document.createElement("span");
        piece.className = `piece ${occupant.player === 2 ? "player-two" : ""} ${state.selectedId === occupant.id ? "is-active" : ""}`;
        piece.textContent = occupant.mark;
        cell.append(piece);
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
  const units = state.units.filter((unit) => unit.player === state.currentPlayer);

  for (const unit of units) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `roster-item ${state.selectedId === unit.id ? "is-active" : ""} ${unit.alive ? "" : "is-defeated"}`;
    button.disabled = !unit.alive || state.gameOver;
    button.innerHTML = `
      <span class="roster-sigil ${unit.player === 2 ? "player-two" : ""}">${unit.mark}</span>
      <span class="roster-copy">
        <strong>${unit.name}</strong>
        <small>${unit.location ? "On board" : "In bench"}</small>
      </span>
      <span class="roster-move">${unit.location ? "LIVE" : "READY"}</span>
    `;
    button.addEventListener("click", () => selectUnit(unit));
    fragment.append(button);
  }

  elements.roster.replaceChildren(fragment);
}

function renderLegend(unit) {
  document.querySelector(".mini-die")?.remove();
  const portraitClass = unit.player === 2 ? "legend-portrait player-two" : "legend-portrait";
  elements.legendCard.innerHTML = `<div class="${portraitClass}">${unit.mark}</div><div class="legend-info"><p class="legend-name">${unit.name}</p><p class="legend-description">${unit.title} · ${unit.ability}</p></div>`;
  elements.legendStats.hidden = false;
  elements.legendStats.innerHTML = `<span class="stat">MOVE <b>${unit.move}</b></span><span class="stat">DIE <b>D6</b></span><span class="stat">TEAM <b>${unit.player === 1 ? "I" : "II"}</b></span>`;

  const faces = unit.faces.map((value) => `<span class="mini-face ${value === 0 ? "is-miss" : ""}">${value === 0 ? "×" : value}</span>`).join("");
  elements.legendStats.insertAdjacentHTML("afterend", `<div class="mini-die" aria-label="${unit.name}'s die faces">${faces}</div>`);
}

function onCellClick(x, y) {
  if (state.gameOver) return;

  const key = keyFor(x, y);
  const occupant = getOccupant(x, y);
  const selected = getSelected();
  const target = state.reachable.get(key);

  if (!selected) {
    if (occupant && occupant.player === state.currentPlayer) {
      selectUnit(occupant);
      return;
    }
    showToast("Select one of your units first.");
    return;
  }

  if (target) {
    if (target.occupant && target.occupant.player !== selected.player) {
      resolveDuel(selected, target.occupant, x, y);
      return;
    }

    if (!selected.location && isSpawnTile(x, y, selected.player)) {
      deployUnit(selected, x, y);
      return;
    }

    if (selected.location) {
      moveUnit(selected, x, y);
      return;
    }
  }

  if (occupant && occupant.player === state.currentPlayer) {
    selectUnit(occupant);
    return;
  }

  state.selectedId = null;
  state.reachable = new Map();
  elements.promptText.textContent = "That tile is not legal for this unit. Pick a highlighted space.";
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "NO SELECTION";
  render();
}

function deployUnit(unit, x, y) {
  if (getOccupant(x, y)) return;
  if (!isSpawnTile(x, y, unit.player)) return;

  state.board[y][x] = unit.id;
  unit.x = x;
  unit.y = y;
  unit.location = keyFor(x, y);
  unit.alive = true;
  state.lastMove = { x, y };
  addLog(`${unit.name} deploys to the ${unit.player === 1 ? "Player One" : "Player Two"} spawn.`);
  endTurn();
}

function moveUnit(unit, x, y) {
  if (!unit.location) return;

  state.board[unit.y][unit.x] = null;
  unit.x = x;
  unit.y = y;
  unit.location = keyFor(x, y);
  state.board[y][x] = unit.id;
  state.lastMove = { x, y };
  addLog(`${unit.name} advances along the lane.`);

  if (isGoalTile(x, y, unit.player)) {
    finishGame(unit.player, `${unit.name} reaches the opposing goal.`);
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
  const outcome = attackerWins ? `${attacker.name} wins the duel.` : `${defender.name} holds the lane.`;

  setDuelDisplay(attackerRoll.face, defenderRoll.face, attacker.name, defender.name, `${attackerScore} vs ${defenderScore} · ${outcome}`);

  if (attackerWins) {
    state.board[defender.y][defender.x] = null;
    defender.alive = false;
    defender.x = null;
    defender.y = null;
    defender.location = null;

    state.board[attacker.y][attacker.x] = null;
    attacker.x = x;
    attacker.y = y;
    attacker.location = keyFor(x, y);
    state.board[y][x] = attacker.id;
    state.lastMove = { x, y };

    addLog(`${attacker.name} rolled ${attackerRoll.face}; ${defender.name} rolled ${defenderRoll.face}. ${outcome}`);

    if (isGoalTile(x, y, attacker.player)) {
      finishGame(attacker.player, `${attacker.name} reaches the opposing goal after a duel.`);
      return;
    }
  } else {
    state.board[attacker.y][attacker.x] = null;
    attacker.alive = false;
    attacker.x = null;
    attacker.y = null;
    attacker.location = null;

    addLog(`${attacker.name} rolled ${attackerRoll.face}; ${defender.name} rolled ${defenderRoll.face}. ${outcome}`);
  }

  const remaining = state.units.filter((unit) => unit.player === loser.player && unit.alive);
  if (remaining.length === 0) {
    finishGame(winner.player, `${winner.name} defeats the final rival.`);
    return;
  }

  endTurn();
}

function roll(unit) {
  const face = unit.faces[Math.floor(Math.random() * unit.faces.length)];
  let score = face;
  if (unit.critical && face === 6) score = 7;
  return { face: face === 0 ? "×" : face, score };
}

function endTurn() {
  state.moveCount += 1;
  if (state.currentPlayer === 2) state.round += 1;
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  state.selectedId = null;
  state.reachable = new Map();
  elements.round.textContent = String(state.round).padStart(2, "0");
  elements.promptText.textContent = `Player ${state.currentPlayer}, choose a unit from the bench or a highlighted tile.`;
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "NO SELECTION";
  render();
}

function finishGame(player, message) {
  state.gameOver = true;
  state.selectedId = null;
  state.reachable = new Map();
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
  state.reachable = new Map();
  elements.promptText.textContent = "Select one of your units from the bench or board.";
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "NO SELECTION";
  render();
  elements.legendCard.innerHTML = '<div class="empty-portrait" aria-hidden="true">✳</div><div class="legend-info"><p class="legend-name">Choose a unit</p><p class="legend-description">Bench, lane cover, and duel details appear here.</p></div>';
  elements.legendStats.hidden = true;
  document.querySelector(".mini-die")?.remove();
});

document.querySelector("#new-game").addEventListener("click", setupGame);
setupGame();

window.__debugBoard = () => {
  console.table(Array.from({ length: SIZE }, (_, y) =>
    Object.fromEntries(Array.from({ length: SIZE }, (_, x) => [String(x), state.board[y][x] ?? "-"]))
  ));
};
