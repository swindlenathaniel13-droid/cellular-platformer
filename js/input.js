import { isTouchDevice } from "./utils.js";

const DEFAULT_BINDS = {
  left: ["ArrowLeft","KeyA"],
  right:["ArrowRight","KeyD"],
  jump: ["Space"],
  throw:["KeyF"],
  dash: ["ShiftLeft","ShiftRight"],
  pause:["Escape"]
};

export class Input {
  constructor(){
    this.binds = DEFAULT_BINDS;
    this.down = new Set();
    this.pressed = new Set();
    this.held = new Set();
    this._pressedKeys = new Set();
    this.touch = {left:false,right:false,jump:false,throw:false,dash:false};

    window.addEventListener("keydown",(e)=>{
      if(!e.repeat){ this.down.add(e.code); this._pressedKeys.add(e.code); }
    });
    window.addEventListener("keyup",(e)=> this.down.delete(e.code));
    this._setupTouch();
  }

  beginFrame(){
    this.pressed.clear();
    this.held.clear();
    this._pressedKeys.clear();
  }

  endFrame(){
    const gp=(navigator.getGamepads?.()[0])||null;
    const axisX=gp?gp.axes?.[0]||0:0;
    const gpLeft=axisX<-0.3, gpRight=axisX>0.3;
    const gpJump=gp?.buttons?.[0]?.pressed;
    const gpDash=gp?.buttons?.[5]?.pressed;
    const gpThrow=gp?.buttons?.[2]?.pressed;
    const gpPause=gp?.buttons?.[9]?.pressed;

    for(const a in this.binds){
      const codes=this.binds[a];
      const held = codes.some(c=>this.down.has(c))
        || (a==="left"&&gpLeft) || (a==="right"&&gpRight)
        || (a==="jump"&&gpJump) || (a==="dash"&&gpDash)
        || (a==="throw"&&gpThrow) || (a==="pause"&&gpPause)
        || this.touch[a];

      if(held) this.held.add(a);

      const pressed = codes.some(c=>this._pressedKeys.has(c));
      if(pressed) this.pressed.add(a);
    }
  }

  isHeld(a){ return this.held.has(a); }
  isPressed(a){ return this.pressed.has(a); }

  _setupTouch(){
    const el=document.getElementById("touchControls");
    if(!el) return;
    if(isTouchDevice()) el.classList.remove("hidden");

    const set=(name,val)=> this.touch[name]=val;
    const handle=(ev,val)=>{
      const btn=ev.target.closest("[data-touch]");
      if(!btn) return;
      set(btn.dataset.touch,val);
      ev.preventDefault();
    };

    el.addEventListener("touchstart",(e)=>handle(e,true),{passive:false});
    el.addEventListener("touchend",(e)=>handle(e,false),{passive:false});
  }
}

