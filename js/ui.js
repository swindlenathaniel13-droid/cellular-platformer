const $ = (sel) => document.querySelector(sel);

export function initUI(state) {
  state.ui = {
    root: $("#uiRoot"),
    toastEl: null,
    current: null,
  };

  state.ui.toast = (msg, ms = 1200) => {
    if (!state.ui.toastEl) {
      const el = document.createElement("div");
      el.className = "toast";
      state.ui.root.appendChild(el);
      state.ui.toastEl = el;
    }
    state.ui.toastEl.textContent = msg;
    state.ui.toastEl.style.display = "block";
    clearTimeout(state.ui._toastT);
    state.ui._toastT = setTimeout(() => {
      if (state.ui.toastEl) state.ui.toastEl.style.display = "none";
    }, ms);
  };

  state.ui.clear = () => {
    const keep = state.ui.toastEl;
    state.ui.root.innerHTML = "";
    if (keep) state.ui.root.appendChild(keep);
    state.ui.current = null;
  };

  state.ui.setOverlay = (el) => {
    state.ui.clear();
    state.ui.root.appendChild(el);
    state.ui.current = el;
  };

  state.ui.updateHUD = () => updateHUD(state);

  return state.ui;
}

export function updateHUD(state) {
  const levelEl = document.getElementById("hudLevel");
  const coinsEl = document.getElementById("hudCoins");
  const dashEl = document.getElementById("hudDash");
  const speedEl = document.getElementById("hudSpeed");
  const throwEl = document.getElementById("hudThrow");
  if (!levelEl) return;

  levelEl.textContent = `Level: ${state.levelIndex}`;
  coinsEl.textContent = `Coins: ${state.coins}`;
  dashEl.textContent = state.player?.dashUnlocked ? "Dash: Ready" : "Dash: Locked";
  speedEl.textContent = state.player?.speedBoost > 0 ? "Speed: Boost" : "Speed: Normal";
  throwEl.textContent = state.player?.throwCd > 0 ? "Throw: Cooling" : "Throw: Ready";
}

export function showBootLoading(state, progress01, msg = "Loading assets…") {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="panel">
      <div class="panel__title">CELLULAR PLATFORMER</div>
      <div class="panel__sub">${msg}</div>
      <div class="progress"><div style="width:${Math.floor(progress01 * 100)}%"></div></div>
      <div class="panel__sub" style="margin-top:10px;color:rgba(245,250,255,0.55);">
        GitHub Pages is case-sensitive. /assets and filenames must match exactly.
      </div>
    </div>
  `;
  state.ui.setOverlay(overlay);
}

export function showPressStart(state, onStart) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="panel">
      <div class="panel__title">CELLULAR PLATFORMER</div>
      <div class="panel__sub">Assets loaded. Press START.</div>
      <div class="btnbar"><button id="btnBootStart">START</button></div>
    </div>
  `;
  overlay.querySelector("#btnBootStart").onclick = () => onStart?.();
  state.ui.setOverlay(overlay);
}

export function showCharacterSelect(state, characters, onPick) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";

  const cards = characters.map(c => `
    <div class="card">
      <img src="${c.preview}" alt="${c.label}">
      <div class="name">${c.label}</div>
      <button data-pick="${c.key}">Select</button>
    </div>
  `).join("");

  overlay.innerHTML = `
    <div class="panel">
      <div class="panel__title">CHOOSE YOUR CHARACTER</div>
      <div class="panel__sub">Tutorial runs once on Level 1.</div>
      <div class="row">${cards}</div>
    </div>
  `;

  overlay.querySelectorAll("button[data-pick]").forEach(btn => {
    btn.onclick = () => onPick?.(btn.getAttribute("data-pick"));
  });

  state.ui.setOverlay(overlay);
}

export function showPauseMenu(state, handlers) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";

  overlay.innerHTML = `
    <div class="panel">
      <div class="panel__title">PAUSED</div>
      <div class="panel__sub">Esc resumes.</div>
      <div class="btnbar" style="justify-content:flex-start;">
        <button id="btnResume">Resume</button>
        <button id="btnRestartLevel">Restart Level</button>
        <button id="btnRestartRun">Restart Run</button>
      </div>
      <div class="panel__sub" style="margin-top:12px;">
        Restart Level resets this stage’s pickups/enemies/damage.
        Restart Run returns to Level 1 (tutorial won’t repeat).
      </div>
    </div>
  `;

  overlay.querySelector("#btnResume").onclick = () => handlers.onResume?.();
  overlay.querySelector("#btnRestartLevel").onclick = () => handlers.onRestartLevel?.();
  overlay.querySelector("#btnRestartRun").onclick = () => handlers.onRestartRun?.();

  state.ui.setOverlay(overlay);
}

