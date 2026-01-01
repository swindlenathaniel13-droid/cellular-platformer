// js/enemies.js
import { rectsOverlap } from "./utils.js";
import { CONFIG } from "./config.js";

export function updateEnemies(world, player, dt){
  for (const e of world.enemies){
    e.inv = Math.max(0, e.inv - dt);

    // basic AI: patrol; chase if player close
    const dx = (player.x + player.w*0.5) - (e.x + e.w*0.5);
    const close = Math.abs(dx) < 260;

    if (close){
      e.vx = Math.sign(dx) * 90;
    }

    // gravity is applied in main via player physics approach; keep it simple:
    e.vy = Math.min(CONFIG.physics.maxFall, e.vy + CONFIG.physics.gravity * dt);

    e.x += e.vx * dt;
    e.y += e.vy * dt;

    // collide with platforms (simple)
    for (const p of world.platforms){
      if (!rectsOverlap(e, p)) continue;

      // resolve vertical first
      if (e.vy > 0){
        e.y = p.y - e.h;
        e.vy = 0;
        e.onGround = true;
      }
    }

    // edge turn (don’t walk off platform)
    if (e.onGround){
      const feetX = e.x + (e.vx > 0 ? e.w + 2 : -2);
      const feetY = e.y + e.h + 2;

      let supported = false;
      for (const p of world.platforms){
        if (feetX >= p.x && feetX <= p.x + p.w && feetY >= p.y && feetY <= p.y + p.h + 6){
          supported = true;
          break;
        }
      }
      if (!supported) e.vx *= -1;
    }
  }
}

export function projectileHits(world, player){
  for (const p of player.projectiles){
    for (const e of world.enemies){
      if (e.hp <= 0) continue;
      if (e.inv > 0) continue;
      if (rectsOverlap(p, e)){
        e.hp -= p.dmg;
        e.inv = 0.15;
        p.life = 0; // consume projectile

        // drop a coin on kill
        if (e.hp <= 0){
          world.coins.push({ x: e.x + e.w*0.4, y: e.y - 18, w: 20, h: 20, taken:false });
        }
      }
    }
  }

  world.enemies = world.enemies.filter(e => e.hp > 0);
}

export function enemyTouchDamage(world, player){
  for (const e of world.enemies){
    if (rectsOverlap(player, e)){
      return { dmg: CONFIG.combat.enemyTouchDamage, knock: Math.sign(player.x - e.x) * 220 };
    }
  }
  return null;
}
