// js/config.js
export const CONFIG = {
  canvas: { w: 960, h: 540 },

  camera: { lookAhead: 120, lerp: 0.14 },

  // PLAYER TUNING (jump + gap reach)
  player: {
    w: 30,
    h: 48,

    // movement
    moveSpeed: 260,
    airSpeed: 245,
    accel: 1900,
    airAccel: 1200,
    friction: 0.84,

    // physics
    gravity: 1750,
    jumpVel: -690,
    jumpCutFactor: 0.45,

    coyoteMs: 130,
    jumpBufferMs: 130,

    // stomp
    stompKill: true,
    stompBounce: -560,

    // damage i-frames
    invulnMs: 850,

    // dash
    dashUnlocked: false,
    dashSpeed: 520,
    dashMs: 115,
    dashCooldownMs: 650,
  },

  // THROW / WEAPON
  throw: {
    cooldownMs: 420,
    speed: 680,
    gravity: 720,
    spreadRad: 0.38,   // random spread
    speedJitter: 0.12, // random speed variation
    lifetimeMs: 1200,
    hitRadius: 12
  },

  // WORLD GENERATION
  world: {
    platformH: 32,
    platformWMin: 180,
    platformWMax: 320,

    // Make jumps possible:
    gapMin: 70,
    gapMax: 120,
    stepYMax: 120,

    coinsPerPlatformMin: 0,
    coinsPerPlatformMax: 3,

    spikeChance: 0.25,
    enemyChance: 0.30,

    // flow:
    checkpointEvery: 1, // each level has checkpoint
    keepCoinsAcrossLevels: true,
  },

  // ENEMIES
  enemy: {
    w: 34,
    h: 34,
    speed: 95,
    patrolMin: 130,
    patrolMax: 260,

    contactDamage: 1,

    // enemy ranged attack
    shootChancePerSecond: 0.35,
    shootRange: 320,
    shootCooldownMs: 1100,
    bulletSpeed: 360,
    bulletRadius: 10,
    bulletLifetimeMs: 1200,
    bulletDamage: 1,
  },

  // SPIKES (fix “hitbox too big”)
  spike: {
    drawW: 52,
    drawH: 30,

    // smaller hitbox than sprite:
    hitboxInsetX: 18,
    hitboxInsetY: 10,
    damage: 2
  },

  // ----- ALIASES (so older code names still work) -----
  // If any file expects jumpV / moveV / stompBounceVel, it still works.
  _aliasesApplied: true
};

// Add alias keys directly onto CONFIG.player so any naming style works.
CONFIG.player.moveV = CONFIG.player.moveSpeed;
CONFIG.player.jumpV = CONFIG.player.jumpVel;
CONFIG.player.jumpCutV = CONFIG.player.jumpVel * CONFIG.player.jumpCutFactor;
CONFIG.player.coyote = CONFIG.player.coyoteMs;
CONFIG.player.jumpBuffer = CONFIG.player.jumpBufferMs;
CONFIG.player.airControl = 1; // used by some implementations
CONFIG.player.stompBounceVel = CONFIG.player.stompBounce;
