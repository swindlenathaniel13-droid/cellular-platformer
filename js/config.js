// js/config.js
export const CONFIG = {
  canvas: {
    w: 960,
    h: 540
  },

  physics: {
    gravity: 2200,
    maxFall: 1600
  },

  player: {
    w: 32,
    h: 48,

    runSpeed: 260,
    accel: 2400,
    decel: 2600,

    jumpV: 860,
    coyote: 0.10,
    jumpBuffer: 0.10,
    jumpCut: 0.55,      // early release reduces upward velocity

    dashUnlocked: false,
    dashSpeed: 760,
    dashTime: 0.14,
    dashCooldown: 0.70,

    throwCooldown: 0.35,

    maxHP: 10,
    invulnTime: 0.65,
  },

  world: {
    floorY: 480,
    levelLen: 3400,

    // Keep jumps doable
    maxGap: 150,
    maxRise: 120,

    platformH: 28,

    spikeChance: 0.22,
    spikeDamage: 2,

    enemyChance: 0.45,
  },

  combat: {
    projSpeed: 620,
    projLife: 0.9,
    projDamage: 1,
    enemyTouchDamage: 1
  },

  debug: {
    showHitboxes: false
  }
};
