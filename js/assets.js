import { clamp } from "./utils.js";

const IMG_FILES = {
  background: "assets/Background_Pic.png",
  platform: "assets/Platform.png",
  exit: "assets/Exit_Door.png",
  flag: "assets/CheckpointFlag.png",
  coin: "assets/Coin.png",
  weapon: "assets/powerup_homephone.png",
  powerupDash: "assets/Powerup_Dash.png",
  powerupSpeed: "assets/Powerup_Speedboost.png",

  Nate: "assets/Nate.png",
  Gilly: "assets/Gilly.png",
  Kevin: "assets/Kevin.png",
  Scott: "assets/Scott.png",
  Edgar: "assets/Edgar.png",

  Enemy1: "assets/Enemy1.png",
  Enemy2: "assets/Enemy2.png"
};

const SND_FILES = {
  jump: "assets/sfx_jump.mp3",
  coin: "assets/sfx_coin.mp3"
};

function fallbackImage(label){
  const c=document.createElement("canvas");
  c.width=128;c.height=128;
  const g=c.getContext("2d");
  g.fillStyle="#111a39"; g.fillRect(0,0,128,128);
  g.strokeStyle="#2c66ff"; g.lineWidth=4;
  g.strokeRect(2,2,124,124);
  g.fillStyle="#fff"; g.font="bold 14px monospace";
  g.textAlign="center"; g.fillText("MISSING",64,60);
  g.fillText(label.slice(0,10),64,82);
  const img=new Image();
  img.src=c.toDataURL();
  return img;
}

export async function loadAssets(onProgress){
  const imgs={}, sounds={};
  const entries=[...Object.entries(IMG_FILES), ...Object.entries(SND_FILES)];
  let done=0, total=entries.length;

  const tick=(msg)=>{
    done++;
    onProgress?.({done,total,pct:Math.round(done/total*100),msg});
  };

  await Promise.all(Object.entries(IMG_FILES).map(([k,path]) =>
    new Promise(res=>{
      const img=new Image();
      img.onload=()=>{ imgs[k]=img; tick("Loaded "+path); res(); };
      img.onerror=()=>{ imgs[k]=fallbackImage(k); tick("Missing "+path); res(); };
      img.src=path;
    })
  ));

  await Promise.all(Object.entries(SND_FILES).map(([k,path]) =>
    new Promise(res=>{
      const a=new Audio();
      a.oncanplaythrough=()=>{ sounds[k]=a; tick("Loaded "+path); res(); };
      a.onerror=()=>{ sounds[k]=null; tick("Missing "+path); res(); };
      a.src=path;
    })
  ));

  return {imgs,sounds};
}

export function playSound(state,name){
  const a=state.assets?.sounds?.[name];
  if(!a) return;
  const vol=clamp(state.settings.volume??0.6,0,1);
  if(vol<=0) return;
  try{
    a.pause(); a.currentTime=0; a.volume=vol;
    a.play().catch(()=>{});
  }catch{}
}

