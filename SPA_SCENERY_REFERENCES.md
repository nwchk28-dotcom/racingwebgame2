# Spa scenery and elevation reconstruction

This update belongs to the Web game **Formula Q**. Only Spa uses the new scene.
It is an original lightweight reconstruction from public references, not a
survey, a licensed circuit model, or a photogrammetric reproduction.

## Reference baseline

- [Circuit operator's 2025 site map](https://www.spa-francorchamps.be/assets/bf6a87ff-84de-4d8b-827a-9db03f015648/plan-parking-2025.pdf):
  relative positions of the pit building, main, Endurance and Raidillon stands,
  and Hotel de l'Eau Rouge. The reference is linked, not redistributed.
- [Circuit operator's access map](https://www.spa-francorchamps.be/assets/3541f0b5-47e5-483b-a5e6-059d99346600/all-plans-acces-csf.pdf):
  the venue's relationship to surrounding roads and wooded areas.
- [F1 elevation comparison](https://www.formula1.com/en/latest/article/highs-and-lows-which-f1-track-has-the-most-elevation-changes-.7I9JEcBw3R2AqXbnJ6hyvc.7I9JEcBw3R2AqXbnJ6hyvc):
  102.2 m maximum-to-minimum difference. This is a range constraint, not a
  source for every intermediate elevation.
- [Mercedes: impact of track elevation](https://www.mercedesamgf1.com/news/the-impact-of-track-elevation-in-f1):
  corroborates the approximately 102 m range and the compression through the
  Eau Rouge/Raidillon complex.
- The existing exported native Spa profile supplies landmark distances and
  relative elevations. Its 40 m Eau Rouge-to-Raidillon ascent, level pit
  straight, and 5 m Bus Stop rise are retained design assumptions. They are
  **not newly measured values**. The absolute elevation datum remains zero at
  the timing line; absolute geographic altitudes are not used.

## What is reconstructed

`src/spaTerrain.ts` owns a continuous shape-preserving elevation curve through
explicit control points. The previous curve flattened at many individual
intermediate anchors. Harmonic-mean Hermite tangents preserve monotonically
climbing/descending sections without overshooting their endpoints. Max/min
height, timing line, horizontal centerline, widths and banking remain unchanged.
The new intermediate slopes affect gravity and the driving condition, so Spa's
course record revision is increased from 0 to 1 (global revision remains 9).
Old Spa records stay stored; other courses retain their record namespaces.
The seven circular collision proxies of the replaced generic buildings are
removed from Spa, avoiding invisible collisions where those boxes used to be.
New facilities are visual-only outside the driving corridor. Roadside and
perimeter rail collisions remain in place.

`loadNativeCircuit` applies `prepareSpaTerrain` to a clone of the fresh Spa
export, once when first loaded. All consumers see this same prepared data:
road ribbon, contact, renderer, runoff, apron and wall bases. Scenic grid
vertices receive the nearby road's elevation correction and broad, low-amplitude
wooded ridges beyond 80 m from the centerline. The ridge pattern is an artistic
approximation, not a digital elevation model. Apron endpoints are resampled
from the prepared ground; the fence retains its existing ground-relative offset.

`src/spaScenery.ts` defines ten named facilities. They have approximate
driver-relative lap positions and dimensions, with small outward placement
adjustments only where needed to clear **all** road arms and runoff. Pit
buildings have garage bays and upper glazing; grandstands have stepped seating,
static crowd colours, supports and optional cantilevered roofs. The hotel uses
a pitched roof. The hotel facade, stand seat counts/colours, temporary stands
at Les Combes/Pouhon/the chicane, and exact building dimensions are approximate.
The 2025 venue plan is the baseline; this is not a claim to reproduce every
temporary structure from that Grand Prix.

Forest bands follow the Kemmel, middle-sector and return sections, excluding
the paddock and all driving corridors. The same seed creates 2,700 conifers
and broadleaf trees on every visit. This is an approximate forest edge, not an
inventory of individual trees. Facility clearance includes a 15 m tree buffer.
Trees stand on the actual rendered terrain grid. Each 160 m forest cell always
renders the same trunks and crowns, including distant trees. Distance-based
shape substitution and removal were removed after visual review to prevent
pop-in. Off-screen cells still benefit from ordinary frustum culling, and the
game's atmospheric fog remains. These use shared geometry/materials and instance colours; no
external imagery, runtime network requests or animated crowd assets are added.

## Regeneration and verification

- Normal development: `npm ci`, `npm test`, `npm run build`.
- To update the native baseline, run `sh tools/sync-ios-circuits.sh <path-to-FormulaWorldIOS>`.
  The Web-owned reconstruction is automatically applied after export when Spa
  is loaded; do not bake it back into the source JSON or run it twice.
- Run `npm run dev`, then open `/tools/spa-scenery.html`. Choose the landmarks,
  replay a lap, and compare PC 1600 × 900 and mobile 844 × 390 framing. This
  development entry does not change the installed-app-only production entry.
- The report button exports a standalone HTML gallery of both sizes, captured
  frame-interval statistics, draw counts, triangle counts and three reloads'
  renderer resource counts. It reuses the actual game renderer/scene/car code;
  replay follows the centerline and is not an automated steering test.
- `src/spaScenery.test.ts` checks the elevation envelope/derivative, periodic
  closure, shared road-contact continuity, immutable source data, facility
  clearance, forest grounding, persistent crowns, stand orientation and disposal. Existing road mesh, runoff,
  bank occlusion and record tests remain applicable to the prepared Spa data.

Frame intervals in the preview include browser scheduling and CPU work. Its
1600 × 900 and 844 × 390 presets are render sizes, not device emulation. They do
not establish iPhone GPU speed, sustained thermal performance or power use.

No F1 logos, operator drawings or photographs are embedded. All geometry is
generated locally. Third-party centerline licensing remains documented in
`THIRD_PARTY_NOTICES.md`.
