import { GRAVITY, FRICTION, MIN_LEN, MAX_LEN } from '../core/config.js';
import * as viewport from '../ui/viewport.js';
import { EDGE_TOL, CLIFF_W } from '../core/config.js';
import { projectToEdge, nearestEdgePoint } from '../systems/Level.js';

const STIFFNESS = 0.25; // 0 → jelly, 1 → instant lock
export class Player {
  constructor(p, level, getCamY, getRightGutter = () => CLIFF_W) {
    this.p = p; // store the p5 instance
    this.level = level; // need it for collisions
    this.getCamY = getCamY; // for mouse world coords
    this.getRightGutter = getRightGutter; // function to get right gutter width

    this.r = 24;
    this.pos = p.createVector(0, 0); // you’ll set a real x,y outside
    this.vel = p.createVector(0, 0);

    /* grappling state */
    this.armAngle = 0;
    this._candidateAnchor = null;
    this.anchor = null;
    this.latched = false;
    this.maxLen = MAX_LEN;
    this.ropeLen = this.maxLen; // adjustable based on set maxLen
    this.freeze = 0; // frames to skip physics after latch
    this.frozen = false; // true means no physics until mouse moves
    this.lastMouse = p.createVector(0, 0); // remember where freeze began

    /* upgrades */
    // this.longArmUnlocked = false; // true when player unlocks long arm
    this.armSegments = [];
    this.totalArmLen = 120; // Base of arm from beginning of game
    this.palette = [
      p.color('#ff595e'),
      p.color('#ffca3a'),
      p.color('#8ac926'),
      p.color('#1982c4'),
      p.color('#6a4c93'),
    ];
    this.nextColIdx = 0; // next color index to use

    /* face? */
    this.face = null;
  }

  /* ---------- FACE HELPER ---------- */
  setFace(img) {
    this.face = img;
  }

  /* ---------- UPGRADES / POWER-UPS ---------- */
  unlockLongArm(len) {
    // if (this.longArmUnlocked) return; // guard
    // if (len > this.maxLen) this.gainReach(len - this.maxLen);
    // this.longArmUnlocked = true;
    if (len > this.maxLen) {
      this.gainReach(len - this.maxLen);
    }
  }

  /* ---------- math helpers ---------- */
  armDir() {
    return this.p.createVector(
      this.p.cos(this.armAngle),
      this.p.sin(this.armAngle)
    );
  }
  armBase() {
    const dir = this.armDir();
    return this.p.createVector(
      this.pos.x + dir.x * this.r,
      this.pos.y + dir.y * this.r
    );
  }
  armTip() {
    if (this.latched) return this.anchor.copy();
    const mw = this.getMouseWorld();
    const dist = this.p.dist(mw.x, mw.y, this.pos.x, this.pos.y);
    const reach = this.p.constrain(dist, 0, this.maxLen);

    // step along the ray until just before we enter a platform
    const dir = this.armDir();
    const step = EDGE_TOL * 0.5; // 4-px steps = ~15 steps max
    let len = 0;
    let stop = reach;

    while (len < reach) {
      const probe = this.p.createVector(
        this.pos.x + dir.x * (len + step),
        this.pos.y + dir.y * (len + step)
      );
      if (this.level.isInsideRect(probe)) {
        stop = len; // stop at edge

        if (this.level.pointInsideRectEdge(probe)) {
          this.anchor = probe.copy();
        }
        break;
      }
      len += step;
    }

    // const finalLen = hitPos ? hitPos.dist(this.pos) : reach; // stop at edge or maxLen
    const tipPos = this.p.createVector(
      this.pos.x + dir.x * stop,
      this.pos.y + dir.y * stop
    );

    // expose both: tipPos for drawing, firstInside for latching
    this._candidateAnchor = this.anchor; // store for tryLatch()
    return tipPos;
  }

  gainReach(deltaLen) {
    // 1. Add a “ring” at the tip
    const col = this.palette[this.nextColIdx++ % this.palette.length];
    this.armSegments.unshift({ len: deltaLen, col }); // newest first

    // 2. Keep your numeric truth-source in sync
    this.totalArmLen += deltaLen;

    /* let the physics layer know */
    this.maxLen += deltaLen; // grow the legal reach
    this.ropeLen = this.p.constrain(this.ropeLen, MIN_LEN, this.maxLen);
  }

