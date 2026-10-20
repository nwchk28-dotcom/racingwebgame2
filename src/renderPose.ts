export interface RenderPose { x:number; y:number; z:number; yaw:number; gradientX:number; gradientZ:number }
const copy = (p: RenderPose): RenderPose => ({x:p.x,y:p.y,z:p.z,yaw:p.yaw,gradientX:p.gradientX,gradientZ:p.gradientZ});

/** Interpolate the last two physics poses at the display's fractional tick. */
export class PoseInterpolator {
  private previous: RenderPose;
  private current: RenderPose;
  constructor(pose: RenderPose) { this.previous=copy(pose);this.current=copy(pose); }
  reset(pose:RenderPose):void { this.previous=copy(pose);this.current=copy(pose); }
  step(pose:RenderPose):void { this.previous=this.current;this.current=copy(pose); }
  sample(alpha:number):RenderPose {
    const t=Math.max(0,Math.min(1,alpha)),a=this.previous,b=this.current;
    const mix=(x:number,y:number)=>x+(y-x)*t;
    const yawDelta=Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw));
    return {x:mix(a.x,b.x),y:mix(a.y,b.y),z:mix(a.z,b.z),yaw:a.yaw+yawDelta*t,
      gradientX:mix(a.gradientX,b.gradientX),gradientZ:mix(a.gradientZ,b.gradientZ)};
  }
}
