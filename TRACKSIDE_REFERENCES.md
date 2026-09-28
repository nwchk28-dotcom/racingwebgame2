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
| Baku | Close city walls, especially the Old Town, with one-sided escape sections | [F1 on the Old Town's left and right boundaries](https://www.formula1.com/en/latest/article/why-we-love-the-azerbaijan-grand-prix.3QbWtTpFoebriMk1Kyu0j8.3QbWtTpFoebriMk1Kyu0j8), [F1 circuit guide](https://www.formula1.com/en/latest/article/circuit-guide-everything-you-need-to-know-about-the-baku-city-circuit.320UGBNQu2ALdgAtax1gRn.320UGBNQu2ALdgAtax1gRn) |
| Yas Marina | Pit-side and marina-sector walls, open runoff at braking corners | [F1 on Turn 14 wall](https://www.formula1.com/en/latest/article/watch-raikkonen-ends-his-final-friday-practice-session-in-f1-in-the-wall-at.5mj44bpEkQcfofL7Zm90d5), [F1 on chicane runoff](https://www.formula1.com/en/latest/article/watch-enjoy-the-race-start-at-yas-marina-as-verstappen-surges-into-the.3AlvlhComEKFrC1JiHiWFM) |
| Marina Bay | Mostly close street walls with one-sided escape sections | [F1 on the street-circuit wall/runoff contrast](https://www.formula1.com/en/latest/article/win-a-replica-race-suit-in-the-street-showdown-f1-fantasys-new-oracle-red.BQROLTGyvpFYn97nyTEgc), [F1 Singapore driver preview](https://www.formula1.com/en/latest/article/singapore-preview-quotes.7Glwb0jsNumsGiGttYTHiF.7Glwb0jsNumsGiGttYTHiF) |

The Monaco tunnel runs from about 43.5% to 60.5% of the game's lap, after
Portier and before the Nouvelle Chicane. Its 8.8 m roof, bright emissive walls,
and light strips intentionally keep the driving view brighter than the real tunnel.
