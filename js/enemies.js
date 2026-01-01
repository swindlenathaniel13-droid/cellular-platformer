import { CONFIG } from "./config.js";
import { rectsOverlap, clamp } from "./utils.js";
import { moveAndCollide } from "./physics.js";

export function createEnemy(x, y, kind="enemy1"){
  return {
    x, y,
    w: CONFIG.ENEMY_W,
    h: CONFIG.ENEMY_H,
    vx: 0, vy: 0,
    onGround: false,
    facing: Math.random() < 0.5 ? -1 : 1,
    kind,
    hp: kind === "boss" ? CONFIG.BOSS_HP_BASE : 2,
    patrolMinX: x - 180,
    patrolMaxX: x + 180,
    hurtCD: 0
  };
}

export function spawnEnemiesForLevel(world, level){
  world.enemies = [];

  const count = Math.min(2 + Math.floor(level * 0.6), 8);
  for (let i=0;i<count;i++){
    const p = world.platforms[(Math.random()*world.platforms.length)|0];
    if (!p) continue;
    const ex = p.x + 40 + Math.random() * Math.max(20, p.w - 80);
    const ey = p.y - CONFIG.ENEMY_H;
    if (ex < 200 || ex > world.width - 250) continue;
    world.enemies.push(createEnemy(ex, ey, Math.random()<0.25 ? "enemy2" : "enemy1"));
  }

  if (level % CONFIG.BOSS_EVERY === 0){
    // Boss near exit platform
    const ep = world.exitPlatform;
    const bx = ep.x + ep.w * 0.55;
    const by = ep.y - (CONFIG.ENEMY_H * 2);
    const b = createEnemy(bx, by, "boss");
    b.w = CONFIG.ENEMY_W * 2;
    b.h = CONFIG.ENEMY_H * 2;
    b.hp = CONFIG.BOSS_HP_BASE + Math.floor(level * 0.8);
    b.patrolMinX = ep.x + 40;
    b.patrolMaxX = ep.x + ep.w - 40;
    world.enemies.push(b);
    world.bossAlive = true;
  } else {
    world.bossAlive = false;
  }
}

export function updateEnemies(world, player, dt, onPlayerDamage){
  const solids = world.platforms;
  for (const e of world.enemies){
    e.hurtCD = Math.max(0, e.hurtCD - dt);
    e.vy += CONFIG.GRAVITY * dt;

    const dx = (player.x + player.w/2) - (e.x + e.w/2);
    const adx = Math.abs(dx);

    // Smart-ish: chase if close, else patrol
    const detect = adx < CONFIG.ENEMY_DETECT_X && Math.abs((player.y+player.h/2)-(e.y+e.h/2)) < 140;
    const speed = detect ? (e.kind==="boss" ? CONFIG.ENEMY_CHASE_SPEED*0.9 : CONFIG.ENEMY_CHASE_SPEED) : CONFIG.ENEMY_SPEED;

    if (detect){
      e.facing = dx < 0 ? -1 : 1;
      e.vx = e.facing * speed;
    } else {
      // patrol between min/max
      e.vx = e.facing * speed;
      if (e.x < e.patrolMinX) e.facing = 1;
      if (e.x > e.patrolMaxX) e.facing = -1;
    }

    e.vx = clamp(e.vx, -280, 280);

    moveAndCollide(e, solids, dt);

    // Edge "hysteresis": if near the edge of any platform, flip
    if (e.onGround){
      const feetX = e.facing === 1 ? (e.x + e.w + 2) : (e.x - 2);
      const feetY = e.y + e.h + 2;

      let supported = false;
      for (const p of solids){
        if (feetX >= p.x && feetX <= p.x + p.w && feetY >= p.y && feetY <= p.y + p.h + 6){
          supported = true;
          break;
        }
      }
      if (!supported){
        e.facing *= -1;
        e.vx = e.facing * speed;
      }
    }

    // Damage player on contact (with cooldown)
    if (rectsOverlap(e, player) && e.hurtCD <= 0){
      e.hurtCD = 0.45;
      onPlayerDamage?.(CONFIG.ENEMY_DAMAGE);
      player.vx += (dx < 0 ? -180 : 180);
      player.vy = -220;
    }
  }

  // Boss alive flag
  world.bossAlive = world.enemies.some(e => e.kind === "boss" && e.hp > 0);
}
