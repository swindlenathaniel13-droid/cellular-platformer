export function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function aabb(a, b) {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function formatTime(seconds) {
  const s = Math.max(0, seconds);
  const mm = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  const ms = Math.floor((s - Math.floor(s)) * 100);
  const pad2 = (n) => String(n).padStart(2, "0");
  return `${pad2(mm)}:${pad2(ss)}.${pad2(ms)}`;
}

export function mulberry32(seed) {
  let t = seed >>> 0;
  return function () {
    t += 0x6D2B79F5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Sub-step movement to prevent clipping when dt is large.
 * Returns collision info: { onGround, hitX, hitY }
 */
export function moveAndCollide(ent, solids, dt) {
  const maxStep = 1 / 120;
  let t = dt;
  let onGround = false;
  let hitX = false;
  let hitY = false;

  while (t > 0) {
    const step = Math.min(maxStep, t);
    t -= step;

    // X
    ent.x += ent.vx * step;
    for (const s of solids) {
      if (aabb(ent, s)) {
        hitX = true;
        if (ent.vx > 0) ent.x = s.x - ent.w;
        else if (ent.vx < 0) ent.x = s.x + s.w;
        ent.vx = 0;
      }
    }

    // Y
    ent.y += ent.vy * step;
    for (const s of solids) {
      if (aabb(ent, s)) {
        hitY = true;
        if (ent.vy > 0) {
          ent.y = s.y - ent.h;
          ent.vy = 0;
          onGround = true;
        } else if (ent.vy < 0) {
          ent.y = s.y + s.h;
          ent.vy = 0;
        }
      }
    }
  }

  return { onGround, hitX, hitY };
}
