import { fmtTime } from "./utils.js";

const $ = (id) => document.getElementById(id);
const show = (el) => el.classList.add("overlay--show");
const hide = (el) => el.classList.remove("overlay--show");

export function createUI(){
  const ui = {
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

    pauseOverlay: $("pauseOverlay"),
    resumeBtn: $("resumeBtn"),
    restartBtn: $("restartBtn"),

    stageOverlay: $("stageOverlay"),
    stageStats: $("stageStats"),
    nextStageBtn: $("nextStageBtn"),

    shopOverlay: $("shopOverlay"),
    shopList: $("shopList"),
    shopCloseBtn: $("shopCloseBtn"),

    hudLevel: $("hudLevel"),
    hudCoins: $("hudCoins"),
    hudDash: $("hudDash"),
    hudSpeed: $("hudSpeed"),
    hudThrow: $("hudThrow"),
    hudHP: $("hudHP"),
  };

  ui.setBootProgress = (pct, file, sub)=>{
    if(ui.bootBar) ui.bootBar.style.width = `${pct}%`;
    if(ui.bootText) ui.bootText.textContent = `${pct}%`;
    if(ui.bootFile) ui.bootFile.textContent = file ?? "—";
    if(ui.bootSub && sub) ui.bootSub.textContent = sub;
  };

  ui.showBootWarn = (text)=>{
    if(!ui.bootWarn) return;
    ui.bootWarn.style.display = "block";
    ui.bootWarn.textContent = text;
  };

  ui.bootReady = ()=>{
    if(ui.bootSub) ui.bootSub.textContent = "Assets loaded. Press START.";
    if(ui.bootStartBtn) ui.bootStartBtn.disabled = false;
  };

  ui.showBoot = ()=>show(ui.bootOverlay);
  ui.hideBoot = ()=>hide(ui.bootOverlay);

  ui.showChar = ()=>show(ui.charOverlay);
  ui.hideChar = ()=>hide(ui.charOverlay);

  ui.showPause = ()=>show(ui.pauseOverlay);
  ui.hidePause = ()=>hide(ui.pauseOverlay);

  ui.showStage = ()=>show(ui.stageOverlay);
  ui.hideStage = ()=>hide(ui.stageOverlay);

  ui.showShop = ()=>show(ui.shopOverlay);
  ui.hideShop = ()=>hide(ui.shopOverlay);

  ui.updateHUD = (game)=>{
    const p = game.player;
    ui.hudLevel.textContent = String(game.level);
    ui.hudCoins.textContent = String(p.coins);
    ui.hudDash.textContent = p.dashUnlocked ? (p.dashCd>0 ? "Cooldown" : "Ready") : "Locked";
    ui.hudSpeed.textContent = (p.speedMult > 1.01) ? "Boost" : "Normal";
    ui.hudThrow.textContent = (p.throwCd>0) ? "Cooldown" : "Ready";
    ui.hudHP.textContent = `${p.hp}/${p.hpMax}`;
  };

  ui.setStageStats = (game)=>{
    const p = game.player;
    ui.stageStats.textContent =
`Time:        ${fmtTime(p.stageTime)}
Coins:       ${p.stageCoins}
Damage Taken:${p.stageDamage}
Level:       ${game.level}`;
  };

  return ui;
}

export function buildCharSelect(ui, assets, onPick){
  ui.charGrid.innerHTML = "";

  const chars = [
    { key:"nate",  label:"Nate" },
    { key:"kevin", label:"Kevin" },
    { key:"scott", label:"Scott" },
    { key:"gilly", label:"Gilly" },
    { key:"edgar", label:"Edgar" },
  ];

  let selected = null;
  ui.charStartBtn.disabled = true;

  for(const c of chars){
    const btn = document.createElement("div");
    btn.className = "charBtn";
    btn.dataset.key = c.key;

    const img = document.createElement("img");
    img.src = assets?.[c.key]?.src || "";
    img.alt = c.label;

    const meta = document.createElement("div");
    meta.innerHTML = `<div class="mono" style="font-size:11px;">${c.label}</div><div class="small dim">Pick your fighter.</div>`;

    btn.appendChild(img);
    btn.appendChild(meta);

    btn.addEventListener("click", ()=>{
      selected = c.key;
      for(const el of ui.charGrid.querySelectorAll(".charBtn")) el.classList.remove("active");
      btn.classList.add("active");
      ui.charStartBtn.disabled = false;
      onPick?.(selected);
    });

    ui.charGrid.appendChild(btn);
  }

  return () => selected;
}

export function buildShop(ui, game, onBuy){
  const p = game.player;
  ui.shopList.innerHTML = "";

  const items = [
    { id:"heal", name:"+3 HP", price: 6, desc:"Emergency patch. Restores 3 HP (cannot exceed max)." },
    { id:"maxhp", name:"+1 Max HP", price: 10, desc:"Permanent for this run. Raises max HP by 1." },
    { id:"dash", name:"Unlock Dash", price: 14, desc:"Unlock Shift dash for this run." },
    { id:"speed", name:"Speed Boost", price: 10, desc:"Run faster for this run." },
    { id:"shield", name:"Shield (2 hits)", price: 12, desc:"Blocks 2 hits this run." },
    { id:"magnet", name:"Coin Magnet", price: 10, desc:"Coins pull toward you for this run." },
  ];

  for(const it of items){
    const wrap = document.createElement("div");
    wrap.className = "shopItem";

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = it.name;

    const desc = document.createElement("div");
    desc.className = "desc";
    desc.textContent = it.desc;

    const buyRow = document.createElement("div");
    buyRow.className = "buyRow";

    const price = document.createElement("div");
    price.className = "price";
    price.textContent = `${it.price} coins`;

    const btn = document.createElement("button");
    btn.className = "btn";
    btn.textContent = "BUY";
    btn.disabled = p.coins < it.price;

    btn.addEventListener("click", ()=>{
      onBuy?.(it);
      buildShop(ui, game, onBuy);
    });

    buyRow.appendChild(price);
    buyRow.appendChild(btn);

    wrap.appendChild(name);
    wrap.appendChild(desc);
    wrap.appendChild(buyRow);

    ui.shopList.appendChild(wrap);
  }
}
