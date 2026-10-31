import * as THREE from 'three';
import type { TrackPath } from './trackPath';
import type { NativeCircuit } from './nativeCircuit';
import { terrainHeight } from './terrainScenery';
import { addLandmark, palmCrownGeometry } from './sceneryLandmarks';

export type FacilityKind='pit'|'stand'|'hotel'|'wing'|'wheel'|'tower'|'pagoda'|'castle'|'casino'|'marina-hotel'|'sphere'|'stadium'|'umbrella'|'bull'|'banking'|'city'|'water'|'hill'|'dune'|'hangar';
export interface CircuitFacility {
  id:string; distance:number; offset:number; width:number; length:number;
  height:number; kind:FacilityKind; roof?:boolean; color?:number;
}
export interface ForestBand {start:number;end:number;inner:number;outer:number;side?:number}
export interface CircuitSceneryProfile {
  id:string; facilities:readonly CircuitFacility[]; forests:readonly ForestBand[];
  treeCount:number; seed:number; normalized?:boolean;
  vegetation?:'temperate'|'pine'|'palm'|'dry';
  seatColors?:readonly number[]; roofColor?:number;
  placementAttempts?:number; placementStep?:number;
  placementShift?:number;
  references?:readonly string[];
}
export interface PlacedFacility extends CircuitFacility {x:number;z:number;y:number;yaw:number}
interface Tree {x:number;y:number;z:number;scale:number;broadleaf:boolean;color:THREE.Color}
const waterLevels=new WeakMap<NativeCircuit,Map<string,number>>();

export function sceneryFrame(path:TrackPath,distance:number,offset=0){
  const ribbon=path.ribbon!,i=ribbon.segmentAt(distance/path.length);
  const t=(distance-path.distances[i])/(path.distances[i+1]-path.distances[i]);
  const p=ribbon.at(i,t,offset),f=ribbon.frame(i,t);
  return {...p,yaw:Math.atan2(f.dx,f.dz)};
}
function local(x:number,z:number,p:{x:number;z:number;yaw:number}){
  const dx=x-p.x,dz=z-p.z,c=Math.cos(p.yaw),s=Math.sin(p.yaw);
  return {x:dx*c-dz*s,z:dx*s+dz*c};
}
function world(x:number,z:number,p:{x:number;z:number;yaw:number}){
  const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
  return {x:p.x+x*c+z*s,z:p.z-x*s+z*c};
}
/** Reject facilities whose footprint reaches ANY arm of the road/corridor.
 * New approximate profiles may slide a short distance along the track. Spa's
 * approved profile keeps its original outward-only placement search. */
export function placeCircuitFacilities(path:TrackPath,profile:CircuitSceneryProfile):PlacedFacility[]{
  const field=path.native.terrain,placed:PlacedFacility[]=[];
  for(const entry of profile.facilities){
    const spec={...entry,distance:entry.distance*(profile.normalized?path.length:1)};
    const candidates:{lateral:number;along:number}[]=[];
    for(let attempt=0;attempt<(profile.placementAttempts??9);attempt++)for(let along=-(profile.placementShift??0);along<=(profile.placementShift??0);along+=20)candidates.push({lateral:attempt*(profile.placementStep??8),along});
    candidates.sort((a,b)=>a.lateral+Math.abs(a.along)-b.lateral-Math.abs(b.along));
    for(const candidate of candidates){
      const distance=((spec.distance+candidate.along)%path.length+path.length)%path.length;
      const p=sceneryFrame(path,distance,spec.offset+Math.sign(spec.offset)*candidate.lateral);
      const corners=[[-1,-1],[-1,1],[1,-1],[1,1]].map(([x,z])=>world(x*spec.width/2,z*spec.length/2,p));
      if(corners.some(q=>q.x<field.minX||q.z<field.minZ||q.x>=field.minX+(field.columns-1)*field.spacing||q.z>=field.minZ+(field.rows-1)*field.spacing))continue;
      let clear=true;
      for(let i=0;i<path.sampleCount;i++){
        const q=local(path.samples[i].x,path.samples[i].z,p);
        const normal=path.native.normals[i],side=(p.x-path.samples[i].x)*normal[0]+(p.z-path.samples[i].z)*normal[1];
        const margin=(profile.id==='spa'?Math.max(path.native.corridor.left[i],path.native.corridor.right[i]):side>=0?path.native.corridor.left[i]:path.native.corridor.right[i])+6;
        if(Math.abs(q.x)<spec.width/2+margin&&Math.abs(q.z)<spec.length/2+margin){clear=false;break;}
      }
      if(!clear)continue;
      // A shallow foundation follows the hillside; the occupied floor is level.
      const heights=[[-1,-1],[-1,1],[1,-1],[1,1],[0,0]].map(([x,z])=>{
        const q=world(x*spec.width/2,z*spec.length/2,p);return terrainHeight(field,q.x,q.z);
      });
      placed.push({...spec,distance,x:p.x,z:p.z,y:Math.max(...heights)+.25,yaw:p.yaw});break;
    }
  }
  return placed;
}

