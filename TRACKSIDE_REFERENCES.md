# Trackside wall placement

`src/trackWalls.ts` uses lap fractions measured from each game's timing line. `left` and
`right` refer to the driver's view. Each interval creates a low, solid wall just
beyond the curb on that side; omitted intervals remain open runoff. The distant
circular perimeter fence still keeps cars within the scene.

These layouts are **visual and driving approximations**. Public F1 articles and
circuit maps identify characteristic barriers and runoff, but do not provide a
surveyed barrier centerline for every metre. The game's centerlines and constant
road widths are simplified, so these fractions should not be used as safety or
engineering data. The wall intervals deliberately leave braking escape areas at
selected corners and permit a wall on only one side.

| Circuit | Characteristic placement used | Public reference |
| --- | --- | --- |
| Monza | Pit-side wall; open runoff at the chicanes and Alboreto | [F1 on Monza runoff and gravel](https://www.formula1.com/en/latest/article/what-tyres-will-the-teams-and-drivers-have-for-the-2026-italian-grand-prix.7nOpWdCgvCBFDGlnODs0gk) |
| Silverstone | Pit-side wall; extensive open corner runoff | [F1 Silverstone circuit guide](https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-silverstone-2026.5Sl0O8g393enBWVIkjRzOr), [F1 on Becketts runoff](https://www.formula1.com/en/latest/article/new-kerb-and-tyre-barrier-added-at-silverstone-after-late-tyre-drama-and.E0ahSnJmwMiVuSZqr2keJ.E0ahSnJmwMiVuSZqr2keJ) |
| Albert Park | Alternating near barriers with open braking areas | [F1 report on barriers at Turns 7–8](https://www.formula1.com/en/latest/article/watch-albon-brings-out-the-red-flags-after-heavy-crash-during-fp1-in.3CFEyOHWVN8fQxnOrLj5UV) |
| Mexico City | Pit wall and close stadium barriers; open runoff elsewhere | [F1 on the stadium barriers](https://www.formula1.com/en/latest/article/fp1-hamilton-just-0-1s-quicker-than-leclerc-and-verstappen-in-mexico-opener.4x3Bn1egYqsFSQ2cAqy8IS/) |
| Gilles-Villeneuve | Island-road barriers and the final-chicane exit wall | [F1 on the Wall of Champions](https://www.formula1.com/en/latest/article/what-is-the-wall-of-champions-and-which-drivers-have-crashed-there.QcBubomZFL79vkmooy8n3) |
| Monaco | Mostly enclosed streets, an escape side at Nouvelle Chicane, and a tunnel from Portier toward Nouvelle Chicane | [F1 corner guide](https://www.formula1.com/en/latest/article/explained-how-every-monaco-corner-got-its-name.5ClYqWmfpeUpsRJA6mDNaX), [F1 tunnel account](https://www.formula1.com/en/latest/article/90-years-on-why-monaco-still-retains-the-magic.OUHMG1RZHuF7lWv3m3Gpy) |
| Spa-Francorchamps | Pit-side and selected close barriers; long open corner runoff | [F1 on Spa runoff](https://www.formula1.com/en/latest/article/imola-94-and-the-legacy-of-improved-safety.5P8zqEzNjKzYw8qdckoYFF) |
| São Paulo | Pit straight wall and selected infield edge; other corners open | [F1 on the pit wall](https://www.formula1.com/en/latest/article/5-reasons-we-love-the-brazilian-grand-prix.37v8PT899Wnp7v6y51sUMf), [F1 on Turn 2 runoff](https://www.formula1.com/en/latest/article/brazil-preview-rosberg-running-out-of-time-in-title-fight.1RINSmBATXT3BemwFih8wd.1RINSmBATXT3BemwFih8wd) |
| Jeddah | Close walls over most of the lap with one-sided corner runoff | [F1 on wall moves at Turns 8, 10, 14 and 20](https://www.formula1.com/en/latest/article/jeddah-corniche-circuit-announce-track-changes-ahead-of-2023-saudi-arabian.4iSwb5mSelxb07fA5W706f.4iSwb5mSelxb07fA5W706f), [F1 on runoff](https://www.formula1.com/en/latest/article/the-circuit-the-challenge-and-the-culture-how-jeddah-is-shaping-up-for-the.6nm5W4zEpXtCKsA3VQBkgb) |
| Baku | Close city walls, especially the Old Town; outside/right asphalt escape area at the left-hand Turn 16 | [FIA 2025 circuit map](https://www.fia.com/system/files/decision-document/2025_azerbaijan_grand_prix_-_event_notes_-_circuit_map_pit_lane_quarantine_zone_and_red_zone.pdf), [FIA event notes describing the Turn 16 run-off wall](https://www.fia.com/sites/default/files/decision-document/2024%20Azerbaijan%20Grand%20Prix%20-%20Race%20Director%27s%20Event%20Notes.pdf) |
| Yas Marina | Pit-side and marina-sector walls, open runoff at braking corners | [F1 on Turn 14 wall](https://www.formula1.com/en/latest/article/watch-raikkonen-ends-his-final-friday-practice-session-in-f1-in-the-wall-at.5mj44bpEkQcfofL7Zm90d5), [F1 on chicane runoff](https://www.formula1.com/en/latest/article/watch-enjoy-the-race-start-at-yas-marina-as-verstappen-surges-into-the.3AlvlhComEKFrC1JiHiWFM) |
| Marina Bay | Mostly close street walls with one-sided escape sections | [F1 on the street-circuit wall/runoff contrast](https://www.formula1.com/en/latest/article/win-a-replica-race-suit-in-the-street-showdown-f1-fantasys-new-oracle-red.BQROLTGyvpFYn97nyTEgc), [F1 Singapore driver preview](https://www.formula1.com/en/latest/article/singapore-preview-quotes.7Glwb0jsNumsGiGttYTHiF.7Glwb0jsNumsGiGttYTHiF) |
| Shanghai | Control line near the middle of the T16–T1 pit straight; pit-side barrier and isolated outer boundaries; open runoff at the large hairpins | [F1 2025 Chinese GP circuit](https://www.formula1.com/en/racing/2025/china), [FIA 2025 circuit map](https://www.fia.com/system/files/decision-document/2025_chinese_grand_prix_-_event_notes_-_circuit_map_pit_lane_and_quarantine_zone.pdf) |
| Bahrain | Pit-side barrier and selected infield boundaries; open desert corner runoff | [F1 2025 Bahrain GP circuit](https://www.formula1.com/en/racing/2025/bahrain) |
| Miami | Temporary street-side barriers on most straights, with one-sided escape sections at braking corners | [F1 2025 Miami GP circuit](https://www.formula1.com/en/racing/2025/miami) |
| Imola | Pit-side and selected close outer barriers; open runoff at the main chicanes | [F1 2025 Emilia-Romagna GP circuit](https://www.formula1.com/en/racing/2025/emilia-romagna) |
| Barcelona-Catalunya | Pit-side wall; mostly open corner runoff | [F1 2025 Spanish GP circuit](https://www.formula1.com/en/racing/2025/spain) |
| Red Bull Ring | Pit-side and selected outer barriers; open uphill braking runoff | [F1 2025 Austrian GP circuit](https://www.formula1.com/en/racing/2025/austria) |
| Hungaroring | Pit-side and isolated outer barriers; open runoff at the slow corners | [F1 2025 Hungarian GP circuit](https://www.formula1.com/en/racing/2025/hungary) |
| Zandvoort | Alternating close dune-side barriers and open escape areas | [F1 2025 Dutch GP circuit](https://www.formula1.com/en/racing/2025/netherlands) |
| Circuit of the Americas | Pit-side and selected outer barriers; wide open corner runoff | [F1 2025 United States GP circuit](https://www.formula1.com/en/racing/2025/united-states) |
| Las Vegas | Close temporary street walls with one-sided openings at selected corners | [F1 2025 Las Vegas GP circuit](https://www.formula1.com/en/racing/2025/las-vegas) |
| Lusail | Pit-side and isolated outer barriers; open runoff around the fast bends | [F1 2025 Qatar GP circuit](https://www.formula1.com/en/racing/2025/qatar) |

The Monaco tunnel runs from about 43.5% to 60.5% of the game's lap, after
Portier and before the Nouvelle Chicane. Its 8.8 m roof, bright emissive walls,
and light strips intentionally keep the driving view brighter than the real tunnel.
Where separate arms of the simplified centerline pass close together, their
facing barriers are merged into one two-sided wall midway between the arms.
This applies to Monaco's Fairmont hairpin and the close parallel streets in
Baku. Tight inside offsets can also fold backwards at a hairpin; those short
wall stretches are left open rather than forming a collision pocket, including
Spa's La Source. The low barriers use a light body and a red top band so they
remain visible against both asphalt and grass.

## Sepang

- [Circuit operator architecture](https://www.sepangcircuit.com/architecture):
  5.543 km, 15 corners, width 16–22 m. The game approximates this with a constant
  18 m asphalt width plus 1.2 m curbs; it does not reproduce surveyed width changes.
- [Official safety briefing and facility map](https://www.sepangcircuit.com/media/wysiwyg/pdf/Daily_Safety_Briefing.pdf),
  circuit-layout page: home straight travels from T15 toward T1 beside the pit
  building; the parallel back straight travels the opposite way, with the central
  grandstand between them. The near pit wall is on the driver's right. Extensive
  outer corner runoff is retained; distant barriers are represented by the existing
  circular boundary rather than invented curbside walls.
- [Honda circuit guide](https://global.honda/en/F1/circuit/sepang-international-circuit/):
  approximately 680 m from the start to T1. The source GeoJSON origin is only about
  315 m from T1; the game's timing line is moved upstream on the same home straight
  to source-local `[365, 28]`, leaving approximately 680 m to T1.
- [FIA 2017 Malaysian GP preview](https://www.fia.com/sites/default/files/2017_malaysian_preview_1.pdf):
  the race start/finish offset is 0 m, so the lap origin and race start coincide.
  [FIA 2016 preview](https://www.fia.com/sites/default/files/preview_5.pdf) records
  the T15 driver-right guardrail being moved farther away; no close outside wall
  is placed around that final left-hand hairpin.

As with the other courses, elevations, pit-lane driving, gravel/asphalt runoff
textures and exact barrier setbacks are not surveyed reproductions.
