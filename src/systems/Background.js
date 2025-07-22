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
    const STRIP_H = 3000; // fixed, GPU-friendly
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
    const PAR = 0.4; // parallax factor for the whole sky strip
    const imgH = this.sky.height; // height of one gradient tile

    const scroll = Math.round(camY * PAR);
    const offset = ((-scroll % imgH) + imgH) % imgH;

    /* ── 1.  TILE THE GRADIENT ─────────────────────────── */
    // Find the first tile’s Y so the strip scrolls at PAR but repeats every imgH.
    let firstY = (-camY * PAR) % imgH;
    if (firstY > 0) firstY -= imgH; // shift upward so we start off-screen

    for (let y = -offset; y < p.height + imgH; y += imgH) {
      p.image(this.sky, 0, Math.round(y), this.sky.width, imgH + 1);
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
