/* ui/Story.js ---------------------------------------------------- */
import { GROUND_Y, MSG_TIME_FRAMES } from '../core/config.js';

export const COPY = {
  // tutorial steps  (was TUTORIAL_STEPS in sketch.js)
  TUT: [
    (n) =>
      `${n} saw the mountain and used\n` +
      'their mouse / trackpad to reach and click + hold a surface.',
    (n) =>
      `While holding, ${n} found that\n` +
      `by dragging their mouse/trackpad they could move.`,
    (n) => `${n} started climbing!`,
  ],

  // scripted story markers  (was STORY_MARKERS)
  MARKERS: [
    { y: GROUND_Y - 80, key: 'M_START' },
    { y: -24, key: 'M_CANT' },
    { y: -512, key: 'M_PUSH' },
    { y: -1024, key: 'M_PEAK' },
  ],
  M: {
    M_START: (n) => `${n} began to get the hang of things…`,
    M_CANT: (n) => `Until there was a place ${n} couldn't reach…`,
    M_PUSH: (n) => `${n} felt like they could make it further than before.`,
    M_PEAK: (n) => `Clouds parted; the summit still loomed.`,
    END_ONE: (n) => `And after many trials,\n` + `${n} reached for the stars!`,
    END_TWO: (n) => `Even though the climb was difficult...`,
    END_THREE: (n) => `Every fall and every failure`,
    END_FOUR: (n) => `Allowed ${n} to grow\n` + 'and reach even further.',
  },

  // fail-state / power-up blurbs
  TOASTS: {
    ARM_STEP: (n) => `${n} stretched a little further…`,
    ARM_UNLOCK: (n) =>
      `${n} realized they could reach\n` + 'even further than before!',
  },
};

/* -------- a one-shot toast queue -------------------------------- */
export class Story {
  constructor(p) {
    this.p = p;
    this.txt = '';
    this.timer = 0;
  }
  queue(txt, frames = MSG_TIME_FRAMES) {
    this.txt = txt;
    this.timer = frames;
  }
  draw(player, endingTriggered) {
    if (this.timer <= 0) return; // nothing? nothing.
    const a = 255 * (this.timer / MSG_TIME_FRAMES);

    const off = player.r + 20; // little below the sprite
    this.p.push();
    this.p.imageMode(this.p.CENTER);
    this.p.textAlign(this.p.CENTER, this.p.TOP);
    this.p.textFont('monospace');
    this.p.textSize(18);
    this.p.fill(255, a);
    this.p.stroke(0, a);
    this.p.strokeWeight(4);
    if (!endingTriggered) {
      this.p.text(this.txt, this.p.width / 4, player.pos.y + off);
    } else {
      this.p.text(this.txt, player.pos.x, player.pos.y + off + 100);
    }
    this.p.pop();

    this.timer--;
  }
}
