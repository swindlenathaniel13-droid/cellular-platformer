:root{
  --bg1:#061023;
  --bg2:#0b1e43;
  --panel:#071433cc;
  --stroke:#1c3a73;
  --text:#e9f1ff;
  --dim:#9bb3da;
}

*{ box-sizing:border-box; }
html,body{ height:100%; }
body{
  margin:0;
  background: radial-gradient(ellipse at top, #0b2d6d 0%, #061023 60%, #020611 100%);
  color:var(--text);
  font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
}

.shell{
  max-width: 1200px;
  margin: 18px auto;
  padding: 14px;
}

.topbar{
  display:flex;
  justify-content:space-between;
  align-items:center;
  padding: 12px 16px;
  border-radius: 16px;
  background: linear-gradient(180deg, rgba(20,46,100,.85), rgba(7,20,51,.85));
  border: 1px solid rgba(28,58,115,.7);
  box-shadow: 0 12px 40px rgba(0,0,0,.35);
}

.title{
  font-family: "Press Start 2P", monospace;
  font-size: 18px;
  letter-spacing: 1px;
}

.help{
  font-size: 12px;
  color: var(--dim);
}

.screen{
  margin-top: 12px;
  position: relative;
  border-radius: 18px;
  overflow:hidden;
  background: rgba(0,0,0,.55);
  border: 1px solid rgba(28,58,115,.5);
  box-shadow: 0 18px 55px rgba(0,0,0,.45);
}

canvas{
  width:100%;
  height:auto;
  display:block;
  image-rendering: pixelated;
  background: #000;
}

.hud{
  display:flex;
  gap:10px;
  flex-wrap:wrap;
  padding: 12px 6px;
  align-items:center;
}

.chip{
  padding: 10px 12px;
  border-radius: 999px;
  background: rgba(7,20,51,.75);
  border: 1px solid rgba(28,58,115,.55);
  color: var(--text);
  font-size: 12px;
}

.chip span{ color: var(--dim); margin-right: 6px; }
.chip.dim{ color: var(--dim); }

.overlay{
  position:absolute;
  inset:0;
  display:none;
  align-items:center;
  justify-content:center;
  background: rgba(0,0,0,.55);
}

.overlay--show{ display:flex; }

.panel{
  width: 520px;
  max-width: calc(100% - 24px);
  padding: 18px 18px 16px;
  border-radius: 16px;
  background: var(--panel);
  border: 1px solid rgba(28,58,115,.65);
  box-shadow: 0 18px 60px rgba(0,0,0,.55);
}

.panel.wide{ width: 740px; }

.panelTitle{
  font-family:"Press Start 2P", monospace;
  font-size: 16px;
  margin-bottom: 8px;
}

.panelSub{
  color: var(--dim);
  font-size: 12px;
  margin-bottom: 14px;
}

.bar{
  height: 10px;
  border-radius: 999px;
  background: rgba(255,255,255,.08);
  border: 1px solid rgba(255,255,255,.08);
  overflow:hidden;
}
.barFill{
  height: 100%;
  width: 0%;
  background: linear-gradient(90deg, #6fb7ff, #98ffcc);
}

.row{
  display:flex;
  justify-content:space-between;
  margin-top: 10px;
  font-size: 12px;
  color: var(--dim);
}

.warn{
  margin-top: 12px;
  padding: 10px;
  border-radius: 12px;
  background: rgba(160,40,40,.22);
  border: 1px solid rgba(255,80,80,.35);
  white-space: pre-wrap;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
  font-size: 12px;
  color: #ffd7d7;
}

.btn{
  margin-top: 14px;
  width: 100%;
  padding: 12px 12px;
  border-radius: 12px;
  border: 1px solid rgba(28,58,115,.7);
  background: rgba(13,35,80,.9);
  color: var(--text);
  font-family:"Press Start 2P", monospace;
  font-size: 12px;
  cursor:pointer;
}

.btn:disabled{
  opacity:.45;
  cursor:not-allowed;
}

.tiny{
  margin-top: 10px;
  color: var(--dim);
  font-size: 12px;
}

.charGrid{
  display:grid;
  grid-template-columns: repeat(2, minmax(0,1fr));
  gap: 10px;
  margin-top: 10px;
}

.charBtn{
  display:flex;
  gap: 12px;
  align-items:center;
  padding: 10px;
  border-radius: 12px;
  background: rgba(255,255,255,.05);
  border: 1px solid rgba(28,58,115,.45);
  cursor:pointer;
}
.charBtn:hover{ border-color: rgba(145,190,255,.8); }
.charBtn.active{ outline: 2px solid rgba(145,190,255,.9); }

.charBtn img{
  width: 46px;
  height: 46px;
  image-rendering: pixelated;
}