  drawArm() {
    const p = this.p;
    const tip = this.armTip();
    const base = this.armBase();
    const bodyR = this.r;

    /* 0.  hidden?  */
    const distToBody = p.dist(tip.x, tip.y, this.pos.x, this.pos.y);
    if (distToBody <= bodyR + 0.5) return; // fully retracted 🚫

    /* 1.  how much rope is outside the body?  */
    let exposed = p.dist(tip.x, tip.y, base.x, base.y); // px

    /* 2.  draw coloured rings starting at the TIP and walking toward BASE  */
    const dirInward = p5.Vector.sub(base, tip).normalize(); // tip → base

    p.strokeWeight(6);
    p.strokeCap(p.SQUARE);

    let start = tip.copy(); // begin at the fingertip
    for (const seg of this.armSegments) {
      if (exposed <= 0) break;
      const segLen = Math.min(seg.len, exposed);
      const end = p5.Vector.add(start, p5.Vector.mult(dirInward, segLen));
      p.stroke(seg.col);
      p.line(start.x, start.y, end.x, end.y);
      start = end;
      exposed -= segLen;
    }

    /* 3.  draw the plain-grey base only if some length is still un-painted  */
    if (exposed > 0) {
      const end = p5.Vector.add(start, p5.Vector.mult(dirInward, exposed));
      p.stroke(40);
      p.line(start.x, start.y, end.x, end.y);
    }

    /* 4.  always stamp a round cap at the true tip so it stays curved  */
    p.noStroke();
    p.fill(this.armSegments.length ? this.armSegments[0].col : 40);
    p.circle(tip.x, tip.y, 6);
  }

  /* ---------- mouse world helpers ---------- */
  getMouseWorld() {
    const v = viewport.screenToWorld(this.p.mouseX, this.p.mouseY);
    return this.p.createVector(
      v.x,
      v.y + this.getCamY() // pass camera or camY too
    );
  }

  /* ---------- core loop steps ---------- */
  update() {
    const p = this.p; // one‑letter alias keeps code short
    const mw = this.getMouseWorld();

    /* ----- stay perfectly still until player wiggles mouse ----- */
    if (this.latched && this.frozen) {
      if (
        this.p.mouseX !== this.lastMouse.x ||
        this.p.mouseY !== this.lastMouse.y
      ) {
        this.frozen = false; // un-freeze on first movement
      } else {
        this.applyAnchorConstraint(); // keep body snapped to anchor
        return; // skip ALL further physics
      }
    }

    this.armAngle = p.atan2(mw.y - this.pos.y, mw.x - this.pos.x);

    /* rope length changes while holding mouse */
    if (this.latched && p.mouseIsPressed) {
      const raw = p.dist(mw.x, mw.y, this.anchor.x, this.anchor.y) - this.r;
      const targetLen = p.constrain(raw, MIN_LEN, this.maxLen);
      this.ropeLen += (targetLen - this.ropeLen) * 0.25; // easing
    }

    // physics
    if (this.freeze > 0) {
      this.freeze--;
    } else {
      /* normal physics */
      this.vel.y += GRAVITY;
      this.vel.mult(FRICTION);
      this.pos.add(this.vel);
    }
    // collisions
    this.level.platforms.forEach((r) => this.collideRect(r));

    // finally, stop at the gutters
    this.constrainToLane();

    if (this.latched) this.applyAnchorConstraint();
  }

  draw() {
    const p = this.p; // shorthand inside this method

    /* 1. draw rope */
    // p.stroke(40);
    // p.strokeWeight(6);
    // const tip = this.armTip();
    // const base = this.armBase();
    // p.line(base.x, base.y, tip.x, tip.y);
    this.drawArm();

    /* 2. draw body */
    p.noStroke();
    p.fill(100, 150, 255);
    p.circle(this.pos.x, this.pos.y, this.r * 2);

    /* 3. draw face if present */
    if (this.face) {
      p.push();
      p.imageMode(p.CENTER);
      p.image(this.face, this.pos.x, this.pos.y, this.r * 2, this.r * 2);
      p.pop();
    }
  }

  /* ---------- grappling helpers ---------- */
  tryLatch() {
    let tip = this.armTip(); // calculate tip position

    /* 1. Find the FIRST rectangle that already contains the tip */
    let anchor = null;
    for (const r of this.level.platforms) {
      if (r.latchable === false) continue;
      const top = r.y - EDGE_TOL;
      const bottom = r.y + (r.hHit ?? r.h) + EDGE_TOL;
      const left = r.x - EDGE_TOL;
      const right = r.x + r.w + EDGE_TOL;

      if (tip.x >= left && tip.x <= right && tip.y >= top && tip.y <= bottom) {
        /* — v4 behaviour: anchor exactly where you clicked — */
        this.latched = true;
        this.anchor = tip.copy();

        const full = this.p.dist(tip.x, tip.y, this.pos.x, this.pos.y);
        this.ropeLen = this.p.constrain(full - this.r, MIN_LEN, MAX_LEN);
        break;
      }
    }
  }

