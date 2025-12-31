// main.js (Loader Diagnostics + Main Loop base)

const CONFIG = {
  VIEW_W: 1280,
  VIEW_H: 720,
};

const ASSET_BASE = "./assets/";

// Cache-bust for debugging deploy issues (change this number if needed)
const CACHE_BUST = "v2025-12-30b";

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

// Other overlays (we won’t fully use them in this loader-fix pass, but keep references safe)
const charOverlay = $("charOverlay");
const charGrid = $("charGrid");
const charStartBtn = $("charStartBtn");

// Minimal game container
const game = {
  mode: "boot",
  assets: null,
  selectedCharKey: null,
};

function showWarn(text){
  bootWarn.style.display = "block";
  bootWarn.textContent = text;
}

function setProgress(done, total){
  const pct = total ? Math.round((done / total) * 100) : 0;
  bootBar.style.width = `${pct}%`;
  bootText.textContent = `${pct}%`;
}

function safeUrl(file){
  // Add cache bust so GitHub Pages doesn’t serve an old deploy forever
  return `${ASSET_BASE}${file}?${CACHE_BUST}`;
}

function loadImageWithTimeout(file, timeoutMs = 4500){
  const url = safeUrl(file);

  return new Promise((resolve) => {
    const img = new Image();
    let finished = false;

    const finish = (ok, reason) => {
      if(finished) return;
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

  // Important: update UI immediately so we can tell JS is alive
  bootSub.textContent = "JS OK — Loading assets…";
  setProgress(0, total);

  // Load sequentially for super-clear debugging (you’ll see the filename change)
  for(const k of keys){
    const file = files[k];
    bootFile.textContent = `Loading: ${file}`;

    const res = await loadImageWithTimeout(file, 4500);

    done++;
    setProgress(done, total);

    if(res.ok){
      assets[k] = res.img;
    } else {
      missing.push(`${file}  (${res.reason})`);
    }
  }

  bootFile.textContent = "—";

  if(missing.length){
    showWarn(
      "Some assets failed to load:\n" +
      missing.map(m => `- ${m}`).join("\n") +
      "\n\nCheck:\n" +
      "1) Folder name is exactly: assets\n" +
      "2) Filenames match EXACT case (Coin.png vs coin.png)\n" +
      "3) Files are at /assets (not /assets/assets)\n"
    );
  }

  return assets;
}

function buildCharSelect(){
  // If you haven’t wired gameplay yet, at least show the select as proof JS/UI works
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
  // If you ever see “Waiting for JavaScript…” forever, main.js is not running.
  bootSub.textContent = "JS OK — Starting loader…";
  bootStartBtn.disabled = true;

  // Catch module/script errors and show them on-screen
  window.addEventListener("error", (e) => {
    showWarn(`JS Error:\n${e.message}`);
  });

  try {
    game.assets = await loadAssets(FILES);
    bootSub.textContent = "Assets loaded. Press START.";
    bootStartBtn.disabled = false;
  } catch (err){
    showWarn(`Loader crashed:\n${String(err)}`);
  }
}

bootStartBtn.addEventListener("click", () => {
  hide(bootOverlay);
  show(charOverlay);
  buildCharSelect();
});

charStartBtn.addEventListener("click", () => {
  // Temporary: just confirm we made it this far
  alert(`Selected: ${game.selectedCharKey}\nNext: hook in your game loop/world here.`);
});

// Minimal render loop so canvas stays “alive”
function render(){
  ctx.clearRect(0,0,CONFIG.VIEW_W,CONFIG.VIEW_H);
  ctx.fillStyle = "#000";
  ctx.fillRect(0,0,CONFIG.VIEW_W,CONFIG.VIEW_H);
  requestAnimationFrame(render);
}

startBoot();
requestAnimationFrame(render);
