const SIZE = 7;
const BENCH_SIZE = 6;

const UNIT_TEMPLATES = [
  { id: "striker", name: "Striker", title: "Frontline Hunter", mark: "S", move: 3, faces: [0, 1, 2, 3, 4, 5], ability: "Rush: can move 3 spaces and pressure the lane." },
  { id: "guardian", name: "Guardian", title: "Shield Bearer", mark: "G", move: 2, faces: [0, 2, 2, 3, 4, 5], defense: 1, ability: "Aegis: +1 defense in duels." },
  { id: "seer", name: "Seer", title: "Star Oracle", mark: "O", move: 2, faces: [0, 1, 3, 4, 4, 6], critical: true, ability: "Astral: a 6 becomes a 7 in a duel." },
];

const BOARD_DEFS = [
  { id: "p1-s1", x: 0, y: 1, spawnFor: 1 },
  { id: "p1-s2", x: 0, y: 5, spawnFor: 1 },
  { id: "p1-1", x: 1, y: 1 },
  { id: "p1-2", x: 2, y: 1 },
  { id: "p1-3", x: 3, y: 1 },
  { id: "p1-4", x: 4, y: 1 },
  { id: "p1-5", x: 5, y: 1 },
  { id: "p1-6", x: 6, y: 1 },

  { id: "p1-m1", x: 1, y: 3 },
  { id: "p1-m2", x: 2, y: 3 },
  { id: "p1-m3", x: 3, y: 3 },
  { id: "p1-m4", x: 4, y: 3 },
  { id: "p1-m5", x: 5, y: 3 },

  { id: "p1-b1", x: 1, y: 5 },
  { id: "p1-b2", x: 2, y: 5 },
  { id: "p1-b3", x: 3, y: 5 },
  { id: "p1-b4", x: 4, y: 5 },
  { id: "p1-b5", x: 5, y: 5 },

  { id: "p2-s1", x: 6, y: 1, spawnFor: 2 },
  { id: "p2-s2", x: 6, y: 5, spawnFor: 2 },
  { id: "p2-1", x: 5, y: 1 },
  { id: "p2-2", x: 4, y: 1 },
  { id: "p2-3", x: 3, y: 1 },
  { id: "p2-4", x: 2, y: 1 },
  { id: "p2-5", x: 1, y: 1 },

  { id: "p2-m1", x: 5, y: 3 },
  { id: "p2-m2", x: 4, y: 3 },
  { id: "p2-m3", x: 3, y: 3 },
  { id: "p2-m4", x: 2, y: 3 },
  { id: "p2-m5", x: 1, y: 3 },

  { id: "p2-b1", x: 5, y: 5 },
  { id: "p2-b2", x: 4, y: 5 },
  { id: "p2-b3", x: 3, y: 5 },
  { id: "p2-b4", x: 2, y: 5 },
  { id: "p2-b5", x: 1, y: 5 },

  { id: "p1-goal", x: 6, y: 3, goalFor: 1 },
  { id: "p2-goal", x: 0, y: 3, goalFor: 2 },
];

const BOARD_GRAPH = new Map();

for (const node of BOARD_DEFS) {
  const neighbors = new Set();
  for (const other of BOARD_DEFS) {
    if (other.id === node.id) continue;
    const distX = Math.abs(node.x - other.x);
    const distY = Math.abs(node.y - other.y);
    const isNeighbor = (distX + distY) === 1 || (distX === 1 && distY === 2) || (distX === 2 && distY === 1);
    if (isNeighbor) neighbors.add(other.id);
  }
  BOARD_GRAPH.set(node.id, [...neighbors]);
}

