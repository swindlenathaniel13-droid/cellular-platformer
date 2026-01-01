import { rectsOverlap } from "./utils.js";
import { CONFIG } from "./config.js";

export function moveAndCollide(body, solids, dt) {
  const steps = Math.min(CONFIG.dev.maxSubSteps, Math.max(1, Math.ceil(dt / CONFIG.dev.fixedDt)));
  const stepDt = dt / steps;

  body.onGround = false;
  body.hitCeil = false;

  for (let i = 0; i < steps; i++) {
    // X axis
    body.x += body.vx * stepDt;
    for (const s of solids) {
      if (!rectsOverlap(body, s)) continue;
      if (body.vx > 0) body.x = s.x - body.w;
      else if (body.vx < 0) body.x = s.x + s.w;
      body.vx = 0;
    }

    // Y axis
    body.y += body.vy * stepDt;
    for (const s of solids) {
      if (!rectsOverlap(body, s)) continue;

      if (body.vy > 0) {
        body.y = s.y - body.h;
        body.vy = 0;
        body.onGround = true;
      } else if (body.vy < 0) {
        body.y = s.y + s.h;
        body.vy = 0;
        body.hitCeil = true;
      }
    }
  }
}
