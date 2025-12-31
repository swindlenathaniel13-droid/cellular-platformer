// main.js
window.__BOOT_JS_OK = true;

const FILES = {
  bg: "Background_Pic.png",
  platform: "Platform.png",
  door: "Exit_Door.png",
  flag: "CheckpointFlag.png",
  coin: "Coin.png",
  enemy1: "Enemy1.png",
  enemy2: "Enemy2.png",
  dash: "Powerup_Dash.png",
  speed: "Powerup_Speedboost.png",
  phone: "powerup_homephone.png",
  nate: "Nate.png",
  kevin: "Kevin.png",
  scott: "Scott.png",
  gilly: "Gilly.png",
  edgar: "Edgar.png"
};

const ASSET_BASE = "./assets/";
const CACHE_BUST = "v2025-12-30d";

const $ = (id) => document.getElementById(id);

const canvas = $("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Boot UI
const bootBar = $("bootBar");
const bootText = $("bootText");
const bootSub = $("bootSub");
const bootFile = $("bootFile");
const bootWarn = $("bootWarn");
const bootStartBtn = $("bootStartBtn");

const bootOverlay = $("bootOverlay");
const charOverlay = $("charOverlay");
const charGrid = $("charGrid");
const charStartBtn = $("charStartBtn");

const game = { assets: null, selectedCharKey: null };

function showWarn(text){
  if (!bootWarn) return;
  bootWarn.style.display = "block";
  bootWarn.textContent = text;
}

function setProgress(done, total){
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (bootBar) bootBar.style.width = `${pct}%`;
  if (bootText) bootText.textContent = `${pct}%`;
}

function safeUrl(file){
  return `${ASSET_BASE}${file}?${CACHE_BUST}`;
}

function loadImageWithTimeout(file, timeoutMs = 4500){
  const url = safeUrl(file);

  return new Promise((resolve) => {
    const img = new Image();
    let finished = false;

    const finish = (ok, reason) => {
      if (finished) return;
      finished = true;
      resolve({ ok, img: ok ? img : null, file, url, reason });
    };

    const t = setTimeout(() => finish(false, "timeout"), timeoutMs);

    img.onload = () => { clearTimeout(t); finish(true, "ok"); };
    img.onerror = () => { clearTimeout(t); finish(false, "error"); };

    img.src = url;
  });
}

async function loadAssets(files){
  const keys = Object.keys(files);
  const total = keys.length;

  const assets = {};
  const missing = [];
  let done = 0;

  if (bootSub) bootSub.textContent = "JS OK — Loading assets…";
  setProgress(0, total);

  for(const k of keys){
    const file = files[k];
    if (bootFile) bootFile.textContent = `Loading: ${file}`;

    const res = await loadImageWithTimeout(file, 4500);

    done++;
    setProgress(done, total);


  
