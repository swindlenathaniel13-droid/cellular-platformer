import { CONFIG } from "./config.js";
import { clamp, moveAndCollide, aabb } from "./utils.js";

function pickSpawnPlatform(world, preferHigh = false) {
  const plats = world.platforms.slice(1); // exclude ground
  if (plats.length === 0) return world.platforms[0];
  if (!preferHigh) return plats[Math.floor(Math.random() * plats.length)];
  const sorted = plats.slice().sort((a, b) => a.y - b.y);
  return sorted[Math.floor(Math.random() * Math.min(6, sorted.length))];
}

export function spawnEnemiesForWorld(state) {
  const w = state.world;
  state.enemies = [];
  state.enemyProjectiles = [];
  state.projectiles = [];

  const count = Math.min(2 + Math.floor(state.levelIndex / 2), 7);

  for (let i = 0; i < count; i++) {
    const plat = pickSpawnPlatform(w, i % 3 === 0);
    const type = Math.random() < 0.55 ? "Enemy1" : "Enemy2";
    const size = type === "Enemy2" ? { w: 46, h: 62 } : { w: 44, h: 58 };

    state.enemies.push({
      type,
      x: plat.x + 20 + Math.random() * (plat.w - 80),
      y: plat.y - size.h,
      w: size.w,
      h: size.h,
      vx: (Math.random() < 0.5 ? -1 : 1) * 90,
      vy: 0,
      hp: type === "Enemy2" ? 3 : 2,
      face: 1,
      homePlat: plat,
      edgeMargin: 10,
      idleT: Math.random() * 0.8,
      shootCd: 0,
    });
  }

  // Boss every 5 levels on the goal platform
  if (state.levelIndex % 5 === 0) {
    const gp = w.goalPlat;
    state.enemies.push({
      type: "Boss",
      x: gp.x + gp.w / 2 - 64,
      y: gp.y - 120,
      w: 128,
      h: 120,
      vx: 0,
      vy: 0,
      hp: 18 + state.levelIndex * 2,
      face: -1,
      homePlat: gp,
      edgeMargin: 18,
      idleT: 0,
      shootCd: 0,
      enraged: false,
    });
  }
}

export function updateEnemies(state, dt) {
  const solids = state.world.platforms;
  const p = state.player;

  // update enemy projectiles
  for (let i = state.enemyProjectiles.length - 1; i >= 0; i--) {
    const b = state.enemyProjectiles[i];
    b.life -= dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.vy += 520 * dt;
    if (b.life <= 0) state.enemyProjectiles.splice(i, 1);
  }

  // update player projectiles
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const pr = state.projectiles[i];
    pr.life -= dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
    pr.vy += 800 * dt;
    if (pr.life <= 0) state.projectiles.splice(i, 1);
  }

  // collisions: player projectiles hit enemies
  for (let i = state.projectiles.length - 1; i >= 0; i--) {
    const pr = state.projectiles[i];
    let hit = false;
    for (const e of state.enemies) {
      if (aabb(pr, e)) {
        e.hp -= pr.dmg ?? 1;
        hit = true;
        break;
      }
    }
    if (hit) state.projectiles.splice(i, 1);
  }

  // remove dead enemies (drop coins)
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    if (e.hp > 0) continue;

    // coin drops
    const drops = e.type === "Boss" ? 10 : (e.type === "Enemy2" ? 3 : 2);
    for (let k = 0; k < drops; k++) {
      state.world.coins.push({
        x: e.x + e.w / 2 + (Math.random() - 0.5) * 40,
        y: e.y + 10 + (Math.random() - 0.5) * 18,
        r: 14,
        collected: false
      });
    }

    state.enemies.splice(i, 1);
  }

  // main enemy update
  for (const e of state.enemies) {
    e.shootCd = Math.max(0, e.shootCd - dt);
    e.idleT = Math.max(0, e.idleT - dt);

    const plat = e.homePlat;
    const leftEdge = plat.x + e.edgeMargin;
    const rightEdge = plat.x + plat.w - e.w - e.edgeMargin;

    // AI “awareness”
    const dx = (p.x + p.w / 2) - (e.x + e.w / 2);
    const dy = (p.y + p.h / 2) - (e.y + e.h / 2);
    const dist = Math.hypot(dx, dy);

    // Boss behavior
    if (e.type === "Boss") {
      if (e.hp < 0.45 * (18 + state.levelIndex * 2)) e.enraged = true;

      const speed = e.enraged ? 210 : 160;
      const chase = dist < 560;

      if (chase) {
        e.face = dx < 0 ? -1 : 1;
        e.vx += e.face * speed * dt;
        e.vx = clamp(e.vx, -speed, speed);

        // ranged burst
        if (e.shootCd <= 0 && dist > 200) {
          e.shootCd = e.enraged ? 0.7 : 1.1;
          const bullet = {
            type: "EnemyBullet",
            x: e.x + e.w / 2 + e.face * 40,
            y: e.y + e.h * 0.45,
            w: 18,
            h: 18,
            vx: e.face * (e.enraged ? 520 : 420),
            vy: -120,
            life: 2.0,
            dmg: 1,
          };
          state.enemyProjectiles.push(bullet);
        }
      } else {
        // patrol
        if (e.idleT <= 0 && Math.random() < 0.01) e.idleT = 0.8 + Math.random() * 1.2;
        if (e.idleT > 0) e.vx *= 0.90;
        else {
          e.vx += e.face * 120 * dt;
          e.vx = clamp(e.vx, -140, 140);
        }
      }
    } else {
      // Standard enemies
      const patrolSpeed = e.type === "Enemy2" ? 120 : 100;
      const chaseSpeed = e.type === "Enemy2" ? 170 : 150;

      const seesPlayer = dist < 420 && Math.abs(dy) < 140;

      if (seesPlayer) {
        e.face = dx < 0 ? -1 : 1;
        e.vx += e.face * chaseSpeed * dt;
        e.vx = clamp(e.vx, -chaseSpeed, chaseSpeed);

        // Enemy2: ranged attack when player is not too close
        if (e.type === "Enemy2" && e.shootCd <= 0 && Math.abs(dx) > 200) {
          e.shootCd = 1.2;
          state.enemyProjectiles.push({
            type: "EnemyBullet",
            x: e.x + e.w / 2 + e.face * 18,
            y: e.y + e.h * 0.45,
            w: 14,
            h: 14,
            vx: e.face * 360,
            vy: -90,
            life: 1.8,
            dmg: 1,
          });
        }
      } else {
        // IDLE state for variety
        if (e.idleT <= 0 && Math.random() < 0.008) e.idleT = 0.7 + Math.random() * 1.3;
        if (e.idleT > 0) {
          e.vx *= 0.92;
        } else {
          e.vx += e.face * patrolSpeed * dt;
          e.vx = clamp(e.vx, -patrolSpeed, patrolSpeed);
        }
      }
    }

    // gravity
    e.vy += CONFIG.GRAVITY * dt;
    e.vy = clamp(e.vy, -9999, CONFIG.MAX_FALL);

    // move/collide
    moveAndCollide(e, solids, dt);

    // edge turn (hysteresis so they don’t “dance”)
    if (e.x < leftEdge) {
      e.x = leftEdge;
      e.face = 1;
      e.vx = Math.abs(e.vx) * 0.8;
    }
    if (e.x > rightEdge) {
      e.x = rightEdge;
      e.face = -1;
      e.vx = -Math.abs(e.vx) * 0.8;
    }
  }
}
