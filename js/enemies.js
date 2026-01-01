import { rectsOverlap, rand } from "./utils.js";

export function spawnEnemy(type, x, y) {
  if (type === 2) {
    return { type: 2, x, y, w: 40, h: 34, vx: rand(-60, 60), vy: 0, hp: 2, onGround: false };
  }
  return { type: 1, x, y, w: 36, h: 32, vx: rand(-70, 70), vy: 0, hp: 1, onGround: false };
}

export function enemyRect(e) {
  return { x: e.x, y: e.y, w: e.w, h: e.h };
}

export function hitEnemy(enemies, idx, dmg) {
  const e = enemies[idx];
  e.hp -= dmg;
  return e.hp <= 0;
}

export function enemyTouchesPlayer(enemy, player) {
  return rectsOverlap(enemyRect(enemy), player);
}
