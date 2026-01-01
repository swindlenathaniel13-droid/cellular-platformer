// js/config.js
export const CONFIG = {
  canvas: { w: 960, h: 540 },

  physics: {
    gravity: 1550,
    maxFall: 1500,
  },

  player: {
    w: 34,
    h: 46,

    // movement
    moveSpeed: 240,
    airSpeed: 230,
    accel: 2600,
    airAccel: 1800,
    friction: 2200,

    // jump tuning
    jumpVel: 620,          // ↑ higher jump
    stompBounceVel: 520,   // bounce after stomp

    // damage invuln time
    hurtInvuln: 0.55,
  },

  world: {
    floorY: 460,

    platformH: 28,
    platformMinW: 190,     // wider platforms
    platformMaxW: 380,

    // ✅ platforms closer
    gapMin: 70,
    gapMax: 160,

    // less vertical chaos
    stepYMax: 70,

    levelMinW: 2400,
    levelGrow: 480,

    coinChance: 0.55,
    enemyChance: 0.30,
    spikeChance: 0.22,
  },

  throw: {
    cooldown: 0.45,
    life: 1.25,

    // base throw power
    speed: 620,

    // ✅ randomization
    speedRand: 0.25,      // ±25%
    angleRand: 0.25,      // radians ~14°
    arcUp: 220,           // starts upward a bit
    gravity: 950,         // makes an arc
  },

  spike: {
    // draw size (matches your Spike.png size visually)
    drawW: 44,
    drawH: 44,

    // ✅ hitbox smaller than sprite so one spike isn’t “a truck”
    hitInsetX: 10,
    hitInsetTop: 12,
    hitInsetBottom: 10,
  },
};
