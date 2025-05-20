/* Getting‑Over‑It prototype — v4 */

import { Player } from './Player.js';
import { Camera } from './Camera.js';
import { Level } from './Level.js';

import { LANE_RATIO } from './constants.js';

new p5((p) => {
  /* game objects */
  let player, camera, level;

  /*layout variables */
  let playW, gutterX;

  /* ---------- p5.js setup ---------- */
  p.setup = () => {
    p.createCanvas(p.windowWidth, p.windowHeight);
    calcLayout(); // sets playW & GUTTER_X

    level = new Level(p, playW);
    buildInitialPlatforms();

    player = new Player(
      p,
      level,
      () => camera.camY,
      () => gutterX
    );
    player.reset(playW * 0.15, level.platforms[0].y - player.r);

    camera = new Camera(p, player, gutterX);
  };

  p.draw = () => {
    p.background(220);

    camera.update();
    camera.begin();

    level.draw();
    player.update();

    player.draw();

    camera.end();

    // fall fail‑safe
    if (player.pos.y - player.r > level.platforms[0].y + level.platforms[0].h) {
      // player is below the ground
      resetGame();
    }
  };

  /* ---------- input ---------- */
  p.mousePressed = () => player.tryLatch();
  p.mouseReleased = () => player.release();
  p.keyPressed = () => {
    if (p.keyCode === p.ESCAPE) resetGame();
  };

  /* ---------- window resize ---------- */

  p.windowResized = () => {
    p.resizeCanvas(p.windowWidth, p.windowHeight);
    calcLayout();
    level.playW = playW; // update spacing helper
    camera.setGutter(gutterX); // update camera offset
  };

  /* ---------- helper functions ---------- */

  function calcLayout() {
    playW = p.floor(p.windowWidth * LANE_RATIO); // lane width
    gutterX = (p.windowWidth - playW) / 2; // gutter each side
  }

  function buildInitialPlatforms() {
    level.addPlatform(0, p.height - 100, playW, 100); // the ground
    level.addPlatform(220, 460, 80, 12);
    level.addPlatform(360, 380, 80, 12);
    level.addPlatform(480, 280, 80, 12);

    level.addRow(160, [100, 200, 300, 400, 500]); // thin stones
    level.addRow(40, [150, 350, 550]); // near the top
    level.addRow(-10, [50, 500]);
  }

  function resetGame() {
    camera.reset();
    player.reset(playW * 0.15, level.platforms[0].y - player.r);
  }

  window.p = p;
});