export function showConfirm(state, title, body, yesLabel, noLabel, onYes, onNo) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";

  overlay.innerHTML = `
    <div class="panel">
      <div class="panel__title">${title}</div>
      <div class="panel__sub">${body}</div>
      <div class="btnbar">
        <button id="btnNo">${noLabel}</button>
        <button id="btnYes">${yesLabel}</button>
      </div>
    </div>
  `;

  overlay.querySelector("#btnYes").onclick = () => onYes?.();
  overlay.querySelector("#btnNo").onclick = () => onNo?.();
  state.ui.setOverlay(overlay);
}

export function showStageComplete(state, results, onShop, onNext) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="panel">
      <div class="panel__title">STAGE COMPLETE</div>
      <div class="kv"><span>Coins</span><span>${results.coins}</span></div>
      <div class="kv"><span>Damage</span><span>${results.damage}</span></div>
      <div class="kv"><span>Time</span><span>${results.time}</span></div>
      <div class="btnbar">
        <button id="btnShop">Shop</button>
        <button id="btnNext">Next Stage</button>
      </div>
      <div class="panel__sub" style="margin-top:10px;">Shop available once per stage (after clearing).</div>
    </div>
  `;
  overlay.querySelector("#btnShop").onclick = () => onShop?.();
  overlay.querySelector("#btnNext").onclick = () => onNext?.();
  state.ui.setOverlay(overlay);
}

export function showShop(state, shopModel, onBuy, onContinue) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";

  const rows = shopModel.items.map(it => {
    const disabled = it.disabled ? "disabled" : "";
    const sold = it.soldOut ? " (SOLD OUT)" : "";
    return `
      <div class="card" style="min-width:260px;">
        <div class="name">${it.name}${sold}</div>
        <div class="panel__sub" style="margin:0 0 10px 0;">${it.desc}</div>
        <div class="kv"><span>Cost</span><span>${it.cost}</span></div>
        <button data-buy="${it.id}" ${disabled}>BUY</button>
      </div>
    `;
  }).join("");

  overlay.innerHTML = `
    <div class="panel">
      <div class="panel__title">SHOP</div>
      <div class="panel__sub">Edgar: “Spend your coins wisely.”</div>
      <div class="kv"><span>Coins</span><span>${state.coins}</span></div>
      <div class="row">${rows}</div>
      <div class="btnbar"><button id="btnContinue">Continue</button></div>
    </div>
  `;

  overlay.querySelectorAll("button[data-buy]").forEach(btn => {
    btn.onclick = () => onBuy?.(btn.getAttribute("data-buy"));
  });
  overlay.querySelector("#btnContinue").onclick = () => onContinue?.();
  state.ui.setOverlay(overlay);
}

export function showNextStageLoading(state, progress01, titleLine) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="panel">
      <div class="panel__title">${titleLine}</div>
      <div class="panel__sub">Preparing stage…</div>
      <div class="progress"><div style="width:${Math.floor(progress01 * 100)}%"></div></div>
    </div>
  `;
  state.ui.setOverlay(overlay);
}

export function showDeath(state, summary, onRestartRun) {
  const overlay = document.createElement("div");
  overlay.className = "overlay";
  overlay.innerHTML = `
    <div class="panel">
      <div class="panel__title">YOU DIED</div>
      <div class="panel__sub">Back to Level 1 (tutorial won’t repeat). Full HP.</div>
      <div class="kv"><span>Level Reached</span><span>${summary.level}</span></div>
      <div class="kv"><span>Coins</span><span>${summary.coins}</span></div>
      <div class="btnbar"><button id="btnRestart">Restart Run</button></div>
    </div>
  `;
  overlay.querySelector("#btnRestart").onclick = () => onRestartRun?.();
  state.ui.setOverlay(overlay);
}
