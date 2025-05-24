import * as viewport from './viewport.js';

const DEBUG_KEY = 'myGameDebug';
const saved = JSON.parse(localStorage.getItem(DEBUG_KEY)) || {};

//--------------------------------------------------------------
// GLOBAL DEBUG STATE OBJECT
//--------------------------------------------------------------

export const Debug = {
  active: saved.showGrid ?? true, // master flag
  showGrid: saved.showGrid ?? true, // draw coordinate grid
  freeMove: false, // arrow‑key teleport
  gridSize: 100, // px between grid lines
  physics: {
    gravity: true,
    friction: true,
  },
  world: {
    bounds: true, // draw world bounds
    lanes: true, // draw lane bounds
  },
};

//--------------------------------------------------------------
// HOT‑KEY HANDLER (call from keyPressed())
//--------------------------------------------------------------

export function handleDebugKeyPress(e) {
  console.log(e.key);
  switch (e.key) {
    case '`': // back‑tick toggles master flag
      Debug.active = !Debug.active;
      break;

    // The remaining shortcuts only work when Debug is on
    case 'g':
    case 'G':
      if (Debug.active) toggleGrid();
      break;
    case 'f':
    case 'F':
      if (Debug.active) Debug.freeMove = !Debug.freeMove;
      break;
    case '1':
      if (Debug.active) Debug.physics.gravity = !Debug.physics.gravity;
      break;
    case '2':
      if (Debug.active) Debug.physics.friction = !Debug.physics.friction;
      break;
    case '3':
      if (Debug.active) Debug.world.bounds = !Debug.world.bounds;
      break;
    case '4':
      if (Debug.active) Debug.world.lanes = !Debug.world.lanes;
      break;
  }
}

//--------------------------------------------------------------
// PRE‑UPDATE (call once each frame BEFORE physics)
//--------------------------------------------------------------
export function debugPreUpdate(player) {
  if (!(Debug.active && Debug.freeMove)) return;

  // Cancel velocity so player stays put when keys released
  player.vel.set(0, 0);

  // Arrow keys nudge position 10 px per frame (adjust as needed)
  if (p.keyIsDown(p.LEFT_ARROW)) player.pos.x -= 10;
  if (p.keyIsDown(p.RIGHT_ARROW)) player.pos.x += 10;
  if (p.keyIsDown(p.UP_ARROW)) player.pos.y -= 10;
  if (p.keyIsDown(p.DOWN_ARROW)) player.pos.y += 10;
}

//--------------------------------------------------------------
// POST‑DRAW  (call once each frame AFTER your normal drawing)
//--------------------------------------------------------------
export function drawGrid(p, cam) {
  if (!(Debug.active && Debug.showGrid)) return;

  p.push();
  p.stroke(160);
  p.fill(255, 0, 0);

  const gs = Debug.gridSize;
  // 1. Visible world rectangle this frame
  const s = viewport.s; // uniform scale
  const off = viewport.off; // letter-box translate (world units)
  const viewW = p.width / s; // width & height in world coords
  const viewH = p.height / s;
  const leftX = off.x; // world X at left edge
  const rightX = leftX + viewW;
  const topY = cam.camY - off.y; // world Y at top edge
  const botY = topY + viewH;

  // 2. Align to grid
  const firstX = Math.floor(leftX / gs) * gs;
  const firstY = Math.floor(topY / gs) * gs;

  const big = gs * 4;

  // vertical lines
  for (let x = firstX; x <= rightX; x += gs) {
    p.stroke(x % big ? 80 : 130);
    p.line(x, topY, x, botY);
    if (x % big === 0) {
      p.fill(160);
      p.noStroke();
      p.textSize(12);
      p.text(x, x + 2, topY + 12); // label near top edge
    }
  }

  // horizontal lines
  for (let y = firstY; y <= botY; y += gs) {
    p.stroke(y % big ? 80 : 130);
    p.line(leftX, y, rightX, y);
    if (y % big === 0) {
      p.fill(160);
      p.noStroke();
      p.textSize(12);
      p.text(y, leftX + 2, y - 2);
    }
  }
  // p.pop();

  // Camera coordinates (top‑left corner of viewport)
  p.noStroke();
  p.text(p.text(`camY: ${cam.camY.toFixed(0)}`, 6, 24));
  p.pop();
}

// Helper to toggle grid on/off
export function toggleGrid() {
  Debug.showGrid = !Debug.showGrid;
  localStorage.setItem(DEBUG_KEY, JSON.stringify(Debug));
}

export function drawWorldBounds(p) {
  p.push();
  p.noFill();
  p.stroke(255, 0, 0); // bright red outline
  p.strokeWeight(10);
  p.rect(0, 0, viewport.WORLD.w, viewport.WORLD.h);
  p.pop();
}

export function drawLaneBounds(p, gutterX, playW) {
  p.push();
  p.noFill();
  p.stroke(0, 180, 255); // cyan
  p.strokeWeight(3);
  p.rect(gutterX, -10000, playW, 20000); // crazy-tall so it spans whole level
  p.pop();
}
