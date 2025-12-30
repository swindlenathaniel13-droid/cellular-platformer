import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";
import { moveAndCollide } from "./physics.js";
import { playSound } from "./assets.js";

export function createPlayer(charKey, spawn) {
  return {
    kind: "player",
    charKey,
    x: spawn.x,
    y: spawn.y,
    w: CONFIG.PLAYER_W,
    h: CONFIG.PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    face: 1,

    hpMax: 10,
    hp: 10,

    dashUnlocked: false,
    speedBoost: 0, // timer

    dashTime: 0,
    dashCd: 0,

    throwCd: 0,

    // jump helpers
    coyote: 0,
    jumpBuf: 0,
    jumpHeld: false,

    // cosmetic
    animStep: 0,
    hurtFlash: 0,
  };
}

export function updatePlayer(state, dt) {
  const p = state.player;
  const input = state.input;
  const world = state.world;

  // timers
  p.hurtFlash = Math.max(0, p.hurtFlash - dt);
  p.throwCd = Math.max(0, p.throwCd - dt);
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.speedBoost = Math.max(0, p.speedBoost - dt);

  // buffer jump
  if (input.isPressed("jump")) p.jumpBuf = CONFIG.JUMP_BUFFER;
  else p.jumpBuf = Math.max(0, p.jumpBuf - dt);

  // coyote time
  if (p.onGround) p.coyote = CONFIG.COYOTE_TIME;
  else p.coyote = Math.max(0, p.coyote - dt);

  const speed = (p.speedBoost > 0 ? 1.25 : 1.0) * CONFIG.PLAYER_SPEED;

  // dash
  if (p.dashTime > 0) {
    p.dashTime -= dt;
    // dash particles
    if (!state.particles) state.particles = [];
    for (let i = 0; i < 6; i++) {
      state.particles.push({
        x: p.x + p.w / 2 + (Math.random() * 12 - 6),
        y: p.y + p.h / 2 + (Math.random() * 12 - 6),
        vx: -p.face * (120 + Math.random() * 120),
        vy: (Math.random() * 80 - 40),
        life: 0.22 + Math.random() * 0.1,
      });
    }
  } else {
    // horizontal movement
    let dir = 0;
    if (input.isHeld("left")) dir -= 1;
    if (input.isHeld("right")) dir += 1;

    if (dir !== 0) p.face = dir;

    // smoothing
    const targetVx = dir * speed;
    p.vx += (targetVx - p.vx) * clamp(14 * dt, 0, 1);

    // initiate dash if unlocked
    if (p.dashUnlocked && input.isPressed("dash") && p.dashCd <= 0) {
      p.dashTime = CONFIG.DASH_TIME;
      p.dashCd = CONFIG.DASH_COOLDOWN;
      p.vx = p.face * CONFIG.DASH_SPEED;
      p.vy = 0;
    }
  }

  // jump
  const wantJump = p.jumpBuf > 0;
  if (wantJump && (p.onGround || p.coyote > 0)) {
    p.vy = -CONFIG.PLAYER_JUMP;
    p.onGround = false;
    p.coyote = 0;
    p.jumpBuf = 0;
    p.jumpHeld = true;
    playSound(state, "jump");
  }

  // variable jump height (cut jump if released early)
  if (!input.isHeld("jump") && p.jumpHeld && p.vy < 0) {
    p.vy *= CONFIG.VAR_JUMP_CUT;
    p.jumpHeld = false;
  }
  if (p.onGround) p.jumpHeld = false;

  // throw weapon (homephone projectile)
  if (input.isPressed("throw") && p.throwCd <= 0) {
    p.throwCd = CONFIG.THROW_COOLDOWN;
    if (!state.projectiles) state.projectiles = [];
    const projW = 30, projH = 30;
    state.projectiles.push({
      from: "player",
      kind: "phone",
      x: p.face > 0 ? p.x + p.w + 6 : p.x - projW - 6,
      y: p.y + p.h * 0.42,
      w: projW,
      h: projH,
      vx: p.face * CONFIG.THROW_SPEED,
      vy: -80,
      life: 1.25,
      spin: 0,
      dmg: 1,
    });
  }

  // gravity
  if (p.dashTime <= 0) {
    p.vy += CONFIG.GRAVITY * dt;
    p.vy = Math.min(p.vy, CONFIG.MAX_FALL_SPEED);
  }

  // move/collide
  moveAndCollide(p, world.solids, dt);

  // animation step
  const moving = Math.abs(p.vx) > 20;
  p.animStep += dt * (moving ? 10 : 3);

  // collect pickups (coins, dash, speed)
  for (let i = state.world.pickups.length - 1; i >= 0; i--) {
    const pu = state.world.pickups[i];
    const hit = !(
      p.x + p.w < pu.x ||
      p.x > pu.x + pu.w ||
      p.y + p.h < pu.y ||
      p.y > pu.y + pu.h
    );
    if (!hit) continue;

    if (pu.kind === "coin") {
      state.coins = (state.coins ?? 0) + 1;
      playSound(state, "coin");
    } else if (pu.kind === "dash") {
      p.dashUnlocked = true;
    } else if (pu.kind === "speed") {
      p.speedBoost = 8.0;
    }

