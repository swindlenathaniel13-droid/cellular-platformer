import { CONFIG } from "./config.js";
import { clamp, rand, aabb } from "./utils.js";
import { takeDamage } from "./player.js";

export function spawnEnemiesForLevel(level, world){
  const enemies = [];

  const baseCount = 2 + Math.min(5, Math.floor(level/2));
  for(let i=0;i<baseCount;i++){
    const plat = pickRandomPlatform(world);
    if(!plat) continue;

    const type = (Math.random() < 0.55) ? "enemy1" : "enemy2";
    enemies.push(makeEnemy(type, plat.x + rand(20, plat.w-60), plat.y - CONFIG.ENEMY_H, false));
  }

  // Boss every 5 levels
  if(level % 5 === 0){
    const bx = world.door.x - 220;
    const by = world.floorY - (CONFIG.ENEMY_H * CONFIG.BOSS_SCALE);
    enemies.push(makeEnemy("enemy2", bx, by, true));
  }

  return enemies;
}

function pickRandomPlatform(world){
  const plats = world.solids.filter(s => s.kind === "plat" || s.kind === "floor" || s.kind === "move");
  if(!plats.length) return null;
  return plats[Math.floor(Math.random()*plats.length)];
}

function makeEnemy(type, x, y, boss){
  const scale = boss ? CONFIG.BOSS_SCALE : 1.0;
  return {
    kind: "enemy",
    type,
    boss,
    x, y,
    w: CONFIG.ENEMY_W * scale,
    h: CONFIG.ENEMY_H * scale,
    vx: (Math.random()<0.5?-1:1) * CONFIG.ENEMY_SPEED,
    vy: 0,
    onGround: false,
    facing: 1,
    hp: boss ? CONFIG.BOSS_HP : (type==="enemy2" ? 4 : 3),

    state: "PATROL", // PATROL, CHASE, IDLE
    stateT: rand(0.6, 1.6),
    lastDropT: 0,

    shootCd: rand(0.6, 1.2), // enemy2 uses
    animT: 0,
    hurtT: 0,
  };
}

export function updateEnemies(enemies, player, world, projectiles, dt){
  for(const e of enemies){
    e.animT += dt;
    if (e.hurtT > 0) e.hurtT -= dt;
    e.lastDropT = Math.max(0, e.lastDropT - dt);
    e.shootCd = Math.max(0, e.shootCd - dt);

    // decide state
    const dx = (player.x + player.w/2) - (e.x + e.w/2);
    const dy = (player.y + player.h/2) - (e.y + e.h/2);
    const adx = Math.abs(dx);

    if (adx < CONFIG.ENEMY_AGGRO_X && Math.abs(dy) < 260){
      // chase only if reasonably close vertically, or boss always chases
      e.state = "CHASE";
      e.stateT = rand(0.5, 1.2);
    } else {
      e.stateT -= dt;
      if(e.stateT <= 0){
        e.state = (Math.random() < 0.35) ? "IDLE" : "PATROL";
        e.stateT = rand(0.8, 1.8);
      }
    }

    if(e.state === "IDLE"){
      e.vx *= 0.85;
      if (Math.abs(e.vx) < 8) e.vx = 0;
    }

    if(e.state === "PATROL"){
      if (Math.abs(e.vx) < 10) e.vx = (Math.random()<0.5?-1:1) * CONFIG.ENEMY_SPEED;
      e.facing = e.vx >= 0 ? 1 : -1;
    }

    if(e.state === "CHASE"){
      const dir = dx === 0 ? 0 : (dx > 0 ? 1 : -1);
      e.facing = dir || e.facing;

      // stay “smarter”: chase on-platform primarily
      const speed = e.boss ? (CONFIG.ENEMY_CHASE_SPEED*1.15) : CONFIG.ENEMY_CHASE_SPEED;
      e.vx = dir * speed;

      // only drop down if player is below AND near an edge AND cooldown ready
      if (dy > 70 && e.onGround && adx < CONFIG.ENEMY_DROP_X && e.lastDropT <= 0){
        if (isNearEdge(e, world)){
          e.vy = 260; // step-off encouragement
          e.lastDropT = 1.25;
        }
      }

      // ranged shot for enemy2 / boss
      if (e.type === "enemy2" && adx > 120 && adx < 520 && Math.abs(dy) < 120 && e.shootCd <= 0){
        e.shootCd = e.boss ? 0.55 : 0.95;
        const px = e.facing > 0 ? (e.x + e.w + 4) : (e.x - 10);
        const py = e.y + e.h*0.45;
        projectiles.push({
          kind:"enemyShot",
          x:px, y:py, w:10, h:6,
          vx: e.facing * (e.boss ? 520 : 420),
          vy: 0,
          life: 2.0,
        });
      }
    }

    // gravity
    e.vy = clamp(e.vy + 2100*dt, -99999, 1600);
  }
}

function isNearEdge(e, world){
  // detect if there is ground right under center +/- a little
  const footY = e.y + e.h + 2;
  const leftX = e.x + e.w*0.25;
  const rightX = e.x + e.w*0.75;

  const underL = hasSolidUnder(leftX, footY, world);
  const underR = hasSolidUnder(rightX, footY, world);

  // near edge if one side lacks ground
  return (underL && !underR) || (!underL && underR);
}

function hasSolidUnder(x, y, world){
  for(const s of world.solids){
    if(!s.solid) continue;
    if (x >= s.x && x <= s.x+s.w && y >= s.y && y <= s.y+s.h+4) return true;
  }
  return false;
}

export function handleEnemyPlayerCollisions(enemies, player){
  const pBox = { x:player.x, y:player.y, w:player.w, h:player.h };
  for(const e of enemies){
    if(e.hp <= 0) continue;
    if(aabb(pBox, e)){
      // stomp?
      const falling = player.vy > 220 && (player.y + player.h) <= (e.y + e.h*0.45);
      if(falling){
        e.hp -= 1;
        e.hurtT = 0.25;
        player.vy = -520;
      } else {
        takeDamage(player, 1);
        // knockback
        player.vx = (player.x < e.x ? -1 : 1) * 260;
        player.vy = -260;
      }
    }
  }
}
