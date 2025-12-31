import { CONFIG } from "./config.js";
import { FILES, loadAssets, safeUrl } from "./assets.js";
import { createUI, buildCharSelect, buildShop } from "./ui.js";
import { createInput } from "./input.js";
import { buildLevel } from "./world.js";
import { createPlayer, updatePlayer, takeDamage, applyShopReset } from "./player.js";
import { moveAndCollide } from "./physics.js";
import { createRenderer, draw } from "./render.js";
import { spawnEnemiesForLevel, updateEnemies, handleEnemyPlayerCollisions } from "./enemies.js";
import { clamp, aabb, now } from "./utils.js";

window.__BOOT_JS_OK = true;

const $ = (id) => document.getElementById(id);

const canvas = $("game");
const ui = createUI();
const input = createInput();
const render = createRenderer(canvas);

const game = {
  W: CONFIG.CANVAS_W,
  H: CONFIG.CANVAS_H,
  render,
  input,
  ui,

  assets: null,
  level: 1,
  world: null,
  player: null,
  enemies: [],
  projectiles: [],
  fx: [],

  camX: 0,
  camY: 0,

  mode: "BOOT", // BOOT, CHAR, PLAY, PAUSE, STAGE, SHOP, LOADING, DEAD
  selectedChar: null,

  // tutorial (runs once on level 1)
  tutorialShown: false,

  // stage stats clock
  stageStartT: 0,
};

ui.bootSub.textContent = "JS OK — Loading assets…";

function setBootProgress(done, total, file, sub){
  const pct = total ? Math.round((done/total)*100) : 0;
  ui.setBootProgress(pct, file, sub);
}

function bootWarnFromMissing(missing){
  if(!missing?.length) return;
  ui.showBootWarn(
    "Some assets failed to load:\n" +
    missing.map(m => `- ${m}`).join("\n") +
    "\n\nFix checklist:\n" +
    "• Folder name is exactly: assets\n" +
    "• Filenames match EXACT case (Coin.png ≠ coin.png)\n" +
    "• Files are at /assets (not /assets/assets)\n"
  );
}

async function boot(){
  const { assets, missing } = await loadAssets(FILES, (p)=>{
    if(p.phase === "loading"){
      setBootProgress(p.done, p.total, `Loading: ${p.file}`, "JS OK — Loading assets…");
    } else if(p.phase === "progress"){
      setBootProgress(p.done, p.total, `Loading: ${p.file}`);
    } else if(p.phase === "done"){
      setBootProgress(p.total, p.total, "—", "Assets loaded. Press START.");
    }
  });

  game.assets = assets;

  // (Important) preload character thumbs in DOM by setting src so UI can use .src
  for(const k of ["nate","kevin","scott","gilly","edgar"]){
    if(!assets[k]){
      const img = new Image();
      img.src = safeUrl(FILES[k]);
      assets[k] = img;
    }
  }

  bootWarnFromMissing(missing);
  ui.bootReady();
}

function startNewRun(level = 1){
  game.level = level;
  game.world = buildLevel(game.level);
  game.player = createPlayer(game.selectedChar || "nate");
  applyShopReset(game.player);
  game.enemies = spawnEnemiesForLevel(game.level, game.world);
  game.projectiles = [];
  game.fx = [];

  game.stageStartT = now();
  game.player.stageCoins = 0;
  game.player.stageDamage = 0;
  game.player.stageTime = 0;

  // spawn position
  game.player.x = 90;
  game.player.y = 80;

  game.mode = "PLAY";
}

function restartLevelWithReset(){
  // resets everything (including shop effects)
  startNewRun(game.level);
}

function dieToLevel1(){
  // back to level 1, full health, no tutorial again
  startNewRun(1);
  game.tutorialShown = true;
}

function nextStage(){
  game.level += 1;
  startNewRun(game.level);
}

function openStageComplete(){
  game.mode = "STAGE";
  ui.setStageStats(game);
  ui.showStage();
}

