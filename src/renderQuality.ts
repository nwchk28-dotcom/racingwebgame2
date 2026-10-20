/** Reduce fill rate only after sustained missed frames; restore it slowly. */
export class RenderQuality {
  readonly minimum: number;
  private ratio: number;
  private last = 0;
  private elapsed = 0;
  private frames = 0;
  private slow = 0;
  private healthy = 0;
  constructor(readonly maximum: number) { this.ratio=maximum;this.minimum=Math.min(1,maximum); }
  get pixelRatio(): number { return this.ratio; }
  reset(): void { this.last=0;this.elapsed=0;this.frames=0;this.slow=0;this.healthy=0; }
  sample(now: number): number {
    const dt=this.last?now-this.last:0;this.last=now;
    // Pauses and app restoration are not evidence of an overloaded renderer.
    if(dt<=0||dt>100){this.elapsed=0;this.frames=0;this.slow=0;this.healthy=0;return this.ratio;}
    this.elapsed+=dt;this.frames++;if(dt>24)this.slow++;
    if(this.elapsed<1500)return this.ratio;
    const mean=this.elapsed/this.frames,bad=this.slow/this.frames;
    if(mean>19||bad>.1){
      this.ratio=Math.max(this.minimum,Math.round((this.ratio-.15)*100)/100);this.healthy=0;
    }else if(mean<17.5&&bad<.03){
      this.healthy+=this.elapsed;
      if(this.healthy>=9000){this.ratio=Math.min(this.maximum,Math.round((this.ratio+.05)*100)/100);this.healthy=0;}
    }else this.healthy=0;
    this.elapsed=0;this.frames=0;this.slow=0;return this.ratio;
  }
}
