# Spa scenery verification — 2026-10-31

## Visual review corrections

- Forest cells now keep their original trunks and crowns at all distances.
  The 300 m shape swap and 1,050 m removal were removed. Ordinary off-screen
  culling and atmospheric fog remain. The overview uses the same trees.
- The local +X axis points to driver-left. Facilities on that side now face
  local -X toward the road (and vice versa). Upper seat rows recede from the
  road on both sides, and pit garage fronts also face the road.
- All seven Spa tests pass, including new regression checks on actual rendered
  row transforms and the presence of all 2,700 crowns without distance LODs.
  TypeScript and the Pages production build also pass.
- These are visual changes outside the driving corridor. No additional record
  revision change is needed.
- Updated images are in [visual-fixes/review.html](visual-fixes/review.html).

The following records and gallery describe the **initial implementation before
these corrections**; their old LOD and performance descriptions are historical.

Implementation: local branch `feat/spa-scenery`, based on Formula Q commit
`7be1da2`. This is a pre-deployment verification record; publication status is tracked by the GitHub Actions Pages workflow.

## Automated checks

- `npm test`: **33 files / 326 tests passed**. Full output: [tests.txt](tests.txt).
- `npm run build`: TypeScript and Pages production build passed. Output:
  [build.txt](build.txt). Vite still reports the existing large circuit-data
  chunks; the per-course lazy-loading architecture is retained.
- Spa-specific checks include the 102.2 m elevation envelope, finite/continuous
  grades, periodic closure, source immutability, all ten facilities clearing all
  driving corridors, forest grounding, and shared LOD resource disposal.
- A deterministic centerline replay at 2 m intervals covers the entire lap
  using the actual `CarPhysics` contact/wheel checks and `LapTracker`: no false
  collision, all-wheels-off-track event, non-finite pose or invalid lap.
  This is a contact replay, not autonomous driving with steering inputs.

## Browser checks

Safari on the development Mac rendered the actual Spa scene and onboard car.
The gallery contains nine views at **1600 × 900**, followed by the same nine
at **844 × 390**. Open [review.html](review.html) for all 18 images and the
browser-generated metrics; individual images are `view-01.jpg`–`view-18.jpg`.
The views cover the pit straight, Endurance section, Eau Rouge, Raidillon,
Kemmel, Pouhon, Blanchimont, Bus Stop and the full scene. The bird's-eye review
disables atmospheric fog and shows the simplified forest LOD for readability;
normal onboard views use the game fog and distance-based LOD selection.

- PC-size lap replay observed a 19 ms median / 26 ms p95 frame interval. This
  was an earlier review run with the same facility batching; these values were
  read from the preview UI, not exported in the final mobile metrics file.
- Final mobile-size centerline replay: **7,005 m / 5,041 frames**, median
  **17 ms**, p95 **18 ms**. Maximum **166 draw calls / 540,004 triangles**.
  Course preparation measured **985 ms**. Raw data: [metrics.json](metrics.json).
- Three successive disposal/recreation cycles each ended at **101 geometries /
  2 textures**, with no accumulating renderer geometry/texture count. Instance
  buffers are explicitly disposed alongside geometry/material/texture cleanup.
- Main straight and Eau Rouge were inspected live; saved PC/mobile onboard
  and overview images were also inspected. Facility silhouettes, static crowd
  seating, forest coverage and road/terrain alignment are lightweight
  approximations as described in [the references](../../SPA_SCENERY_REFERENCES.md).

The presets specify render dimensions, not device emulation. These timings
measure a development preview's CPU/browser frame intervals and exclude the
production HUD/input/audio workload; they are not GPU or thermal measurements.
The PC-size result does not establish sustained 60 fps. An actual iPhone/iPad
performance/temperature test remains outstanding. No iOS Simulator was launched.

## Record compatibility

Only Spa changes to course revision **1**, with global revision **9** retained.
Its old PB, sectors and gap trace remain stored but are excluded from new-condition
comparisons. Other courses keep their existing record revisions.

The update changes Spa's intermediate road slopes and removes seven stale
collision circles left by the replaced generic buildings. The horizontal
centerline, widths, sector/timing positions, banks, and roadside/perimeter
barrier footprints remain unchanged.
