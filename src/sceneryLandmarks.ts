import * as THREE from 'three';
import type { NativeCircuit } from './nativeCircuit';
import type { PlacedFacility } from './sceneryBuilder';
import { terrainHeight } from './terrainScenery';

interface Parts {
  box:(g:THREE.Object3D,w:number,h:number,l:number,x:number,y:number,z:number,material:THREE.Material)=>THREE.Mesh;
  concrete:THREE.Material;dark:THREE.Material;roof:THREE.Material;glass:THREE.Material;
}
export function palmCrownGeometry():THREE.BufferGeometry {
  const positions:number[]=[],indices:number[]=[];
  for(let leaf=0;leaf<7;leaf++){
    const a=leaf/7*Math.PI*2,c=Math.cos(a),s=Math.sin(a),v=positions.length/3;
    for(const [r,w,y] of [[0,0,1],[2,-.65,.8],[5,0,-1.2],[2,.65,.8]])positions.push(c*r-s*w,y,s*r+c*w);
    indices.push(v,v+1,v+2,v,v+2,v+3,v+2,v+1,v,v+3,v+2,v);
  }
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
}

/** Original, unbranded silhouettes. Dimensions/placement are public-source
 * approximations; see CIRCUIT_SCENERY_REFERENCES.md, not survey geometry. */