/** Carve the scenic water bed before terrain meshes are built. Road/runoff
 * geometry and physics remain untouched. Cache the datum so reloads cannot
 * lower the water repeatedly or mutate the imported source JSON. */
export function prepareCircuitLandscape(path:TrackPath,profile:CircuitSceneryProfile):void{
  const data=path.native;if(waterLevels.has(data)||!profile.facilities.some(p=>p.kind==='water'))return;
  const waters=placeCircuitFacilities(path,profile).filter(p=>p.kind==='water');
  const levels=new Map(waters.map(p=>[p.id,Math.min(...data.surface.map(s=>s[0]))-1]));
  const field=structuredClone(data.terrain),fence=data.fence;
  for(let k=0;k<field.heights.length;k++){
    const x=field.minX+k%field.columns*field.spacing,z=field.minZ+Math.floor(k/field.columns)*field.spacing;
    if(Math.hypot(x-fence.centerX,z-fence.centerZ)>fence.radius-field.spacing*2)continue;
    const water=waters.find(p=>{const q=local(x,z,p);return Math.abs(q.x)<p.width/2&&Math.abs(q.z)<p.length/2;});
    if(!water)continue;
    const near=path.nearest(x,z),i=path.ribbon!.segmentAt(near.progress);
    if(near.distance<=Math.max(data.corridor.left[i],data.corridor.right[i])+field.spacing*2)continue;
    field.heights[k]=Math.min(field.heights[k],levels.get(water.id)!-.5);
  }
  for(const side of ['sceneryLeft','sceneryRight'] as const)field[side]=field[side].map(([x,,z])=>[x,terrainHeight(field,x,z),z]);
  data.terrain=field;waterLevels.set(data,levels);
}

