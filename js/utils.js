export function clamp(v,a,b){ return Math.max(a, Math.min(b,v)); }
export function mulberry32(seed){
  let t = seed>>>0;
  return function(){
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t>>>15), 1|t);
    x ^= x + Math.imul(x ^ (x>>>7), 61|x);
    return ((x ^ (x>>>14))>>>0) / 4294967296;
  };
}
export function aabb(a,b){
  return a.x < b.x+b.w && a.x+a.w > b.x && a.y < b.y+b.h && a.y+a.h > b.y;
}
export function isTouchDevice(){
  return ('ontouchstart' in window) || navigator.maxTouchPoints > 0;
}

