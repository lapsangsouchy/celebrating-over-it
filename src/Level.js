/* Level.js */

export class Level {
  constructor(p, playW, gutterX) {
    this.p = p;
    this.playW = playW;
    this.gutterX = gutterX;
    this.platforms = [];
  }

  /* ---------- helpers you already know ---------- */
  addPlatform(tempX, y, w, h = 12) {
    console.log(this.gutterX);
    let x = this.gutterX + tempX;
    this.platforms.push({ x, y, w, h });
  }

  /* addRow(y, positions [, w = 80, h = 12])
   *  positions:  array of explicit x’s   OR   integer count (even spacing)
   */
  addRow(y, positions, w = 80, h = 12) {
    if (Array.isArray(positions)) {
      positions.forEach((x) => this.addPlatform(x, y, w, h));
    } else {
      const count = positions;
      const gap = (this.playW - w) / (count - 1);
      for (let i = 0; i < count; i++) this.addPlatform(i * gap, y, w, h);
    }
  }

  draw() {
    const p = this.p;
    p.fill(120);
    p.noStroke();
    p.rectMode(p.CORNER);
    this.platforms.forEach((r) => p.rect(r.x, r.y, r.w, r.h));
  }

  /* small utility used by Player */
  pointInsideRect(pt) {
    return this.platforms.some(
      (r) => pt.x > r.x && pt.x < r.x + r.w && pt.y > r.y && pt.y < r.y + r.h
    );
  }
}
