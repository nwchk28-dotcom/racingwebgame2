import { expect, it } from 'vitest';
import { PoseInterpolator } from './renderPose';
import { CarVisual } from './car';
it('interpolates elevation and tilt on displays between physics ticks',()=>{
  const p={x:0,y:0,z:0,yaw:0,gradientX:0,gradientZ:0},view=new PoseInterpolator(p);
  view.step({...p,y:1,z:2,gradientZ:.2});
  expect(view.sample(.25)).toEqual({...p,y:.25,z:.5,gradientZ:.05});
  expect(view.sample(.75).y-view.sample(.25).y).toBeCloseTo(.5);
  view.reset({...p,y:10});expect(view.sample(.2).y).toBe(10);
});
it('takes the shortest heading across the angle wrap',()=>{
  const p={x:0,y:0,z:0,yaw:Math.PI-.1,gradientX:0,gradientZ:0},view=new PoseInterpolator(p);
  view.step({...p,yaw:-Math.PI+.1});expect(view.sample(.5).yaw).toBeCloseTo(Math.PI);
});
it('keeps onboard camera height fixed at every speed and animation time',()=>{
  const car=new CarVisual(),height=car.camera.position.y;
  for(const speed of [0,15,50,95])for(const elapsed of [0,.02,.1,.5,1]){
    car.animate(.4,speed,elapsed);expect(car.camera.position.y).toBe(height);
  }
});
