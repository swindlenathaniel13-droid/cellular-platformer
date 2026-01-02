// js/ui.js
import { FILES } from "./assets.js";

export function uiRefs(){
  const $ = (id) => document.getElementById(id);

  return {
    bootOverlay: $("bootOverlay"),
    bootBar: $("bootBar"),
    bootText: $("bootText"),
    bootSub: $("bootSub"),
    bootFile: $("bootFile"),
    bootWarn: $("bootWarn"),
    bootStartBtn: $("bootStartBtn"),

    charOverlay: $("charOverlay"),
    charGrid: $("charGrid"),
    charStartBtn: $("charStartBtn"),

    shopOverlay: $("shopOverlay"),
    shopList: $("shopList"),
    shopSub: $("shopSub"),
    shopContinueBtn: $("shopContinueBtn"),

    hudLevel: $("hudLevel"),
    hudCoins: $("hudCoins"),
    hudDash: $("hudDash"),
    hudSpeed: $("hudSpeed"),
    hudThrow: $("hudThrow"),
    hudThrowIcon: $("hudThrowIcon"),
    hudHP: $("hudHP")
  };
}

export function setOverlay(el, show){
  if (!el) return;
  el.classList.toggle("overlay--show", !!show);
}

export function setBootProgress(ui, done, total){
  const pct = total ? Math.round((done / total) * 100) : 0;
  if (ui.bootBar) ui.bootBar.style.width = `${pct}%`;
  if (ui.bootText) ui.bootText.textContent = `${pct}%`;
}

export function showWarn(ui, text){
  if (!ui.bootWarn) return;
  ui.bootWarn.style.display = "block";
  ui.bootWarn.textContent = text;
}

export function buildCharSelect(ui, assets, onPick){
  ui.charGrid.innerHTML = "";

  const chars = [
    { key:"nate",  label:"Nate",  file: FILES.nate },
    { key:"kevin", label:"Kevin", file: FILES.kevin },
    { key:"scott", label:"Scott", file: FILES.scott },
    { key:"gilly", label:"Gilly", file: FILES.gilly },
    { key:"edgar", label:"Edgar", file: FILES.edgar },
  ];

  let selected = null;

  for (const c of chars){
    const btn = document.createElement("div");
    btn.className = "charBtn";
    btn.dataset.key = c.key;

    const img = document.createElement("img");
    img.src = `./assets/${c.file}`;
    img.alt = c.label;

    const meta = document.createElement("div");
    meta.innerHTML = `<div class="name">${c.label}</div><div class="desc">Pick your fighter.</div>`;

    btn.appendChild(img);
    btn.appendChild(meta);

    btn.addEventListener("click", () => {
      selected = c.key;
      for (const el of ui.charGrid.querySelectorAll(".charBtn")) el.classList.remove("active");
      btn.classList.add("active");
      ui.charStartBtn.disabled = false;
    });

    ui.charGrid.appendChild(btn);
  }

  ui.charStartBtn.disabled = true;
  ui.charStartBtn.onclick = () => onPick(selected);
}

export function updateHUD(ui, state){
  ui.hudLevel.textContent = `Level: ${state.level}${state.phase2 ? " (Phase 2)" : ""}`;
  ui.hudCoins.textContent = `Coins: ${state.coins}`;
  ui.hudDash.textContent = `Dash: ${state.player.dashUnlocked ? "Unlocked" : "Locked"}`;
  ui.hudSpeed.textContent = `Speed: ${state.player.dashUnlocked ? "Boosted" : "Normal"}`;
  ui.hudThrow.textContent = `Throw: ${state.player.throwCooldownT > 0 ? "Cooldown" : "Ready"}`;
  ui.hudHP.textContent = `HP: ${state.player.hp}/${state.player.hpMax}`;

  // weapon icon
  ui.hudThrowIcon.src = state.assets.phone ? state.assets.phone.src : "";
  ui.hudThrowIcon.style.visibility = state.assets.phone ? "visible" : "hidden";
}

export function buildShop(ui, state, onBuy){
  ui.shopList.innerHTML = "";

  const items = [
    {
      id: "dash",
      name: "Unlock Dash",
      desc: "Shift to dash through gaps.",
      cost: 10,
      canBuy: () => !state.player.dashUnlocked
    },
    {
      id: "hp",
      name: "+1 Max HP",
      desc: "Raises max HP by 1 (and heals 1).",
      cost: 6,
      canBuy: () => state.player.hpMax < 16
    },
    {
      id: "heal",
      name: "Heal +3",
      desc: "Quick heal (up to max).",
      cost: 4,
      canBuy: () => state.player.hp < state.player.hpMax
    }
  ];

  for (const it of items){
    const row = document.createElement("div");
    row.className = "shopItem";

    const left = document.createElement("div");
    left.className = "left";
    left.innerHTML = `<div class="name">${it.name}</div><div class="desc">${it.desc}</div>`;

    const right = document.createElement("div");
    right.innerHTML = `<div class="cost">${it.cost} coins</div>`;

    const btn = document.createElement("button");
    btn.textContent = "BUY";
    btn.disabled = !(state.coins >= it.cost && it.canBuy());

    btn.onclick = () => onBuy(it);

    row.appendChild(left);
    row.appendChild(right);
    row.appendChild(btn);

    ui.shopList.appendChild(row);
  }

  ui.shopSub.textContent = `Coins: ${state.coins} — Press ENTER or CONTINUE when ready.`;
}
