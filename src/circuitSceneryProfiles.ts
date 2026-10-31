import type { TrackId } from './trackData';
import type { CircuitFacility, CircuitSceneryProfile, FacilityKind, ForestBand } from './sceneryBuilder';

// Distances below are normalized laps from the game's timing line. Metric
// footprints are deliberately approximate; every footprint is clearance-tested.
const f=(id:string,kind:FacilityKind,distance:number,offset:number,width:number,length:number,height:number,roof=false):CircuitFacility=>({id,kind,distance,offset,width,length,height,roof});
const stand=(id:string,d:number,o:number,l=90,h=13,roof=true)=>f(id,'stand',d,o,26,l,h,roof);
const pit=(d=.985,o=-50,l=150)=>f('pit-building','pit',d,o,24,l,11);
const band=(start:number,end:number,inner=65,outer=230,side?:number):ForestBand=>({start,end,inner,outer,side});
const profile=(id:TrackId,facilities:CircuitFacility[],forests:ForestBand[],treeCount:number,references:string[],vegetation:CircuitSceneryProfile['vegetation']='temperate'):CircuitSceneryProfile=>({
  id,normalized:true,facilities,forests,treeCount,references,vegetation,
  seed:1000+[...id].reduce((a,c)=>a*31+c.charCodeAt(0),0)>>>0,
  placementAttempts:40,placementStep:8,placementShift:80,
});

/** Per-course source-informed scenery, independent of driving elevation data.
 * Adding a profile requires coverage in circuitScenery.test.ts and the reference
 * register. Spa remains the separately approved profile in spaScenery.ts. */
