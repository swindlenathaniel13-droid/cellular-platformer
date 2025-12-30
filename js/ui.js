:root{
  --bg1:#050814;
  --bg2:#0b1230;
  --panel: rgba(10,14,30,0.72);
  --panel2: rgba(10,14,30,0.88);
  --stroke: rgba(180,210,255,0.35);
  --stroke2: rgba(180,210,255,0.55);
  --text: rgba(245,250,255,0.92);
  --muted: rgba(245,250,255,0.65);
  --good: rgba(120,255,190,0.95);
  --bad: rgba(255,110,110,0.95);
  --warn: rgba(255,210,120,0.95);
}

*{ box-sizing:border-box; }
html,body{ height:100%; }
body{
  margin:0;
  background: radial-gradient(1200px 700px at 20% 0%, #142157 0%, var(--bg1) 55%) ,
              radial-gradient(1000px 600px at 90% 30%, #0f2a4c 0%, var(--bg2) 60%);
  color:var(--text);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial;
}

.page{
  max-width: 1500px;
  margin: 0 auto;
  padding: 18px;
}

.topbar{
  display:flex;
  align-items:center;
  justify-content:space-between;
  padding: 16px 18px;
  border: 1px solid var(--stroke);
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(25,40,90,0.35), rgba(10,14,30,0.55));
  box-shadow: 0 18px 70px rgba(0,0,0,0.45);
  margin-bottom: 14px;
}
.brand{
  font-family: "Press Start 2P", monospace;
  font-size: 16px;
  letter-spacing: 1px;
}
.hint{
  font-size: 12px;
  color: var(--muted);
  text-align:right;
  line-height: 1.35;
}

.shell{
  border: 1px solid var(--stroke);
  border-radius: 18px;
  background: rgba(0,0,0,0.18);
  padding: 14px;
}

.gamewrap{
  position:relative;
  border-radius: 18px;
  overflow:hidden;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(0,0,0,0.55);
}

canvas#game{
  width:100%;
  height:auto;
  display:block;
  image-rendering: pixelated;
}

.footer{
  margin-top: 10px;
  text-align:center;
  color: rgba(245,250,255,0.55);
  font-size: 12px;
}

/* HUD chips */
.hud{
  position:absolute;
  left: 14px;
  bottom: 14px;
  display:flex;
  gap: 10px;
  flex-wrap: wrap;
  pointer-events:none;
}
.chip{
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(10,14,30,0.65);
  border: 1px solid rgba(180,210,255,0.22);
  backdrop-filter: blur(8px);
  font-size: 12px;
  font-family: "Press Start 2P", monospace;
}

/* UI Root overlays */
.uiRoot{
  position:absolute;
  inset:0;
  pointer-events:none;
}

/* Modal overlay base */
.overlay{
  position:absolute;
  inset:0;
  display:flex;
  align-items:center;
  justify-content:center;
  background: rgba(0,0,0,0.55);
  backdrop-filter: blur(6px);
  pointer-events:auto;
}

.panel{
  width: min(920px, 92vw);
  border-radius: 18px;
  background: var(--panel2);
  border: 1px solid var(--stroke2);
  box-shadow: 0 28px 90px rgba(0,0,0,0.55);
  padding: 18px;
}

.panel__title{
  font-family:"Press Start 2P", monospace;
  font-size: 18px;
  margin: 0 0 10px 0;
  letter-spacing: 1px;
}
.panel__sub{
  color: var(--muted);
  font-size: 12px;
  margin: 0 0 14px 0;
  line-height: 1.5;
}

.row{
  display:flex;
  gap: 12px;
  flex-wrap: wrap;
}

.card{
  flex: 1 1 180px;
  min-width: 180px;
  border-radius: 16px;
  padding: 12px;
  background: rgba(10,14,30,0.60);
  border: 1px solid rgba(180,210,255,0.20);
}

.card img{
  width: 92px;
  height: 92px;
  display:block;
  margin-bottom: 10px;
  image-rendering: pixelated;
}

.card .name{
  font-family:"Press Start 2P", monospace;
  font-size: 12px;
  margin-bottom: 10px;
}

.btnbar{
  display:flex;
  justify-content:flex-end;
  gap: 10px;
  margin-top: 14px;
  flex-wrap: wrap;
}

button{
  border: 1px solid rgba(180,210,255,0.25);
  background: rgba(25,40,90,0.35);
  color: var(--text);
  padding: 10px 14px;
  border-radius: 14px;
  cursor:pointer;
  font-family:"Press Start 2P", monospace;
  font-size: 12px;
}
button:hover{ border-color: rgba(180,210,255,0.5); }
button:disabled{
  opacity:0.5;
  cursor:not-allowed;
}

.progress{
  width:100%;
  height: 14px;
  border-radius: 999px;
  background: rgba(255,255,255,0.12);
  border: 1px solid rgba(180,210,255,0.25);
  overflow:hidden;
}
.progress > div{
  height:100%;
  width:0%;
  background: rgba(120,255,190,0.75);
}

.kv{
  display:flex;
  justify-content:space-between;
  gap: 12px;
  font-family:"Press Start 2P", monospace;
  font-size: 12px;
  margin: 8px 0;
}
.kv span:last-child{ color: var(--good); }

.toast{
  position:absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(10,14,30,0.88);
  border: 1px solid rgba(180,210,255,0.35);
  padding: 10px 14px;
  border-radius: 14px;
  font-family:"Press Start 2P", monospace;
  font-size: 12px;
  pointer-events:none;
}

