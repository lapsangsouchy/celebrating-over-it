/* Cliff.js — stone-wall variant */

export function buildCliffStone(
  p5,
  rightGutter, // width of the gutter in world pixels
  stoneImg,
  taperImg, // 16×16 and 8×16 tiles, already in memory
  scale = 4,
  bg = '#130022' // very dark purple
) {
  const stoneW = stoneImg.width * scale; // 16→64
  const stoneH = stoneImg.height * scale;
  const taperW = taperImg.width * scale; //  8→32
  const taperH = taperImg.height * scale;

  const cliffH = 4096; // tall enough for any climb
  const g = p5.createGraphics(rightGutter, cliffH);
  g.noSmooth();
  g.background(bg); // shows through taper’s alpha

  /* 1 ▸ fill with stone except the taper column */
  const fillW = rightGutter - taperW;
  for (let y = 0; y < cliffH; y += stoneH) {
    for (let x = 0; x < fillW; x += stoneW) {
      g.image(stoneImg, x, y, stoneW, stoneH);
    }
  }

  /* 2 ▸ vertical taper strip */
  for (let y = 0; y < cliffH; y += taperH) {
    g.image(taperImg, fillW, y, taperW, taperH);
  }

  return g;
}
