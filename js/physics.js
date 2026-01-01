// js/physics.js
import { rectsOverlap } from "./utils.js";

function resolveAxis(body, solids, axis){
  for (const s of solids){
    if (!rectsOverlap(body, s)) continue;

    if (axis === "x"){
      if (body.vx > 0) body.x = s.x - body.w;
      else if (body.vx < 0) body.x = s.x + s.w;
      body.vx = 0;
    } else {
      if (body.vy > 0){
        body.y = s.y - body.h;
        body.vy = 0;
        body.onGround = true;
      } else if (body.vy < 0){
        body.y = s.y + s.h;
        body.vy = 0;
      }
    }
  }
}

export function moveAndCollide(body, solids, dt){
  body.onGround = false;

  const dx = body.vx * dt;
  const dy = body.vy * dt;

  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) / 8));
  const stepDt = dt / steps;

  for (let i=0;i<steps;i++){
    body.x += body.vx * stepDt;
    resolveAxis(body, solids, "x");

    body.y += body.vy * stepDt;
    resolveAxis(body, solids, "y");
  }
}
