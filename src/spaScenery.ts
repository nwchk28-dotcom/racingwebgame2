import type { TrackPath } from './trackPath';
import type { Group } from 'three';
import { addCircuitScenery, placeCircuitFacilities, sceneryFrame, type CircuitFacility, type CircuitSceneryProfile } from './sceneryBuilder';
export type SpaFacility=CircuitFacility;
export type { PlacedFacility } from './sceneryBuilder';

/** Driver-left offsets are positive. Dimensions and lap locations are approximate.
 * These are intentionally data rather than anonymous boxes sprinkled around a lap. */
export const SPA_FACILITIES:readonly SpaFacility[]=[
  {id:'f1-pit',distance:6860,offset:-52,width:26,length:185,height:12,kind:'pit'},
  {id:'main-grandstand',distance:6850,offset:65,width:28,length:155,height:14,kind:'stand',roof:true},
  {id:'la-source-grandstand',distance:145,offset:64,width:25,length:78,height:12,kind:'stand',roof:true},
  {id:'endurance-pit',distance:535,offset:52,width:22,length:140,height:8,kind:'pit'},
  {id:'endurance-grandstand',distance:570,offset:-66,width:28,length:155,height:16,kind:'stand',roof:true},
  {id:'raidillon-grandstand',distance:1045,offset:78,width:32,length:105,height:19,kind:'stand',roof:true},
  {id:'eau-rouge-hotel',distance:805,offset:-97,width:23,length:36,height:12,kind:'hotel'},
  {id:'les-combes-grandstand',distance:2350,offset:-75,width:22,length:65,height:10,kind:'stand'},
  {id:'pouhon-grandstand',distance:3690,offset:-72,width:23,length:80,height:10,kind:'stand'},
  {id:'chicane-grandstand',distance:6540,offset:75,width:26,length:85,height:12,kind:'stand',roof:true},
];
export const SPA_FORESTS=[
  {start:950,end:2240,inner:75,outer:340},
  {start:2600,end:4450,inner:65,outer:310},
  {start:4500,end:6320,inner:65,outer:340},
] as const;

export const SPA_SCENERY:CircuitSceneryProfile={id:'spa',facilities:SPA_FACILITIES,forests:SPA_FORESTS,treeCount:2700,seed:202510};
export const spaFrame=sceneryFrame;
export const placeSpaFacilities=(path:TrackPath)=>placeCircuitFacilities(path,SPA_SCENERY);
export const addSpaScenery=(path:TrackPath,parent:Group)=>addCircuitScenery(path,parent,SPA_SCENERY);
