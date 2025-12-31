import { CONFIG } from "./config.js";
import { clamp } from "./utils.js";

export function createPlayer(charKey){
  return {
    kind: "player",
    charKey,
    x: 90,
    y: 100,
    w: CONFIG.PLAYER_W,
    h: CONFIG.PLAYER_H,
    vx: 0,
    vy: 0,
    onGround: false,
    facing: 1,

    hpMax: CONFIG.HP_START,
    hp: CONFIG.HP_START,

    dashUnlocked: false,
    dashT: 0,
    dashCd: 0,

    throwCd: 0,

    // jump helpers
    coyote: 0,
    jumpBuffer: 0,

    // stats
    coins: 0,
    stageCoins: 0,
    stageDamage: 0,
    stageTime: 0,

    // shop effects (reset on restart/death)
    speedMult: 1.0,
    throwMult: 1.0,
    shieldHits: 0,
    magnet: 0,

    // visuals
    animT: 0,
    hurtT: 0,
  };
}

export function applyShopReset(p){
  p.speedMult = 1.0;
  p.throwMult = 1.0;
  p.shieldHits = 0;
  p.magnet = 0;
  // keep dashUnlocked? (shop item)
  // we reset everything from shop, so:
  p.dashUnlocked = false;
}

export function takeDamage(p, amt){
  if(p.shieldHits > 0){
    p.shieldHits--;
    p.hurtT = 0.2;
    return;
  }
  p.hp = Math.max(0, p.hp - amt);
  p.stageDamage += amt;
  p.hurtT = 0.35;
}

export function updatePlayer(p, input, dt){
  p.animT += dt;
  if (p.hurtT > 0) p.hurtT -= dt;

  const speed = CONFIG.PLAYER_SPEED * p.speedMult;

  // timers
  p.dashCd = Math.max(0, p.dashCd - dt);
  p.throwCd = Math.max(0, p.throwCd - dt);

  // coyote + jump buffer
  p.coyote = p.onGround ? CONFIG.COYOTE_TIME : Math.max(0, p.coyote - dt);
  p.jumpBuffer = input.jumpPressed() ? CONFIG.JUMP_BUFFER : Math.max(0, p.jumpBuffer - dt);

  // dash
  if (p.dashT > 0){
    p.dashT = Math.max(0, p.dashT - dt);
    // during dash we keep vx as set
  } else {
    // horizontal input
    let ax = 0;
    if (input.left()) ax -= 1;
    if (input.right()) ax += 1;

    if (ax !== 0) p.facing = ax;

    // acceleration-ish
    const targetVx = ax * speed;
    p.vx = targetVx;

    // jump
    if (p.jumpBuffer > 0 && p.coyote > 0){
      p.vy = -CONFIG.PLAYER_JUMP;
      p.jumpBuffer = 0;
      p.coyote = 0;
    }

    // variable jump (release early)
    if (!input.jumpHeld() && p.vy < 0){
      p.vy *= 0.82;
    }

    // dash trigger
    if (p.dashUnlocked && input.dashPressed() && p.dashCd <= 0){
      p.dashT = CONFIG.DASH_TIME;
      p.dashCd = CONFIG.DASH_COOLDOWN;
      p.vx = p.facing * CONFIG.DASH_SPEED;
      // little hop to feel snappy
      p.vy *= 0.25;
    }
  }

  // gravity
  p.vy = clamp(p.vy + CONFIG.GRAVITY * dt, -99999, CONFIG.MAX_FALL);
}