function openShop(){
  game.mode = "SHOP";
  buildShop(ui, game, (it)=>{
    const p = game.player;
    if(p.coins < it.price) return;
    p.coins -= it.price;

    if(it.id === "heal"){
      p.hp = Math.min(p.hpMax, p.hp + 3);
    }
    if(it.id === "maxhp"){
      p.hpMax += 1;
      p.hp = Math.min(p.hpMax, p.hp + 1);
    }
    if(it.id === "dash"){
      p.dashUnlocked = true;
    }
    if(it.id === "speed"){
      p.speedMult = Math.min(1.35, p.speedMult + 0.15);
    }
    if(it.id === "shield"){
      p.shieldHits += 2;
    }
    if(it.id === "magnet"){
      p.magnet = Math.min(1, p.magnet + 1);
    }
  });
  ui.showShop();
}

function closeShop(){
  ui.hideShop();
  game.mode = "PLAY";
}

function togglePause(){
  if(game.mode === "PLAY"){
    game.mode = "PAUSE";
    ui.showPause();
  } else if(game.mode === "PAUSE"){
    game.mode = "PLAY";
    ui.hidePause();
  }
}

function firePhone(){
  const p = game.player;
  if(p.throwCd > 0) return;
  p.throwCd = 0.40 / p.throwMult;

  const w = 18, h = 12;
  game.projectiles.push({
    kind: "phone",
    x: p.facing > 0 ? (p.x + p.w + 2) : (p.x - w - 2),
    y: p.y + p.h*0.45,
    w, h,
    vx: p.facing * 920,
    vy: 0,
    life: 1.2,
  });
}

function updateCamera(){
  const p = game.player;
  const worldW = game.world.W;

  const target = (p.x + p.w/2) - game.W*0.45;
  game.camX = clamp(target, 0, Math.max(0, worldW - game.W));
  game.camY = 0;
}

function updateMovingPlatforms(dt){
  for(const s of game.world.solids){
    if(s.kind !== "move") continue;
    s.move.t += dt;
    const t = (Math.sin(s.move.t*1.2) + 1) * 0.5;
    const nx = s.move.x0 + (s.move.x1 - s.move.x0) * t;
    const dx = nx - s.x;
    s.x = nx;

    // carry player if standing on it
    const p = game.player;
    const onTop = p.onGround &&
      (p.y + p.h) <= (s.y + 3) &&
      (p.x + p.w) > s.x &&
      p.x < (s.x + s.w) &&
      Math.abs((p.y+p.h) - s.y) < 4;
    if(onTop){
      p.x += dx;
    }
  }
}

function updateProjectiles(dt){
  // move, lifetime, collisions
  for(const pr of game.projectiles){
    pr.life -= dt;
    pr.x += pr.vx * dt;
    pr.y += pr.vy * dt;
  }
  game.projectiles = game.projectiles.filter(p => p.life > 0);

  // player phone hits enemies
  for(const pr of game.projectiles){
    if(pr.kind !== "phone") continue;
    for(const e of game.enemies){
      if(e.hp <= 0) continue;
      if(aabb(pr, e)){
        e.hp -= 1;
        e.hurtT = 0.25;
        pr.life = 0;
        // drop coin chance
        if(Math.random() < 0.5){
          game.world.pickups.push({ x:e.x+e.w/2, y:e.y, w:18, h:18, kind:"coin", alive:true });
        }
      }
    }
  }

  // enemy shots hit player
  const p = game.player;
  for(const pr of game.projectiles){
    if(pr.kind !== "enemyShot") continue;
    if(aabb(pr, p)){
      pr.life = 0;
      takeDamage(p, 1);
    }
  }
}

function updateCoins(dt){
  const p = game.player;

  // magnet pulls coins
  if(p.magnet > 0){
    for(const c of game.world.pickups){
      if(!c.alive) continue;
      if(c.kind !== "coin") continue;
      const dx = (p.x + p.w/2) - (c.x + c.w/2);
      const dy = (p.y + p.h/2) - (c.y + c.h/2);
      const d2 = dx*dx + dy*dy;
      if(d2 < 240*240){
        c.x += dx * dt * 3.2;
        c.y += dy * dt * 3.2;
      }
    }
  }

  for(const c of game.world.pickups){
    if(!c.alive) continue;
    if(c.kind === "coin" && aabb(p, c)){
      c.alive = false;
      p.coins += 1;
      p.stageCoins += 1;
    }
  }
}

function updateHazards(dt){
  const p = game.player;
  for(const h of game.world.hazards){
    if(aabb(p, h)){
      takeDamage(p, 1);
      // small bounce
      p.vy = -360;
      p.vx *= -0.4;
    }
  }
}

