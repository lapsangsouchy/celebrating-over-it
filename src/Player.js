import { GRAVITY, FRICTION, MIN_LEN, MAX_LEN } from './constants.js';

export class Player {
  constructor(p, level, getCamY, getGutter) {
    this.p = p; // store the p5 instance
    this.level = level; // need it for collisions
    this.getCamY = getCamY; // for mouse world coords
    this.getGutter = getGutter; // for mouse world coords

    this.r = 24;
    this.pos = p.createVector(0, 0); // you’ll set a real x,y outside
    this.vel = p.createVector(0, 0);

    /* grappling state */
    this.armAngle = 0;
    this.anchor = null;
    this.latched = false;
    this.ropeLen = MAX_LEN;
  }

  /* ---------- math helpers ---------- */
  armDir() {
    return this.p.createVector(
      this.p.cos(this.armAngle),
      this.p.sin(this.armAngle)
    );
  }
  armBase() {
    return this.p.createVector(
      this.pos.x + this.armDir().x * this.r,
      this.pos.y + this.armDir().y * this.r
    );
  }
  armTip() {
    if (this.latched) return this.anchor.copy();
    const mw = this.getMouseWorld();
    const dist = this.p.dist(mw.x, mw.y, this.pos.x, this.pos.y);
    const reach = this.p.constrain(dist, 0, MAX_LEN);
    return this.p.createVector(
      this.pos.x + this.armDir().x * reach,
      this.pos.y + this.armDir().y * reach
    );
  }

  /* ---------- mouse world helpers ---------- */
  getMouseWorld() {
    return this.p.createVector(
      this.p.mouseX - this.getGutter(), // we’ll pass gutterX in a sec
      this.p.mouseY + this.getCamY() // pass camera or camY too
    );
  }

  /* ---------- core loop steps ---------- */
  update() {
    const p = this.p; // one‑letter alias keeps code short
    const mw = this.getMouseWorld();

    this.armAngle = p.atan2(mw.y - this.pos.y, mw.x - this.pos.x);

    /* rope length changes while holding mouse */
    if (this.latched && p.mouseIsPressed) {
      const raw = p.dist(mw.x, mw.y, this.anchor.x, this.anchor.y) - this.r;
      const targetLen = p.constrain(raw, MIN_LEN, MAX_LEN);
      this.ropeLen += (targetLen - this.ropeLen) * 0.25; // easing
    }

    if (this.latched) this.applyAnchorConstraint();

    // physics
    this.vel.y += GRAVITY;
    this.vel.mult(FRICTION);
    this.pos.add(this.vel);

    // collisions
    this.level.platforms.forEach((r) => this.collideRect(r));
  }

  draw() {
    const p = this.p; // shorthand inside this method

    /* 1. draw rope */
    p.stroke(40);
    p.strokeWeight(6);
    const tip = this.armTip();
    const base = this.armBase();
    p.line(base.x, base.y, tip.x, tip.y);

    /* 2. draw body */
    p.noStroke();
    p.fill(100, 150, 255);
    p.circle(this.pos.x, this.pos.y, this.r * 2);
  }

  /* ---------- grappling helpers ---------- */
  tryLatch() {
    const tip = this.armTip();
    if (this.level.pointInsideRect(tip)) {
      this.latched = true;
      this.anchor = tip.copy();

      const full = this.p.dist(tip.x, tip.y, this.pos.x, this.pos.y);
      this.ropeLen = this.p.constrain(full - this.r, MIN_LEN, MAX_LEN);
    }
  }

  release() {
    this.latched = false;
    this.anchor = null;
  }

  /* ---------- rope distance‑joint ---------- */
  applyAnchorConstraint() {
    if (!this.latched || !this.anchor) return;

    const dir = this.armDir();
    const targetBase = this.p.createVector(
      this.anchor.x - dir.x * this.ropeLen,
      this.anchor.y - dir.y * this.ropeLen
    );
    const targetPos = this.p.createVector(
      targetBase.x - dir.x * this.r,
      targetBase.y - dir.y * this.r
    );
    const correction = this.p.createVector(
      targetPos.x - this.pos.x,
      targetPos.y - this.pos.y
    );

    this.pos.add(correction);
    this.vel.add(correction);
  }

  /* ---------- circle vs rect push‑out ---------- */
  collideRect(rect) {
    const p = this.p;
    const cx = p.constrain(this.pos.x, rect.x, rect.x + rect.w);
    const cy = p.constrain(this.pos.y, rect.y, rect.y + rect.h);
    const delta = p.createVector(this.pos.x - cx, this.pos.y - cy);
    const d = delta.mag();

    if (d < this.r) {
      const overlap = this.r - d;
      delta.setMag(d !== 0 ? overlap : 0); // exact corner case

      if (d == 0) delta.set(0, -overlap);
      this.pos.add(delta);
      if (!this.latched && delta.y < 0) this.vel.y = 0; // landed on top
      else this.vel.add(delta); // slide
    }
  }

  /* ---------- reset ---------- */
  reset(startX, startY) {
    this.pos.set(startX, startY);
    this.vel.set(0, 0);
    this.release();
    this.ropeLen = MAX_LEN;
  }
}
