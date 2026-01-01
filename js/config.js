export const CONFIG = {
  canvas: { w: 960, h: 540 },

  world: {
    floorY: 470,              // platform top for the ground
    levelMinW: 2400,
    levelGrow: 240,
    platformH: 28,

    // JUMP-DOABLE generation (this is the big fix)
    platformMinW: 160,
    platformMaxW: 260,
    gapMin: 70,
    gapMax: 150,
    stepYMax: 85,             // how much a platform can go up/down vs previous

    coinChance: 0.65,
    enemyChance: 0.45,
    spikeChance: 0.22,
  },

  physics: {
    gravity: 2100,
    maxFall: 1400,
  },

  player: {
    w: 34,
    h: 46,
    moveV: 260,
    airControl: 0.92,
    jumpV: 880,

    // feels good + makes jump not “randomly impossible”
    coyote: 0.11,
    jumpBuffer: 0.11,

    // variable jump height
    jumpCutV: 260,

    // damage i-frames after spikes/enemies
    invuln: 0.75,
  },

  throw: {
    cooldown: 0.35,
    speed: 920,
    w: 14,
    h: 8,
    life: 0.8,
  },

  spike: {
    drawW: 44,
    drawH: 44,
    // SMALLER hitbox than the sprite
    hitInsetX: 10,
    hitInsetTop: 18,
    hitInsetBottom: 8,
  },

  dev: {
    showHitboxes: false,
    fixedDt: 1 / 60,
    maxSubSteps: 4,
  },
};
