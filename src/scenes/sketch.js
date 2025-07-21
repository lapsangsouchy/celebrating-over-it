/* Getting‑Over‑It prototype — v5 */

import { Player } from '../entities/Player.js';
import { Camera } from '../systems/Camera.js';
import { Level } from '../systems/Level.js';
import { TILES } from '../entities/Tiles.js';

import {
  GROUND_Y,
  CLIFF_W,
  MSG_TIME_FRAMES,
  FAIL_STATES,
  GRID_UNIT,
} from '../core/config.js';
import { COPY, Story } from '../ui/Story.js';
import { buildCliffStone } from '../systems/Cliff.js';

import {
  Debug,
  handleDebugKeyPress,
  debugPreUpdate,
  drawGrid,
  drawWorldBounds,
  drawLaneBounds,
  drawHitboxes,
  drawArmLenHUD,
} from '../ui/Debug.js';

import { VolumeControl } from '../ui/VolumeControl.js';

import Background from '../systems/Background.js';

import * as viewport from '../ui/viewport.js';

/* ---------- Start of p5.js Implementation --------------------------- */

new p5((p) => {
  const STATE_INTRO = 'intro'; // selfie?
  const STATE_CAM = 'webcam'; // live preview & capture
  const STATE_REVIEW = 'review'; // show round selfie Yes / Retake
  const STATE_NAME = 'name'; // enter your name
  const STATE_PLAY = 'playing'; // normal gameplay

  let gameState = STATE_INTRO;

  /* ---------- One-time tutorial ------------------------------------ */
  const TUT_KEY = 'advTutSeen'; // localStorage flag
  const TUTORIAL_STEPS = COPY.TUT;
  let tutorial = { active: false, step: 0, alpha: 255, text: '' }; // tutorial state

  /* ---------- Story Layer ----------------------------------------- */
  const STORY_MARKERS = COPY.MARKERS; // height-triggered captions
  let storySeen = new Set(); // remembers which markers are done

  const story = new Story(p); // toast manager

  // transient pop-ups (fail-states, upgrades, etc.)
  let storyPopup = { txt: '', alpha: 0 }; // alpha==0 → idle
  /* game objects */
  let player, camera, level;

  let playerName = 'You'; // default player name

  /*layout variables */
  let playW;
  let rightGutter;
  let cliffG;

  /* ---------- webcam globals ---------- */
  let cam,
    camReady = false;
  let faceSnap = null; // p5.Image of final masked selfie

  /* ---------- fail globals ---------- */
  let failIndex = 0; // index in FAIL_STATES
  let checkpointHit = false; // reached that state's platform?

  /* ---------- brush globals ---------- */
  let brushStart = null; // {x,y} when you press
  const BRUSH_W = 64; // standard width
  const HIT = 32; // hHit
  const ART = 64; // hArt (64)
  let brushHalf = 0;
  let brushKinds = [];
  let brushIndex = 0; // selection index in BRUSH_KINDS
  const getBrushKind = () => brushKinds[brushIndex];
  let atlas;

  /* ---------- Cookie reset helpers ---------------------------------------- */
  let btnResetCookies = null; // DOM button handle
  const SAVE_KEYS = ['advName', 'advFace', 'advTutSeen']; // add more later

  let bg;
  const WORLD_H = 40000; // however tall your climb is (px)

  /* ----------- Music ------------------ */
  let bgMusic;
  /* ----------- SFX -------------------- */
  let sfx = {
    grassGrabSnd: null,
    stoneGrabSnd: null,
    grassLandSnd: null,
    stoneLandSnd: null,
  };
  // let grassGrabSnd, stoneGrabSnd, grassLandSnd, stoneLandSnd;
  let volCtrl;

  /* ---------- p5.js preload ---------- */

  p.preload = () => {
    atlas = p.loadImage(new URL('../assets/tilemap.png', import.meta.url).href);
    bgMusic = p.loadSound(
      new URL('../assets/OverTheClover.m4a', import.meta.url).href
    );

    // SFX
    sfx.grassGrabSnd = p.loadSound(
      new URL('../assets/sfx/grassLand.ogg', import.meta.url).href
    );
    sfx.stoneGrabSnd = p.loadSound(
      new URL('../assets/sfx/stonesHit1.ogg', import.meta.url).href
    );
    sfx.grassLandSnd = p.loadSound(
      new URL('../assets/sfx/grassLand.ogg', import.meta.url).href
    );
    sfx.stoneLandSnd = p.loadSound(
      new URL('../assets/sfx/stoneHit5.ogg', import.meta.url).href
    );
  };

  /* ---------- p5.js setup ---------- */
  p.setup = () => {
    p.pixelDensity(1); // if you want 1:1 pixels on Hi-DPI
    p.imageSmoothingEnabled = false; // crisp pixel-art

    let savedName = localStorage.getItem('advName');
    let savedFace = localStorage.getItem('advFace'); // Data URL

    if (savedName) {
      // player.setFace(p.loadImage(savedFace));
      playerName = savedName;
      if (savedFace) {
        p.loadImage(savedFace, (img) => {
          player.setFace(img);
        });
      }
      gameState = STATE_PLAY; // skip intro
    } else {
      gameState = STATE_INTRO; // start with intro
    }

    if (gameState === STATE_PLAY && !localStorage.getItem(TUT_KEY)) {
      tutorial = {
        active: true,
        step: 0,
        alpha: 255,
        text: TUTORIAL_STEPS[0](playerName),
      };
    }

    /* ---------- slice everything declared in TILES ---------- */
    Object.values(TILES).forEach((def) => {
      if (def.method === 'caps') {
        def.capImg = atlas.get(def.cap.x, def.cap.y, def.cap.w, def.cap.h);
        def.midImg = atlas.get(def.mid.x, def.mid.y, def.mid.w, def.mid.h);
      } else if (def.method === 'repeat' || def.method === 'tileY') {
        // repeat or tileY
        def.tileImg = atlas.get(def.tile.x, def.tile.y, def.tile.w, def.tile.h);
      } else if (def.method === 'single') {
        def.tileImg = atlas.get(def.tile.x, def.tile.y, def.tile.w, def.tile.h);
        // --------------------------------------------------
        // 1️⃣ 90-degree rotation (if rot90 flag present)
        // --------------------------------------------------
        if (def.rot90) {
          const w = def.tileImg.height;
          const h = def.tileImg.width;
          const g = p.createGraphics(w, h);
          g.noSmooth();
          g.push();
          g.translate(w, 0); // rotate by +90°
          g.rotate(p.HALF_PI);
          g.image(def.tileImg, 0, 0);
          g.pop();
          def.tileImg = g;
        }
        // --------------------------------------------------
        // 2️⃣ optional X or Y flip
        // --------------------------------------------------
        if (def.flipX || def.flipY) {
          const w = def.tileImg.width;
          const h = def.tileImg.height;
          const g = p.createGraphics(w, h);
          g.noSmooth();
          g.push();
          g.translate(def.flipX ? w : 0, def.flipY ? h : 0);
          g.scale(def.flipX ? -1 : 1, def.flipY ? -1 : 1);
          g.image(def.tileImg, 0, 0);
          g.pop();
          def.tileImg = g;
        }
      } else if (def.method === 'cliff') {
        // cliff
        def.stoneImg = atlas.get(
          def.stone.x,
          def.stone.y,
          def.stone.w,
          def.stone.h
        );
        def.taperImg = atlas.get(
          def.taper.x,
          def.taper.y,
          def.taper.w,
          def.taper.h
        );
      }
    });

    // Place tiles into brushKinds array
    brushKinds = Object.keys(TILES);

    p.createCanvas(p.windowWidth, p.windowHeight);

    /* ----- intro buttons ---------------------------------------- */
    if (gameState === STATE_INTRO) {
      const btnYes = p.createButton('Add my face 😊');
      const btnSkip = p.createButton('Skip for now');

      styleBtn(btnYes, 0);
      styleBtn(btnSkip, 1); // helper for CSS ↓↓↓

      btnYes.mousePressed(() => {
        btnYes.hide();
        btnSkip.hide();
        startWebcam();
      });

      btnSkip.mousePressed(() => {
        btnYes.remove();
        btnSkip.remove();
        gotoNameScreen(); // skip to name screen
        // gameState = STATE_PLAY; // straight into the game
      });
    }

    viewport.update(); // // updates scale (s) & letterbox offset
    calcLayout(); // sets playW & gutter

    bg = new Background(WORLD_H, viewport.WORLD.w, p);

    cliffG = buildCliffStone(
      p,
      CLIFF_W, // width of the right-side wall
      TILES.cliffStone.stoneImg,
      TILES.cliffStone.taperImg,
      TILES.cliffStone.scale
    );

    level = new Level(
      p,
      playW,
      TILES // pass the tile definitions
    );
    buildInitialPlatforms();

    player = new Player(
      p,
      level,
      () => camera.camY,
      () => rightGutter,
      volCtrl,
      sfx
    );
    player.reset(playW * 0.15, GROUND_Y - player.r);

    camera = new Camera(p, player);

    // Speaker icon 16px from top right gutter
    const iconX = p.width - 32 - 32;
    const iconY = 16;

    volCtrl = new VolumeControl(p, iconX, iconY, [
      bgMusic,
      sfx.grassGrabSnd,
      sfx.stoneGrabSnd,
      sfx.grassLandSnd,
      sfx.stoneLandSnd,
    ]);

    // console.log(sfx);

    volCtrl.setVolume(0.5); // default volume
  };

  p.draw = () => {
    if (gameState === STATE_INTRO || gameState === STATE_CAM) {
      p.background('#130022');
    }

    if (gameState === STATE_CAM && camReady) {
      // center the live video feed with a faint circle “face window”
      p.image(cam, p.width / 2 - 160, p.height / 2 - 120); // 320×240
      p.noFill();
      p.stroke(255);
      p.strokeWeight(2);
      p.circle(p.width / 2, p.height / 2, 128); // guide ring
      return; // skip game draw
    }

    if (gameState === STATE_REVIEW) {
      if (faceSnap) {
        p.imageMode(p.CENTER);
        p.image(faceSnap, p.width / 2, p.height / 2);
      }
      return; // skip gameplay
    }

    if (gameState === STATE_PLAY) {
      p.imageMode(p.CORNER); // reset image mode
      p.background(220);
      debugPreUpdate(p, player);

      viewport.begin(p); // scale and center

      camera.update();

      const SKY_START_Y = 400;
      if (camera.camY < SKY_START_Y) {
        bg.draw(0, camera.camY);
      }

      camera.begin(); // follow-y

      // find first tile that sits just above view
      const firstY =
        p.floor((camera.camY - viewport.WORLD.h) / cliffG.height) *
        cliffG.height;

      for (
        let y = firstY;
        y < camera.camY + viewport.WORLD.h;
        y += cliffG.height
      ) {
        p.image(cliffG, viewport.WORLD.w - rightGutter, y);
      }

      if (Debug.active && Debug.showGrid) drawGrid(p, camera);
      if (Debug.active && Debug.world.bounds) drawWorldBounds(p);
      if (Debug.active && Debug.world.lanes) drawLaneBounds(p, playW);
      if (Debug.active && Debug.showBoxes) drawHitboxes(p, level);

      /* ---------- brush preview ---------- */
      if (Debug.brush) {
        const v = viewport.screenToWorld(p.mouseX, p.mouseY);
        const k = getBrushKind();
        const w = naturalWidth(k);
        const strip = level.getStrip(k, w);
        const ghost = { x: v.x, y: v.y + camera.camY };
        // snap to grid
        ghost.x = Math.round(ghost.x / Debug.snap) * Debug.snap;
        ghost.y = Math.round(ghost.y / Debug.snap) * Debug.snap;

        if (brushHalf && strip.height < GRID_UNIT)
          ghost.y += GRID_UNIT - strip.height;
        // sprite for the current brush kind
        function naturalWidth(kind) {
          const t = TILES[kind];
          if (!t) return 0;

          if (t.method === 'single') {
            const baseW = t.rot90 ? t.tile.h : t.tile.w;
            return baseW * (t.scale ?? 4);
          }
          return BRUSH_W;
        }
        // const strip = level.getStrip(getBrushKind(), BRUSH_W);

        if (TILES[k].align === 'right') ghost.x += GRID_UNIT - strip.width;

        p.push();
        p.tint(255, 160); // 60 % alpha so it looks ghosty
        p.image(strip, ghost.x, ghost.y);
        p.pop();
      }

      level.draw();
      player.update();

      updateTutorial(); // update tutorial state
      updateStory(); // update story markers

      const hasTargetLen = (fs) => player.maxLen >= fs.targetLen - 0.01;

      /* ---------- Fail-State progression ---------- */
      if (failIndex < FAIL_STATES.length) {
        const fs = FAIL_STATES[failIndex];

        // 1. wait until Alex stands on / below the checkpoint line
        if (!checkpointHit && player.pos.y <= fs.checkpointY) {
          checkpointHit = true;
        }

        if (!checkpointHit) {
        } else if (player.pos.y >= fs.bottomBoundY) {
          const newLen = Math.min(player.maxLen + fs.stepLen, fs.targetLen);
          if (newLen > player.maxLen) {
            player.gainReach(newLen - player.maxLen);
            story.queue(COPY.TOASTS[fs.toastStep](playerName));
            checkpointHit = false; // reset for next fail-state
          }
          // Done? lock-in full long-arm, advance to next fail-state
          if (newLen >= fs.targetLen) {
            if (hasTargetLen(fs)) {
              failIndex++; // player earned this earlier; skip it
              checkpointHit = false;
              return;
            }
            player.unlockLongArm(fs.targetLen);
            story.queue(COPY.TOASTS[fs.toastUnlock](playerName));
            failIndex++;
            checkpointHit = false; // reset for next fail-state
          }
        } else if (player.pos.y <= fs.topBoundY) {
          // If player finds a way to climb above the checkpoint without long-arm
          if (player.maxLen !== fs.targetLen) {
            player.unlockLongArm(fs.targetLen);
            story.queue(COPY.TOASTS[fs.toastUnlock](playerName));
            failIndex++;
            checkpointHit = false; // reset for next fail-state
          }
        }
      }

      /* ---------- UI toast ---------- */
      story.draw(player);

      player.draw();

      drawTutorial(); // show tutorial text
      drawStory(); // show story popups

      camera.end();
      viewport.end(p); // pop

      drawArmLenHUD(p, player, camera); // show arm length HUD

      const worldRightScreenX = viewport.WORLD.w * viewport.s;
      if (p.width > worldRightScreenX) {
        p.noStroke();
        p.fill('#130022'); // same dark purple
        p.rect(worldRightScreenX, 0, p.width - worldRightScreenX, p.height);
      }
      debugOverlay(); // show / hide the Reset-Cookies button

      if (!bgMusic.isPlaying()) {
        bgMusic.setVolume(volCtrl.volume);
        bgMusic.loop(); // loop background music
      }
      volCtrl.draw();
    }
  };

  /* ---------- Debug UI overlay ------------------------------------ */
  function debugOverlay() {
    if (Debug.active) {
      // create once
      if (!btnResetCookies) {
        btnResetCookies = p.createButton('⚠︎ Reset Cookies');
        btnResetCookies.position(12, 10); // fixed-pixel HUD position
        btnResetCookies.style('font-family', 'monospace');
        btnResetCookies.mousePressed(() => {
          SAVE_KEYS.forEach((k) => localStorage.removeItem(k));
          console.log('Local storage cleared — reloading…');
          window.location.reload(); // hard reset
        });
      }
    } else if (btnResetCookies) {
      // tidy up when Debug toggles off
      btnResetCookies.remove();
      btnResetCookies = null;
    }
  }

  /* ---------- input/handlers ---------- */
  p.mousePressed = () => {
    if (Debug.brush) {
      // screen → world
      const v = viewport.screenToWorld(p.mouseX, p.mouseY);
      const world = { x: v.x, y: v.y + camera.camY };
      // snap to grid
      world.x = Math.round(world.x / Debug.snap) * Debug.snap;
      world.y = Math.round(world.y / Debug.snap) * Debug.snap;
      brushStart = world;
      return;
    }
    player.tryLatch();
    p.userStartAudio();
    volCtrl.mousePressed(p.mouseX, p.mouseY); // check volume control
  };

  p.mouseDragged = () => {
    volCtrl.mouseDragged(p.mouseX, p.mouseY); // check volume control
  };

  p.mouseReleased = () => {
    if (Debug.brush && brushStart) {
      const laneX = brushStart.x; // convert to lane coord
      let yTop = brushStart.y;
      const kind = getBrushKind();
      const spec = TILES[kind] ?? {};

      let wPix;
      if (spec.method === 'single') {
        const baseW = spec.rot90 ? spec.tile.h : spec.tile.w;
        wPix = baseW * (spec.scale ?? 4);
      } else {
        wPix = BRUSH_W;
      }
      // const wPix =
      //   spec.method === 'single' ? baseW * (spec.scale ?? 4) : BRUSH_W;
      const hit = 'hit' in spec ? spec.hit : HIT; // If hit is 0 it's not latchable

      let hArt = 64;
      if ('art' in spec) hArt = spec.art;
      else if (spec.tile) hArt = spec.tile.h * (spec.scale ?? 4);
      if (brushHalf && hArt < GRID_UNIT) yTop += GRID_UNIT - hArt;
      level.addPlatform(laneX, yTop, wPix, hit, ART, false, kind);
      const code = `level.addPlatform(${laneX}, ${yTop}, ${wPix}, ${hit}, ${hArt}, false, '${kind}');`;
      console.log(code); // ← copy-paste this

      brushStart = null;
      return;
    }
    player.release();
    volCtrl.mouseReleased();
  };

  /* ---------- window resize ---------- */

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    viewport.update(); // update viewport
    calcLayout();
    bg = new Background(WORLD_H, viewport.WORLD.w, p); // rebuild to new width
    level.playW = playW; // update spacing helper

    volCtrl.x = p.width - 16 - volCtrl.size;
    volCtrl.y = 16;
  };

  /* ---------- helper functions ---------- */

  function calcLayout() {
    // playW = viewport.WORLD.w - CLIFF_W; // play area width
    rightGutter = CLIFF_W; // right side wall
    // rightGutter = Math.round(CLIFF_W / viewport.s / GRID_UNIT) * GRID_UNIT; // right side wall
    playW = viewport.WORLD.w - rightGutter; // play area width
  }

  function buildInitialPlatforms() {
    level.addPlatform(0, GROUND_Y, playW, 100, level.tileH, true, 'grass16'); // the ground
    level.addPlatform(
      0,
      GROUND_Y, // one strip below grass
      playW,
      0, // hHit 0 → never collides
      4096, // absurd height; we’ll cut it off-screen
      false,
      'groundFill'
    );

    level.addPlatform(512, 256, 64, 32, 32, false, 'tinyGrass');
    level.addPlatform(448, 128, 64, 32, 64, false, 'tinyGrass');
    level.addPlatform(448, 0, 64, 32, 64, false, 'tinyGrass');
    level.addPlatform(256, -128, 64, 32, 32, false, 'tinyGrass');
    level.addPlatform(448, -192, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(576, -320, 64, 32, 32, false, 'tinyGrass');
    level.addPlatform(384, -448, 64, 32, 32, false, 'tinyGrass');
    level.addPlatform(320, -448, 64, 32, 32, false, 'tinyGrass');
    level.addPlatform(192, -576, 64, 32, 64, false, 'tinyGrass');
    level.addPlatform(128, -768, 64, 32, 32, false, 'tinyGrass');

    // Stone Wall with grass patches 1
    level.addPlatform(320, -960, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(320, -1024, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(320, -1088, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(320, -1152, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(320, -896, 32, 16, 16, false, 'grassySurfaceT');
    level.addPlatform(320, -896, 32, 16, 16, false, 'grassySurfaceTR');
    level.addPlatform(576, -768, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(512, -1024, 64, 32, 32, false, 'tinyGrass');
    level.addPlatform(384, -1152, 16, 32, 32, false, 'grassySurfaceL');

    // Stone Separator -> onto fail state #2
    level.addPlatform(192, -1152, 64, 32, 64, false, 'tinyGrass');

    level.addPlatform(0, -1344, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(0, -1408, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(0, -1472, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(0, -1536, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(0, -1600, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(0, -1664, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(0, -1728, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(0, -1792, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -1344, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -1408, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -1472, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -1536, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -1600, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -1664, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -1728, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -1792, 64, 64, 64, false, 'stoneBlock');

    level.addPlatform(128, -1312, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1344, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1376, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1408, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1440, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1472, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1504, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1536, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1568, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1600, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1632, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1664, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1696, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1728, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1760, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(128, -1792, 16, 32, 32, false, 'grassySurfaceR');

    level.addPlatform(64, -1312, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1344, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1376, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1408, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1440, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1472, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1504, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1536, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1568, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1600, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1632, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1664, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1696, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1728, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1760, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1792, 16, 32, 32, false, 'grassySurfaceL');

    level.addPlatform(576, -2000, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(512, -2000, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(448, -2000, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -2000, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(320, -2000, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(256, -2000, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -2000, 64, 64, 64, false, 'stoneBlock');
  }

  function resetGame() {
    camera.reset();
    player.reset(playW * 0.15, level.platforms[0].y - player.r);
  }

  /* ---------- Webcam Screen ---------- */
  function startWebcam() {
    gameState = STATE_CAM;

    cam = p.createCapture(p.VIDEO, () => {
      camReady = true;
    });
    cam.size(320, 240);
    cam.hide();

    // capture button
    const btnShot = p.createButton('Capture');
    styleBtn(btnShot, 4);
    btnShot.mousePressed(() => {
      grabFace();

      cam.remove(); // stop stream
      btnShot.remove();
      showReviewScreen();
    });
  }

  function grabFace() {
    const srcSide = 128;
    const sx = (cam.width - srcSide) / 2; // top-left corner of crop
    const sy = (cam.height - srcSide) / 2;

    /* 1 ▸ copy the centred square region of the live feed */
    const square = cam.get(sx, sy, srcSide, srcSide); // p5.Image

    /* 3 ▸ apply a circular mask so corners become transparent */
    const mask = p.createGraphics(srcSide, srcSide);
    mask.noStroke();
    mask.fill(255);
    mask.circle(srcSide / 2, srcSide / 2, srcSide);

    square.mask(mask); // punch the circle

    /* 4 ▸ hand it to the player */
    faceSnap = square; // put the image in global scope
  }

  /* ---  Review Screen --- */

  function showReviewScreen() {
    gameState = STATE_REVIEW;

    const txt = p.createDiv('Does this look good?');
    const okBtn = p.createButton('Yes!');
    const noBtn = p.createButton("Let's try that again");

    txt
      .style('font-family', 'monospace', 'white')
      .style('color', 'white')
      .position(p.width / 2 - 90, p.height / 2 - 150);
    styleBtn(okBtn, 3);
    styleBtn(noBtn, 4);

    okBtn.mousePressed(() => {
      okBtn.remove();
      noBtn.remove();
      txt.remove();
      player.setFace(faceSnap);
      if (faceSnap) {
        // const dataURL = faceSnap.canvas.toDataURL('image/png');
        // localStorage.setItem('advFace', dataURL);
      }
      gotoNameScreen();
    });

    noBtn.mousePressed(() => {
      okBtn.remove();
      noBtn.remove();
      txt.remove();
      startWebcam(); // reopen live preview
    });
  }

  /* ---  Name Screen --- */
  function gotoNameScreen() {
    gameState = STATE_NAME;

    const prompt = p.createDiv('Adventurer, what is your name?');
    const input = p.createInput('');
    const ok = p.createButton('Start!');

    prompt
      .style('font-family', 'monospace')
      .style('color', 'white')
      .position(p.width / 2 - 120, p.height / 2 - 150);
    input.position(p.width / 2 - 80, p.height / 2 + 150).size(160, 32);
    ok.position(p.width / 2 - 30, p.height / 2 + 200);

    ok.mousePressed(() => {
      const name = input.value().trim() || 'you';
      playerName = name;
      // localStorage.setItem('advName', name);
      prompt.remove();
      input.remove();
      ok.remove();
      p.imageMode(p.CORNER); // reset image mode

      /* ---------- Tutorial start ---------- */
      const seenTut = localStorage.getItem(TUT_KEY);
      if (!seenTut) {
        tutorial.active = true; // start the tutorial
        tutorial.step = 0;
        tutorial.text = TUTORIAL_STEPS[tutorial.step](playerName);
        tutorial.alpha = 255; // fade in
      }

      /* ---------- start the game! ---------- */
      gameState = STATE_PLAY;
    });
  }

  /* simple inline styling */
  function styleBtn(b, row = 0) {
    const x = p.width / 2 - 80;
    const y = p.height / 2 + row * 40; // 40 px
    b.position(x, y);
    b.size(160, 32);
    b.style('font-family', 'monospace');
  }

  /* ---------- tutorial functions ---------- */
  function updateTutorial() {
    if (!tutorial.active) return;

    // STEP-0 ▸ wait for the first successful latch
    if (tutorial.step === 0 && player.latched) {
      tutorial.step = 1;
      tutorial.text = TUTORIAL_STEPS[1](playerName);
      tutorial.alpha = 255;
    }
    // STEP-1 ▸ wait for the first release
    else if (tutorial.step === 1 && !player.latched && !p.mouseIsPressed) {
      tutorial.step = 2;
      tutorial.text = TUTORIAL_STEPS[2](playerName);
      tutorial.alpha = 255;
    }
    // STEP-2 ▸ fade out, then finish
    else if (tutorial.step === 2) {
      tutorial.alpha -= 0.5; // fade-out
      if (tutorial.alpha <= 0) {
        tutorial.active = false;
        // localStorage.setItem(TUT_KEY, '1'); // never show again
      }
    }
  }

  function drawTutorial() {
    if (!tutorial.active) return;
    p.push();
    p.textAlign(p.CENTER, p.TOP);
    p.textFont('monospace');
    p.textSize(18);
    p.fill(255, tutorial.alpha);
    p.stroke(0, tutorial.alpha);
    p.strokeWeight(4);
    // keep it near the player so it scrolls with the camera
    p.text(tutorial.text, viewport.WORLD.w / 2, player.pos.y - player.r - 60);
    p.pop();
  }

  /* ---------- story functions ---------- */
  function updateStory() {
    // skip story if tutorial already seen
    // if (!localStorage.getItem(TUT_KEY)) return;

    // HEIGHT-TRIGGERED CAPTIONS ──────────────────────────────────
    for (const m of STORY_MARKERS) {
      if (!storySeen.has(m) && player.pos.y <= m.y) {
        story.queue(COPY.M[m.key](playerName)); // one-shot toast
        storySeen.add(m);
        break; // one at a time
      }
    }

    // FADE-OUT for the active popup
    if (storyPopup.alpha > 0) {
      storyPopup.alpha -= 1; // ≈ 85 frames →  ~1.4 s
    }
  }

  function drawStory() {
    if (storyPopup.alpha <= 0) return;

    const txtOffset = player.r + 40; // a bit under the player
    p.push();
    p.textAlign(p.CENTER, p.TOP);
    p.textFont('monospace');
    p.textSize(18);
    p.fill(255, storyPopup.alpha);
    p.stroke(0, storyPopup.alpha);
    p.strokeWeight(4);
    p.text(
      storyPopup.txt,
      p.width / 3, // roughly lane-centre
      player.pos.y + txtOffset
    ); // world coords → scrolls w/ cam
    p.pop();
  }

  window.p = p;

  /* ---------- debug stuff ---------- */
  p.keyPressed = (e) => {
    if (p.keyCode === p.ESCAPE) resetGame();
    handleDebugKeyPress(e, player);
    // --- cycle brush kinds with [ and ] ---------------------------------
    if (Debug.active && Debug.brush && brushKinds.length) {
      if (e.key === ']') {
        brushIndex = (brushIndex + 1) % brushKinds.length; // next kind
        console.log('Brush →', getBrushKind());
      } else if (e.key === '[') {
        brushIndex = (brushIndex - 1 + brushKinds.length) % brushKinds.length; // prev kind
        console.log('Brush ←', getBrushKind());
      }
      if (e.key === 'v') {
        brushHalf ^= 1;
        console.log('Brush half:', brushHalf ? 'BOTTOM' : 'TOP');
      }
      if (e.key === 'x') {
        // NEW ⇆ toggle
        const cur = getBrushKind();
        const other = cur.endsWith('R') ? cur.slice(0, -1) : cur + 'R';
        const idx = brushKinds.indexOf(other);
        if (idx !== -1) {
          brushIndex = idx; // swap brush
          console.log('Brush side →', other);
        }
      }
    }
  };
});
