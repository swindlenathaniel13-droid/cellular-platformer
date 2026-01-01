// js/player.js
import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";
import { anyDown, anyPressed, anyReleased, KEYS } from "./input.js";

export function createPlayer(x, y, charKey){
  return {
    x, y,
    w: CONFIG.player.w,
    h: CONFIG.player.h,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,

    hp: CONFIG.player.maxHP,
    maxHP: CONFIG.player.maxHP,
    inv: 0,

    coyote: 0,
    jumpBuf: 0,

    dashUnlocked: CONFIG.player.dashUnlocked,
    dashT: 0,
    dashCd: 0,

    throwCd: 0,
    projectiles: [],

    charKey
  };
}

export function snapshotRunState(player, coinsTotal){
  return {
    coinsTotal,
    maxHP: player.maxHP,
    dashUnlocked: player.dashUnlocked
  };
}

export function restoreRunState(player, snap){
  player.maxHP = snap.maxHP;
  player.dashUnlocked = snap.dashUnlocked;
  player.hp = player.maxHP;
}

export function updatePlayer(player, input, dt){
  // timers
  player.inv = Math.max(0, player.inv - dt);
  player.coyote = player.onGround ? CONFIG.player.coyote : Math.max(0, player.coyote - dt);
  player.jumpBuf = Math.max(0, player.jumpBuf - dt);
  player.dashCd = Math.max(0, player.dashCd - dt);
  player.throwCd = Math.max(0, player.throwCd - dt);

  if (anyPressed(input, KEYS.jump)) player.jumpBuf = CONFIG.player.jumpBuffer;

  const left = anyDown(input, KEYS.left);
  const right = anyDown(input, KEYS.right);

  let dir = 0;
  if (left) dir -= 1;
  if (right) dir += 1;

  if (dir !== 0) player.facing = dir;

  // Dash
  if (player.dashUnlocked && player.dashT <= 0 && player.dashCd <= 0 && anyPressed(input, KEYS.dash)){
    player.dashT = CONFIG.player.dashTime;
    player.dashCd = CONFIG.player.dashCooldown;
    player.vy = 0;
  }

  if (player.dashT > 0){
    player.dashT -= dt;
    player.vx = player.facing * CONFIG.player.dashSpeed;
    return; // skip normal movement while dashing
  }

  // Horizontal movement
  const target = dir * CONFIG.player.runSpeed;
  const accel = (Math.abs(target) > Math.abs(player.vx)) ? CONFIG.player.accel : CONFIG.player.decel;
  player.vx = moveToward(player.vx, target, accel * dt);

  // Jump if buffered + coyote
  if (player.jumpBuf > 0 && player.coyote > 0){
    player.vy = -CONFIG.player.jumpV;
    player.jumpBuf = 0;
    player.coyote = 0;
  }

  // Variable jump height (release early)
  if (anyReleased(input, KEYS.jump) && player.vy < 0){
    player.vy *= CONFIG.player.jumpCut;
  }

  // gravity applied in main after collisions
}

export function applyGravity(player, dt){
  player.vy = clamp(player.vy + CONFIG.physics.gravity * dt, -9999, CONFIG.physics.maxFall);
}

export function tryThrow(player, input){
  if (!anyPressed(input, KEYS.throw)) return null;
  if (player.throwCd > 0) return null;

  player.throwCd = CONFIG.player.throwCooldown;

  const p = {
    x: player.x + player.w*0.5 + player.facing * 14,
    y: player.y + player.h*0.45,
    w: 14,
    h: 14,
    vx: player.facing * CONFIG.combat.projSpeed,
    vy: 0,
    life: CONFIG.combat.projLife,
    dmg: CONFIG.combat.projDamage
  };

  player.projectiles.push(p);
  return p;
}

export function updateProjectiles(player, dt){
  const arr = player.projectiles;
  for (const p of arr){
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  player.projectiles = arr.filter(p => p.life > 0);
}

export function hurtPlayer(player, dmg, knockX = 0){
  if (player.inv > 0) return false;
  player.hp = Math.max(0, player.hp - dmg);
  player.inv = CONFIG.player.invulnTime;
  player.vx += knockX;
  return true;
}

function moveToward(v, target, maxDelta){
  if (v < target) return Math.min(target, v + maxDelta);
  if (v > target) return Math.max(target, v - maxDelta);
  return target;
}
