/** Baked from FormulaWorldIOS Core and Resources. Coordinates are already world-space. */
export interface NativeCircuit {
  id: string; length: number; startYaw: number; curbWidth: number;
  points: number[][]; normals: number[][]; distances: number[]; widths: number[];
  surface: number[][];
  fence: {centerX:number;centerZ:number;radius:number};
  terrain: { minX:number;minZ:number;spacing:number;columns:number;rows:number;baseHeight:number;
    heights:number[];fenceHeights:number[];sceneryLeft:number[][];sceneryRight:number[][];bridgeRange?:number[] };
  obstacles: { x: number; z: number; radius: number }[];
  corridor: {
    left: number[]; right: number[];
    barriers: { a: {x:number;z:number}; b:{x:number;z:number}; inward:{x:number;z:number}; heightA:number; heightB:number; twoSided:boolean }[];
    escapeAreas?: {polygon:{x:number;z:number}[];height:number}[];
  };
}
const files = import.meta.glob('./nativeCircuits/*.json', { import: 'default' }) as Record<string, () => Promise<NativeCircuit>>;
export const nativeCircuits: Record<string, NativeCircuit> = {};
export async function loadNativeCircuit(id:string):Promise<void> {
  if(nativeCircuits[id])return;
  const load=files[`./nativeCircuits/${id}.json`];
  if(!load)throw Error(`Missing circuit: ${id}`);
  nativeCircuits[id]=await load();
}
