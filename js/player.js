import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";
import { moveAndCollide } from "./physics.js";

export function createPlayer(x, y, charKey){
  return {
    x, y,
    w: CONFIG.PLAYER_W,
    h: CONFIG.PLAYER_H,
    vx: 0, vy: 0,
    onGround: false,
    facing: 1,

    hp: CONFIG.START_HP,
    maxHP: CONFIG.START_HP,

    coyote: 0,
    jumpBuf: 0,

    dashUnlocked: false,
    dashTime: 0,
    dashCD: 0,

    speedMult: 1.0,

    charKey
  };
}

export function updatePlayer(p, input, solids, hazards, dt, onDamage){
  // Timers
  p.coyote = p.onGround ? CONFIG.COYOTE_TIME : Math.max(0, p.coyote - dt);
  p.jumpBuf = Math.max(0, p.jumpBuf - dt);
  p.dashCD = Math.max(0, p.dashCD - dt);
  p.dashTime = Math.max(0, p.dashTime - dt);

  const left = input.isDown("ArrowLeft") || input.isDown("KeyA");
  const right = input.isDown("ArrowRight") || input.isDown("KeyD");
  const wantJump = input.wasPressed("Space");
  const jumpUp = input.wasReleased("Space");
  const wantDash = input.wasPressed("ShiftLeft") || input.wasPressed("ShiftRight");

  if (wantJump) p.jumpBuf = CONFIG.JUMP_BUFFER;

  // Facing
  if (left) p.facing = -1;
  if (right) p.facing = 1;

  // Dash
  if (p.dashUnlocked && wantDash && p.dashCD <= 0 && p.dashTime <= 0){
    p.dashTime = CONFIG.DASH_TIME;
    p.dashCD = CONFIG.DASH_COOLDOWN;
    p.vy *= 0.15; // keep it snappy
  }

  const accel = CONFIG.MOVE_ACCEL * p.speedMult;
  const max = CONFIG.MOVE_MAX * p.speedMult;

  // Horizontal control
  if (p.dashTime > 0){
    p.vx = p.facing * CONFIG.DASH_SPEED;
  } else {
    if (left && !right) p.vx -= accel * dt;
    else if (right && !left) p.vx += accel * dt;
    else {
      // friction
      const fr = (p.onGround ? CONFIG.GROUND_FRICTION : CONFIG.AIR_FRICTION) * dt;
      if (p.vx > 0) p.vx = Math.max(0, p.vx - fr);
      else if (p.vx < 0) p.vx = Math.min(0, p.vx + fr);
    }
    p.vx = clamp(p.vx, -max, max);
  }

  // Gravity
  p.vy += CONFIG.GRAVITY * dt;

  // Jump (buffer + coyote)
  if (p.jumpBuf > 0 && (p.onGround || p.coyote > 0)){
    p.jumpBuf = 0;
    p.vy = -CONFIG.JUMP_V;
    p.onGround = false;
    p.coyote = 0;
  }

  // Variable jump height
  if (jumpUp && p.vy < 0){
    p.vy *= CONFIG.JUMP_CUT;
  }

  // Move + collide
  moveAndCollide(p, solids, dt);

  // Hazard damage
  for (const h of hazards){
    if (
      p.x < h.x + h.w &&
      p.x + p.w > h.x &&
      p.y < h.y + h.h &&
      p.y + p.h > h.y
    ){
      onDamage?.(h.damage ?? 1);
      // knockback
      p.vy = Math.min(p.vy, 240);
      p.vx += (p.x + p.w/2 < h.x + h.w/2 ? -120 : 120);
      break;
    }
  }
}
