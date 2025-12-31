export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a,b,t) => a + (b-a)*t;

export function aabb(ax, ay, aw, ah, bx, by, bw, bh){
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

export function rand(a,b){ return a + Math.random() * (b-a); }
export function randi(a,b){ return Math.floor(rand(a,b+1)); }
