// Background.js
export default class Background {
  /**
   * @param {number} worldH   – total vertical span of your level in px
   * @param {number} worldW   – canvas width at setup()
   * @param {p5}     p        – p5 instance (only needed if you’re using instance mode)
   */
  constructor(worldH, worldW, p = window, teraSprites, saggiSprites) {
    this.worldH = worldH;
    this.worldW = worldW;
    this.p = p;

    // ── Animation setup ─────────────────────────
    this.teraSprites = teraSprites;
    this.saggiSprites = saggiSprites;
    this.frameWidth = 100;
    this.frameHeight = 100;
    this.totalFrames = 60;
    this.animTimer = 0; // accumulates p.deltaTime
    this.frameDuration = 100; // ms per frame

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

    // a handful of small stars scattered across the entire world
    this.spaceStars = Array.from({ length: 200 }, () => ({
      x: p.random(0, worldW),
      y: p.random(-10000, -6000),
      size: p.random(1, 3),
    }));
    // two “planets” placed in the upper half of the world
    this.planets = [
      {
        x: worldW * 0.3,
        y: -8000,
        r: 100,
        img: teraSprites,
        frameWidth: 100,
      },
      {
        x: worldW * 0.7,
        y: -7200,
        r: 40,
        img: saggiSprites,
        frameWidth: 5882 / 60,
      },
    ];

    // ── TUNE THESE TO YOUR CUTSCENE ────────────────
    // camera.camY at ~17 s of the cutscene is about –6000 px
    this.spaceFadeStartY = -6000;
    // over how many pixels to fade from sky → space
    this.spaceFadeRange = 1200;

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

    // ── Advance animation timer & pick frame ────
    this.animTimer += p.deltaTime;
    const frameIndex =
      Math.floor(this.animTimer / this.frameDuration) % this.totalFrames;

    const PAR = 0.4;
    const imgH = this.sky.height;
    const viewH = p.height;

    // 1) Pure continuous scroll (no modulo)
    const scroll = Math.abs(camY) * PAR;

    // 2) Figure out the very first strip’s Y
    const startY = -scroll - imgH; // shift up one strip to guarantee coverage

    const tRaw = (this.spaceFadeStartY - camY) / this.spaceFadeRange;
    const fade = p.constrain(tRaw, 0, 1);
    const alpha = fade * 255;
    // skyAlpha: 255→0 as fade goes 0→1
    const skyAlpha = p.constrain(255 * (1 - fade), 0, 255);

    p.push();
    p.tint(255, skyAlpha);
    for (let y = startY; y < viewH + imgH; y += imgH) {
      p.image(this.sky, 0, Math.round(y), this.worldW, imgH + 0.99999999);
    }
    p.pop();

    // ── BLACK SPACE OVERLAY ───────────────────────────────────
    if (fade > 0) {
      p.push();
      p.noStroke();
      p.fill(0, alpha);
      for (let y = -6000; y < viewH + imgH; y += imgH) {
        p.rect(0, Math.round(y), this.worldW, imgH + 0.99999999);
      }
      p.pop();
    }

    /* ── 2.  CLOUDS ───────────────────────────────────── */
    if (alpha === 0) {
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

    if (fade > 0) {
      const alpha = fade * 255;
      p.push();
      p.noStroke();

      // draw each star
      this.spaceStars.forEach((st) => {
        const sy = st.y - camY;
        if (sy < -st.size || sy > p.height + st.size) return;
        p.fill(255, alpha);
        p.circle(st.x, sy, st.size);
      });
      p.pop();

      p.push();
      p.imageMode(p.CENTER);
      // draw each planet
      this.planets.forEach((pl) => {
        const py = pl.y - camY;
        if (py < -pl.r || py > p.height + pl.r) return;

        // global frameIndex from your animTimer logic
        const idx = frameIndex;

        // source rect
        const sx = idx * pl.frameWidth;
        const sy = 0;

        // draw at pl.x, py; size = diameter = r*2
        p.image(
          pl.img,
          pl.x,
          py,
          pl.r * 2,
          pl.r * 2,
          sx,
          sy,
          this.frameWidth,
          this.frameHeight
        );
      });

      p.pop();
    }
  }
}
