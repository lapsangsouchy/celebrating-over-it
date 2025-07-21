import { GRAVITY, FRICTION, MIN_LEN, MAX_LEN } from '../core/config.js';
import * as viewport from '../ui/viewport.js';
import { EDGE_TOL, CLIFF_W } from '../core/config.js';
import { projectToEdge, nearestEdgePoint } from '../systems/Level.js';

const STIFFNESS = 0.25; // 0 → jelly, 1 → instant lock

/**
 * Raycast a moving circle (a→b) against an AABB expanded by radius r.
 * @param {p5.Vector} a      Start point
 * @param {p5.Vector} b      End point
 * @param {object}    rect   { x, y, w, hHit }
 * @param {number}    r      Circle radius
 * @returns {number|null}    t in [0,1] of first impact, or null if none
 */
function segmentRectTOI(a, b, rect, r) {
  // 1) expanded bounds
  const minX = rect.x - r;
  const maxX = rect.x + rect.w + r;
  const minY = rect.y - r;
  const maxY = rect.y + rect.hHit + r;

  // 2) movement vector
  const dx = b.x - a.x;
  const dy = b.y - a.y;

  let tEnter = 0;
  let tExit = 1;

  // X‐slab
  if (dx === 0) {
    if (a.x < minX || a.x > maxX) return null;
  } else {
    const tx1 = (minX - a.x) / dx;
    const tx2 = (maxX - a.x) / dx;
    const txMin = Math.min(tx1, tx2);
    const txMax = Math.max(tx1, tx2);
    tEnter = Math.max(tEnter, txMin);
    tExit = Math.min(tExit, txMax);
    if (tEnter > tExit) return null;
  }

  // Y‐slab
  if (dy === 0) {
    if (a.y < minY || a.y > maxY) return null;
  } else {
    const ty1 = (minY - a.y) / dy;
    const ty2 = (maxY - a.y) / dy;
    const tyMin = Math.min(ty1, ty2);
    const tyMax = Math.max(ty1, ty2);
    tEnter = Math.max(tEnter, tyMin);
    tExit = Math.min(tExit, tyMax);
    if (tEnter > tExit) return null;
  }

  // if the entry time is within [0,1], we hit
  return tEnter >= 0 && tEnter <= 1 ? tEnter : null;
}
export class Player {
  constructor(
    p,
    level,
    getCamY,
    getRightGutter = () => CLIFF_W,
    volumeControl,
    sounds
  ) {
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

    // Audio Properties
    this.volCtrl = volumeControl;
    this.sfx = sounds;
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
      const innerX = viewport.WORLD.w - this.getRightGutter();
      if (probe.x > innerX) {
        stop = len;
        // anchor on the wall edge
        this.anchor = this.p.createVector(innerX, probe.y);
        break;
      }
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

    // /* ----- stay perfectly still until player wiggles mouse ----- */
    // if (this.latched && this.frozen) {
    //   if (
    //     this.p.mouseX !== this.lastMouse.x ||
    //     this.p.mouseY !== this.lastMouse.y
    //   ) {
    //     this.frozen = false; // un-freeze on first movement
    //   } else {
    //     this.applyAnchorConstraint(); // keep body snapped to anchor
    //     return; // skip ALL further physics
    //   }
    // }

    this.armAngle = p.atan2(mw.y - this.pos.y, mw.x - this.pos.x);

    // ————————————— LATched MODE —————————————
    if (this.latched) {
      // 1) handle the “freeze until mouse moves” state
      if (this.frozen) {
        if (p.mouseX !== this.lastMouse.x || p.mouseY !== this.lastMouse.y) {
          this.frozen = false;
        }
        this.applyAnchorConstraint();
        return;
      }

      // 2) once unfrozen, allow rope‐length adjust on drag
      if (p.mouseIsPressed) {
        const raw = p.dist(mw.x, mw.y, this.anchor.x, this.anchor.y) - this.r;
        const targetLen = p.constrain(raw, MIN_LEN, this.maxLen);
        this.ropeLen += (targetLen - this.ropeLen) * 0.25;
      }

      // 3) enforce rope constraint every frame, then skip free physics
      this.applyAnchorConstraint();
      return;
    }

    // physics

    // physics with sub-steps to prevent tunneling
    if (this.freeze > 0) {
      this.freeze--;
    } else {
      // 1) integrate gravity & friction once
      this.vel.y += GRAVITY;
      this.vel.mult(FRICTION);

      // 2) true top-only sweep clamp
      const oldPos = this.pos.copy();
      const nextPos = this.p.createVector(
        oldPos.x + this.vel.x,
        oldPos.y + this.vel.y
      );
      const mv = p5.Vector.sub(nextPos, oldPos);

      // only if moving mostly downward
      if (mv.y > 0 && Math.abs(mv.y) > Math.abs(mv.x)) {
        const oldBottom = oldPos.y + this.r;
        const nextBottom = nextPos.y + this.r;
        const EPS = 0.01;

        for (const r of this.level.platforms) {
          // require start above and end below the platform’s top edge
          if (
            oldBottom <= r.y &&
            nextBottom >= r.y &&
            // and horizontally overlapping when you land
            nextPos.x >= r.x &&
            nextPos.x <= r.x + r.w
          ) {
            const toi = segmentRectTOI(oldPos, nextPos, r, this.r);
            if (toi !== null && toi > EPS && toi < 1) {
              // clamp at impact and stop vertical velocity
              this.pos = p5.Vector.lerp(oldPos, nextPos, toi * 0.99);
              this.vel.y = 0;
              break;
            }
          }
        }
      }

      // free‐motion micro-steps to catch thin platforms
      const maxStep = this.r * 0.5;
      const dist = this.vel.mag();
      const steps = Math.ceil(dist / maxStep) || 1;
      for (let i = 0; i < steps; i++) {
        this.pos.x += this.vel.x / steps;
        this.pos.y += this.vel.y / steps;
        this.level.platforms.forEach((r) => this.collideRect(r));
        this.constrainToLane();
      }
    }

    // finally, if we’re latched, apply the rope constraint
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

    for (const r of this.level.platforms) {
      const top = r.y - EDGE_TOL;
      const bottom = r.y + (r.hHit ?? r.h) + EDGE_TOL;
      const left = r.x - EDGE_TOL;
      const right = r.x + r.w + EDGE_TOL;

      if (tip.x >= left && tip.x <= right && tip.y >= top && tip.y <= bottom) {
        if (r.latchable === false) {
          this.sfx.stoneGrabSnd.play();
          this.sfx.stoneGrabSnd.rate(4);
          break;
        }
        /* — v4 behaviour: anchor exactly where you clicked — */
        this.latched = true;
        this.anchor = tip.copy();

        // Play Sound
        this.sfx.grassGrabSnd.play();
        this.sfx.grassGrabSnd.rate(4);

        const full = this.p.dist(tip.x, tip.y, this.pos.x, this.pos.y);
        this.ropeLen = this.p.constrain(full - this.r, MIN_LEN, MAX_LEN);
        break;
      }
    }
    if (tip.x >= viewport.WORLD.w - this.getRightGutter() - EDGE_TOL) {
      this.sfx.stoneGrabSnd.play();
      this.sfx.stoneGrabSnd.rate(4);
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
    // dynamic sub-steps
    const correction = p5.Vector.sub(targetPos, this.pos);
    const mag = correction.mag();
    if (mag > 0) {
      const maxStep = this.r * 0.5;
      const steps = Math.ceil(mag / maxStep);
      const sub = correction.copy().div(steps);
      for (let i = 0; i < steps; i++) {
        this.pos.add(sub);
        this.level.platforms.forEach((r) => this.collideRect(r));
        this.constrainToLane();
        this.collideWall();
      }
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

      if (delta.y < 0) {
        // hitting top of platform
        this.vel.y = 0;
        if (!this.latched) {
          this.vel.x *= 0.3; // slow down on landing
        }
      } else {
        //side or bottom hit
        // this.vel.add(delta);
        if (this.vel.y < 0) this.vel.y = 0;
        if (!this.latched) {
          // this.vel.add(delta);
          this.vel.x *= 0.8;
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
