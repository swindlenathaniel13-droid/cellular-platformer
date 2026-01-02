// js/physics.js
import { aabb } from "./utils.js";

export function resolvePlatforms(body, platforms){
  body.onGround = false;

  // Horizontal
  body.x += body.vx * body.dt;
  for (const p of platforms){
    if (!aabb(body, p)) continue;
    if (body.vx > 0) body.x = p.x - body.w;
    else if (body.vx < 0) body.x = p.x + p.w;
    body.vx = 0;
  }

  // Vertical
  body.y += body.vy * body.dt;
  for (const p of platforms){
    if (!aabb(body, p)) continue;

    if (body.vy > 0){
      body.y = p.y - body.h;
      body.vy = 0;
      body.onGround = true;
    } else if (body.vy < 0){
      body.y = p.y + p.h;
      body.vy = 0;
    }
  }
}
