import { LIFT_SPEED, DROP_SPEED, SCREEN_GAP } from './constants.js';
import { WORLD } from './viewport.js';

export class Camera {
  constructor(p, player, gutterX = 0) {
    this.p = p;
    this.player = player;
    this.gutterX = gutterX; // left margin for centred lane
    this.camY = 0;
  }

  update() {
    const p = this.p;
    const midY = WORLD.h * SCREEN_GAP; // WORLD.h = 450 by default
    const playerY = this.player.pos.y - this.camY; // player in screen coords
    const desired = this.player.pos.y - midY; // camY if centred

    if (playerY < midY) {
      // above halfway → lift gently
      this.camY = p.lerp(this.camY, desired, LIFT_SPEED);
    } else if (playerY > midY) {
      // below halfway → drop faster
      this.camY = p.lerp(this.camY, desired, DROP_SPEED);
    }
  }

  /* call at top of draw(): push & translate world */
  begin() {
    this.p.push();
    this.p.translate(0, -this.camY);
  }

  /* call after world draw, before UI: pop back */
  end() {
    this.p.pop();
  }

  /* when window resizes and lane re-centers */
  setGutter(x) {
    this.gutterX = x;
  }

  /* reset on game restart */
  reset() {
    this.camY = 0;
  }
}
