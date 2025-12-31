// js/config.js
// NOTE: This file MUST be valid JavaScript (not CSS). If you see anything starting with "."
// (like ".panel { ... }"), that will crash the whole game.

export const CONFIG = Object.freeze({
  // Canvas
  CANVAS_W: 960,
  CANVAS_H: 540,

  // Physics
  GRAVITY: 2400,
  MAX_FALL: 1800,

  // Player tuning
  PLAYER: {
    W: 28,
    H: 40,
    SPEED: 240,
    ACCEL: 2400,
    FRICTION: 1800,
    JUMP_VY: -720,
    COYOTE_TIME: 0.10,     // seconds
    JUMP_BUFFER: 0.10,     // seconds
    VARIABLE_JUMP_CUT: 0.45, // releasing jump early reduces upward velocity
  },

  // World generation
  WORLD: {
    PLATFORM_H: 22,
    MIN_GAP_X: 70,
    MAX_GAP_X: 150,
    MIN_STEP_Y: 30,
    MAX_STEP_Y: 120,
  },

  // Enemy tuning (baseline)
  ENEMY: {
    CONTACT_DMG: 1,
    VISION_X: 360,
    VISION_Y: 120,
  },

  // Hazard tuning
  SPIKES: {
    DMG: 2,
    KNOCKBACK_X: 260,
    KNOCKBACK_Y: -420,
    INVULN: 0.35, // seconds
  },

  // Shop limits (you can adjust later)
  SHOP: {
    MAX_HP_BUYS: 5,
  },
});

// Support both import styles:
// import { CONFIG } from "./config.js"
// import CONFIG from "./config.js"
export default CONFIG;
