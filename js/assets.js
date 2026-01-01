const FILES = {
  bg: "Background_Pic.png",
  platform: "Platform.png",
  door: "Exit_Door.png",
  flag: "CheckpointFlag.png",
  coin: "Coin.png",
  spike: "Spike.png",

  // weapon icon projectile
  phone: "powerup_homephone.png",

  enemy1: "Enemy1.png",
  enemy2: "Enemy2.png",

  nate: "Nate.png",
  kevin: "Kevin.png",
  scott: "Scott.png",
  gilly: "Gilly.png",
  edgar: "Edgar.png",
};

function assetBase() {
  // robust under GitHub Pages subpaths
  return new URL("../assets/", import.meta.url).toString();
}

export function getFiles() {
  return { ...FILES };
}

export function assetUrl(file) {
  return assetBase() + file;
}

function loadImage(file, timeoutMs = 6000) {
  const url = assetUrl(file);

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

export async function loadAssets(onProgress) {
  const entries = Object.entries(FILES);
  const total = entries.length;

  const assets = {};
  const missing = [];
  let loaded = 0;

  for (const [key, file] of entries) {
    onProgress?.({ loaded, total, file });

    const res = await loadImage(file);
    loaded++;

    onProgress?.({ loaded, total, file });

    if (res.ok) assets[key] = res.img;
    else missing.push(`${file} (${res.reason})`);
  }

  return { assets, missing };
}
