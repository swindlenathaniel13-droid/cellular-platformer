export const CONFIG = {
  ASSET_BASE: "./assets/",
  CACHE_BUST: "v2025-12-31a",

  CANVAS_W: 960,
  CANVAS_H: 540,

  GRAVITY: 1900,
  MOVE_ACCEL: 5200,
  MOVE_MAX: 320,
  GROUND_FRICTION: 4200,
  AIR_FRICTION: 900,

  JUMP_V: 720,
  COYOTE_TIME: 0.10,
  JUMP_BUFFER: 0.10,
  JUMP_CUT: 0.55, // early release reduces jump height

  DASH_SPEED: 780,
  DASH_TIME: 0.14,
  DASH_COOLDOWN: 0.45,

  PLAYER_W: 26,
  PLAYER_H: 40,

  PLATFORM_H: 36,

  // Level gen safety: keep gaps reachable
  MAX_GAP: 170,       // horizontal gap between platform edges
  MAX_RISE: 110,      // max upward step between platforms
  MIN_PLATFORM_W: 160,
  MAX_PLATFORM_W: 320,

  SPIKE_W: 48,
  SPIKE_H: 32,
  SPIKE_DAMAGE: 1,

  ENEMY_W: 30,
  ENEMY_H: 30,
  ENEMY_SPEED: 120,
  ENEMY_CHASE_SPEED: 165,
  ENEMY_DETECT_X: 250,
  ENEMY_DAMAGE: 1,

  BOSS_EVERY: 5,
  BOSS_HP_BASE: 12,

  START_HP: 10,
  MAX_HP_CAP: 15
};
