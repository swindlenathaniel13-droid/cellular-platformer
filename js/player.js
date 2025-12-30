import { CONFIG } from "./config.js";
import { clamp, moveAndCollide, aabb } from "./utils.js";

export function createPlayer(charKey, spawn, runUpgrades = {}) {
  const baseHpMax = 10;
  const hpMax = baseHpMax + (runUpgrades.hpMaxBonus || 0);

  return {
    type: "Player",
    charKey,

    x: spawn.x,
    y: spawn.y,
    w: CONFIG.PLAYER_W,
    h: CONFIG.PLAYER_H,

    vx: 0,
    vy: 0,
    face: 1,

    hpMax,
    hp: hpMax,

    dashUnlocked: !!runUpgrades.dashUnlocked,
    dashT: 0,
    dashCd: 0,

    speedBoost: runUpgrades.speedBoostSeconds || 0,

    throwCd: 0,
    throwDmgBonus: runUpgrades.throwDmgBonus || 0,

    // jump helpers
    coyote: 0,
    jumpBuf: 0,
    wasJumpHeld: false,

    // damage feedback
    iFrames: 0,
    hurtFlash: 0,
  };
}

export function updatePlayer(state, dt) {
  const p = state.player;
  const input = state.input;
  const solids = state.world.platforms;

  // timers
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.throwCd = Math.max(0, p.throwCd - dt);
  p.speedBoost = Math.max(0, p.speedBoost - dt);
  p.iFrames = Math.max(0, p.iFrames - dt);
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);

  // horizontal movement
  const speed = CONFIG.MOVE_SPEED * (p.speedBoost > 0 ? 1.18 : 1.0);
  let dir = 0;
  if (input.isHeld("left")) dir -= 1;
  if (input.isHeld("right")) dir += 1;
  if (dir !== 0) p.face = dir;

  const accel = dir * speed * 10;
  const airFactor = p.onGround ? 1 : CONFIG.AIR_CONTROL;

  p.vx += accel * dt * airFactor;

  // clamp vx
  p.vx = clamp(p.vx, -speed, speed);

  // friction
  if (p.onGround && dir === 0 && p.dashT <= 0) {
    p.vx *= Math.pow(CONFIG.FRICTION_GROUND, dt * 60);
    if (Math.abs(p.vx) < 8) p.vx = 0;
  }

  // jump buffering + coyote
  if (input.isPressed("jump")) p.jumpBuf = CONFIG.JUMP_BUFFER;
  else p.jumpBuf = Math.max(0, p.jumpBuf - dt);

  p.coyote = p.onGround ? CONFIG.COYOTE_TIME : Math.max(0, p.coyote - dt);

  // start jump
  if (p.jumpBuf > 0 && p.coyote > 0 && p.dashT <= 0) {
    p.vy = CONFIG.JUMP_VY;
    p.jumpBuf = 0;
    p.coyote = 0;
  }

  // variable jump height
  const jumpHeld = input.isHeld("jump");
  if (p.wasJumpHeld && !jumpHeld && p.vy < 0) {
    p.vy *= CONFIG.VAR_JUMP_CUT;
  }
  p.wasJumpHeld = jumpHeld;

  // dash
  if (p.dashUnlocked && input.isPressed("dash") && p.dashCd <= 0 && p.dashT <= 0) {
    p.dashT = CONFIG.DASH_TIME;
    p.dashCd = CONFIG.DASH_COOLDOWN;
    p.vy = 0;
    p.vx = p.face * CONFIG.DASH_SPEED;
  }

  if (p.dashT > 0) {
    p.dashT -= dt;
    p.vy = 0;
  } else {
    // gravity
    p.vy += CONFIG.GRAVITY * dt;
    p.vy = clamp(p.vy, -9999, CONFIG.MAX_FALL);
  }

  // move + collide
  const col = moveAndCollide(p, solids, dt);
  p.onGround = col.onGround;

  // throw (projectile)
  if (input.isPressed("throw") && p.throwCd <= 0) {
    p.throwCd = CONFIG.THROW_COOLDOWN;

    const proj = {
      type: "PlayerProj",
      x: p.x + p.w / 2 + p.face * 18,
      y: p.y + p.h * 0.45,
      w: 18,
      h: 18,
      vx: p.face * CONFIG.PROJECTILE_SPEED,
      vy: -40,
      life: 0.9,
      dmg: 1 + (p.throwDmgBonus || 0),
    };
    state.projectiles.push(proj);
  }

  // coins pickup
  for (const c of state.world.coins) {
    if (c.collected) continue;
    const coinBox = { x: c.x - c.r, y: c.y - c.r, w: c.r * 2, h: c.r * 2 };
    if (aabb(p, coinBox)) {
      c.collected = true;
      state.coins += 1;
      state.stageCoins += 1;
    }
  }
}
