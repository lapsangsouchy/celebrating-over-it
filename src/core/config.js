/* ---------- Fail-State progression --------------------------------- */
/* Each object = one upgrade in story order. */
export const FAIL_STATES = [
  {
    // Fail-State 1 - The First Hurdle
    name: 'longArm',
    checkpointY: 0, // stand here first…
    topBoundY: -192, // …then climb above this OR
    bottomBoundY: 256, //    fall below this to trigger
    targetLen: 174, // final length
    stepLen: (174 - 120) / 3, // arm pixel increase every fall
    unlock: (player) => player.unlockLongArm(174),
    toastStep: 'ARM_STEP',
    toastUnlock: 'ARM_UNLOCK',
  },
  {
    // Fail-State 2 - Rope Swing
    name: 'swingWall',
    checkpointY: -768,
    topBoundY: -1088,
    bottomBoundY: -512,
    targetLen: 216,
    stepLen: (216 - 174) / 3,
    unlock: (player) => {
      player.unlockLongArm(216);
    },
    toastStep: 'ARM_STEP',
    toastUnlock: 'ARM_UNLOCK',
  },
  {
    // Fail-State 3 - Push Up the Wall
    name: 'wallPush',
    checkpointY: -2048,
    topBoundY: -2264,
    bottomBoundY: -1856,
    targetLen: 300,
    stepLen: (300 - 216) / 3,
    unlock: (player) => {
      player.unlockLongArm(300);
    },
    toastStep: 'ARM_STEP',
    toastUnlock: 'ARM_UNLOCK',
  },
];

export const MSG_TIME_FRAMES = 300; // 4-second toast

export const TILE_SIZE = 16; // world pixels per tile
export const SCALE = 4; // world pixels per screen pixel
export const CLIFF_W = 160; // width of the right cliff
export const GRID_UNIT = 64; // grid size for snapping
export const GRAVITY = 0.4; // gravity strength
export const FRICTION = 0.98; // friction strength
export const LIFT_SPEED = 0.05; // speed of lifting the player
export const DROP_SPEED = 0.2; // speed of dropping the player
export const SCREEN_GAP = 0.5; // gap between screens in world units
export const EDGE_TOL = 2;
export const MIN_LEN = 0; // minimum rope length
export const MAX_LEN = 120; // maximum rope length
export const GROUND_Y = 400; // y-coordinate of the ground
export const HIT_GROUND = 100; // height of the ground hitbox
