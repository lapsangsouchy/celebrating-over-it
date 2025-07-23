// Background.js
export default class Background {
  /**
   * @param {number} worldH   – total vertical span of your level in px
   * @param {number} worldW   – canvas width at setup()
   * @param {p5}     p        – p5 instance (only needed if you’re using instance mode)
   */
  constructor(worldH, worldW, p = window) {
    this.worldH = worldH;
    this.worldW = worldW;
    this.p = p;

    /* --------- 1. PAINT ONE LOOPABLE GRADIENT STRIP --------- */
    const STRIP_H = 4000; // fixed, GPU-friendly
    this.sky = p.createGraphics(worldW, STRIP_H);

    for (let y = 0; y < STRIP_H; y++) {
      // mirrored 0 → 1 → 0 so top == bottom ⇒ seamless tile
      let t = y / STRIP_H;
      t = t < 0.5 ? t * 2 : (1 - t) * 2;

      const col = p.lerpColor(
        p.color('#6EC6FF'), // zenith
        p.color('#E0F7FF'), // hazy horizon
        t
      );
      this.sky.stroke(col);
      this.sky.line(0, y, worldW, y);
    }

    /* --------- 2. PROCEDURAL CLOUDS --------- */
    this.clouds = Array.from({ length: 120 }, () => ({
      x: p.random(-worldW * 0.5, worldW * 1.5),
      y: p.random(0, worldH),
      r: p.random(90, 220), // radius
      layer: p.random(0.35, 0.6), // parallax factor (lower = slower)
    }));
  }

  /** Draw at current camera origin (camX, camY) in world coordinates */
  draw(camX, camY) {
    const p = this.p;
    const PAR = 0.4;
    const imgH = this.sky.height;
    const viewH = p.height;

    // 1) Pure continuous scroll (no modulo)
    const scroll = camY * PAR;

    // 2) Figure out the very first strip’s Y
    const startY = -scroll - imgH; // shift up one strip to guarantee coverage

    // 3) Tile until you’re off the bottom
    for (let y = startY; y < viewH + imgH; y += imgH) {
      p.image(this.sky, 0, Math.round(y), this.worldW, imgH + 0.99999999);
    }

    /* ── 2.  CLOUDS ───────────────────────────────────── */
    p.push();
    p.translate(-camX, 0); // keep clouds locked in world-X
    this.clouds.forEach((cl) => {
      const yOnScreen = cl.y - camY * cl.layer;

      /* wrap both directions so there are always clouds */
      if (yOnScreen > p.height + cl.r) cl.y -= this.worldH;
      if (yOnScreen < -cl.r) cl.y += this.worldH;

      p.noStroke();
      p.fill(255, 240);
      p.ellipse(cl.x, yOnScreen, cl.r, cl.r * 0.6);
      p.ellipse(
        cl.x - cl.r * 0.4,
        yOnScreen + cl.r * 0.1,
        cl.r * 0.7,
        cl.r * 0.45
      );
      p.ellipse(
        cl.x + cl.r * 0.4,
        yOnScreen + cl.r * 0.1,
        cl.r * 0.7,
        cl.r * 0.45
      );
    });
    p.pop();
  }
}
