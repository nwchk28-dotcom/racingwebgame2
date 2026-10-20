type Placement = {x:number;y:number;scale:number;opacity:number};
const KEY='formula-world:control-layout:v1';
const ids=['steer-left','steer-right','steering-track','brake','throttle'];
export class ControlLayoutEditor {
  private layout: Record<string,Placement>={};
  constructor(private root:HTMLElement, private clear:()=>void) {
    try { const saved=JSON.parse(localStorage.getItem(KEY)??'{}');
      for(const id of ids) { const p=saved[id]; if(p && [p.x,p.y,p.scale,p.opacity].every(Number.isFinite)) this.layout[id]={x:Math.max(0,Math.min(1,p.x)),y:Math.max(0,Math.min(1,p.y)),scale:Math.max(.6,Math.min(1.6,p.scale)),opacity:Math.max(.2,Math.min(1,p.opacity))}; }
    } catch { /* Storage may be disabled. */ }
    this.apply(); window.addEventListener('resize',()=>this.apply());
    for(const id of ['layout-button','pause-layout-button']) root.querySelector('#'+id)?.addEventListener('click',()=>this.open());
  }
  private apply() {
    for(const id of ids) {
      const el=this.root.querySelector<HTMLElement>('#'+id)!; const p=this.layout[id];
      if(!p) { el.removeAttribute('style'); continue; }
      Object.assign(el.style,{position:'fixed',left:`${Math.max(8,Math.min(innerWidth-el.offsetWidth-8,p.x*innerWidth-el.offsetWidth/2))}px`,top:`${Math.max(55,Math.min(innerHeight-el.offsetHeight-8,p.y*innerHeight-el.offsetHeight/2))}px`,transform:`scale(${p.scale})`,opacity:String(p.opacity),transformOrigin:'center'});
    }
  }
  private open() {
    this.clear(); const draft=structuredClone(this.layout);
    const defaults:Record<string,Placement>={
      'steer-left':{x:.10,y:.8,scale:1,opacity:1},'steer-right':{x:.24,y:.8,scale:1,opacity:1},
      'steering-track':{x:.20,y:.8,scale:1,opacity:1},brake:{x:.77,y:.8,scale:1,opacity:1},throttle:{x:.90,y:.8,scale:1,opacity:1},
    };
    const panel=document.createElement('section'); panel.className='layout-editor'; panel.setAttribute('role','dialog');panel.setAttribute('aria-label','操作ボタン配置');
    panel.innerHTML='<div class="layout-toolbar"><strong>ボタンをドラッグして配置</strong><label>大きさ <input id="layout-size" type="range" min="0.6" max="1.6" step="0.05" value="1"></label><label>透明度 <input id="layout-opacity" type="range" min="0.2" max="1" step="0.05" value="1"></label><button id="layout-reset">初期配置</button><button id="layout-cancel">キャンセル</button><button id="layout-save">保存</button><span id="layout-status" role="status"></span></div>';
    let selected=ids[0];
    const size=panel.querySelector<HTMLInputElement>('#layout-size')!,opacity=panel.querySelector<HTMLInputElement>('#layout-opacity')!;
    const clones=new Map<string,HTMLElement>();
    for(const id of ids) {
      const source=this.root.querySelector<HTMLElement>('#'+id)!,rect=source.getBoundingClientRect();
      const clone=document.createElement('button'); clone.type='button';clone.className='layout-handle';clone.textContent=id==='steer-left'?'←':id==='steer-right'?'→':id==='steering-track'?'STEERING':id==='brake'?'BRAKE':'THROTTLE';
      const p=draft[id]??(rect.width>0?{x:Math.max(.08,Math.min(.92,(rect.x+rect.width/2)/innerWidth)),y:Math.max(.3,Math.min(.85,(rect.y+rect.height/2)/innerHeight)),scale:1,opacity:1}:structuredClone(defaults[id]));draft[id]=p;
      const paint=()=>Object.assign(clone.style,{left:`${p.x*100}%`,top:`${p.y*100}%`,transform:`translate(-50%,-50%) scale(${p.scale})`,opacity:String(p.opacity)});
      paint();clones.set(id,clone);panel.append(clone);
      clone.hidden=id==='steering-track'?this.root.classList.contains('button-steering'):id.startsWith('steer-')?!this.root.classList.contains('button-steering'):false;
      clone.addEventListener('pointerdown',e=>{selected=id;size.value=String(p.scale);opacity.value=String(p.opacity);clone.setPointerCapture(e.pointerId);});
      clone.addEventListener('pointermove',e=>{if(!clone.hasPointerCapture(e.pointerId))return;p.x=Math.max(.08,Math.min(.92,e.clientX/innerWidth));p.y=Math.max(.3,Math.min(.85,e.clientY/innerHeight));paint();});
    }
    const update=()=>{const p=draft[selected];p.scale=Number(size.value);p.opacity=Number(opacity.value);const clone=clones.get(selected)!;clone.style.transform=`translate(-50%,-50%) scale(${p.scale})`;clone.style.opacity=String(p.opacity);};
    size.oninput=opacity.oninput=update;
    panel.querySelector('#layout-cancel')!.addEventListener('click',()=>panel.remove());
    panel.querySelector('#layout-reset')!.addEventListener('click',()=>{for(const id of ids){Object.assign(draft[id],defaults[id]);const c=clones.get(id)!,p=draft[id];Object.assign(c.style,{left:`${p.x*100}%`,top:`${p.y*100}%`,transform:'translate(-50%,-50%) scale(1)',opacity:'1'});}size.value='1';opacity.value='1';});
    panel.querySelector('#layout-save')!.addEventListener('click',()=>{this.layout=draft;this.apply();try{localStorage.setItem(KEY,JSON.stringify(draft));panel.remove();}catch{panel.querySelector('#layout-status')!.textContent='このブラウザでは保存できません。配置は現在の画面に適用しました。';}});
    this.root.append(panel);
  }
}
