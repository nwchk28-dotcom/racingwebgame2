# Third-party notices

## Circuit centerline data

The Monza and Silverstone coordinates in `src/trackData.ts`, and the Albert Park,
Mexico City, and Circuit Gilles-Villeneuve coordinates in `src/flatCircuitData.ts`,
and the Monaco, Spa-Francorchamps, and São Paulo coordinates in
`src/additionalCircuitData.ts`, and the Jeddah, Baku, Yas Marina, and Singapore
coordinates in `src/streetCircuitData.ts`,
and the Shanghai, Bahrain, Miami, Imola, Barcelona-Catalunya, Red Bull Ring,
Hungaroring, Zandvoort, Circuit of the Americas, Las Vegas, and Lusail
coordinates in `src/calendar2025CircuitData.ts`, and the Sepang coordinates
in `src/sepangCircuitData.ts`,
are adapted from [bacinger/f1-circuits](https://github.com/bacinger/f1-circuits),
specifically `circuits/it-1922.geojson`, `circuits/gb-1948.geojson`,
`circuits/au-1953.geojson`, `circuits/mx-1962.geojson`, and
`circuits/ca-1978.geojson`, `circuits/mc-1929.geojson`,
`circuits/be-1925.geojson`, `circuits/br-1940.geojson`, `circuits/sa-2021.geojson`,
`circuits/az-2016.geojson`, `circuits/ae-2009.geojson`, and `circuits/sg-2008.geojson`.
The added 2025 circuits use `circuits/cn-2004.geojson`, `circuits/bh-2002.geojson`,
`circuits/us-2022.geojson`, `circuits/it-1953.geojson`, `circuits/es-1991.geojson`,
`circuits/at-1969.geojson`, `circuits/hu-1986.geojson`, `circuits/nl-1948.geojson`,
`circuits/us-2012.geojson`, `circuits/us-2023.geojson`, and `circuits/qa-2004.geojson`.
Sepang uses `circuits/my-1999.geojson`.
They were projected to local metre coordinates and
rounded; Monza, Silverstone, Monaco, Jeddah, Baku, Yas Marina, Singapore, and
Shanghai and Sepang were additionally rotated to their timing lines.

Copyright (c) 2019-2025 Tomislav Bacinger

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
