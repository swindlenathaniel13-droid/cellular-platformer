import { rectsOverlap, rand } from "./utils.js";
import { CONFIG } from "./config.js";
import { moveAndCollide } from "./physics.js";

export function spawnEnemy(type, x, y) {
  if (type === 2) {
    return { type: 2, x, y, w: 40, h: 34, vx: rand(-60, 60), vy: 0, hp: 2, onGround: false, dir: 1, shootCd: rand(0.5, 1.4) };
  }
  return { type: 1, x, y, w: 36, h: 32, vx: rand(-70, 70), vy: 0, hp: 1, onGround: false, dir: 1, shootCd: 999 };
}

export function enemyRect(e) {
  return { x: e.x, y: e.y, w: e.w, h: e.h };
}

export function hitEnemy(enemies, idx, dmg) {
  const e = enemies[idx];
  e.hp -= dmg;
  return e.hp <= 0;
}

function pointOnAnyPlatform(px, py, platforms) {
  for (const p of platforms) {
    if (px >= p.x && px <= p.x + p.w && py >= p.y && py <= p.y + p.h) return true;
  }
  return false;
}

export function updateEnemies(world, player, dt, enemyBulletsOut) {
  for (const e of world.enemies) {
    // gravity
    e.vy += CONFIG.physics.gravity * dt;
    if (e.vy > CONFIG.physics.maxFall) e.vy = CONFIG.physics.maxFall;

    const dx = (player.x + player.w * 0.5) - (e.x + e.w * 0.5);
    const adx = Math.abs(dx);

    // choose direction
    if (adx < 420) e.dir = dx < 0 ? -1 : 1;

    // patrol/chase speed
    const base = e.type === 2 ? 90 : 120;
    const chase = e.type === 2 ? 120 : 150;

    let speed = base;
    if (adx < 340) speed = chase;

    e.vx = e.dir * speed;

    // edge avoidance (don’t walk off platform)
    const footY = e.y + e.h + 2;
    const aheadX = e.x + (e.dir > 0 ? e.w + 6 : -6);
    const hasFloorAhead = pointOnAnyPlatform(aheadX, footY, world.platforms);

    if (!hasFloorAhead && e.onGround) {
      e.dir *= -1;
      e.vx = e.dir * speed;
    }

    // move/collide
    moveAndCollide(e, world.platforms, dt);

    // enemy2 shoots at player when close-ish
    if (e.type === 2) {
      e.shootCd -= dt;
      const sameBand = Math.abs((player.y + player.h * 0.5) - (e.y + e.h * 0.5)) < 90;

      if (e.shootCd <= 0 && adx < 520 && sameBand) {
        const dir = dx < 0 ? -1 : 1;
        enemyBulletsOut.push({
          x: e.x + (dir > 0 ? e.w : -10),
          y: e.y + e.h * 0.45,
          w: 10,
          h: 6,
          vx: 520 * dir,
          vy: 0,
          life: 1.1,
        });
        e.shootCd = rand(1.0, 1.7);
      }
    }
  }
}
