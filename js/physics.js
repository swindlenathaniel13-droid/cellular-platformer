import { clamp } from "./utils.js";

export function moveAndCollide(body, solids, dt){
  // Sub-step to prevent clipping on lag
  const steps = Math.max(1, Math.ceil((Math.abs(body.vx)+Math.abs(body.vy)) * dt / 24));
  const h = dt / steps;

  body.onGround = false;

  for(let i=0;i<steps;i++){
    body.x += body.vx * h;
    resolveAxis(body, solids, "x");

    body.y += body.vy * h;
    resolveAxis(body, solids, "y");

    body.vy = clamp(body.vy, -99999, body.maxFall ?? 99999);
  }
}

function resolveAxis(b, solids, axis){
  for(const s of solids){
    if (!s.solid) continue;
    if (b.x < s.x + s.w && b.x + b.w > s.x && b.y < s.y + s.h && b.y + b.h > s.y){
      if(axis === "x"){
        if (b.vx > 0) b.x = s.x - b.w;
        else if (b.vx < 0) b.x = s.x + s.w;
        b.vx = 0;
      } else {
        if (b.vy > 0){
          b.y = s.y - b.h;
          b.vy = 0;
          b.onGround = true;
        } else if (b.vy < 0){
          b.y = s.y + s.h;
          b.vy = 0;
        }
      }
    }
  }
}