/** All geometry/materials belong to Track.group and its existing disposal path. */
export function addCircuitScenery(path:TrackPath,parent:THREE.Group,profile:CircuitSceneryProfile):void{
  const root=new THREE.Group();root.name=`${profile.id}-scenery`;parent.add(root);
  const placed=placeCircuitFacilities(path,profile),field=path.native.terrain;
  const concrete=new THREE.MeshStandardMaterial({color:'#b4b4a4',roughness:.95});
  const dark=new THREE.MeshStandardMaterial({color:'#364445',roughness:.8});
  const roof=new THREE.MeshStandardMaterial({color:profile.roofColor??'#d7ddd7',roughness:.7,side:THREE.DoubleSide});
  const glass=new THREE.MeshStandardMaterial({color:'#52737c',roughness:.35,metalness:.15});
  const seats=(profile.seatColors??[0x477c85,0x668c91,0x93a6a2]).map(color=>new THREE.MeshStandardMaterial({color,roughness:1}));
  const unitBox=new THREE.BoxGeometry(1,1,1);
  function box(g:THREE.Object3D,w:number,h:number,l:number,x:number,y:number,z:number,material:THREE.Material){
    const mesh=new THREE.Mesh(unitBox,material);mesh.scale.set(w,h,l);mesh.position.set(x,y,z);
    mesh.receiveShadow=true;g.add(mesh);return mesh;
  }
  for(const p of placed){
    if(p.kind==='water')p.y=waterLevels.get(path.native)?.get(p.id)??p.y;
    const g=new THREE.Group();g.name=`${profile.id}-${p.id}`;g.position.set(p.x,p.y,p.z);g.rotation.y=p.yaw;g.userData.facility=p;root.add(g);
    // Foundation blocks are embedded into actual terrain instead of applying
    // the legacy root-box height lift a second time to their children.
    const slabs=Math.ceil(p.length/8);
    for(let k=0;k<slabs&&!['water','hill','dune','banking'].includes(p.kind);k++){
      const z=-p.length/2+(k+.5)*p.length/slabs;
      const heights=[-p.width/2,0,p.width/2].map(x=>{const q=world(x,z,p);return terrainHeight(field,q.x,q.z);});
      if(p.kind==='stand'){
        // Open steel supports let a stand sit on a hillside without turning
        // the entire slope into a tall, featureless concrete retaining wall.
        for(const [k,x] of [-p.width/2+.7,p.width/2-.7].entries()){
          const depth=Math.max(.5,p.y-heights[k===0?0:2]+.6);
          box(g,.65,depth,.65,x,-depth/2,z,dark);
        }
      }else{
        const depth=Math.max(.5,p.y-Math.min(...heights)+1);
        box(g,p.width,depth,p.length/slabs,0,-depth/2,z,concrete);
      }
    }
    if(p.kind==='pit'){
      box(g,p.width,p.height*.65,p.length,0,p.height*.325,0,concrete);
      box(g,p.width+.5,1,p.length+1,0,p.height*.7,0,roof);
      box(g,p.width*.85,p.height*.25,p.length-4,0,p.height*.85,0,glass);
      box(g,p.width+2,.7,p.length+3,0,p.height+.35,0,dark);
      const face=p.offset>0?-1:1; // Local +X is driver-left; face back toward the road.
      for(let z=-p.length/2+5;z<p.length/2;z+=10){
        box(g,.25,4.5,7,face*(p.width/2+.15),2.4,z,dark);
        box(g,.35,.45,8,face*(p.width/2+.3),5,z,roof);
      }
    }else if(p.kind==='stand'){
      const face=p.offset>0?-1:1;
      for(let row=0;row<10;row++){
        const x=face*(p.width/2-(row+.5)*p.width/10),y=.5+row*p.height/12;
        box(g,p.width/10,.65,p.length-2,x,y,0,seats[row%seats.length]);
        // Sparse, static crowd colours avoid thousands of animated spectators.
        const count=Math.floor((p.length-4)/1.2),crowd=new THREE.InstancedMesh(unitBox,seats[0],count),matrix=new THREE.Matrix4();
        for(let k=0;k<count;k++){
          matrix.compose(new THREE.Vector3(x,y+.55,-p.length/2+2+k*1.2),new THREE.Quaternion(),new THREE.Vector3(.45,.65,.45));
          crowd.setMatrixAt(k,matrix);crowd.setColorAt(k,new THREE.Color([0x203340,0xb2b3a0,0x975848,0xd3ccb6][(row*7+k*13)%4]));
        }
        g.add(crowd);
      }
      for(const z of [-p.length/2+3,p.length/2-3])for(const x of [-p.width/2+1,p.width/2-1]){
        box(g,.5,p.height,.5,x,p.height/2,z,dark);
      }
      if(p.roof){
        const canopy=box(g,p.width+7,.6,p.length+5,0,p.height+.4,0,roof);
        canopy.rotation.z=-face*.08;
        box(g,1,1,p.length+5,-face*p.width/2,p.height,0,dark);
      }
    }else if(p.kind==='hotel'){
      box(g,p.width,p.height,p.length,0,p.height/2,0,concrete);
      const pitched=new THREE.Mesh(new THREE.CylinderGeometry(1,1,1,3),new THREE.MeshStandardMaterial({color:'#72554a',roughness:1}));
      // A triangular prism makes the hotel roof identifiable from the valley.
      pitched.rotation.x=-Math.PI/2;pitched.scale.set(p.width*.65,p.length+3,3.2);
      pitched.position.y=p.height+1.6;g.add(pitched);
      for(const side of [-1,1])for(let row=0;row<3;row++)for(let z=-p.length/2+3;z<p.length/2;z+=5){
        box(g,.2,1.6,1.6,side*(p.width/2+.12),2.5+row*3,z,glass);
      }
    }
    if(!['pit','stand','hotel'].includes(p.kind))addLandmark(g,p,field,{box,concrete,dark,roof,glass});
    // Batch structural parts and all crowd rows per material, per facility.
    // Keep facility-sized bounds so off-screen buildings can still be culled.
    const batches=new Map<THREE.Material,THREE.Mesh[]>();
    for(const child of [...g.children])if(child instanceof THREE.Mesh&&child.geometry===unitBox){
      const material=child.material as THREE.Material,list=batches.get(material)??[];
      list.push(child);batches.set(material,list);g.remove(child);
    }
    for(const [material,parts] of batches){
      const count=parts.reduce((sum,m)=>sum+(m instanceof THREE.InstancedMesh?m.count:1),0);
      const batch=new THREE.InstancedMesh(unitBox,material,count),matrix=new THREE.Matrix4(),color=new THREE.Color();let slot=0;
      for(const part of parts){
        part.updateMatrix();
        for(let k=0;k<(part instanceof THREE.InstancedMesh?part.count:1);k++){
          if(part instanceof THREE.InstancedMesh){part.getMatrixAt(k,matrix);matrix.premultiply(part.matrix);if(part.instanceColor)part.getColorAt(k,color);else color.set(0xffffff);}
          else {matrix.copy(part.matrix);color.set(0xffffff);}
          batch.setMatrixAt(slot,matrix);batch.setColorAt(slot,color);slot++;
        }
        // InstancedMesh owns GPU instance buffers separately from shared geometry.
        if(part instanceof THREE.InstancedMesh)part.dispose();
      }
      batch.receiveShadow=true;batch.computeBoundingSphere();g.add(batch);
    }
  }

  // Seeded forest bands leave the paddock and braking runoff open. Grouping
  // by spatial cell retains frustum culling without distance-based pop-in.
  let seed=profile.seed;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
  const chunks=new Map<string,Tree[]>(),trees:Tree[]=[];
  for(let attempt=0;attempt<Math.max(16000,profile.treeCount*12)&&trees.length<profile.treeCount;attempt++){
    const zone=profile.forests[Math.floor(rand()*profile.forests.length)];
    const distanceScale=profile.normalized?path.length:1;
    const d=(zone.start+rand()*(zone.end-zone.start))*distanceScale,offset=(zone.side??(rand()<.5?-1:1))*(zone.inner+rand()*(zone.outer-zone.inner));
    const p=sceneryFrame(path,d,offset),near=path.nearest(p.x,p.z),i=path.ribbon!.segmentAt(near.progress);
    const clearance=Math.max(path.native.corridor.left[i],path.native.corridor.right[i])+13;
    if(near.distance<clearance)continue;
    if(p.x<field.minX+30||p.z<field.minZ+30||p.x>field.minX+(field.columns-1)*field.spacing-30||p.z>field.minZ+(field.rows-1)*field.spacing-30)continue;
    if(placed.some(f=>{const q=local(p.x,p.z,f);return Math.abs(q.x)<f.width/2+15&&Math.abs(q.z)<f.length/2+15;}))continue;
    const scale=profile.vegetation==='dry'?.25+rand()*.35:.8+rand()*1.1,broadleaf=rand()<(profile.vegetation==='pine'?.15:profile.vegetation==='palm'?1:.4);
    const tree={x:p.x,z:p.z,y:terrainHeight(field,p.x,p.z),scale,broadleaf,color:new THREE.Color().setHSL(.29+rand()*.06,.23+rand()*.15,.19+rand()*.08)};
    trees.push(tree);const key=`${Math.floor(p.x/160)},${Math.floor(p.z/160)}`;
    const list=chunks.get(key)??[];list.push(tree);chunks.set(key,list);
  }
  root.userData.trees=trees;
  root.userData.missingFacilities=profile.facilities.filter(spec=>!placed.some(p=>p.id===spec.id)).map(p=>p.id);
  const trunkMaterial=new THREE.MeshStandardMaterial({color:'#625446',roughness:1});
  const leafMaterial=new THREE.MeshStandardMaterial({color:0xffffff,roughness:1});
  const trunkHeight=profile.vegetation==='palm'?8:5;
  const trunkGeometry=new THREE.CylinderGeometry(profile.vegetation==='palm'?.18:.26,profile.vegetation==='palm'?.28:.42,trunkHeight,5);
  const firGeometry=new THREE.ConeGeometry(3.6,11,7);
  const broadGeometry=profile.vegetation==='palm'?palmCrownGeometry():new THREE.IcosahedronGeometry(4.5,0);
  const matrix=new THREE.Matrix4(),rotation=new THREE.Quaternion();
  for(const [key,list] of chunks){
    const [cx,cz]=key.split(',').map(Number),origin=new THREE.Vector3((cx+.5)*160,list.reduce((sum,t)=>sum+t.y,0)/list.length,(cz+.5)*160);
    // Render the same trunks and crowns at every distance. Switching broadleaf
    // crowns to cones, or switching the entire cell off, visibly popped on approach.
    const cell=new THREE.Group();cell.name=`${profile.id}-forest-cell`;cell.position.copy(origin);root.add(cell);
    const trunks=new THREE.InstancedMesh(trunkGeometry,trunkMaterial,list.length);trunks.name=`${profile.id}-tree-trunks`;cell.add(trunks);
    list.forEach((t,i)=>{
      matrix.compose(new THREE.Vector3(t.x-origin.x,t.y-origin.y+trunkHeight*.5*t.scale,t.z-origin.z),rotation,new THREE.Vector3(t.scale,t.scale,t.scale));trunks.setMatrixAt(i,matrix);
    });
    for(const broadleaf of [false,true]){
      const selected=list.filter(t=>t.broadleaf===broadleaf);if(!selected.length)continue;
      const mesh=new THREE.InstancedMesh(broadleaf?broadGeometry:firGeometry,leafMaterial,selected.length);mesh.name=`${profile.id}-tree-crowns`;cell.add(mesh);
      selected.forEach((t,i)=>{
        matrix.compose(new THREE.Vector3(t.x-origin.x,t.y-origin.y+(broadleaf?8:9)*t.scale,t.z-origin.z),rotation,new THREE.Vector3(t.scale,broadleaf?t.scale*1.2:t.scale,t.scale));mesh.setMatrixAt(i,matrix);mesh.setColorAt(i,t.color);
      });
      mesh.computeBoundingSphere();
    }
    trunks.computeBoundingSphere();
  }
}
