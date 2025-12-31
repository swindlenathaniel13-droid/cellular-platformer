export const CONFIG = {
  CANVAS_W: 960,
  CANVAS_H: 540,

  // Physics tuned for “doable” jumps
  GRAVITY: 1900,
  MAX_FALL: 1600,

  PLAYER_W: 34,
  PLAYER_H: 46,
  PLAYER_SPEED: 360,     // was 320
  PLAYER_JUMP: 780,      // was 720
  COYOTE_TIME: 0.10,
  JUMP_BUFFER: 0.10,

  DASH_SPEED: 820,
  DASH_TIME: 0.12,
  DASH_COOLDOWN: 0.55,

  THROW_SPEED: 920,
  THROW_COOLDOWN: 0.40,

  ENEMY_W: 34,
  ENEMY_H: 40,
  ENEMY_SPEED: 140,
  ENEMY_CHASE_SPEED: 200,
  ENEMY_AGGRO_X: 340,
  ENEMY_DROP_X: 120,

  BOSS_SCALE: 1.65,
  BOSS_HP: 14,

  HP_START: 10,

  // Level generation
  LEVEL_W: 2800,
  FLOOR_Y: 470,

  // Keep floor gaps reasonable (Level 1 must be playable)
  PLATFORM_MIN_GAP: 60,
  PLATFORM_MAX_GAP: 130,

  SPIKES_FROM_LEVEL: 4,
  MOVING_PLAT_FROM_LEVEL: 3,
};
