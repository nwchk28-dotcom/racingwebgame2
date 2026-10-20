import type { NativeCircuit } from './nativeCircuit';
type V = readonly [number, number];
type Spline = { x: number[]; z: number[] };
export interface RibbonLocation { segment:number; t:number; offset:number; residual:number }
function cubic(p:number,q:number,a:number,b:number):number[] { return [p,a,3*(q-p)-2*a-b,2*(p-q)+a+b]; }
function polynomial(c:number[],t:number) {
  let value=c[c.length-1],derivative=0,second=0;
  for(let i=c.length-2;i>=0;i--){second=second*t+2*derivative;derivative=derivative*t+value;value=value*t+c[i];}
  return {value,derivative,second};
}
const clamp=(x:number)=>Math.max(0,Math.min(1,x));

/** The native C1 ribbon: road, curbs and runoff share one inverse map and Jacobian. */
export class RoadRibbon {
  private readonly centers:Spline[]=[];
  private readonly normals:Spline[]=[];
  private readonly heights:number[][]=[];
  private readonly banks:number[][]=[];
  readonly count:number;
  constructor(readonly data:NativeCircuit){
    const p=data.points,n=data.normals,s=data.distances,count=this.count=p.length-1;
    const slopes:V[]=Array.from({length:count},(_,i)=>{
      const before=(i+count-1)%count,after=(i+1)%count;
      const span=(i===0?s[count]-s[count-1]:s[i]-s[i-1])+s[i+1]-s[i];
      return [(n[after][0]-n[before][0])/span,(n[after][1]-n[before][1])/span];
    });
    for(let i=0;i<count;i++){
      const next=(i+1)%count,h=s[i+1]-s[i];
      const a=data.surface[i],b=data.surface[i+1];
      this.heights.push(cubic(a[0],b[0],a[1]*h,b[1]*h));
      this.banks.push(cubic(a[2],b[2],a[3]*h,b[3]*h));
      this.centers.push({x:cubic(p[i][0],p[i+1][0],-n[i][1]*h,-n[next][1]*h),z:cubic(p[i][1],p[i+1][1],n[i][0]*h,n[next][0]*h)});
      this.normals.push({x:cubic(n[i][0],n[i+1][0],slopes[i][0]*h,slopes[next][0]*h),z:cubic(n[i][1],n[i+1][1],slopes[i][1]*h,slopes[next][1]*h)});
    }
    if(data.id==='suzuka'){
      // Same periodic quintic reconstruction as FormulaWorldIOS; derivative
      // normals remain continuous even on the banked inside of a tight corner.
      let controls=p.slice(0,count).map(v=>[v[0],v[1]]);
      for(let pass=0;pass<160;pass++)controls=controls.map((_,i)=>[0,1].map(k=>
        (p[i][k]*120-(controls[(i+count-1)%count][k]+controls[(i+1)%count][k])*26-controls[(i+count-2)%count][k]-controls[(i+2)%count][k])/66));
      const weights=[[1,-5,10,-10,5,-1],[26,-50,20,20,-20,5],[66,0,-60,0,30,-10],[26,50,20,-20,-20,10],[1,5,10,10,5,-5],[0,0,0,0,0,1]];
      for(let i=0;i<count;i++){
        const coefficients=[0,1].map(axis=>Array.from({length:6},(_,k)=>weights.reduce((sum,w,j)=>sum+controls[(i+j-2+count)%count][axis]*w[k]/120,0)));
        this.centers[i]={x:coefficients[0],z:coefficients[1]};
      }
    }
  }
  segmentAt(progress:number):number {
    const d=((progress%1)+1)%1*this.data.length,s=this.data.distances;
    let lo=0,hi=this.count;while(lo+1<hi){const mid=(lo+hi)>>>1;if(s[mid]<=d)lo=mid;else hi=mid;}return lo;
  }
  frame(segment:number,t:number){
    const center=this.centers[segment],x=polynomial(center.x,t),z=polynomial(center.z,t);
    if(this.data.id==='suzuka'){
      const speed=Math.max(1e-12,Math.hypot(x.derivative,z.derivative)),tx=x.derivative/speed,tz=z.derivative/speed;
      const projection=tx*x.second+tz*z.second;
      return {x:x.value,z:z.value,dx:x.derivative,dz:z.derivative,nx:tz,nz:-tx,
        ndx:(z.second-tz*projection)/speed,ndz:-(x.second-tx*projection)/speed};
    }
    const normal=this.normals[segment],nx=polynomial(normal.x,t),nz=polynomial(normal.z,t);
    return {x:x.value,z:z.value,dx:x.derivative,dz:z.derivative,nx:nx.value,nz:nz.value,ndx:nx.derivative,ndz:nz.derivative};
  }
  profile(segment:number,t:number){
    const span=this.data.distances[segment+1]-this.data.distances[segment];
    const height=polynomial(this.heights[segment],t);
    const bank=polynomial(this.banks[segment],t);
    return {height:height.value,grade:height.derivative/span,bank:bank.value,bankRate:bank.derivative/span};
  }
  at(segment:number,t:number,offset:number){
    const f=this.frame(segment,t),p=this.profile(segment,t),bank=Math.tan(p.bank);
    const dsx=f.dx+f.ndx*offset,dsz=f.dz+f.ndz*offset,det=dsx*f.nz-dsz*f.nx;
    const ht=(p.grade+offset*p.bankRate*(1+bank*bank))*(this.data.distances[segment+1]-this.data.distances[segment]);
    return {x:f.x+f.nx*offset,z:f.z+f.nz*offset,height:p.height+offset*bank,
      gradientX:Math.abs(det)<1e-9?0:(ht*f.nz-bank*dsz)/det,
      gradientZ:Math.abs(det)<1e-9?0:(bank*dsx-ht*f.nx)/det,
      progress:(this.data.distances[segment]+t*(this.data.distances[segment+1]-this.data.distances[segment]))/this.data.length%1};
  }
  locate(x:number,z:number,seed:number):RibbonLocation {
    let best:RibbonLocation={segment:seed,t:0,offset:0,residual:Infinity},score=Infinity;
    for(let order=0;order<=16;order++){
      const delta=order===0?0:(order%2?-1:1)*Math.ceil(order/2),i=(seed+delta+this.count)%this.count;
      const a=this.data.points[i],b=this.data.points[i+1],dx=b[0]-a[0],dz=b[1]-a[1];
      let t=clamp(((x-a[0])*dx+(z-a[1])*dz)/Math.max(1e-9,dx*dx+dz*dz)),u=0;
      for(let step=0;step<8;step++){
        const f=this.frame(i,t),rx=x-f.x-f.nx*u,rz=z-f.z-f.nz*u;
        const dsx=f.dx+f.ndx*u,dsz=f.dz+f.ndz*u,det=dsx*f.nz-dsz*f.nx;
        if(Math.abs(det)<1e-9)break;
        const previousT=t,previousU=u;t=clamp(t+(rx*f.nz-rz*f.nx)/det);
        const next=this.frame(i,t);u=((x-next.x)*next.nx+(z-next.z)*next.nz)/Math.max(1e-9,next.nx**2+next.nz**2);
        if(Math.abs(t-previousT)<1e-12&&Math.abs(u-previousU)<1e-10)break;
      }
      const f=this.frame(i,t),residual=Math.hypot(x-f.x-f.nx*u,z-f.z-f.nz*u),value={segment:i,t,offset:u,residual};
      if(residual<1e-8)return value;
      const candidate=residual+Math.abs(delta)*1e-10;if(candidate<score){score=candidate;best=value;}
    }
    return best;
  }
  position(l:RibbonLocation){
    const f=this.frame(l.segment,l.t),normalLength=Math.hypot(f.nx,f.nz),progress=(this.data.distances[l.segment]+l.t*(this.data.distances[l.segment+1]-this.data.distances[l.segment]))/this.data.length%1;
    return {progress,distance:Math.abs(l.offset),signedDistance:l.offset,centerX:f.x,centerZ:f.z,normalX:f.nx/normalLength,normalZ:f.nz/normalLength};
  }
}
