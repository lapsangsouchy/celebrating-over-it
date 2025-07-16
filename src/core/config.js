/* ---------- Fail-State progression --------------------------------- */
/* Each object = one upgrade in story order. */
export const FAIL_STATES = [
  {
    // 0 ► Long Arm
    name: 'longArm',
    checkpointY: 0, // stand here first…
    topBoundY: -256, // …then climb above this OR
    bottomBoundY: 128, //    fall below this to trigger
    targetLen: 240, // final length
    stepLen: 40, // arm pixel increase every fall
    unlock: (player) => player.unlockLongArm(240),
    toastStep: 'ARM_STEP',
    toastUnlock: 'ARM_UNLOCK',
  },
  {
    // 1 ► Movement+Jump   (todo)
    name: 'moveBoost',
    checkpointY: -800, // placeholder numbers
    topBoundY: -1056,
    bottomBoundY: -544,
    message: (playerName) => 'TODO: you can jump farther!',
    unlock: (player) => {
      /* add later */
    },
  },
  {
    // 2 ► Attack          (todo)
    name: 'attackUpgrade',
    checkpointY: -1600,
    topBoundY: -1856,
    bottomBoundY: -1344,
    message: (playerName) => 'TODO: Alex can now smash obstacles!',
    unlock: (player) => {
      /* add later */
    },
  },
];

export const MSG_TIME_FRAMES = 600; // 4-second toast

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
