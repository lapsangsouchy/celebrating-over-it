export const WORLD = { w: 800, h: 450 };

export let s = 1; // scale factor
export let off = { x: 0, y: 0 }; // letter-box offsets

export function update() {
  s = Math.min(p.windowWidth / WORLD.w, p.windowHeight / WORLD.h);
  off.x = 0; // world units
  off.y = (p.windowHeight / s - WORLD.h) * 0.5;
}

export function begin(p) {
  p.push();
  p.scale(s);
  p.translate(off.x, off.y);
}

export function end(p) {
  p.pop();
}

/* helper for mouse/touch → world coords (ignores Camera) */
export function screenToWorld(px, py) {
  return { x: px / s - off.x, y: py / s - off.y };
}
