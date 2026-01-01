export function bindUI() {
  const $ = (id) => document.getElementById(id);

  const boot = {
    overlay: $("bootOverlay"),
    bar: $("bootBar"),
    text: $("bootText"),
    sub: $("bootSub"),
    file: $("bootFile"),
    warn: $("bootWarn"),
    start: $("bootStartBtn"),
  };

  const chars = {
    overlay: $("charOverlay"),
    grid: $("charGrid"),
    start: $("charStartBtn"),
  };

  const shop = {
    overlay: $("shopOverlay"),
    list: $("shopList"),
    sub: $("shopSub"),
    cont: $("shopContinueBtn"),
  };

  const hud = {
    level: $("hudLevel"),
    coins: $("hudCoins"),
    dash: $("hudDash"),
    speed: $("hudSpeed"),
    throw: $("hudThrow"),
    hp: $("hudHP"),
    hpMax: $("hudHPMax"),
  };

  return { boot, chars, shop, hud };
}

export function show(el) { el?.classList.add("overlay--show"); }
export function hide(el) { el?.classList.remove("overlay--show"); }

export function setBootProgress(ui, loaded, total, file) {
  const pct = total ? Math.round((loaded / total) * 100) : 0;
  if (ui.boot.bar) ui.boot.bar.style.width = `${pct}%`;
  if (ui.boot.text) ui.boot.text.textContent = `${pct}%`;
  if (ui.boot.file) ui.boot.file.textContent = file ? `Loading: ${file}` : "—";
}

export function bootWarn(ui, text) {
  if (!ui.boot.warn) return;
  ui.boot.warn.style.display = "block";
  ui.boot.warn.textContent = text;
}

export function updateHUD(ui, state) {
  ui.hud.level.textContent = String(state.world.level);
  ui.hud.coins.textContent = String(state.player.coins);
  ui.hud.dash.textContent = state.dashUnlocked ? "Ready" : "Locked";
  ui.hud.speed.textContent = "Normal";
  ui.hud.throw.textContent = state.player.throwCd <= 0 ? "Ready" : "Cooldown";
  ui.hud.hp.textContent = String(state.player.hp);
  ui.hud.hpMax.textContent = String(state.player.hpMax);
}

export function buildCharGrid(ui, assets, onPick) {
  const chars = [
    { key:"nate", label:"Nate" },
    { key:"kevin", label:"Kevin" },
    { key:"scott", label:"Scott" },
    { key:"gilly", label:"Gilly" },
    { key:"edgar", label:"Edgar" },
  ];

  ui.chars.grid.innerHTML = "";
  ui.chars.start.disabled = true;

  let selected = null;

  for (const c of chars) {
    const btn = document.createElement("div");
    btn.className = "charBtn";

    const img = document.createElement("img");
    img.src = assets?.[c.key]?.src || "";
    img.alt = c.label;

    const meta = document.createElement("div");
    meta.innerHTML = `<div style="font-family:'Press Start 2P', monospace; font-size:11px;">${c.label}</div>
                      <div class="dim tiny">Pick your fighter.</div>`;

    btn.appendChild(img);
    btn.appendChild(meta);

    btn.addEventListener("click", () => {
      selected = c.key;
      for (const el of ui.chars.grid.querySelectorAll(".charBtn")) el.classList.remove("active");
      btn.classList.add("active");
      ui.chars.start.disabled = false;
    });

    ui.chars.grid.appendChild(btn);
  }

  ui.chars.start.onclick = () => {
    if (!selected) return;
    onPick(selected);
  };
}

export function buildShop(ui, state, onBuy) {
  ui.shop.list.innerHTML = "";

  const items = [
    { id:"hp", name:"+1 HP", cost: 5, desc:"Increase max HP by 1 (also heals 1)." },
    { id:"dash", name:"Dash Unlock", cost: 12, desc:"Unlock dash for future phases." },
  ];

  for (const it of items) {
    const row = document.createElement("div");
    row.className = "shopItem";

    const left = document.createElement("div");
    left.innerHTML = `<div class="name">${it.name} (${it.cost})</div><div class="desc">${it.desc}</div>`;

    const btn = document.createElement("button");
    btn.className = "btn buy";
    btn.textContent = "BUY";
    btn.disabled = state.player.coins < it.cost;

    btn.onclick = () => onBuy(it);

    row.appendChild(left);
    row.appendChild(btn);
    ui.shop.list.appendChild(row);
  }
}