  release() {
    this.latched = false;
    this.anchor = null;
    this.frozen = false;
  }

  /* ---------- rope distance‑joint ---------- */
  applyAnchorConstraint() {
    if (!this.latched || !this.anchor) return;

    // const toAnchor = this.p.createVector(
    //   this.anchor.x - this.pos.x,
    //   this.anchor.y - this.pos.y
    // );
    // const dist = toAnchor.mag();
    // const ideal = this.ropeLen + this.r;
    // const err = dist - ideal; // + → too far, – → too close
    // if (Math.abs(err) < 0.01) return; // already good

    // const dir = toAnchor.copy().normalize();
    // const correction = dir.copy().mult(err * STIFFNESS);

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

    // break it into mini-steps to catch collisions
    const STEPS = 5;
    const sub = p5.Vector.mult(correction, 1 / STEPS);
    for (let i = 0; i < STEPS; i++) {
      this.pos.add(sub);
      this.level.platforms.forEach((r) => this.collideRect(r));

      this.collideWall(); // prevent going into the right gutter
    }

    // remove radial velocity so you don't ping off axis

    const radialVel = this.vel.dot(dir); // projection onto rope
    this.vel.sub(dir.copy().mult(radialVel));
  }

  /* ---------- circle vs rect push‑out ---------- */
  collideRect(rect) {
    if (rect.hHit <= 0) return; // no hitbox, skip
    const p = this.p;
    const cx = p.constrain(this.pos.x, rect.x, rect.x + rect.w);
    const cy = p.constrain(this.pos.y, rect.y, rect.y + rect.hHit);
    const delta = p.createVector(this.pos.x - cx, this.pos.y - cy);
    const d = delta.mag();

    if (d < this.r) {
      const overlap = this.r - d;
      delta.setMag(d !== 0 ? overlap : 0); // exact corner case

      if (d == 0) delta.set(0, -overlap);
      this.pos.add(delta);
      //   if (!this.latched && delta.y < 0) this.vel.y = 0; // landed on top
      //   else this.vel.add(delta); // slide

      // if (!this.latched && delta.y < 0) {
      //   this.vel.y = 0; // standing on top
      //   this.vel.x *= 0.3; // slow down on landing
      // } else if (!this.latched) {
      //   this.vel.add(delta); // slide / bounce only when free
      // }
      if (delta.y < 0) {
        // hitting top of platform
        this.vel.y = 0;
        if (!this.latched) {
          this.vel.x *= 0.3; // slow down on landing
        }
      } else {
        //side of bottom hit
        if (!this.latched) {
          this.vel.add(delta);
        } else {
          // damped any residual slide when latched
          this.vel.mult(0.9);
        }
      }
    }
  }

  /* ---------- keep inside play lane ---------- */
  constrainToLane() {
    const half = this.r; // half the player
    const left = half; // left edge of player
    const right = viewport.WORLD.w - this.getRightGutter() - half; // right edge of player
    if (this.pos.x < left) {
      this.pos.x = left;
    }

    if (this.vel.x < 0) {
      this.vel.x = 0; // stop sliding
    } else if (this.pos.x > right) {
      this.pos.x = right;
      if (this.vel.x > 0) {
        this.vel.x = 0; // stop sliding
      }
    }
  }

  /**
   * Prevent the player from ever going into the right‐hand gutter wall.
   */
  collideWall() {
    // world-space X of the inner face of the wall:
    const innerX = viewport.WORLD.w - this.getRightGutter();
    const over = this.pos.x + this.r - innerX;

    if (over > 0) {
      // 1) push back out by the overlap amount
      this.pos.x -= over;

      // 2) zero out any positive x‐velocity so you don't ping off
      if (this.vel.x > 0) this.vel.x = 0;
    }
  }

  /* ---------- powerups ---------- */
  setMaxRopeLength(len) {
    this.maxLen = len;
    this.ropeLen = this.p.constrain(this.ropeLen, MIN_LEN, this.maxLen);
  }

  /* ---------- reset ---------- */
  reset(startX, startY) {
    this.pos.set(startX, startY);
    this.vel.set(0, 0);
    this.release();
    this.ropeLen = this.maxLen;
  }
}
