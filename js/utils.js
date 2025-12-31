export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const lerp = (a,b,t) => a + (b-a)*t;
export const rand = (a,b) => a + Math.random()*(b-a);
export const randi = (a,b) => Math.floor(rand(a,b+1));
export const now = () => performance.now() / 1000;

export function aabb(a,b){
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

export function fmtTime(s){
  const m = Math.floor(s/60);
  const ss = Math.floor(s%60).toString().padStart(2,"0");
  const ms = Math.floor((s*100)%100).toString().padStart(2,"0");
  return `${m}:${ss}.${ms}`;
}
