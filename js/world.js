import { aabb } from "./utils.js";

function rectOverlap(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

function resolveAxis(ent, solids, axis) {
  for (const s of solids) {
    if (!s.solid) continue;
    if (!rectOverlap(ent, s)) continue;

    if (axis === "x") {
      const midA = ent.x + ent.w / 2;
      const midB = s.x + s.w / 2;
      if (midA < midB) {
        ent.x = s.x - ent.w;
      } else {
        ent.x = s.x + s.w;
      }
      ent.vx = 0;
    } else {
      const midA = ent.y + ent.h / 2;
      const midB = s.y + s.h / 2;
      if (midA < midB) {
        // Landed on top
        ent.y = s.y - ent.h;
        ent.vy = 0;
        ent.onGround = true;
        ent._groundId = s._id ?? null;
      } else {
        // Hit head
        ent.y = s.y + s.h;
        ent.vy = 0;
      }
    }
  }
}

export function moveAndCollide(ent, solids, dt) {
  // Sub-step to prevent tunneling and jitter
  const MAX_STEP = 1 / 120;
  let remaining = dt;

  ent.onGround = false;
  ent._groundId = null;

  while (remaining > 0) {
    const step = Math.min(MAX_STEP, remaining);
    remaining -= step;

    // X
    ent.x += ent.vx * step;
    resolveAxis(ent, solids, "x");

    // Y
    ent.y += ent.vy * step;
    resolveAxis(ent, solids, "y");
  }
}

export function pointInSolid(x, y, solids) {
  const p = { x, y, w: 1, h: 1 };
  for (const s of solids) {
    if (!s.solid) continue;
    if (aabb(p, s)) return s;
  }
  return null;
}

export function getSupportRect(ent, solids, pad = 2) {
  // Checks a tiny box under the feet
  const probe = {
    x: ent.x + pad,
    y: ent.y + ent.h + 1,
    w: Math.max(1, ent.w - pad * 2),
    h: 2,
  };
  for (const s of solids) {
    if (!s.solid) continue;
    if (aabb(probe, s)) return s;
  }
  return null;
}

