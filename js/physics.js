import { rectsOverlap } from "./utils.js";

export function moveAndCollide(entity, solids, dt){
  // Move X
  entity.x += entity.vx * dt;
  for (const s of solids){
    if (!rectsOverlap(entity, s)) continue;
    if (entity.vx > 0) entity.x = s.x - entity.w;
    else if (entity.vx < 0) entity.x = s.x + s.w;
    entity.vx = 0;
  }

  // Move Y
  entity.y += entity.vy * dt;
  entity.onGround = false;

  for (const s of solids){
    if (!rectsOverlap(entity, s)) continue;
    if (entity.vy > 0){
      entity.y = s.y - entity.h;
      entity.vy = 0;
      entity.onGround = true;
    } else if (entity.vy < 0){
      entity.y = s.y + s.h;
      entity.vy = 0;
    }
  }
}
