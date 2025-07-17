// import { TILE_SIZE, SCALE } from '../core/config';

export const TILES = {
  tinyGrass: {
    cap: { x: 0, y: 296, w: 8, h: 8 }, // left-cap tile
    mid: { x: 8, y: 296, w: 8, h: 8 }, // middle tile
    scale: 4,
    method: 'caps',
    art: 32,
  },
  grass16: {
    tile: { x: 0, y: 296, w: 16, h: 16 }, // one tile only
    scale: 4,
    method: 'repeat',
  },
  groundFill: {
    tile: { x: 0, y: 296, w: 16, h: 16 },
    scale: 4,
    method: 'tileY',
  },

  /* ------------ stone cliff (right-side wall) ------------ */
  cliffStone: {
    stone: { x: 0, y: 328, w: 16, h: 16 }, // 16×16 repeating block
    taper: { x: 96, y: 328, w: 8, h: 16 }, // 8×16 semi-transparent edge
    scale: 4,
    method: 'cliff', // <-- new method tag
  },

  /* ---------- NEW NON-LATCHABLE STONE BLOCK ---------- */
  stoneBlock: {
    // 64 × 64 in world-space
    tile: { x: 0, y: 328, w: 16, h: 16 }, // same pixels as cliff face
    scale: 4,
    method: 'single',
    hit: 64,
    noLatch: true,
  },

  /* ---------- NEW LATCHABLE GRASSY STRIP ---------- */
  grassySurfaceL: {
    // 64 × 16 in world-space
    tile: { x: 32, y: 288, w: 4, h: 8 }, // tweak w/h if your atlas differs
    scale: 4,
    method: 'single',
    hit: 32, // same top-surface depth as other platforms
    snapW: false,
    art: 32,
  },

  grassySurfaceR: {
    tile: { x: 32, y: 288, w: 4, h: 8 },
    scale: 4,
    method: 'single',
    flipX: true,
    snapW: false,
    hit: 32,
    art: 32,
    align: 'right',
  },

  /* ---------- 32 × 16 grassy ledges (horizontal) ---------- */
  grassySurfaceT: {
    // top-left half-cell
    tile: { x: 32, y: 288, w: 4, h: 8 },
    scale: 4,
    method: 'single',
    rot90: true, // rotate 90° clockwise (so width → 32 px)
    hit: 16, // collision depth matches sprite height
    art: 16,
    snapW: false,
  },
  grassySurfaceTR: {
    // top-right
    tile: { x: 32, y: 288, w: 4, h: 8 },
    scale: 4,
    method: 'single',
    rot90: true,
    flipX: true, // mirror so grass blades face left
    hit: 16,
    art: 16,
    snapW: false,
    align: 'right', // shove into right-hand 32 px of the cell
  },
  grassySurfaceB: {
    // bottom-left
    tile: { x: 32, y: 288, w: 4, h: 8 },
    scale: 4,
    method: 'single',
    rot90: true,
    flipY: true, // blades point down
    hit: 16,
    art: 16,
    snapW: false,
  },
  grassySurfaceBR: {
    // bottom-right  ← the error case
    tile: { x: 32, y: 288, w: 4, h: 8 },
    scale: 4,
    method: 'single',
    rot90: true,
    flipX: true,
    flipY: true,
    hit: 16,
    art: 16,
    snapW: false,
    align: 'right',
  },

  /* add more here ↓ */
  // stone:     { x: 32,  y: 296, w:16, h:16, scale: 4, method: 'repeat' },
};
