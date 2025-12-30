const IMG_FILES = {
  background: "Background_Pic.png",
  platform: "Platform.png",
  coin: "Coin.png",
  exit: "Exit_Door.png",
  checkpoint: "CheckpointFlag.png",

  Nate: "Nate.png",
  Kevin: "Kevin.png",
  Gilly: "Gilly.png",
  Scott: "Scott.png",
  Edgar: "Edgar.png",

  Enemy1: "Enemy1.png",
  Enemy2: "Enemy2.png",

  dashPU: "Powerup_Dash.png",
  speedPU: "Powerup_Speedboost.png",
  phonePU: "powerup_homephone.png",
};

export async function loadAssets(onProgress) {
  const base = "./assets/";
  const keys = Object.keys(IMG_FILES);
  const total = keys.length;

  const images = {};
  let loaded = 0;

  const loadOne = (key) =>
    new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Failed to load ${base + IMG_FILES[key]}`));
      img.src = base + IMG_FILES[key];
    });

  for (const k of keys) {
    onProgress?.(loaded / total, `Loading ${IMG_FILES[k]}…`);
    try {
      images[k] = await loadOne(k);
      loaded += 1;
      onProgress?.(loaded / total, `Loaded ${IMG_FILES[k]}`);
    } catch (e) {
      // Fail loud: better to know which file is missing
      console.error(e);
      throw e;
    }
  }

  onProgress?.(1, "Done.");
  return { images };
}

// Optional sound hooks (safe no-op if you don’t have audio yet)
export function playSound(_state, _name) {}