const state = {
  currentPlayer: 1,
  selectedId: null,
  reachable: new Set(),
  round: 1,
  gameOver: false,
  lastMove: null,
  units: [],
  board: new Map(),
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

function makeUnits() {
  return [1, 2].flatMap((player) =>
    UNIT_TEMPLATES.flatMap((template, archetypeIndex) =>
      Array.from({ length: 2 }, (_, copyIndex) => ({
        ...template,
        player,
        id: `${template.id}-${player}-${copyIndex}`,
        name: `${template.name} ${copyIndex + 1}`,
        slot: archetypeIndex * 2 + copyIndex,
        alive: true,
        location: null,
      }))
    )
  );
}

function getUnitById(id) {
  return state.units.find((unit) => unit.id === id) ?? null;
}

function getSelected() {
  return state.selectedId ? getUnitById(state.selectedId) : null;
}

function getOccupant(nodeId) {
  const unitId = state.board.get(nodeId);
  return unitId ? getUnitById(unitId) : null;
}

function setupGame() {
  state.currentPlayer = 1;
  state.selectedId = null;
  state.reachable = new Set();
  state.round = 1;
  state.gameOver = false;
  state.lastMove = null;
  state.board = new Map();
  state.units = makeUnits();

  elements.log.replaceChildren();
  elements.round.textContent = "01";
  elements.promptText.textContent = "Select one of your bench units to deploy or pick a unit on the board.";
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

function findReachable(unit) {
  const reachable = new Set();
  const visited = new Set();
  const queue = [];

  if (!unit.location) {
    const spawnNodes = BOARD_DEFS.filter((node) => node.spawnFor === unit.player && !getOccupant(node.id));
    for (const node of spawnNodes) reachable.add(node.id);
    return reachable;
  }

  queue.push({ id: unit.location, steps: 0 });
  visited.add(unit.location);

  while (queue.length) {
    const current = queue.shift();
    const neighbors = BOARD_GRAPH.get(current.id) ?? [];

    for (const neighborId of neighbors) {
      if (visited.has(neighborId)) continue;
      const occupant = getOccupant(neighborId);
      const stepCost = current.steps + 1;
      if (stepCost > unit.move) continue;
      if (occupant && occupant.player === unit.player) continue;
      visited.add(neighborId);
      reachable.add(neighborId);
      if (!occupant) queue.push({ id: neighborId, steps: stepCost });
    }
  }

  return reachable;
}

function selectUnit(unit) {
  if (!unit || state.gameOver) return;
  if (unit.player !== state.currentPlayer) {
    showToast("It is not that side's turn.");
    return;
  }

  state.selectedId = unit.id;
  state.reachable = findReachable(unit);
  elements.promptText.textContent = unit.location
    ? `${unit.name} can move to a connected space or strike a rival.`
    : `${unit.name} is in the bench. Pick an open spawn tile for your side.`;
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

  for (const node of BOARD_DEFS) {
    const cell = document.createElement("button");
    const occupant = getOccupant(node.id);
    const target = state.reachable.has(node.id);

    cell.type = "button";
    cell.className = "cell";
    cell.dataset.nodeId = node.id;
    cell.setAttribute("role", "gridcell");
    cell.setAttribute("aria-label", `${node.id}, ${occupant ? `${occupant.name} player ${occupant.player}` : "empty space"}`);

    if (node.spawnFor) cell.classList.add("is-spawn");
    if (node.goalFor) cell.classList.add("is-goal");
    if (target && occupant && occupant.player !== state.currentPlayer) cell.classList.add("is-duel");
    if (target && (!occupant || occupant.player === state.currentPlayer || !occupant)) cell.classList.add("is-move");
    if (selected && selected.location === node.id) cell.classList.add("is-selected");
    if (state.lastMove && state.lastMove === node.id) cell.classList.add("is-last-move");

    if (occupant) {
      const piece = document.createElement("span");
      piece.className = `piece ${occupant.player === 2 ? "player-two" : ""} ${state.selectedId === occupant.id ? "is-active" : ""}`;
      piece.textContent = occupant.mark;
      cell.append(piece);
    }

    cell.disabled = state.gameOver || !!(node.spawnFor && node.spawnFor !== state.currentPlayer && !occupant);
    cell.addEventListener("click", () => onCellClick(node.id));
    fragment.append(cell);
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

function onCellClick(nodeId) {
  if (state.gameOver) return;

  const selected = getSelected();
  const node = BOARD_DEFS.find((entry) => entry.id === nodeId);
  const occupant = getOccupant(nodeId);

  if (!selected) {
    if (occupant && occupant.player === state.currentPlayer) {
      selectUnit(occupant);
      return;
    }
    showToast("Select one of your units first.");
    return;
  }

  if (state.reachable.has(nodeId)) {
    if (occupant && occupant.player !== selected.player) {
      resolveDuel(selected, occupant, nodeId);
      return;
    }

    if (!selected.location && node.spawnFor === selected.player) {
      deployUnit(selected, nodeId);
      return;
    }

    if (selected.location) {
      moveUnit(selected, nodeId);
      return;
    }
  }

  if (occupant && occupant.player === state.currentPlayer) {
    selectUnit(occupant);
    return;
  }

  state.selectedId = null;
  state.reachable = new Set();
  elements.promptText.textContent = "That tile is not legal for this unit. Choose a highlighted space.";
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "NO SELECTION";
  render();
}

function deployUnit(unit, nodeId) {
  const node = BOARD_DEFS.find((entry) => entry.id === nodeId);
  if (!node || !node.spawnFor || node.spawnFor !== unit.player) return;
  if (getOccupant(nodeId)) return;

  state.board.set(nodeId, unit.id);
  unit.location = nodeId;
  state.lastMove = nodeId;
  addLog(`${unit.name} deploys to the ${unit.player === 1 ? "Player One" : "Player Two"} spawn.`);
  endTurn();
}

function moveUnit(unit, nodeId) {
  const previous = unit.location;
  if (!previous) return;

  state.board.delete(previous);
  unit.location = nodeId;
  state.board.set(nodeId, unit.id);
  state.lastMove = nodeId;
  addLog(`${unit.name} advances along the lane.`);

  if (nodeId === `p${unit.player}-goal`) {
    finishGame(unit.player, `${unit.name} reaches the opposing goal.`);
    return;
  }

  endTurn();
}

function resolveDuel(attacker, defender, nodeId) {
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
    state.board.delete(defender.location);
    defender.alive = false;
    defender.location = null;

    state.board.delete(attacker.location);
    attacker.location = nodeId;
    state.board.set(nodeId, attacker.id);
    state.lastMove = nodeId;
    addLog(`${attacker.name} rolled ${attackerRoll.face}; ${defender.name} rolled ${defenderRoll.face}. ${outcome}`);

    if (nodeId === `p${attacker.player}-goal`) {
      finishGame(attacker.player, `${attacker.name} reaches the goal after a duel.`);
      return;
    }
  } else {
    state.board.delete(attacker.location);
    attacker.alive = false;
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
  state.moveCount = (state.moveCount || 0) + 1;
  if (state.currentPlayer === 2) state.round += 1;
  state.currentPlayer = state.currentPlayer === 1 ? 2 : 1;
  state.selectedId = null;
  state.reachable = new Set();
  elements.round.textContent = String(state.round).padStart(2, "0");
  elements.promptText.textContent = `Player ${state.currentPlayer}, choose one of your units or a valid spawn.`;
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "NO SELECTION";
  render();
}

function finishGame(player, message) {
  state.gameOver = true;
  state.selectedId = null;
  state.reachable = new Set();
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
  state.reachable = new Set();
  elements.promptText.textContent = "Select a bench unit or a valid board unit.";
  elements.cancel.hidden = true;
  elements.selectionState.textContent = "NO SELECTION";
  render();
  elements.legendCard.innerHTML = '<div class="empty-portrait" aria-hidden="true">✳</div><div class="legend-info"><p class="legend-name">Choose a unit</p><p class="legend-description">Bench, lane cover, and duel details appear here.</p></div>';
  elements.legendStats.hidden = true;
  document.querySelector(".mini-die")?.remove();
});

document.querySelector("#new-game").addEventListener("click", setupGame);
setupGame();

window.addEventListener("DOMContentLoaded", () => {
  document.querySelector("#board").setAttribute("aria-label", "Connected board with spawn points and goal lane");
});

const boardNodeLookup = Object.fromEntries(BOARD_DEFS.map((node) => [node.id, node]));
window.boardNodeLookup = boardNodeLookup;

window.__debugBoard = () => {
  console.table(BOARD_DEFS.map((node) => ({ id: node.id, x: node.x, y: node.y, spawnFor: node.spawnFor ?? "-", goalFor: node.goalFor ?? "-" })));
};