export const CIRCUIT_SCENERY:Partial<Record<TrackId,CircuitSceneryProfile>>={
  monza:profile('monza',[
    pit(.985,-55,170),stand('main-grandstand',.99,62,150),stand('rettifilo-grandstand',.16,-68,85),
    stand('roggia-grandstand',.38,-65,80),stand('ascari-grandstand',.73,-65,95),stand('alboreto-grandstand',.91,68,100),
    f('historic-banking-north','banking',.29,-160,65,210,11),f('historic-banking-south','banking',.69,150,60,200,10),
  ],[band(.12,.42,65,270),band(.45,.88,60,260)],2400,['https://www.monzanet.it/en/circuit/']),

  silverstone:profile('silverstone',[
    f('silverstone-wing','wing',.985,-68,38,190,16),stand('hamilton-grandstand',.985,70,170),
    stand('village-grandstand',.16,-70),stand('luffield-grandstand',.4,-75,105),stand('copse-grandstand',.53,-75,100),
    stand('becketts-grandstand',.67,-75,100),stand('stowe-grandstand',.86,-85,110),stand('club-grandstand',.965,80,80),
    f('airfield-hangar','hangar',.79,-240,45,75,13),
  ],[band(.28,.45,150,280),band(.54,.68,170,290)],420,['https://www.silverstone.co.uk/events/formula-1-british-grand-prix/tickets/grandstands','https://www.ashandlacy.com/case-studies/the-silverstone-wing-building/']),

  'albert-park':profile('albert-park',[
    pit(.985,-52),stand('fangio-grandstand',.985,62,140),stand('jones-grandstand',.08,-68),stand('brabham-grandstand',.1,70),
    stand('clark-grandstand',.46,-65),stand('waite-grandstand',.68,-70),stand('prost-grandstand',.94,-65),
    f('albert-park-lake-north','water',.34,240,200,350,.1),f('albert-park-lake-south','water',.69,230,180,290,.1),
    f('lakeside-pavilion','hotel',.42,100,22,40,9),
  ],[band(.12,.4,45,160),band(.5,.9,45,170)],1600,['https://www.grandprix.com.au/uploads/images/GP25-Information-Handbook.pdf']),

  'mexico-city':profile('mexico-city',[
    pit(.01,-55,170),stand('main-grandstand',.01,65,150),stand('t1-grandstand',.25,-75,105),stand('esses-grandstand',.66,-75,100),
    stand('stadium-north',.86,58,135,24,false),stand('stadium-south',.88,-58,130,24,false),stand('stadium-exit',.94,-75,100,20,false),
    f('sports-complex','stadium',.55,200,95,140,22),
  ],[band(.25,.6,85,220),band(.88,.98,130,240)],1000,['https://www.formula1.com/en/information/mexico-autodromo-hermanos-rodriguez-mexico-city.1K2WPfBcI8kTXjcTHcbsBM']),

  'gilles-villeneuve':profile('gilles-villeneuve',[
    pit(.985,-48,140),stand('main-grandstand',.99,60,125),stand('senna-grandstand',.1,-60,100),
    stand('hairpin-grandstand',.64,65,105),stand('hairpin-east-grandstand',.66,-65,80),stand('chicane-grandstand',.95,-65,95),
    f('rowing-basin','water',.48,180,100,330,.1),f('st-lawrence-waterfront','water',.78,-230,170,400,.1),
    f('island-pavilion','hotel',.17,105,25,45,12),
  ],[band(.12,.59,45,180),band(.68,.91,45,160)],1800,['https://gpcanada.ca/wp-content/uploads/2025/06/guide_2025_.pdf']),

  monaco:profile('monaco',[
    pit(.97,-58,95),stand('start-grandstand',.99,48,85),stand('tabac-grandstand',.72,-50,80),stand('piscine-grandstand',.81,-50,95),
    f('casino-monte-carlo','casino',.25,55,42,65,22),f('fairmont-hotel','city',.38,-70,50,85,30),
    f('port-hercule','water',.75,-210,180,260,.1),f('harbour-apartments','city',.67,78,23,55,35),f('beau-rivage-apartments','city',.14,65,20,48,40),
  ],[band(.13,.32,50,110,1)],180,['https://www.fia.com/sites/default/files/dossier_media_2025_gb_-_bat2.pdf']),

  'sao-paulo':profile('sao-paulo',[
    pit(.99,58,150),stand('main-grandstand',.985,-65,150),stand('senna-s-grandstand',.09,-70,105),
    stand('descida-grandstand',.31,-75,95),stand('juncao-grandstand',.76,-75,95),stand('uphill-grandstand',.9,-65,120),
    f('infield-hill','hill',.47,140,120,200,12),f('interlagos-neighbourhood','city',.88,-220,40,70,24),
  ],[band(.27,.7,100,230),band(.83,.95,140,260)],800,['https://autodromodeinterlagos.prefeitura.sp.gov.br/circuito']),

  jeddah:profile('jeddah',[
    pit(.985,55,150),stand('main-grandstand',.99,-65,150),stand('t1-grandstand',.09,-65,90),stand('central-grandstand',.42,-65,95),stand('final-grandstand',.91,-75,95),
    f('red-sea-north','water',.38,-210,180,280,.1),f('red-sea-south','water',.73,-220,170,330,.1),
    f('corniche-hotel','city',.3,150,35,55,65),f('waterfront-pavilion','wing',.68,100,28,55,14),
  ],[band(.08,.28,75,145),band(.7,.92,85,170)],400,['https://www.jeddahcircuit.com/en'],'palm'),

  baku:profile('baku',[
    pit(.98,58,145),stand('main-grandstand',.99,-62,140),stand('t1-grandstand',.07,-60,85),stand('old-town-grandstand',.39,70,80),
    f('old-city-castle','castle',.405,70,26,45,22),f('boulevard-palace','casino',.16,-90,30,65,22),
    f('city-block-north','city',.55,90,30,65,38),f('seafront-block','city',.91,-85,25,70,32),
    f('caspian-sea','water',.87,230,210,390,.1),
  ],[band(.78,.97,75,150,1)],300,['https://www.fia.com/system/files/decision-document/2025_azerbaijan_grand_prix_-_event_notes_-_circuit_map_pit_lane_quarantine_zone_and_red_zone.pdf']),

  'abu-dhabi':profile('abu-dhabi',[
    pit(.99,58,165),stand('main-grandstand',.99,-65,145),stand('north-grandstand',.25,-75,105),stand('west-grandstand',.49,-75,95),stand('south-grandstand',.68,-75,105),
    f('yas-hotel','marina-hotel',.84,-110,65,115,36),f('yas-marina','water',.8,230,180,250,.1),f('marina-tower','tower',.74,140,25,25,35),
  ],[band(.02,.13,85,160),band(.7,.95,95,170)],450,['https://www.yasmarina.ae/resources/documents/2018/2018-race-week-berth-holders-guide.pdf'],'palm'),

  singapore:profile('singapore',[
    pit(.99,-52,150),stand('pit-grandstand',.99,65,150),stand('t1-grandstand',.06,-60,95),stand('padang-grandstand',.44,65,100),stand('bayfront-grandstand',.91,-65,100),
    f('singapore-flyer','wheel',.94,155,110,16,120),f('fullerton-hotel','casino',.56,-100,40,75,30),
    f('marina-bay','water',.74,-240,210,330,.1),f('downtown-tower','city',.4,-140,34,45,105),f('marina-tower','city',.82,-170,40,50,115),
  ],[band(.31,.6,70,150),band(.88,.98,85,155)],450,['https://storage.singaporegp.sg/web/2025/circuit-park-map/circuit-park-map.pdf'],'palm'),

  shanghai:profile('shanghai',[
    pit(.99,-60,180),stand('main-grandstand',.99,75,180,20),stand('t1-grandstand',.12,-80,105),stand('t13-grandstand',.64,-75,105),stand('hairpin-grandstand',.88,-75,105),
    f('lotus-pavilions','pagoda',.035,-125,40,130,32),f('lake-infield','water',.56,190,110,200,.1),
  ],[band(.19,.48,90,220),band(.69,.84,100,240)],850,['https://english.shanghai.gov.cn/assets/Download/Shanghai%20International%20Circuit%20Map.pdf']),

  bahrain:profile('bahrain',[
    pit(.99,-60,160),stand('main-grandstand',.99,70,150),stand('t1-grandstand',.1,-75,100),stand('university-grandstand',.36,-80,90),stand('victory-grandstand',.93,-75,110),
    f('sakhir-tower','tower',.02,-120,30,30,40),f('desert-dune-west','dune',.27,220,100,150,13),f('desert-dune-east','dune',.68,-210,130,180,11),
  ],[band(.01,.11,95,150)],140,['https://www.bahraingp.com/blog/news/f1-fans-first-to-witness-bahrains-iconic-bic-tower-in-a-whole-new-light/'],'palm'),

  miami:profile('miami',[
    pit(.99,-55,145),stand('main-grandstand',.99,68,140),stand('t1-grandstand',.06,-70,95),stand('marina-grandstand',.3,-70,95),stand('beach-grandstand',.72,-75,100),stand('hairpin-grandstand',.88,-75,90),
    f('hard-rock-stadium','stadium',.22,250,180,210,38),f('miami-marina','water',.33,170,90,170,.1),
  ],[band(.12,.4,65,180),band(.7,.94,80,180)],600,['https://s40320.pcdn.co/wp-content/uploads/2023/04/MAR176_CampusGuide_MAP_2023-V10.pdf'],'palm'),

  imola:profile('imola',[
    pit(.99,50,145),stand('main-grandstand',.99,-60,130),stand('tamburello-grandstand',.16,-70,95),stand('tosa-grandstand',.35,-75,95),stand('rivazza-grandstand',.87,-80,110),
    f('acque-minerali-hill','hill',.55,-155,120,170,15),f('imola-control-tower','tower',.02,105,14,14,24),f('santerno-river','water',.2,-230,65,260,.1),
  ],[band(.13,.31,60,210),band(.4,.85,65,240)],2100,['https://www.autodromoimola.it/en/experience/open-day/']),

  barcelona:profile('barcelona',[
    pit(.985,-58,165),stand('main-grandstand',.985,70,165),stand('t1-grandstand',.16,-80,95),stand('t5-grandstand',.43,-70,85),stand('stadium-grandstand',.8,-80,110),stand('final-grandstand',.94,-75,95),
    f('catalunya-paddock','wing',.03,-125,30,85,16),f('campsa-hill','hill',.55,-165,130,210,14),
  ],[band(.22,.51,85,210),band(.61,.9,95,240)],1100,['https://www.circuitcat.com/en/membership-modalities/'],'pine'),

  austria:profile('austria',[
    pit(.99,-55,150),stand('main-grandstand',.99,65,150),stand('t1-grandstand',.08,-80,110),stand('t3-grandstand',.3,-85,105),stand('t4-grandstand',.49,-80,100),stand('final-grandstand',.9,-75,100),
    f('steel-bull','bull',.67,155,35,22,19),f('styrian-hill','hill',.32,-245,180,240,24),
  ],[band(.15,.53,130,320),band(.61,.9,140,310)],1800,['https://www.redbullring.com/en/history/'],'pine'),

  hungary:profile('hungary',[
    pit(.99,-55,155),stand('main-grandstand',.99,70,155),stand('t1-grandstand',.08,-80,100),stand('silver-grandstand',.36,-80,95),stand('t12-grandstand',.74,-75,105),stand('final-grandstand',.87,-80,105),
    f('hungaroring-paddock','wing',.025,-130,35,110,15),f('bowl-hillside','hill',.5,-190,130,220,18),
  ],[band(.15,.45,75,230),band(.55,.85,85,240)],1700,['https://hungaroring.hu/guidebook/']),

  zandvoort:profile('zandvoort',[
    pit(.99,-55,140),stand('main-grandstand',.99,65,135),stand('tarzan-grandstand',.1,-70,95),stand('arena-grandstand',.73,-75,110),stand('final-grandstand',.92,-75,100),
    f('dune-north','dune',.31,-150,100,160,14),f('dune-middle','dune',.49,-165,115,170,13),f('dune-return','dune',.81,150,95,150,10),
  ],[band(.24,.47,150,230)],200,['https://dutchgp.com/app/uploads/2025/08/2025_F1-Netherlands-Wayfinding-Map_Negative_VISUAL.pdf'],'dry'),

  austin:profile('austin',[
    pit(.99,60,170),stand('main-grandstand',.99,-75,155),stand('t1-grandstand',.065,-80,110),stand('t11-grandstand',.41,-80,95),stand('t12-grandstand',.64,-85,105),stand('stadium-grandstand',.76,-80,120),
    f('cota-observation-tower','tower',.84,-125,20,25,77),f('texas-hill','hill',.1,-185,140,180,16),
  ],[band(.17,.39,105,240),band(.68,.91,120,250)],950,['https://circuitoftheamericas.com/blog/2024/2/20/all-about-the-cota-tower/']),

  'las-vegas':profile('las-vegas',[
    pit(.99,-60,170),stand('east-harmon-grandstand',.99,70,150),stand('sphere-grandstand',.39,-95,110),stand('strip-grandstand',.7,-85,110),
    f('sphere','sphere',.46,180,125,125,110),f('strip-hotel-north','city',.61,-180,60,95,120),f('strip-hotel-south','city',.76,-175,65,100,105),
    f('strip-hotel-east','city',.68,160,50,80,95),f('harmon-hotel','city',.88,-120,40,70,65),
  ],[band(.56,.85,100,180)],170,['https://www.f1lasvegasgp.com/app/uploads/2025/10/Event-Week-Map.pdf'],'palm'),

  lusail:profile('lusail',[
    pit(.99,-60,165),stand('main-grandstand',.99,75,170),stand('t1-grandstand',.18,-80,105),stand('t2-grandstand',.25,-80,90),stand('t16-grandstand',.94,-80,110),
    f('lusail-paddock','wing',.025,-145,36,115,16),f('lusail-hill','hill',.18,-200,120,160,10),f('desert-ridge','dune',.6,-220,160,250,9),
  ],[band(.01,.11,100,165)],130,['https://www.lcsc.qa/ticket/main-grandstand-3-day'],'palm'),

  sepang:profile('sepang',[
    pit(.99,-58,165),stand('main-grandstand',.99,68,170,16,false),stand('k1-grandstand',.15,-80,100),stand('f-grandstand',.5,-80,110),stand('final-grandstand',.94,-80,100),
    f('hibiscus-canopies','umbrella',.99,110,45,185,23),f('sepang-control-tower','tower',.035,95,20,20,28),
  ],[band(.15,.43,90,250),band(.51,.87,95,260)],1700,['https://www.sepangcircuit.com/media/wysiwyg/pdf/MGP25_Spectator_Guide_v2.pdf'],'palm'),

  suzuka:profile('suzuka',[
    pit(.99,-58,160),stand('v-grandstand',.99,70,170,20),stand('t1-grandstand',.12,-80,115),stand('s-curves-grandstand',.25,-75,110),stand('hairpin-grandstand',.48,-80,95),stand('spoon-grandstand',.67,-80,100),stand('chicane-grandstand',.91,-75,100),
    f('suzuka-ferris-wheel','wheel',.97,170,50,12,52),f('racing-gallery','wing',.035,135,32,65,13),
  ],[band(.2,.42,75,230),band(.5,.84,70,250)],2000,['https://sp.suzukacircuit.jp/park/attraction/','https://www.honda-ml.co.jp/business/promo_menu/pdf/motorsportspromotion.pdf']),
};
