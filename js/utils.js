export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a, b, t) => a + (b - a) * t;

export function rectsOverlap(a, b){
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}

export function randi(a, b){
  return (Math.random() * (b - a + 1) + a) | 0;
}

export function randf(a, b){
  return a + Math.random() * (b - a);
}

export function pick(arr){
  return arr[(Math.random() * arr.length) | 0];
}

export function nowSec(){
  return performance.now() / 1000;
}
