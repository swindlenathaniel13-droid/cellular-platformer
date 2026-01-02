// js/utils.js
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function randRange(a, b){
  return a + Math.random() * (b - a);
}

export function choice(arr){
  return arr[(Math.random() * arr.length) | 0];
}

export function aabb(a, b){
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