export function addLandmark(g:THREE.Group,p:PlacedFacility,field:NativeCircuit['terrain'],parts:Parts):void {
  const {box,concrete,dark,roof,glass}=parts;
  const coloured=new THREE.MeshStandardMaterial({color:p.color??0xb9b5a1,roughness:.8});
  const add=(geometry:THREE.BufferGeometry,material:THREE.Material,x=0,y=0,z=0)=>{
    const mesh=new THREE.Mesh(geometry,material);mesh.position.set(x,y,z);g.add(mesh);return mesh;
  };
  const beam=(a:THREE.Vector3,b:THREE.Vector3,r:number,material=dark)=>{
    const mesh=add(new THREE.CylinderGeometry(r,r,a.distanceTo(b),5),material);
    mesh.position.copy(a).add(b).multiplyScalar(.5);mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return mesh;
  };
  switch(p.kind){
    case 'wing': case 'hangar': {
      box(g,p.width,p.height*.65,p.length,0,p.height*.325,0,glass);
      box(g,p.width+1,1,p.length+1,0,.5,0,concrete);
      const panels=p.kind==='wing'?6:3;
      for(let i=0;i<panels;i++){
        const z=-p.length/2+(i+.5)*p.length/panels;
        const panel=box(g,p.width+5,.8,p.length/panels+1,0,p.height*(.8+.15*(i%2)),z,roof);
        panel.rotation.x=(i%2?1:-1)*.12;panel.rotation.z=p.kind==='wing'?.1:0;
      }
      break;
    }
    case 'wheel': {
      const radius=Math.min(p.width,p.height)*.43,hub=p.height*.53;
      add(new THREE.TorusGeometry(radius,.6,5,48),roof,0,hub);
      add(new THREE.SphereGeometry(1.4,8,5),coloured,0,hub);
      for(const side of [-1,1])beam(new THREE.Vector3(side*radius*.5,0,0),new THREE.Vector3(0,hub,0),.7);
      for(let i=0;i<16;i++){
        const a=i/16*Math.PI*2,x=Math.cos(a)*radius,y=hub+Math.sin(a)*radius;
        beam(new THREE.Vector3(0,hub,0),new THREE.Vector3(x,y,0),.13,roof);
        box(g,2.3,2.4,2.4,x,y-1.3,0,i%2?glass:coloured);
      }
      break;
    }
    case 'tower': {
      if(p.id.includes('cota')){
        const red=new THREE.MeshStandardMaterial({color:0xc73b34,roughness:.7});
        for(const x of [-2,2])for(const z of [-2,2])beam(new THREE.Vector3(x,0,z),new THREE.Vector3(x*.7,p.height*.94,z*.7),.6,roof);
        for(let k=0;k<5;k++)beam(new THREE.Vector3(-4+k*2,0,-4),new THREE.Vector3(-4+k*2,p.height,3),.45,red);
        box(g,p.width,1.8,p.length,0,p.height*.9,0,glass);
        box(g,p.width+3,.8,p.length+4,0,p.height,0,red);
      }else{
        add(new THREE.CylinderGeometry(p.width*.26,p.width*.3,p.height,16),glass,0,p.height/2);
        for(let level=0;level<8;level++)add(new THREE.CylinderGeometry(p.width*.49,p.width*.49,1,16),roof,0,(level+1)*p.height/8);
      }
      break;
    }
    case 'pagoda': {
      for(const z of [-p.length*.28,p.length*.28]){
        add(new THREE.CylinderGeometry(p.width*.08,p.width*.12,p.height*.85,10),concrete,0,p.height*.425,z);
        add(new THREE.CylinderGeometry(p.width*.48,p.width*.4,p.height*.18,12),glass,0,p.height*.8,z);
        add(new THREE.ConeGeometry(p.width*.58,p.height*.18,12),roof,0,p.height*.97,z);
      }
      break;
    }
    case 'castle': case 'casino': {
      box(g,p.width,p.height*.65,p.length,0,p.height*.325,0,coloured);
      if(p.kind==='castle'){
        for(const x of [-1,1])for(const z of [-1,1]){
          const tx=x*p.width*.4,tz=z*p.length*.4;
          add(new THREE.CylinderGeometry(p.width*.14,p.width*.15,p.height,8),coloured,tx,p.height*.5,tz);
          for(let i=0;i<8;i++){const a=i/8*Math.PI*2;box(g,1.3,2,1.3,tx+Math.cos(a)*p.width*.12,p.height,tz+Math.sin(a)*p.width*.12,coloured);}
        }
      }else{
        for(const x of [-p.width*.35,p.width*.35]){
          box(g,p.width*.22,p.height*.8,p.length*.3,x,p.height*.4,0,coloured);
          add(new THREE.SphereGeometry(p.width*.16,10,5,0,Math.PI*2,0,Math.PI/2),roof,x,p.height*.8,0);
        }
        for(let z=-p.length*.4;z<=p.length*.4;z+=6)box(g,.3,2.5,1.5,-Math.sign(p.offset)*(p.width/2+.1),p.height*.35,z,glass);
      }
      break;
    }
    case 'marina-hotel': {
      for(const z of [-p.length*.22,p.length*.22]){
        const body=add(new THREE.SphereGeometry(1,20,10),glass,0,p.height*.42,z);body.scale.set(p.width*.48,p.height*.42,p.length*.31);
        const shell=add(new THREE.SphereGeometry(1,18,8,0,Math.PI*2,0,Math.PI*.62),roof,0,p.height*.48,z);shell.scale.set(p.width*.53,p.height*.52,p.length*.35);
        const net=add(shell.geometry,new THREE.MeshBasicMaterial({color:0x668095,wireframe:true}));net.position.copy(shell.position);net.scale.copy(shell.scale).multiplyScalar(1.002);
      }
      break;
    }
    case 'sphere': {
      const sphere=add(new THREE.SphereGeometry(1,28,16),new THREE.MeshStandardMaterial({color:p.color??0x5d83a5,emissive:0x18374e,emissiveIntensity:.2,roughness:.7}),0,p.height*.5);
      sphere.scale.set(p.width*.5,p.height*.5,p.length*.5);break;
    }
    case 'stadium': {
      for(const side of [-1,1]){
        box(g,p.width*.19,p.height,p.length,side*p.width*.4,p.height*.5,0,coloured);
        box(g,p.width*.25,1,p.length+5,side*p.width*.4,p.height,0,roof);
        box(g,p.width,p.height,p.length*.17,0,p.height*.5,side*p.length*.42,coloured);
      }
      box(g,p.width*.6,.3,p.length*.55,0,1,0,new THREE.MeshStandardMaterial({color:0x487957}));break;
    }
    case 'umbrella': {
      for(let z=-p.length*.4;z<=p.length*.4;z+=p.width*.65){
        add(new THREE.CylinderGeometry(.6,.8,p.height,7),concrete,0,p.height/2,z);
        const cap=add(new THREE.ConeGeometry(p.width*.58,p.height*.22,12),roof,0,p.height,z);cap.scale.z=.8;
      }
      break;
    }
    case 'bull': {
      const arch=add(new THREE.TorusGeometry(p.width*.44,.8,6,24,Math.PI),coloured,0,0);arch.scale.y=p.height/p.width*1.3;
      const body=add(new THREE.SphereGeometry(1,8,5),dark,0,p.height*.46);body.scale.set(p.width*.23,p.height*.16,p.length*.18);
      const head=add(new THREE.SphereGeometry(1,7,4),dark,p.width*.25,p.height*.52);head.scale.set(p.width*.1,p.height*.12,p.length*.14);
      for(const x of [-1,1])for(const z of [-1,1])beam(new THREE.Vector3(x*p.width*.16,p.height*.4,z*p.length*.09),new THREE.Vector3(x*p.width*.2,p.height*.1,z*p.length*.15),.65);
      for(const z of [-1,1])beam(new THREE.Vector3(p.width*.25,p.height*.55,z*p.length*.06),new THREE.Vector3(p.width*.31,p.height*.7,z*p.length*.16),.4,coloured);
      break;
    }
    case 'city': {
      box(g,p.width,p.height,p.length,0,p.height*.5,0,coloured);
      for(let level=3;level<p.height;level+=3.8){
        box(g,p.width+.2,.55,p.length+.2,0,level,0,glass);
      }
      box(g,p.width+1,.7,p.length+1,0,p.height+.35,0,roof);break;
    }
    case 'water': {
      const mesh=add(new THREE.PlaneGeometry(p.width,p.length),new THREE.MeshStandardMaterial({color:p.color??0x4f8b9d,roughness:.35,metalness:.18,side:THREE.DoubleSide}),0,.03);mesh.rotation.x=-Math.PI/2;
      break;
    }
    case 'hill': case 'dune': {
      const geometry=new THREE.SphereGeometry(1,20,10,0,Math.PI*2,0,Math.PI/2),positions=geometry.getAttribute('position');
      const c=Math.cos(p.yaw),s=Math.sin(p.yaw);
      for(let i=0;i<positions.count;i++){
        const x=positions.getX(i)*p.width*.5,z=positions.getZ(i)*p.length*.5,y=positions.getY(i)*p.height;
        positions.setXYZ(i,x,y+terrainHeight(field,p.x+x*c+z*s,p.z-x*s+z*c)-p.y+.02,z);
      }
      geometry.computeVertexNormals();add(geometry,new THREE.MeshStandardMaterial({color:p.color??(p.kind==='dune'?0xc4b68a:0x647c4d),roughness:1}));break;
    }
    case 'banking': {
      const vertices:number[]=[],indices:number[]=[];
      for(let i=0;i<=40;i++)for(const edge of [0,1]){
        const t=i/40,a=(t-.5)*Math.PI*.8,r=p.width*(.2+edge*.3);
        vertices.push(Math.cos(a)*r-p.width*.3,edge*p.height,Math.sin(a)*p.length*.5);
        if(i<40&&edge===0){const v=i*2;indices.push(v,v+1,v+2,v+1,v+3,v+2);}
      }
      const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.setIndex(indices);geometry.computeVertexNormals();
      add(geometry,new THREE.MeshStandardMaterial({color:0x8b8b7a,roughness:1,side:THREE.DoubleSide}));break;
    }
  }
  // Avoid keeping an unused material for models which do not need this colour.
  let used=false;g.traverse(o=>{if(o instanceof THREE.Mesh&&o.material===coloured)used=true;});if(!used)coloured.dispose();
}
