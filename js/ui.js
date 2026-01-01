// js/ui.js
export function $(id){ return document.getElementById(id); }

export function show(el){ el?.classList.add("overlay--show"); }
export function hide(el){ el?.classList.remove("overlay--show"); }

export function setBootProgress(done, total, file){
  const pct = total ? Math.round((done/total)*100) : 0;
  const bootBar = $("bootBar");
  const bootText = $("bootText");
  const bootFile = $("bootFile");
  if (bootBar) bootBar.style.width = `${pct}%`;
  if (bootText) bootText.textContent = `${pct}%`;
  if (bootFile) bootFile.textContent = file ?? "—";
}

export function setBootSub(text){
  const el = $("bootSub");
  if (el) el.textContent = text;
}

export function showBootWarn(text){
  const el = $("bootWarn");
  if (!el) return;
  el.style.display = "block";
  el.textContent = text;
}

export function updateHUD(state){
  $("hudLevel").textContent = `Level: ${state.level}`;
  $("hudCoins").textContent = `Coins: ${state.coinsTotal}`;
  $("hudDash").textContent = `Dash: ${state.player.dashUnlocked ? "Ready" : "Locked"}`;
  $("hudSpeed").textContent = `Speed: Normal`;
  $("hudThrow").textContent = `Throw: ${state.player.throwCd > 0 ? "Cooldown" : "Ready"}`;
  $("hudHP").textContent = `HP: ${state.player.hp}/${state.player.maxHP}`;
}

export function buildCharSelect(assets, onPick){
  const grid = $("charGrid");
  const startBtn = $("charStartBtn");
  grid.innerHTML = "";

  const chars = [
    { key:"nate",  label:"Nate"  },
    { key:"kevin", label:"Kevin" },
    { key:"scott", label:"Scott" },
    { key:"gilly", label:"Gilly" },
    { key:"edgar", label:"Edgar" },
  ];

  let selected = null;

  for (const c of chars){
    const btn = document.createElement("div");
    btn.className = "charBtn";
    btn.dataset.key = c.key;

    const img = document.createElement("img");
    img.src = assets[c.key]?.src ?? "";
    img.alt = c.label;

    const meta = document.createElement("div");
    meta.innerHTML = `<div style="font-family:'Press Start 2P', monospace; font-size:11px;">${c.label}</div>
                      <div class="cardSub" style="margin:6px 0 0;">Pick your fighter.</div>`;

    btn.appendChild(img);
    btn.appendChild(meta);

    btn.addEventListener("click", () => {
      selected = c.key;
      for (const el of grid.querySelectorAll(".charBtn")) el.classList.remove("active");
      btn.classList.add("active");
      startBtn.disabled = false;
    });

    grid.appendChild(btn);
  }

  startBtn.disabled = true;
  startBtn.onclick = () => onPick(selected);
}

export function openShop(state, onBuy, onClose){
  const items = $("shopItems");
  items.innerHTML = "";

  const list = [
    {
      id:"dash",
      name:"Dash Unlock",
      desc:"Unlock dash (Shift).",
      cost: 15,
      canBuy: () => !state.player.dashUnlocked
    },
    {
      id:"hp",
      name:"+2 Max HP",
      desc:"Increase max HP by 2.",
      cost: 12,
      canBuy: () => state.player.maxHP < 16
    }
  ];

  for (const it of list){
    const wrap = document.createElement("div");
    wrap.className = "shopItem";

    wrap.innerHTML = `
      <div class="name">${it.name}</div>
      <div class="desc">${it.desc}</div>
      <div class="buyRow">
        <div class="cost">${it.cost} coins</div>
        <button class="btn" style="width:auto; padding:10px 12px;">BUY</button>
      </div>
    `;

    const btn = wrap.querySelector("button");
    const ok = it.canBuy();

    btn.disabled = !ok || state.coinsTotal < it.cost;
    btn.onclick = () => onBuy(it);

    items.appendChild(wrap);
  }

  $("shopCloseBtn").onclick = onClose;
}
