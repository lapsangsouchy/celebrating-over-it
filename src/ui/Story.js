/* ui/Story.js ---------------------------------------------------- */
import { MSG_TIME_FRAMES, GUIDE_FADE_FRAMES } from '../core/config.js';

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
    { y: 192, key: 'M_START' },
    { y: -24, key: 'M_CANT' },
    { y: -512, key: 'M_PUSH' },
    { y: -1024, key: 'M_PEAK' },
  ],
  M: {
    M_START: (n) => `${n} began to get the hang of things…`,
    M_CANT: (n) => `Until there was a place ${n} couldn't reach…`,
    M_PUSH: (n) => `${n} kept climbing.`,
    M_PEAK: (n) =>
      `${n} was growing each time they failed,\n yet the summit still loomed.`,
    END_ONE: (n) => `And after many trials,\n` + `${n} reached for the stars!`,
    END_TWO: (n) => `Even though the climb was difficult...`,
    END_THREE: (n) => `Every fall and every failure`,
    END_FOUR: (n) => `Allowed ${n} to grow\n` + 'and reach even further.',
  },

  // fail-state / power-up blurbs
  TOASTS: {
    ARM_STEP: (n) => `${n} stretched a little further…`,
    FAIL_HINT_1: (n) => `${n} went back up yet again`,
    FAIL_HINT_2: (n) => `${n} wondered if they\n could reach the platform`,
    FAIL_HINT_3: (n) => `${n} envisioned a plan...`,
    FAIL_HINT_4: (n) => `${n} saw they couldn't swing over`,
    FAIL_HINT_5: (n) =>
      `Maybe ${n} could place themselves\n on the other side...`,
    FAIL_HINT_6: (n) => `${n} envisioned a plan...`,
    FAIL_HINT_7: (n) => `This challenge was really tough`,
    FAIL_HINT_8: (n) =>
      `Perhaps there was a better spot\n to grab with their new arm...`,
    FAIL_HINT_9: (n) => `${n} envisioned a plan...`,
    FAIL_HINT_10: (n) => `${n} failed once more\n and tried again!`,
    FAIL_HINT_11: (n) => `This challenge was hard for\n ${n} to *grasp* onto`,
    FAIL_HINT_12: (n) => `${n} envisioned a plan...`,
    ARM_UNLOCK: (n) =>
      `${n} realized they could reach\n` + 'even further than before!',
  },
};

/* -------- a one-shot toast queue -------------------------------- */
export class Story {
  constructor(p, failTutorials = []) {
    this.p = p;
    this.txt = '';
    this.timer = 0;

    // Guides
    this.failTutorials = failTutorials;
    this.guideGif = null;
    this.guideTimer = 0;
  }

  queue(txt, frames = MSG_TIME_FRAMES) {
    this.txt = txt;
    this.timer = frames;
  }

  showGuide(idx) {
    this.guideGif = this.failTutorials[idx];
    const nFrames = this.guideGif.numFrames();
    console.log(nFrames);
    this.guideTimer = GUIDE_FADE_FRAMES + nFrames + GUIDE_FADE_FRAMES;
  }

  draw(player, endingTriggered) {
    this._drawToast(player, endingTriggered);
    this._drawGuide();
  }

  _drawToast(player, endingTriggered) {
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
  _drawGuide() {
    if (this.guideTimer <= 0 || !this.guideGif) return;
    const p = this.p;
    const t = this.guideTimer;
    const nFrames = this.guideGif.numFrames();
    const total = GUIDE_FADE_FRAMES + nFrames + GUIDE_FADE_FRAMES;
    let alpha = 255;

    // fade-in
    if (t > nFrames + GUIDE_FADE_FRAMES) {
      alpha = p.map(t, total, nFrames + GUIDE_FADE_FRAMES, 0, 255);
    }
    // fade-out
    else if (t < GUIDE_FADE_FRAMES) {
      alpha = p.map(t, 0, GUIDE_FADE_FRAMES, 0, 255);
    }
    // else fully visible

    // Responsiveness and sizing
    const pctSize = 0.3; // 30% of canvas width
    const padPct = 0.02; // 2% padding
    const dispW = p.width * pctSize; // desired display width
    const scale = dispW / this.guideGif.width;
    const dispH = this.guideGif.height * scale;
    const padX = p.width * padPct;
    const padY = p.height * padPct;

    p.push();
    p.resetMatrix();
    p.tint(255, alpha);
    p.imageMode(p.CORNER);
    // place bottom-left, with 16px padding
    p.image(this.guideGif, padX, p.height - dispH - padY, dispW, dispH);
    p.pop();

    this.guideTimer--;
  }
}
