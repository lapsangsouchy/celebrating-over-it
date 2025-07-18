// VolumeControl.js
export class VolumeControl {
  constructor(p, x, y, sounds = []) {
    this.p = p;
    this.x = x;
    this.y = y;
    this.size = 32; // speaker icon size
    this.sliderH = 100; // height of volume slider
    this.sliderW = 8; // width of slider track
    this.knobH = 12; // height of knob
    this.volume = 0.5;
    this.muted = false;
    this.prevVol = this.volume;
    this.sounds = sounds; // array of p5.Sound instances
    this.dragging = false; // is the slider knob being dragged?
    this.visible = false; // is the slider visible?
    this.pad = 10; // padding around expanded hit area
  }

  // basic rect hit-test
  _hit(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
  }

  draw() {
    const p = this.p;
    const mx = p.mouseX,
      my = p.mouseY;

    // speaker bounds
    const sx = this.x,
      sy = this.y,
      sw = this.size,
      sh = this.size;

    // slider bounds (under speaker, 8px gap)
    const sliderX = this.x + this.size / 2 - this.sliderW / 2;
    const sliderY = this.y + this.size + 8;
    const sliderW = this.sliderW,
      sliderH = this.sliderH;

    // expanded hit area: covers speaker + slider + padding
    const areaX = sx - this.pad;
    const areaY = sy - this.pad;
    const areaW = sw + this.pad * 2;
    const areaH = sh + 8 + sliderH + this.pad * 2;

    // determine visibility: if dragging or mouse inside expanded area
    this.visible =
      this.dragging || this._hit(mx, my, areaX, areaY, areaW, areaH);

    // ── draw speaker background ───────────────────────────────
    p.push();
    p.noStroke();
    p.fill(30, 180);
    p.rect(sx, sy, sw, sh, 4);
    p.pop();

    // ── cone pointing right ────────────────────────────────────
    const midY = sy + sh / 2;
    p.push();
    p.noStroke();
    p.fill(200);
    p.triangle(sx + sw - 6, sy + 8, sx + sw - 6, sy + 24, sx + 6, midY);
    p.pop();

    // ── waves or X ────────────────────────────────────────────
    p.push();
    if (!this.muted) {
      p.noFill();
      p.stroke(200);
      p.strokeWeight(2);
      const waves = Math.ceil(this.volume * 3);
      for (let i = 1; i <= waves; i++) {
        p.arc(sx + sw - 6 + i * 4, midY, i * 8, i * 8, -p.PI / 4, p.PI / 4);
      }
    } else {
      // small X to the right of the speaker icon
      const x0 = sx + sw + 6;
      const y0 = midY;
      const s = 4; // half-size of the small X
      p.stroke(200);
      p.strokeWeight(2);
      p.line(x0 - s, y0 - s, x0 + s, y0 + s);
      p.line(x0 - s, y0 + s, x0 + s, y0 - s);
    }
    p.pop();

    // ── draw slider if visible ────────────────────────────────
    if (this.visible) {
      // track
      p.push();
      p.noStroke();
      p.fill(50, 180);
      p.rect(sliderX, sliderY, sliderW, sliderH, 4);
      p.pop();

      // knob
      const knobY = sliderY + sliderH * (1 - this.volume) - this.knobH / 2;
      p.push();
      p.noStroke();
      p.fill(220);
      p.rect(sliderX - 2, knobY, sliderW + 4, this.knobH, 4);
      p.pop();
    }
  }

  mousePressed(mx, my) {
    const sx = this.x,
      sy = this.y,
      sw = this.size,
      sh = this.size;
    const sliderX = this.x + this.size / 2 - this.sliderW / 2;
    const sliderY = this.y + this.size + 8;

    // speaker click toggles mute
    if (this._hit(mx, my, sx, sy, sw, sh)) {
      this.muted = !this.muted;
      if (this.muted) {
        this.prevVol = this.volume;
        this.setVolume(0);
      } else {
        this.setVolume(this.prevVol);
      }
      return;
    }

    // click on slider track starts drag
    if (
      this.visible &&
      this._hit(mx, my, sliderX, sliderY, this.sliderW, this.sliderH)
    ) {
      this.dragging = true;
      this._updateVolumeFromY(my, sliderY);
    }
  }

  mouseDragged(mx, my) {
    if (this.dragging) {
      const sliderY = this.y + this.size + 8;
      this._updateVolumeFromY(my, sliderY);
    }
  }

  mouseReleased() {
    this.dragging = false;
  }

  _updateVolumeFromY(my, sliderY) {
    const p = this.p;
    const clamped = p.constrain(my, sliderY, sliderY + this.sliderH);
    this.setVolume(1 - (clamped - sliderY) / this.sliderH);
    if (this.muted && this.volume > 0) this.muted = false;
  }

  setVolume(v) {
    this.volume = this.p.constrain(v, 0, 1);
    this.sounds.forEach((snd) => snd.setVolume(this.volume));
    this.muted = this.volume === 0;
  }
}
