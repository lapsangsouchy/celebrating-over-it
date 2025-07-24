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
  // ── fullscreen toggle globals ────────────────────────
  let fsBtn, fsTooltip;
  const FS_BTN_SIZE = 32;
  const FS_ICON = '⛶'; // enter fullscreen
  const EXIT_FS_ICON = '🗗'; // exit fullscreen

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }

  function updateFullscreenButton() {
    // swap icon
    fsBtn.html(document.fullscreenElement ? EXIT_FS_ICON : FS_ICON);
  }
  /* ---------- States ------------------- */
  const STATE_INTRO = 'intro'; // selfie?
  const STATE_CAM = 'webcam'; // live preview & capture
  const STATE_REVIEW = 'review'; // show round selfie Yes / Retake
  const STATE_NAME = 'name'; // enter your name
  const STATE_PLAY = 'playing'; // normal gameplay

  let gameState = STATE_INTRO;

  /* ---------- User Interface Screens ------------------ */
  let ui = {
    introYes: null,
    introSkip: null,
    camCapture: null,
    reviewTxt: null,
    reviewYes: null,
    reviewRetry: null,
    namePrompt: null,
    nameInput: null,
    nameStart: null,
  };

  /* ---------- One-time tutorial ------------------------------------ */
  const TUT_KEY = 'advTutSeen'; // localStorage flag
  const TUTORIAL_STEPS = COPY.TUT;
  let tutorial = { active: false, step: 0, alpha: 255, text: '' }; // tutorial state

  /* ---------- Story Layer ----------------------------------------- */
  let story;
  let STORY_MARKERS;
  let storySeen = new Set(); // remembers which markers are done

  // transient pop-ups (fail-states, upgrades, etc.)
  let storyPopup = { txt: '', alpha: 0 }; // alpha==0 → idle

  /* game objects */
  let player, camera, level;

  let playerName = 'The Adventurer'; // default player name

  /* level layout variables */
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
  let fails = 0;
  let toastHintIndex = 0;
  let totalGameFails = 0;
  let hasCountedThisFall = false;

  // Fail Tutorials
  let failTut1, failTut2, failTut3, failTut4;
  let failTutorials = [];

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

  /* --------- Background Image Assets ----------- */
  let teraSprites;
  let saggiSprites;
  let bg;
  const WORLD_H = 4000; // however tall your climb is (px)

  /* ----------- Music ------------------ */
  let bgMusic;
  let endMusic;
  /* ----------- SFX -------------------- */
  let sfx = {
    grassGrabSnd: null,
    stoneGrabSnd: null,
    grassLandSnd: null,
    stoneLandSnd: null,
    armGrowSnd: null,
    armGrowSpecialSnd: null,
  };
  // let grassGrabSnd, stoneGrabSnd, grassLandSnd, stoneLandSnd;
  let volCtrl;

  /* --------- Ending Item ---------- */
  let itemSprite;
  let sparkles = [];

  // ── Cutscene state & config ─────────────────────
  let endingTriggered = false;
  let cutsceneX = 576;
  let cutsceneY = -3200; // starting Y of the item
  let cutsceneTimer = 0;
  let cutsceneStartMs = 0;
  let cutsceneM1,
    cutsceneM2,
    cutsceneM3,
    cutsceneM4 = false; // cutscene messages

  /* ---------- Title Font ------------ */
  let titleFont;

  /* ---------- p5.js preload ---------- */

  p.preload = () => {
    // Check if in prod or dev mode via localhost
    if (!window.location.hostname.includes('localhost')) {
      console.log('prod');
      atlas = p.loadImage('assets/tilemap.png');
      bgMusic = p.loadSound('assets/OverTheClover.m4a');
      endMusic = p.loadSound('assets/MapleSyrupFactory.mp3');

      // SFX
      sfx.grassGrabSnd = p.loadSound('assets/sfx/grassLand.ogg');
      sfx.stoneGrabSnd = p.loadSound('assets/sfx/stonesHit1.ogg');
      sfx.grassLandSnd = p.loadSound('assets/sfx/grassLand.ogg');
      sfx.stoneLandSnd = p.loadSound('assets/sfx/stoneHit5.ogg');
      sfx.armGrowSnd = p.loadSound('assets/sfx/powerUp7.ogg');
      sfx.armGrowSpecialSnd = p.loadSound('assets/sfx/powerUp9.ogg');

      itemSprite = p.loadImage('assets/asc-logo.png');
      teraSprites = p.loadImage('assets/tera.png');
      saggiSprites = p.loadImage('assets/saggi.png');

      titleFont = p.loadFont('assets/PressStart2P-Regular.ttf');

      // Fail Tutorial GIFs
      failTut1 = p.loadImage('assets/fail-tuts/FailState1Tut.gif');
      failTut2 = p.loadImage('assets/fail-tuts/FailState2Tut.gif');
      failTut3 = p.loadImage('assets/fail-tuts/FailState3Tut.gif');
      failTut4 = p.loadImage('assets/fail-tuts/FailState4Tut.gif');
      failTutorials.push(failTut1, failTut2, failTut3, failTut4);
    } else {
      console.log('local');
      atlas = p.loadImage('assets/tilemap.png');
      bgMusic = p.loadSound('assets/OverTheClover.m4a');
      endMusic = p.loadSound('assets/MapleSyrupFactory.mp3');

      // SFX
      sfx.grassGrabSnd = p.loadSound('assets/sfx/grassLand.ogg');
      sfx.stoneGrabSnd = p.loadSound('assets/sfx/stonesHit1.ogg');
      sfx.grassLandSnd = p.loadSound('assets/sfx/grassLand.ogg');
      sfx.stoneLandSnd = p.loadSound('assets/sfx/stoneHit5.ogg');
      sfx.armGrowSnd = p.loadSound('assets/sfx/powerUp7.ogg');
      sfx.armGrowSpecialSnd = p.loadSound('assets/sfx/powerUp9.ogg');

      itemSprite = p.loadImage('assets/asc-logo.png');
      teraSprites = p.loadImage('assets/tera.png');
      saggiSprites = p.loadImage('assets/saggi.png');

      titleFont = p.loadFont('assets/PressStart2P-Regular.ttf');

      // Fail Tutorial GIFs
      failTut1 = p.loadImage('assets/fail-tuts/FailState1Tut.gif');
      failTut2 = p.loadImage('assets/fail-tuts/FailState2Tut.gif');
      failTut3 = p.loadImage('assets/fail-tuts/FailState3Tut.gif');
      failTut4 = p.loadImage('assets/fail-tuts/FailState4Tut.gif');
      failTutorials.push(failTut1, failTut2, failTut3, failTut4);
    }
  };

  /* ---------- p5.js setup ---------- */
  p.setup = () => {
    p.pixelDensity(1); // if you want 1:1 pixels on Hi-DPI
    p.imageSmoothingEnabled = false; // crisp pixel-art

    let savedName = localStorage.getItem('advName');
    let savedFace = localStorage.getItem('advFace'); // Data URL
    story = new Story(p, failTutorials); // toast manager
    STORY_MARKERS = COPY.MARKERS; // height-triggered captions

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

    const renderer = p.createCanvas(p.windowWidth, p.windowHeight);

    const ctx = renderer.elt.getContext('2d', {
      willReadFrequently: true,
    });

    p.drawingContext = ctx;

    /* ----- intro buttons ---------------------------------------- */
    if (gameState === STATE_INTRO) {
      ui.introYes = p.createButton('Add my face 😊');
      ui.introSkip = p.createButton('Skip for now');

      styleBtn(ui.introYes, 0);
      styleBtn(ui.introSkip, 1); // helper for CSS ↓↓↓

      ui.introYes.mousePressed(() => {
        ui.introYes.hide();
        ui.introSkip.hide();
        startWebcam();
      });

      ui.introSkip.mousePressed(() => {
        ui.introYes.remove();
        ui.introSkip.remove();
        gotoNameScreen(); // skip to name screen
        // gameState = STATE_PLAY; // straight into the game
      });
    }

    viewport.update(); // // updates scale (s) & letterbox offset
    calcLayout(); // sets playW & gutter

    bg = new Background(
      WORLD_H,
      viewport.WORLD.w,
      p,
      teraSprites,
      saggiSprites
    );

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
      endMusic,
      sfx.grassGrabSnd,
      sfx.stoneGrabSnd,
      sfx.grassLandSnd,
      sfx.stoneLandSnd,
      sfx.armGrowSnd,
      sfx.armGrowSpecialSnd,
    ]);

    // console.log(sfx);

    volCtrl.setVolume(0.5); // default volume

    // ── Full-screen toggle ──────────────────────────────
    fsBtn = p.createButton(FS_ICON);
    fsBtn.size(FS_BTN_SIZE, FS_BTN_SIZE);
    fsBtn.style('background', 'transparent');
    fsBtn.style('border', 'none');
    fsBtn.style('font-size', '24px');
    fsBtn.style('cursor', 'pointer');
    fsBtn.style('color', '#fff');
    // bottom-right (16px margin)
    fsBtn.position(p.width - 16 - FS_BTN_SIZE, p.height - 16 - FS_BTN_SIZE);
    fsBtn.style('position', 'absolute');
    fsBtn.style('z-index', '1000'); // on top of everything

    // custom tooltip div (hidden by default)
    fsTooltip = p.createDiv('Full Screen').elt;
    Object.assign(fsTooltip.style, {
      position: 'absolute',
      background: 'rgba(0,0,0,0.7)',
      color: 'white',
      padding: '4px 8px',
      borderRadius: '4px',
      fontFamily: 'monospace',
      fontSize: '12px',
      pointerEvents: 'none',
      visibility: 'hidden',
    });
    document.body.appendChild(fsTooltip);

    // wire up click + hover
    // fsBtn.mousePressed(toggleFullscreen);
    fsBtn.elt.addEventListener('mouseover', () => {
      const label = document.fullscreenElement
        ? 'Exit Full Screen'
        : 'Full Screen';
      fsTooltip.textContent = label;
      const btnR = fsBtn.elt.getBoundingClientRect();
      // force layout so we can read its height
      fsTooltip.style.visibility = 'hidden';
      fsTooltip.style.display = 'block';
      const ttH = fsTooltip.getBoundingClientRect().height;
      fsTooltip.style.left = `${btnR.left}px`;
      fsTooltip.style.top = `${btnR.top - ttH - 4}px`;
      fsTooltip.style.display = '';
      fsTooltip.style.visibility = 'visible';
    });
    fsBtn.elt.addEventListener('mouseout', () => {
      fsTooltip.style.visibility = 'hidden';
    });

    // keep icon in sync if user presses ESC or exits with browser controls
    document.addEventListener('fullscreenchange', () => {
      updateFullscreenButton();
      // if tooltip showing, update its text too
      if (fsTooltip.style.visibility === 'visible') {
        fsTooltip.textContent = document.fullscreenElement
          ? 'Exit Full Screen'
          : 'Full Screen';
      }
    });
  };

  p.draw = () => {
    if (gameState === STATE_INTRO) {
      p.background('#130022');

      const titleSize = Math.min(p.width, p.height) * 0.08;
      const titleFloat = Math.sin(p.frameCount * 0.05) * 8;
      p.push();
      p.textFont('monospace'); // or load a pixel font in preload
      p.textAlign(p.CENTER, p.CENTER);
      p.textFont(titleFont);
      p.textSize(titleSize);
      // outline
      // p.stroke('#FFD700');
      p.strokeWeight(8);
      // fill
      p.fill('#FFFFFF');

      p.text(
        'A Game About\n' + 'Failing',
        p.width / 2,
        p.height * 0.25 + titleFloat
      );
      p.pop();

      // 3) draw your two intro buttons underneath
      return; // skip all the other states
    }

    if (gameState === STATE_CAM && camReady) {
      p.background('#130022');
      // center the live video feed with a faint circle “face window”
      p.imageMode(p.CORNER);
      p.image(cam, p.width / 2 - cam.width / 2, p.height / 2 - cam.height / 2);

      p.noFill();
      p.stroke(255);
      p.strokeWeight(2);
      p.circle(p.width / 2, p.height / 2, 128); // guide ring
      return; // skip game draw
    }

    if (gameState === STATE_REVIEW) {
      if (faceSnap) {
        p.background('#130022');
        p.imageMode(p.CENTER);
        p.image(faceSnap, p.width / 2, p.height / 2);
      }
      return; // skip gameplay
    }

    if (gameState === STATE_NAME) {
      p.background('#130022');
      p.imageMode(p.CENTER);
      if (!faceSnap) {
        // p.background('#130022');
        p.fill(100, 150, 255);
        p.circle(p.width / 2, p.height / 2, 128);
      } else {
        p.image(faceSnap, p.width / 2, p.height / 2);
      }
      return;
    }

    if (gameState === STATE_PLAY) {
      p.imageMode(p.CORNER); // reset image mode
      p.background(220);
      debugPreUpdate(p, player);

      viewport.begin(p); // scale and center

      if (!endingTriggered || cutsceneTimer < 28) {
        camera.update();
      }

      const SKY_START_Y = 700;
      if (camera.camY < SKY_START_Y) {
        bg.draw(0, camera.camY);
      }

      camera.begin(); // follow-y

      // find first tile that sits just above view
      const firstY =
        p.floor((camera.camY - viewport.WORLD.h) / cliffG.height) *
        cliffG.height;

      if (!endingTriggered) {
        const dx = player.pos.x - 576;
        const dy = player.pos.y - cutsceneY; /* = -3200 */
        const dist = Math.hypot(dx, dy);
        if (dist < player.r + 32) {
          triggerEnding();
        }
      }

      drawEndingItem();

      for (
        let y = firstY;
        y < camera.camY + viewport.WORLD.h;
        y += cliffG.height
      ) {
        if (y + cliffG.height > -3136) {
          p.image(cliffG, viewport.WORLD.w - rightGutter, y);
        }
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
      player.update(endingTriggered);

      updateTutorial(); // update tutorial state
      updateStory(); // update story markers

      const hasTargetLen = (fs) => player.maxLen >= fs.targetLen - 0.01;

      /* ---------- Fail-State progression ---------- */
      if (failIndex < FAIL_STATES.length) {
        const fs = FAIL_STATES[failIndex];

        // 1. wait until Player stands on / below the checkpoint line
        if (!checkpointHit && player.pos.y <= fs.checkpointY) {
          checkpointHit = true;
        }

        if (!checkpointHit) {
          hasCountedThisFall = false;
        } else if (player.pos.y >= fs.bottomBoundY) {
          if (!hasCountedThisFall && !player.latched) {
            console.log('Story Tutorials', story.failTutorials);
            console.log('Counted Fall?', hasCountedThisFall);
            fails++;
            console.log('Fails:', fails);
            console.log('Has Target Length?', hasTargetLen(fs));
            const newLen = Math.min(player.maxLen + fs.stepLen, fs.targetLen);
            if (newLen > player.maxLen && !player.latched) {
              player.gainReach(newLen - player.maxLen);
              sfx.armGrowSnd.play();

              story.queue(COPY.TOASTS[fs.toastStep](playerName));
              checkpointHit = false; // reset for next fail-state
            }
            // Done? lock-in full long-arm, advance to next fail-state
            if (newLen >= fs.targetLen) {
              if (!hasTargetLen(fs)) {
                player.unlockLongArm(fs.targetLen);
                sfx.armGrowSnd.play();

                story.queue(COPY.TOASTS[fs.toastUnlock](playerName));
              }

              checkpointHit = false; // reset for next fail-state
              if (fails >= 6 && fails <= 7) {
                story.queue(
                  COPY.TOASTS[fs.toastHints[toastHintIndex]](playerName)
                );
                toastHintIndex++;
              } else if (fails === 8) {
                story.queue(
                  COPY.TOASTS[fs.toastHints[toastHintIndex]](playerName)
                );
                story.showGuide(failIndex);
                toastHintIndex++;
              }
            }
            hasCountedThisFall = true;
          }
        } else if (player.pos.y <= fs.topBoundY) {
          // If player finds a way to climb above the checkpoint without long-arm
          if (player.maxLen !== fs.targetLen) {
            player.unlockLongArm(fs.targetLen);
            sfx.armGrowSpecialSnd.play();
            story.queue(COPY.TOASTS[fs.toastUnlock](playerName));
          }
          failIndex++;
          checkpointHit = false; // reset for next fail-state
          totalGameFails += fails;
          fails = 0;
          toastHintIndex = 0;
        }
      }

      /* ---------- UI toast ---------- */
      story.draw(player, endingTriggered);

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

      if (!bgMusic.isPlaying() && !endingTriggered) {
        bgMusic.setVolume(volCtrl.volume);
        bgMusic.loop(); // loop background music
      }
      volCtrl.draw();

      if (endingTriggered) {
        if (!endMusic.isPlaying()) {
          // endMusic.setVolume(volCtrl.volume);
          endMusic.play();
          endMusic.jump(40);
        }
        // computing elapsed time in seconds
        cutsceneTimer = (p.millis() - cutsceneStartMs) / 1000;

        if (cutsceneTimer < 2) {
          cutsceneY += (5 * p.deltaTime) / 1000;
        } else if (cutsceneTimer < 3) {
          cutsceneY -= (10 * p.deltaTime) / 1000;
        } else if (cutsceneTimer < 5) {
          // Move player to the center of the screen by the end of this cutsceneTimer check
          let tNorm = (cutsceneTimer - 3) / 2;
          tNorm = p.constrain(tNorm, 0, 1); // clamp to [0, 1]
          cutsceneX = p.lerp(576, viewport.WORLD.w / 2, tNorm);
          const bob = Math.sin(p.frameCount * 0.05) * 1.5;
          cutsceneY += bob;
        } else if (cutsceneTimer < 7) {
          cutsceneY += (5 * p.deltaTime) / 1000;
        } else if (cutsceneTimer < 28) {
          cutsceneY -= 5;
          if (cutsceneTimer >= 7 && !cutsceneM1) {
            story.queue(COPY.M.END_ONE(playerName));
            cutsceneM1 = true;
          }
          if (cutsceneTimer >= 12 && !cutsceneM2) {
            story.queue(COPY.M.END_TWO(playerName));
            cutsceneM2 = true;
          }
          if (cutsceneTimer >= 17 && !cutsceneM3) {
            story.queue(COPY.M.END_THREE(playerName));
            cutsceneM3 = true;
          }
          if (cutsceneTimer >= 22 && !cutsceneM4) {
            story.queue(COPY.M.END_FOUR(playerName));
            cutsceneM4 = true;
          }
        } else {
          const t = cutsceneTimer - 31;
          cutsceneY -= 20;
          if (t > 0) {
            const alpha = p.constrain((t / 2) * 255, 0, 255);
            p.push();
            p.fill(0, alpha);
            p.noStroke();
            p.rect(0, 0, p.width, p.height);
            p.pop();

            if (alpha === 255) {
              let titleAlpha = p.constrain(((t - 2) / 2) * 255, 0, 255);
              // draw title
              if (titleAlpha > 0) {
                p.push();
                p.textAlign(p.CENTER, p.CENTER);
                p.textSize(48);
                p.fill(255, titleAlpha);
                p.text('A Game About Failing', p.width / 2, p.height / 2 - 150);
                p.pop();
              }
              if (cutsceneTimer >= 35) {
                let totalFailsAlpha = p.constrain(((t - 2) / 2) * 255, 0, 255);
                if (totalFailsAlpha > 0) {
                  p.push();
                  p.textAlign(p.CENTER, p.CENTER);
                  p.textSize(20);
                  p.fill(255, totalFailsAlpha);
                  p.text(
                    `You made it to the top after ${totalGameFails} fails!\n Woohoo!!`,
                    p.width / 2,
                    p.height / 2 - 60
                  );
                  p.pop();
                }
              }

              if (cutsceneTimer >= 39) {
                if (!window.playAgainBtn) {
                  window.playAgainBtn = p.createButton('Play Again?');
                  window.playAgainBtn.position(
                    p.width / 2 - 60,
                    p.height / 2 + 20
                  );
                  window.playAgainBtn.size(120, 32);
                  window.playAgainBtn.style('font-family', 'monospace');
                  window.playAgainBtn.mousePressed(() => {
                    endMusic.stop(); // stop the music
                    // remove overlay
                    window.playAgainBtn.remove();
                    window.playAgainBtn = null;
                    // reset state
                    resetGame(); // defined lower in sketch.js
                    endingTriggered = null; // allow replay
                    cutsceneX = 576;
                    cutsceneY = -3200; // reset cutscene position
                    cutsceneTimer = 0; // reset timer
                    tutorial.active = false; // skip tutorial
                    // re-center camera, reset arm
                    camera.reset();
                  });
                }
              }
            }
          }
        }
        // console.log(cutsceneTimer);
        player.pos.set(cutsceneX, cutsceneY);
        // console.log(cutsceneTimer);
      }
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
    const v = viewport.screenToWorld(p.mouseX, p.mouseY);
    if (Debug.brush) {
      // screen → world
      const world = { x: v.x, y: v.y + camera.camY };
      // snap to grid
      world.x = Math.round(world.x / Debug.snap) * Debug.snap;
      world.y = Math.round(world.y / Debug.snap) * Debug.snap;
      brushStart = world;
      return;
    }
    if (v.x < playW + 100 && !endingTriggered) {
      player.tryLatch();
      return;
    }
    p.userStartAudio();
    volCtrl.mousePressed(p.mouseX, p.mouseY); // check volume control
    fsBtn.mousePressed(toggleFullscreen);
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
    volCtrl.mouseReleased();
    if (endingTriggered) return;

    player.release();
  };

  /* ---------- window resize ---------- */

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    viewport.update(); // update viewport
    calcLayout();
    if (gameState === STATE_PLAY) {
      bg = new Background(
        WORLD_H,
        viewport.WORLD.w,
        p,
        teraSprites,
        saggiSprites
      ); // rebuild to new width
      level.playW = playW; // update spacing helper
    }

    volCtrl.x = p.width - 16 - volCtrl.size;
    volCtrl.y = 16;

    repositionUI(); // reposition UI elements

    fsBtn.position(p.width - 16 - FS_BTN_SIZE, p.height - 16 - FS_BTN_SIZE);
  };

  function repositionUI() {
    switch (gameState) {
      case STATE_INTRO:
        if (ui.introYes) styleBtn(ui.introYes, 0);
        if (ui.introSkip) styleBtn(ui.introSkip, 1);
        break;
      case STATE_CAM:
        if (ui.camCapture) styleBtn(ui.camCapture, 4);
        break;
      case STATE_REVIEW:
        if (ui.reviewTxt)
          ui.reviewTxt.position(p.width / 2 - 90, p.height / 2 - 150);
        if (ui.reviewYes) styleBtn(ui.reviewYes, 3);
        if (ui.reviewRetry) styleBtn(ui.reviewRetry, 4);
        break;
      case STATE_NAME:
        if (ui.namePrompt)
          ui.namePrompt.position(p.width / 2 - 120, p.height / 2 - 150);
        if (ui.nameInput)
          ui.nameInput.position(p.width / 2 - 84, p.height / 2 + 150);
        if (ui.nameStart)
          ui.nameStart.position(p.width / 2 - 45, p.height / 2 + 200);
        break;
    }
  }

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
    level.addPlatform(576, -832, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(576, -800, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(512, -1024, 64, 32, 32, false, 'tinyGrass');
    level.addPlatform(384, -1152, 16, 32, 32, false, 'grassySurfaceL');

    // Fail-State #3
    level.addPlatform(320, -1344, 32, 16, 16, false, 'grassySurfaceT');
    level.addPlatform(320, -1344, 32, 16, 16, false, 'grassySurfaceTR');
    // level.addPlatform(320, -1408, 32, 16, 16, false, 'grassySurfaceTR');
    // level.addPlatform(320, -1408, 32, 16, 16, false, 'grassySurfaceT');
    level.addPlatform(576, -1408, 64, 32, 32, false, 'tinyGrass');
    // level.addPlatform(320, -1472, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(320, -1408, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(320, -1472, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(320, -1536, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -1536, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(64, -1600, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(128, -1600, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -1600, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(256, -1600, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(320, -1600, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -1600, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(448, -1568, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(448, -1600, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(64, -1616, 32, 16, 16, false, 'grassySurfaceB');
    level.addPlatform(64, -1616, 32, 16, 16, false, 'grassySurfaceBR');

    level.addPlatform(448, -1728, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(448, -1696, 16, 32, 32, false, 'grassySurfaceL');

    level.addPlatform(384, -1728, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -1792, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -1856, 64, 64, 64, false, 'stoneBlock');

    level.addPlatform(384, -2048, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -2112, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -2176, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -2240, 64, 64, 64, false, 'stoneBlock');

    level.addPlatform(384, -1984, 32, 16, 16, false, 'grassySurfaceT');

    level.addPlatform(384, -1984, 32, 16, 16, false, 'grassySurfaceTR');
    level.addPlatform(320, -1728, 16, 32, 32, false, 'grassySurfaceR');

    level.addPlatform(320, -1696, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(576, -2112, 16, 32, 32, false, 'grassySurfaceR');

    level.addPlatform(256, -2432, 64, 32, 32, false, 'tinyGrass');
    level.addPlatform(320, -2432, 64, 32, 32, false, 'tinyGrass');

    level.addPlatform(192, -2624, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -2624, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -2688, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -2688, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -2752, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -2752, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -2816, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -2816, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -2880, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -2880, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -2944, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -2944, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(256, -2592, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2944, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2880, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2816, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2752, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2688, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2624, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2656, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2720, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2784, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2848, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2912, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(320, -2592, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2656, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2720, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2784, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2848, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2912, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2624, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2688, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2752, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2816, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2880, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2944, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(192, -3008, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -3072, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -3008, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -3072, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(192, -3136, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(384, -3136, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(448, -3136, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(512, -3136, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(576, -3136, 64, 64, 64, false, 'stoneBlock');
    level.addPlatform(256, -3136, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -3072, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -3008, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -3104, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -3040, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(256, -2976, 16, 32, 32, false, 'grassySurfaceL');
    level.addPlatform(320, -3104, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -3040, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -2976, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -3136, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -3072, 16, 32, 32, false, 'grassySurfaceR');
    level.addPlatform(320, -3008, 16, 32, 32, false, 'grassySurfaceR');

    level.addPlatform(192, -3152, 32, 16, 16, false, 'grassySurfaceB');
    level.addPlatform(192, -3152, 32, 16, 16, false, 'grassySurfaceBR');
    level.addPlatform(384, -3152, 32, 16, 16, false, 'grassySurfaceBR');
    level.addPlatform(448, -3152, 32, 16, 16, false, 'grassySurfaceBR');
    level.addPlatform(512, -3152, 32, 16, 16, false, 'grassySurfaceBR');
    level.addPlatform(576, -3152, 32, 16, 16, false, 'grassySurfaceBR');
    level.addPlatform(640, -3152, 32, 16, 16, false, 'grassySurfaceBR');
    level.addPlatform(704, -3152, 32, 16, 16, false, 'grassySurfaceBR');
    level.addPlatform(384, -3152, 32, 16, 16, false, 'grassySurfaceB');
    level.addPlatform(448, -3152, 32, 16, 16, false, 'grassySurfaceB');
    level.addPlatform(512, -3152, 32, 16, 16, false, 'grassySurfaceB');
    level.addPlatform(576, -3152, 32, 16, 16, false, 'grassySurfaceB');
    level.addPlatform(640, -3152, 32, 16, 16, false, 'grassySurfaceB');
    level.addPlatform(704, -3152, 32, 16, 16, false, 'grassySurfaceB');
    level.addPlatform(768, -3152, 32, 16, 16, false, 'grassySurfaceB');
  }

  function resetGame() {
    camera.reset();
    player.reset(playW * 0.15, level.platforms[0].y - player.r);
  }

  /* ---------- Webcam Screen ---------- */
  function startWebcam() {
    p.background('#130022');
    gameState = STATE_CAM;

    if (!cam) {
      cam = p.createCapture(p.VIDEO, { flipped: true }, () => {
        camReady = true;
      });
    } else {
      cam.play();
      // camReady = true; // webcam already open
    }

    cam.hide();

    // capture button
    ui.camCapture = p.createButton('Capture');
    styleBtn(ui.camCapture, 4);
    ui.camCapture.mousePressed(() => {
      grabFace();

      cam.stop(); // stop stream
      // cam = null;
      ui.camCapture.remove();
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

    ui.reviewTxt = p.createDiv('Does this look good?');
    ui.reviewYes = p.createButton('Yes!');
    ui.reviewRetry = p.createButton('Retake it!');

    ui.reviewTxt
      .style('font-family', 'monospace', 'white')
      .style('color', 'white')
      .position(p.width / 2 - 90, p.height / 2 - 150);
    styleBtn(ui.reviewYes, 3);
    styleBtn(ui.reviewRetry, 4);

    ui.reviewYes.mousePressed(() => {
      ui.reviewYes.remove();
      ui.reviewRetry.remove();
      ui.reviewTxt.remove();
      player.setFace(faceSnap);
      if (faceSnap) {
        // const dataURL = faceSnap.canvas.toDataURL('image/png');
        // localStorage.setItem('advFace', dataURL);
      }
      cam.remove(); // stop webcam
      gotoNameScreen();
    });

    ui.reviewRetry.mousePressed(() => {
      faceSnap = null;
      camReady = false;
      cam.remove(); // stop webcam
      cam = null;
      ui.reviewYes.remove();
      ui.reviewRetry.remove();
      ui.reviewTxt.remove();
      startWebcam(); // reopen live preview
    });
  }

  /* ---  Name Screen --- */
  function gotoNameScreen() {
    gameState = STATE_NAME;

    ui.namePrompt = p.createDiv('Adventurer, what is your name?');
    ui.nameInput = p.createInput('');
    ui.nameStart = p.createButton("Let's begin!");

    ui.namePrompt
      .style('font-family', 'monospace')
      .style('color', 'white')
      .style('width', '240px')
      .position(p.width / 2 - 120, p.height / 2 - 150);
    ui.nameInput.position(p.width / 2 - 84, p.height / 2 + 150).size(160, 32);
    ui.nameStart.position(p.width / 2 - 45, p.height / 2 + 200).size(90, 32);

    ui.nameStart.mousePressed(() => {
      const name = ui.nameInput.value().trim() || 'The Adventurer';
      playerName = name;
      // localStorage.setItem('advName', name);
      ui.namePrompt.remove();
      ui.nameInput.remove();
      ui.nameStart.remove();
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
      tutorial.alpha -= 1; // fade-out
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

  /* ---------- Ending Item Helper ---------- */
  function drawEndingItem() {
    // bob up/down
    const floatAmt = endingTriggered ? 0 : Math.sin(p.frameCount * 0.05) * 8;

    p.push();
    p.imageMode(p.CENTER);
    p.translate(
      endingTriggered ? cutsceneX : 576,
      (endingTriggered ? cutsceneY : -3200) + floatAmt
    );
    p.image(itemSprite, 0, 0, 64, 64);

    // spawn a sparkle every few frames
    if (p.frameCount % 6 === 0) {
      sparkles.push({
        x: p.random(-16, 16),
        y: p.random(-16, 16),
        life: 30,
      });
    }

    // draw & age sparkles
    for (let i = sparkles.length - 1; i >= 0; i--) {
      const s = sparkles[i];
      s.life--;
      const alpha = p.map(s.life, 0, 30, 0, 255);
      const size = p.map(s.life, 0, 30, 0, 4);
      p.noStroke();
      p.fill(255, 255, 200, alpha);
      p.ellipse(s.x, s.y, size);
      if (s.life <= 0) sparkles.splice(i, 1);
    }
    p.pop();
  }

  window.p = p;

  /* ---------- debug stuff ---------- */
  p.keyPressed = (e) => {
    if (p.keyCode === p.ESCAPE) resetGame();
    handleDebugKeyPress(e, player, fails);
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
  function triggerEnding() {
    endingTriggered = true;
    cutsceneStartMs = p.millis();
    cutsceneTimer = 0;
    bgMusic.stop(); // halt the soundtrack
    player.release(); // drop any latch & disable arm
  }
});
