// import { TILE_SIZE, SCALE } from '../core/config';

export const TILES = {
  tinyGrass: {
    cap: { x: 0, y: 296, w: 8, h: 8 }, // left-cap tile
    mid: { x: 8, y: 296, w: 8, h: 8 }, // middle tile
    scale: 4,
    method: 'caps',
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

  /* add more here ↓ */
  // stone:     { x: 32,  y: 296, w:16, h:16, scale: 4, method: 'repeat' },
};
