import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";

export function createPlayer(charKey) {
  return {
    x: 120,
    y: 120,
    w: CONFIG.player.w,
    h: CONFIG.player.h,
    vx: 0,
    vy: 0,
    face: 1,

    charKey,
    hp: 10,
    hpMax: 10,

    coins: 0,

    onGround: false,
    hitCeil: false,

    coyote: 0,
    jumpBuf: 0,
    invuln: 0,

    throwCd: 0,
  };
}

export function applyPhysics(player, dt) {
  player.vy += CONFIG.physics.gravity * dt;
  player.vy = clamp(player.vy, -99999, CONFIG.physics.maxFall);

  player.invuln = Math.max(0, player.invuln - dt);
  player.throwCd = Math.max(0, player.throwCd - dt);

  player.coyote = Math.max(0, player.coyote - dt);
  player.jumpBuf = Math.max(0, player.jumpBuf - dt);
}

export function updatePlayer(player, input, dt) {
  const left = input.isDown("ArrowLeft") || input.isDown("KeyA");
  const right = input.isDown("ArrowRight") || input.isDown("KeyD");

  let move = 0;
  if (left) move -= 1;
  if (right) move += 1;

  if (move !== 0) player.face = move;

  const targetV = move * CONFIG.player.moveV;
  if (player.onGround) {
    player.vx = targetV;
    player.coyote = CONFIG.player.coyote;
  } else {
    player.vx = (player.vx * (1 - CONFIG.player.airControl)) + (targetV * CONFIG.player.airControl);
  }

  // Jump buffer
  if (input.consumePress("Space")) {
    player.jumpBuf = CONFIG.player.jumpBuffer;
  }

  // Execute jump if buffered + coyote available
  if (player.jumpBuf > 0 && player.coyote > 0) {
    player.vy = -CONFIG.player.jumpV;
    player.coyote = 0;
    player.jumpBuf = 0;
  }

  // Variable jump: if you release Space early, cut upward velocity
  if (input.consumeRelease("Space")) {
    if (player.vy < -CONFIG.player.jumpCutV) {
      player.vy = -CONFIG.player.jumpCutV;
    }
  }
}

export function canThrow(player) {
  return player.throwCd <= 0;
}

export function markThrew(player) {
  player.throwCd = CONFIG.throw.cooldown;
}

export function damagePlayer(player, amount) {
  if (player.invuln > 0) return false;
  player.hp = Math.max(0, player.hp - amount);
  player.invuln = CONFIG.player.invuln;
  return true;
}
