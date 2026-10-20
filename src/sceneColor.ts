import { Color, Material, Mesh, Object3D, Scene, SRGBColorSpace } from 'three';
const enhanced=new WeakSet<Material>();
const backgrounds=new WeakSet<Color>();
/** Apply the existing 20% saturation in the world shader, avoiding a full-canvas CSS pass. */
export function enhanceSceneColor(scene: Scene): void {
  scene.traverse((object:Object3D)=>{
    if(!(object instanceof Mesh))return;
    const materials:Material[]=Array.isArray(object.material)?object.material:[object.material];
    for(const material of materials){
      if(enhanced.has(material))continue;
      enhanced.add(material);
      const compile=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
      material.onBeforeCompile=function(shader,renderer){
        compile.call(this,shader,renderer);
        shader.fragmentShader=shader.fragmentShader.replace('#include <dithering_fragment>',`#include <dithering_fragment>
          float formulaLuma = dot(gl_FragColor.rgb, vec3(0.213, 0.715, 0.072));
          gl_FragColor.rgb = clamp(mix(vec3(formulaLuma), gl_FragColor.rgb, 1.2), 0.0, 1.0);`);
      };
      material.customProgramCacheKey=()=>cacheKey+':formula-q-saturation-1.2';
      material.needsUpdate=true;
    }
  });
  // The sky is cleared directly rather than rendered through a material.
  if(scene.background instanceof Color&&!backgrounds.has(scene.background)){
    const color=scene.background,rgb=color.getRGB({r:0,g:0,b:0},SRGBColorSpace),luma=.213*rgb.r+.715*rgb.g+.072*rgb.b;
    const boost=(v:number)=>Math.max(0,Math.min(1,luma+(v-luma)*1.2));
    color.setRGB(boost(rgb.r),boost(rgb.g),boost(rgb.b),SRGBColorSpace);backgrounds.add(color);
  }
}
