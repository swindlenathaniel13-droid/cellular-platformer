import { CONFIG } from "./config.js";

export const FILES = {
  bg: "Background_Pic.png",
  platform: "Platform.png",
  door: "Exit_Door.png",
  flag: "CheckpointFlag.png",
  coin: "Coin.png",
  enemy1: "Enemy1.png",
  enemy2: "Enemy2.png",
  spike: "Spike.png",
  dash: "Powerup_Dash.png",
  speed: "Powerup_Speedboost.png",
  phone: "powerup_homephone.png",
  nate: "Nate.png",
  kevin: "Kevin.png",
  scott: "Scott.png",
  gilly: "Gilly.png",
  edgar: "Edgar.png"
};

export function safeUrl(file){
  return `${CONFIG.ASSET_BASE}${file}?${CONFIG.CACHE_BUST}`;
}

function loadImageWithTimeout(file, timeoutMs = 4500){
  const url = safeUrl(file);
  return new Promise((resolve) => {
    const img = new Image();
    let done = false;

    const finish = (ok, reason) => {
      if (done) return;
      done = true;
      resolve({ ok, img: ok ? img : null, file, url, reason });
    };

    const t = setTimeout(() => finish(false, "timeout"), timeoutMs);
    img.onload = () => { clearTimeout(t); finish(true, "ok"); };
    img.onerror = () => { clearTimeout(t); finish(false, "error"); };
    img.src = url;
  });
}

export async function loadAssets(onProgress){
  const keys = Object.keys(FILES);
  const total = keys.length;

  const assets = {};
  const missing = [];
  let done = 0;

  for (const k of keys){
    const file = FILES[k];
    onProgress?.({ done, total, file, phase: "loading" });

    const res = await loadImageWithTimeout(file, 4500);

    done++;
    onProgress?.({ done, total, file, phase: "loaded", ok: res.ok });

    if (res.ok) assets[k] = res.img;
    else missing.push(`${file} (${res.reason})`);
  }

  return { assets, missing };
}
