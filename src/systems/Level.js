import { EDGE_TOL, GRID_UNIT } from '../core/config.js';

const snap = (v) => Math.round(v / GRID_UNIT) * GRID_UNIT;

export class Level {
  constructor(p, playW, tiles) {
    this.p = p;
    this.playW = playW;
    this.platforms = [];
    this.tiles = tiles;
    this.cache = new Map(); // cache width and graphics buffer
  }

  /* ---------- Platform Creators ---------- */
  addPlatform(
    laneX,
    yTop,
    w,
    hHit = 12,
    hArt = this.tileH,
    isGround = false,
    kind
  ) {
    // this.platforms.push({ x, y: yTop, w, hHit, hArt, isGround, kind });
    const x = snap(laneX); // lane coord → world coord
    w = snap(w); // width locked to grid
    yTop = snap(yTop); // (optional – keeps rows tidy)
    this.platforms.push({ x, y: yTop, w, hHit, hArt, isGround, kind });
  }

  addRow(y, positions, w, hHit, hArt) {
    if (Array.isArray(positions)) {
      positions.forEach((x) => this.addPlatform(x, y, w, hHit, hArt));
    } else {
      const count = positions;
      const gap = (this.playW - w) / (count - 1);
      for (let i = 0; i < count; i++)
        this.addPlatform(i * gap, y, w, hHit, hArt);
    }
  }

  /* ---------- Create with Tile ---------- */
  getStrip(kind, w) {
    const spec = this.tiles[kind]; // ← pull once
    if (!spec) return defaultStrip(this.p, w); // fallback

    const { scale = 4 } = spec;
    const key = `${kind}|${w}`;

    if (this.cache[key]) return this.cache[key];

    switch (spec.method) {
      case 'caps':
        this.cache[key] = buildCaps(this.p, spec.capImg, spec.midImg, w, scale);
        break;
      case 'repeat':
        this.cache[key] = buildRepeatingStrip(this.p, spec.tileImg, w, scale);
        break;
      case 'tileY':
        this.cache[key] = buildTilingArea(
          this.p,
          spec.tileImg,
          this.playW,
          4096,
          scale
        );
        break;
      default:
        this.cache[key] = defaultStrip(this.p, w);
    }
    return this.cache[key];
  }

  draw() {
    for (const r of this.platforms) {
      const strip = this.getStrip(r.kind, r.w, r.hArt);
      // align sprite so grass sits ON TOP of the collision rect
      this.p.image(strip, r.x, r.y);
    }
  }

  /* small utility used by Player */
  isInsideRect(pt) {
    return this.platforms.some(
      (r) =>
        pt.x >= r.x && pt.x <= r.x + r.w && pt.y >= r.y && pt.y <= r.y + r.hHit
    );
  }

  pointInsideRectEdge(pt) {
    return this.platforms.some((r) => {
      const onTop =
        pt.x >= r.x &&
        pt.x <= r.x + r.w &&
        pt.y >= r.y &&
        pt.y <= r.y + EDGE_TOL;

      const onLeft =
        pt.y >= r.y &&
        pt.y <= r.y + r.hHit &&
        pt.x >= r.x - EDGE_TOL &&
        pt.x <= r.x;

      const onRight =
        pt.y >= r.y &&
        pt.y <= r.y + r.hHit &&
        pt.x >= r.x + r.w &&
        pt.x <= r.x + r.w + EDGE_TOL;

      return onTop || onLeft || onRight;
    });
  }
}

/**
 * buildGrassStrip(width, scale = 4)
 * Returns a p5.Graphics strip that is:
 *   [capL] [mid × N] [capR-mirror]
 * scaled to (8 × scale) pixels tall.
 */
