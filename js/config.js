export const CONFIG = {
  CANVAS_W: 1400,
  CANVAS_H: 720,

  GRAVITY: 2200,
  MAX_FALL: 1400,

  PLAYER_W: 44,
  PLAYER_H: 62,

  MOVE_SPEED: 300,
  AIR_CONTROL: 0.85,
  FRICTION_GROUND: 0.82,

  JUMP_VY: -820,
  COYOTE_TIME: 0.10,
  JUMP_BUFFER: 0.10,
  VAR_JUMP_CUT: 0.45, // when letting go early

  DASH_SPEED: 760,
  DASH_TIME: 0.12,
  DASH_COOLDOWN: 0.70,

  THROW_COOLDOWN: 0.35,
  PROJECTILE_SPEED: 760,

  BASE_GROUND_Y: 610,

  LEVEL_LENGTH: 3600,
  NEXT_STAGE_LOAD_SECONDS: 2.2,

  // Generation tuning (safe defaults so it’s always beatable)
  PATH_STEP_X_MIN: 170,
  PATH_STEP_X_MAX: 260,
  PATH_Y_LEVELS: [610, 520, 440, 360], // allowed platform tops
};