function updateFX(dt){
  // dash trail
  const p = game.player;
  if(p.dashT > 0){
    for(let i=0;i<3;i++){
      game.fx.push({
        x: p.x + rand(-2, p.w+2),
        y: p.y + rand(2, p.h-6),
        w: 4, h: 3,
        a: 0.85,
        life: 0.20,
      });
    }
  }
  for(const fx of game.fx){
    fx.life -= dt;
    fx.a = Math.max(0, fx.life / 0.20);
  }
  game.fx = game.fx.filter(f => f.life > 0);
}

function checkFlagAndDoor(){
  const p = game.player;

  // flag = shop trigger
  if(aabb(p, game.world.flag)){
    // open shop once per stage, when you touch flag
    if(!game._shopOpened){
      game._shopOpened = true;
      openShop();
    }
  }

  // door = stage complete (boss gating: if boss exists, must be dead)
  if(aabb(p, game.world.door)){
    const livingBoss = game.enemies.some(e => e.boss && e.hp > 0);
    if(!livingBoss){
      openStageComplete();
    }
  }
}

function loop(){
  requestAnimationFrame(loop);

  // pause hotkey works anywhere except boot/char
  if(input.pausePressed() && (game.mode === "PLAY" || game.mode === "PAUSE")){
    togglePause();
  }

  if(game.mode === "PLAY"){
    const dt = 1/60;

    updateMovingPlatforms(dt);

    // update stage timer
    game.player.stageTime = now() - game.stageStartT;

    updatePlayer(game.player, input, dt);

    // physics + collisions
    game.player.maxFall = 1600;
    moveAndCollide(game.player, game.world.solids, dt);

    // enemies
    updateEnemies(game.enemies, game.player, game.world, game.projectiles, dt);
    for(const e of game.enemies){
      if(e.hp <= 0) continue;
      e.maxFall = 1600;
      moveAndCollide(e, game.world.solids, dt);
    }
    handleEnemyPlayerCollisions(game.enemies, game.player);

    // projectiles, pickups, hazards
    if(input.throwPressed()) firePhone();
    updateProjectiles(dt);
    updateCoins(dt);
    updateHazards(dt);
    updateFX(dt);

    // camera
    updateCamera();

    // death: fall or hp 0
    if(game.player.y > game.world.floorY + 260 || game.player.hp <= 0){
      dieToLevel1();
    }

    // stage triggers
    checkFlagAndDoor();
  }

  // UI/hud always updates
  ui.updateHUD(game);

  // draw always
  draw(game);

  // end-of-frame input
  input.frameEnd();
}

// UI wiring
ui.bootStartBtn?.addEventListener("click", ()=>{
  ui.hideBoot();
  game.mode = "CHAR";
  ui.showChar();

  const getSelected = buildCharSelect(ui, game.assets, (k)=> game.selectedChar = k);

  ui.charStartBtn.onclick = ()=>{
    const picked = getSelected();
    game.selectedChar = picked || "nate";
    ui.hideChar();

    // start game for real
    game._shopOpened = false;
    startNewRun(1);
  };
});

ui.resumeBtn?.addEventListener("click", ()=>togglePause());

ui.restartBtn?.addEventListener("click", ()=>{
  const ok = confirm("Restart level?\n\nThis resets the level (including shop effects).");
  if(ok){
    ui.hidePause();
    restartLevelWithReset();
  }
});

ui.nextStageBtn?.addEventListener("click", ()=>{
  ui.hideStage();
  game.mode = "LOADING";
  // small arcade-ish delay then shop then next stage
  setTimeout(()=>{
    // open shop between stages
    game._shopOpened = false;
    openShop();
    // after shop close we proceed
  }, 250);
});

ui.shopCloseBtn?.addEventListener("click", ()=>{
  ui.hideShop();
  if(game.mode === "SHOP"){
    // if we came from stage complete -> go next stage
    if(game.player.stageTime > 0 && game.mode !== "PLAY"){
      // If stageOverlay was just used, proceed
      if(game.level >= 1 && game.player){
        // go next stage now
        nextStage();
        game._shopOpened = false;
      }
    }
    game.mode = "PLAY";
  }
});

// Start
boot().then(()=>{
  // keep boot overlay visible until START pressed
}).catch((err)=>{
  ui.showBootWarn(`Loader crashed:\n${String(err)}`);
});

// kick off loop
requestAnimationFrame(loop);
