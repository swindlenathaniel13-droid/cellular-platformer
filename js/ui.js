export function createUI(){
  const $ = (id) => document.getElementById(id);

  const boot = {
    overlay: $("bootOverlay"),
    bar: $("bootBar"),
    text: $("bootText"),
    sub: $("bootSub"),
    file: $("bootFile"),
    warn: $("bootWarn"),
    startBtn: $("bootStartBtn")
  };

  const chars = {
    overlay: $("charOverlay"),
    grid: $("charGrid"),
    startBtn: $("charStartBtn")
  };

  const pause = {
    overlay: $("pauseOverlay"),
    resumeBtn: $("pauseResumeBtn"),
    restartRunBtn: $("pauseRestartRunBtn")
  };

  const shop = {
    overlay: $("shopOverlay"),
    coins: $("shopCoins"),
    list: $("shopList"),
    contBtn: $("shopContinueBtn")
  };

  const stage = {
    overlay: $("stageOverlay"),
    stats: $("stageStats"),
    contBtn: $("stageContinueBtn")
  };

  const death = {
    overlay: $("deathOverlay"),
    restartBtn: $("deathRestartBtn")
  };

  const hud = {
    level: $("hudLevel"),
    coins: $("hudCoins"),
    dash: $("hudDash"),
    speed: $("hudSpeed"),
    hp: $("hudHP")
  };

  const show = (el) => el && el.classList.add("overlay--show");
  const hide = (el) => el && el.classList.remove("overlay--show");

  return {
    boot, chars, pause, shop, stage, death, hud,
    show, hide
  };
}

export function setBootProgress(ui, done, total, file){
  const pct = total ? Math.round((done/total)*100) : 0;
  if (ui.boot.bar) ui.boot.bar.style.width = `${pct}%`;
  if (ui.boot.text) ui.boot.text.textContent = `${pct}%`;
  if (ui.boot.file) ui.boot.file.textContent = file ? `Loading: ${file}` : "—";
}

export function showBootWarn(ui, text){
  if (!ui.boot.warn) return;
  ui.boot.warn.style.display = "block";
  ui.boot.warn.textContent = text;
}

export function setHUD(ui, state){
  if (ui.hud.level) ui.hud.level.textContent = `Level: ${state.level}`;
  if (ui.hud.coins) ui.hud.coins.textContent = `Coins: ${state.coins}`;
  if (ui.hud.dash) ui.hud.dash.textContent = `Dash: ${state.dashUnlocked ? "Ready" : "Locked"}`;
  if (ui.hud.speed) ui.hud.speed.textContent = `Speed: ${state.speedTier === 0 ? "Normal" : `Boost ${state.speedTier}`}`;
  if (ui.hud.hp) ui.hud.hp.textContent = `HP: ${state.hp}/${state.maxHP}`;
}

export function buildCharSelect(ui, assets, onPick){
  const chars = [
    { key:"nate",  label:"Nate" },
    { key:"kevin", label:"Kevin" },
    { key:"scott", label:"Scott" },
    { key:"gilly", label:"Gilly" },
    { key:"edgar", label:"Edgar" },
  ];

  ui.chars.grid.innerHTML = "";
  ui.chars.startBtn.disabled = true;

  let picked = null;

  for (const c of chars){
    const btn = document.createElement("div");
    btn.className = "charBtn";

    const img = document.createElement("img");
    img.src = assets[c.key]?.src || "";
    img.alt = c.label;

    const meta = document.createElement("div");
    meta.innerHTML =
      `<div style="font-family:'Press Start 2P', monospace; font-size:11px;">${c.label}</div>
       <div class="desc">Pick your fighter.</div>`;

    btn.appendChild(img);
    btn.appendChild(meta);

    btn.addEventListener("click", () => {
      picked = c.key;
      for (const el of ui.chars.grid.querySelectorAll(".charBtn")) el.classList.remove("active");
      btn.classList.add("active");
      ui.chars.startBtn.disabled = false;
    });

    ui.chars.grid.appendChild(btn);
  }

  ui.chars.startBtn.onclick = () => {
    if (!picked) return;
    onPick(picked);
  };
}

export function showShop(ui, runState, onBuy, onContinue){
  ui.shop.coins.textContent = `Coins: ${runState.coins}`;

  const items = [
    {
      id: "dash",
      name: "DASH UNLOCK",
      cost: 20,
      desc: "Unlock dash (Shift).",
      canBuy: () => !runState.dashUnlocked
    },
    {
      id: "speed",
      name: "SPEED BOOST",
      cost: 15,
      desc: "Faster movement (stacks up to 3).",
      canBuy: () => runState.speedTier < 3
    },
    {
      id: "hp",
      name: "MAX HP +1",
      cost: 25,
      desc: "Increase max HP (up to +5).",
      canBuy: () => runState.maxHP < runState.baseHP + 5
    }
  ];

  ui.shop.list.innerHTML = "";
  for (const it of items){
    const row = document.createElement("div");
    row.className = "shopItem";

    const left = document.createElement("div");
    left.innerHTML = `<b>${it.name}</b><div class="desc">${it.desc}</div>`;

    const right = document.createElement("div");
    right.className = "right";

    const cost = document.createElement("div");
    cost.className = "cost";
    cost.textContent = `${it.cost} coins`;

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.style.width = "auto";
    btn.textContent = "BUY";

    const enabled = it.canBuy() && runState.coins >= it.cost;
    btn.disabled = !enabled;

    btn.onclick = () => {
      onBuy(it.id, it.cost);
      showShop(ui, runState, onBuy, onContinue); // refresh
    };

    right.appendChild(cost);
    right.appendChild(btn);

    row.appendChild(left);
    row.appendChild(right);
    ui.shop.list.appendChild(row);
  }

  ui.shop.contBtn.onclick = onContinue;
}

export function showStageComplete(ui, stats, onContinue){
  ui.stage.stats.innerHTML =
    `Coins collected: <b>${stats.stageCoins}</b><br/>` +
    `Damage taken: <b>${stats.damageTaken}</b><br/>` +
    `Time: <b>${stats.time.toFixed(1)}s</b><br/>` +
    `Total coins: <b>${stats.totalCoins}</b>`;
  ui.stage.contBtn.onclick = onContinue;
}
