import { GRID_UNIT, MAX_LEN } from '../core/config.js';
import * as viewport from './viewport.js';

//--------------------------------------------------------------
// GLOBAL DEBUG STATE OBJECT
//--------------------------------------------------------------

export const Debug = {
  active: false, // master flag
  showGrid: false, // draw coordinate grid
  freeMove: false, // arrow‑key teleport
  gridSize: GRID_UNIT, // px between grid lines
  physics: {
    gravity: true,
    friction: true,
  },
  world: {
    bounds: false, // draw world bounds
    lanes: true, // draw lane bounds
  },
  brush: false,
  snap: GRID_UNIT, // snap to grid size
  longArm: false,
  showBoxes: false,
};

//--------------------------------------------------------------
// HOT‑KEY HANDLER (call from keyPressed())
//--------------------------------------------------------------

export function handleDebugKeyPress(e, player) {
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
    case 'b':
      if (Debug.active) Debug.brush = !Debug.brush;
      break;
    case 'l':
    case 'L':
      if (Debug.active) Debug.longArm = !Debug.longArm;
      player.setMaxRopeLength(Debug.longArm ? 240 : MAX_LEN);
      console.log('Long arm:', Debug.longArm ? 'ON (240)' : 'OFF (170)');
      break;
    case 'h':
    case 'H':
      if (Debug.active) Debug.showBoxes = !Debug.showBoxes;
      console.log('Show boxes:', Debug.showBoxes ? 'ON' : 'OFF');
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
export function drawGrid(p, cam, spacing = Debug.snap) {
  if (!(Debug.active && Debug.showGrid)) return;

  // 1. Visible world rectangle this frame
  const s = viewport.s; // uniform scale
  const off = viewport.off; // letter-box translate (world units)
  const viewW = p.width / s; // width & height in world coords
  const viewH = p.height / s;
  const leftX = -off.x; // world X at left edge
  const rightX = leftX + viewW;
  const topY = cam.camY - off.y; // world Y at top edge
  const botY = topY + viewH;

  // 2. Align to grid
  const firstX = Math.floor(leftX / spacing) * spacing;
  const firstY = Math.floor(topY / spacing) * spacing;

  const big = spacing * 5; // bold every 5th line

  p.push();
  p.noFill();

  // vertical lines
  for (let x = firstX; x <= rightX; x += spacing) {
    p.stroke(x % big ? 70 : 120);
    p.line(x, topY, x, botY);
    if ((x % GRID_UNIT) % 4 === 0) {
      p.fill(0);
      p.noStroke();
      p.textSize(12);
      p.text(x, x + 2, topY + 14); // label near top edge
    }
  }

  // horizontal lines
  for (let y = firstY; y <= botY; y += GRID_UNIT) {
    p.stroke(y % big ? 70 : 120);
    p.line(leftX, y, rightX, y);
    if ((y / GRID_UNIT) % 1 === 0) {
      p.fill(0);
      p.noStroke();
      p.textSize(12);
      p.text(y, leftX + 4, y - 4);
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
}

export function drawWorldBounds(p) {
  p.push();
  p.noFill();
  p.stroke(255, 0, 0); // bright red outline
  p.strokeWeight(10);
  p.rect(0, 0, viewport.WORLD.w, viewport.WORLD.h);
  p.pop();
}

export function drawLaneBounds(p, playW) {
  p.push();
  p.noFill();
  p.stroke(0, 180, 255); // cyan
  p.strokeWeight(3);
  p.rect(0, -10000, playW, 20000); // crazy-tall so it spans whole level
  p.pop();
}

export function drawHitboxes(p, level) {
  p.push();
  p.fill(0, 255, 255, 50);
  p.strokeWeight(6);
  p.stroke(0, 255, 255, 50);
  for (const r of level.platforms) {
    p.rect(r.x, r.y, r.w, r.hHit);
  }
  p.pop();
}
