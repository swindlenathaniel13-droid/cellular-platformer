// js/enemies.js
import { CONFIG } from "./config.js";
import { clamp, randRange } from "./utils.js";

export function updateEnemies(enemies, player, dtMs){
  const dt = dtMs / 1000;
  const shots = [];

  for (const e of enemies){
    if (!e.alive) continue;

    // patrol
    const speed = CONFIG.enemy.speed;
    e.x += e.dir * speed * dt;

    if (e.x < e.patrolLeft){
      e.x = e.patrolLeft;
      e.dir = 1;
    } else if (e.x > e.patrolRight){
      e.x = e.patrolRight;
      e.dir = -1;
    }

    // shooting logic
    e.shootCooldown = Math.max(0, e.shootCooldown - dtMs);

    const dx = (player.x + player.w/2) - (e.x + e.w/2);
    const dy = (player.y + player.h/2) - (e.y + e.h/2);
    const dist = Math.hypot(dx, dy);

    const inRange = dist < CONFIG.enemy.shootRange && Math.abs(dy) < 120;

    if (inRange && e.shootCooldown <= 0){
      // probabilistic fire so they’re not machine guns
      const pFire = CONFIG.enemy.shootChancePerSecond * dt;
      if (Math.random() < pFire){
        const dir = dx >= 0 ? 1 : -1;
        shots.push({
          x: e.x + e.w/2,
          y: e.y + e.h/2,
          vx: dir * CONFIG.enemy.bulletSpeed,
          vy: randRange(-40, 40),
          r: CONFIG.enemy.bulletRadius,
          life: CONFIG.enemy.bulletLifetimeMs,
          from: "enemy"
        });
        e.shootCooldown = CONFIG.enemy.shootCooldownMs;
      }
    }
  }

  return shots;
}

export function killEnemy(e){
  e.alive = false;
}
