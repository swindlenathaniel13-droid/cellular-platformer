import { aabb } from "./utils.js";

export function moveAndCollide(body, solids, dt){
  // Substep to prevent tunneling on slow frames
  const maxStep = 1/120;
  let t = dt;

  while (t > 0){
    const step = Math.min(maxStep, t);
    t -= step;

    body.vy += body.gravity * step;

    // X
    body.x += body.vx * step;
    for (const p of solids){
      if (aabb(body.x, body.y, body.w, body.h, p.x, p.y, p.w, p.h)){
        if (body.vx > 0) body.x = p.x - body.w;
        else if (body.vx < 0) body.x = p.x + p.w;
        body.vx = 0;
      }
    }

    // Y
    body.y += body.vy * step;
    body.onGround = false;

    for (const p of solids){
      if (aabb(body.x, body.y, body.w, body.h, p.x, p.y, p.w, p.h)){
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
  }
}