function buildCaps(p, capImg, midImg, widthPx, scale = 4) {
  const tileW = capImg.width * scale;
  const tileH = capImg.height * scale;

  if (widthPx < tileW * 2) widthPx = tileW * 2;

  const g = p.createGraphics(widthPx, tileH);
  g.noSmooth();

  /* left cap */
  g.image(capImg, 0, 0, tileW, tileH);

  /* middle repeats */
  for (let x = tileW; x <= widthPx - tileW * 2; x += tileW)
    g.image(midImg, x, 0, tileW, tileH);

  /* right cap (mirror) */
  g.push();
  g.translate(widthPx, 0);
  g.scale(-1, 1);
  g.image(capImg, 0, 0, tileW, tileH);
  g.pop();

  return g;
}

function buildRepeatingStrip(p, tile, widthPx, scale = 4) {
  const tileW = tile.width * scale;
  const tileH = tile.height * scale;

  const g = p.createGraphics(widthPx, tileH);
  g.noSmooth();
  // for (let x = 0; x < widthPx; x += tileW) g.image(tile, x, 0, tileW, tileH);
  for (let x = 0; x < widthPx; x += tileW) {
    const drawW = Math.min(tileW, widthPx - x); // last sliver?
    g.image(
      tile,
      x,
      0,
      100,
      tileH,
      0,
      0,
      tile.width * (drawW / tileW),
      tile.height
    );
  }
  return g;
}

/**
 * buildTilingArea – fill a w×h buffer with one tile, scaled N×, repeating in X & Y.
 */
function buildTilingArea(p, tile, w, h, scale = 4) {
  const TW = tile.width * scale;
  const TH = tile.height * scale;

  const g = p.createGraphics(w, h);
  g.noSmooth();
  for (let y = 0; y < h; y += TH)
    for (let x = 0; x < w; x += TW) g.image(tile, x, y, TW, TH);

  return g;
}

function defaultStrip(p, widthPx, heightPx = 24, colour = '#666') {
  const g = p.createGraphics(widthPx, heightPx);
  g.noSmooth();
  g.background(colour);
  return g;
}

/* ------------------------------------------------------------------
   Return the nearest point ON the rectangle’s edge, or null if the
   point is outside the rect entirely.
------------------------------------------------------------------- */
export function nearestEdgePoint(pt, rect) {
  // Support either {h} or {hHit}
  const top = rect.y;
  const bottom = rect.y + (rect.hHit ?? rect.h);
  const left = rect.x;
  const right = rect.x + rect.w;

  // Inclusive check so points exactly on the edge still count
  if (pt.x < left || pt.x > right || pt.y < top || pt.y > bottom) return null;

  // Distances to each edge
  const dxL = pt.x - left;
  const dxR = right - pt.x;
  const dyT = pt.y - top;
  const dyB = bottom - pt.y;

  const min = Math.min(dxL, dxR, dyT, dyB);

  if (min === dxL) return { x: left, y: pt.y }; // left edge
  if (min === dxR) return { x: right, y: pt.y }; // right edge
  if (min === dyT) return { x: pt.x, y: top }; // top edge
  return { x: pt.x, y: bottom }; // bottom edge
}

/* --------------------------------------------------------------
   Given a point KNOWN to be inside rect, return the closest
   point ON THE EDGE of that rect (left/right/top/bottom).
---------------------------------------------------------------- */
export function projectToEdge(pt, rect) {
  const top = rect.y;
  const bottom = rect.y + (rect.hHit ?? rect.h);
  const left = rect.x;
  const right = rect.x + rect.w;

  const dxL = pt.x - left;
  const dxR = right - pt.x;
  const dyT = pt.y - top;
  const dyB = bottom - pt.y;

  const min = Math.min(dxL, dxR, dyT, dyB);

  switch (min) {
    case dxL:
      return { x: left, y: pt.y }; // left edge
    case dxR:
      return { x: right, y: pt.y }; // right edge
    case dyT:
      return { x: pt.x, y: top }; // top edge
    default:
      return { x: pt.x, y: bottom }; // bottom edge
  }
}
