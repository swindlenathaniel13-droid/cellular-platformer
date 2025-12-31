// main.js (Loader Diagnostics + Boot)
// FIRST LINE: flip watchdog flag so index.html knows JS is alive
window.__BOOT_JS_OK = true;

const CONFIG = {
  VIEW_W: 1280,
  VIEW_H: 720,
};

const ASSET_BASE = "./assets/";

// Change this string whenever you deploy if caching is being annoying
const CACHE_BUST = "v2025-12-30c";

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

const $ = (id) => document.getElementById(id);

const canvas = $("game");
const ctx = canvas.getContext("2d");
ctx.imageSmoothingEnabled = false;

// Boot UI
const bootOverlay = $("bootOverlay");
const bootBar = $("bootBar");
const bootText = $("bootText");
const bootWarn = $("bootWarn");
const bootStartBtn = $("bootStartBtn");
const bootSub = $("bootSub");
const bootFile = $("bootFile");

// Character UI
const charOverlay = $("charOverlay");
const charGrid = $("charGrid");
const charStartBtn = $("charStartBtn");

const game = {
  mode: "boot",
  assets: null,
  selectedCharKey: null,
};

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

  // Load sequentially for clear debugging
  for(const k of keys){
    const file = files[k];
    if (bootFile) bootFile.textContent = `Loading: ${file}`;

    const res = await loadImageWithTimeout(file, 4500);

    done++;
    setProgress(done, total);

    if(res.ok){
      assets[k] = res.img;
    } else {
      missing.push(`${file} (${res.reason})`);
    }
  }

  if (bootFile) bootFile.textContent = "—";

  if(missing.length){
    showWarn(
      "Some assets failed to load:\n" +
      missing.map(m => `- ${m}`).join("\n") +
      "\n\nFix checklist:\n" +
      "• Folder name is exactly: assets\n" +
      "• Filenames match EXACT case (Coin.png ≠ coin.png)\n" +
      "• Files are at /assets (not /assets/assets)\n"
    );
  }

  return assets;
}

function buildCharSelect(){
  charGrid.innerHTML = "";

  const chars = [
    { key:"nate",  label:"Nate",  file: FILES.nate },
    { key:"kevin", label:"Kevin", file: FILES.kevin },
    { key:"scott", label:"Scott", file: FILES.scott },
    { key:"gilly", label:"Gilly", file: FILES.gilly },
    { key:"edgar", label:"Edgar", file: FILES.edgar },
  ];

  for(const c of chars){
    const btn = document.createElement("div");
    btn.className = "charBtn";
    btn.dataset.key = c.key;

    const img = document.createElement("img");
    img.src = safeUrl(c.file);
    img.alt = c.label;

    const meta = document.createElement("div");
    meta.innerHTML = `<div style="font-family:'Press Start 2P', monospace; font-size:11px;">${c.label}</div>
                      <div class="small dim">Pick your fighter.</div>`;

    btn.appendChild(img);
    btn.appendChild(meta);

    btn.addEventListener("click", () => {
      game.selectedCharKey = c.key;
      for(const el of charGrid.querySelectorAll(".charBtn")) el.classList.remove("active");
      btn.classList.add("active");
      charStartBtn.disabled = false;
    });

    charGrid.appendChild(btn);
  }

  charStartBtn.disabled = true;
}

function hide(el){ el.classList.remove("overlay--show"); }
function show(el){ el.classList.add("overlay--show"); }

async function startBoot(){
  if (bootSub) bootSub.textContent = "JS OK — Starting loader…";
  if (bootStartBtn) bootStartBtn.disabled = true;

  game.assets = await loadAssets(FILES);

  if (bootSub) bootSub.textContent = "Assets loaded. Press START.";
  if (bootStartBtn) bootStartBtn.disabled = false;
}

bootStartBtn?.addEventListener("click", () => {
  hide(bootOverlay);
  show(charOverlay);
  buildCharSelect();
});

charStartBtn?.addEventListener("click", () => {
  alert(`Selected: ${game.selectedCharKey}\nNext: hook into your game loop/world here.`);
});

// Keep canvas alive
function render(){
  ctx.clearRect(0,0,CONFIG.VIEW_W,CONFIG.VIEW_H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,CONFIG.VIEW_W,CONFIG.VIEW_H);
  requestAnimationFrame(render);
}

startBoot().catch(err => {
  showWarn(`Loader crashed:\n${String(err)}`);
});

requestAnimationFrame(render);
