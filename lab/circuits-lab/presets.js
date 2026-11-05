// Preset circuits shared by the sandbox (and helpers for chapter presets).
export const w = (x1, y1, x2, y2) => ({ type: 'wire', pts: [[x1, y1], [x2, y2]] });
// A wire path through several points: path([1,1],[4,1],[4,3])
export const path = (...pts) => pts.slice(1).map((p, i) => ({ type: 'wire', pts: [pts[i], p] }));

export const PRESETS = [
  {
    id: 'empty', name: 'Empty board', note: 'Start from nothing.',
    circuit: { cols: 14, rows: 9, parts: [{ type: 'battery', pts: [[2, 6], [2, 4]], V: 6 }] },
  },
  {
    id: 'loop', name: 'Bulb and switch', note: 'The simplest useful circuit.',
    circuit: { cols: 14, rows: 9, parts: [
      { type: 'battery', pts: [[3, 6], [3, 3]], V: 6 }, ...path([3, 3], [5, 3]), { type: 'switch', pts: [[5, 3], [7, 3]] }, ...path([7, 3], [9, 3]),
      { type: 'bulb', pts: [[9, 3], [9, 6]] }, ...path([9, 6], [3, 6]),
    ] },
  },
  {
    id: 'divider', name: 'Light sensor divider', note: 'A fixed resistor and an LDR split 9 V. Change the light level on the LDR and watch the output voltage. This is how a night light knows it is dark.',
    circuit: { cols: 14, rows: 9, parts: [
      { type: 'battery', pts: [[3, 7], [3, 1]], V: 9 }, ...path([3, 1], [7, 1]),
      { id: 'Rfix', type: 'resistor', pts: [[7, 1], [7, 4]], R: 10000, label: 'R' },
      { id: 'LDR', type: 'ldr', pts: [[7, 4], [7, 7]], light: 0.5 }, ...path([7, 7], [3, 7]),
      ...path([7, 4], [10, 4]), { type: 'voltmeter', pts: [[10, 4], [10, 7]], label: 'Vout' }, ...path([10, 7], [7, 7]),
    ] },
  },
  {
    id: 'bridge', name: 'Wheatstone bridge', note: 'Four resistors in a diamond. The meter across the middle reads zero when R1/R2 = R3/R4. Tap R4 and change it until the bridge balances: that is how unknown resistances were measured precisely.',
    circuit: { cols: 14, rows: 9, parts: [
      { type: 'battery', pts: [[2, 8], [2, 1]], V: 10 }, ...path([2, 1], [4, 1]),
      { id: 'R1', type: 'resistor', pts: [[4, 1], [4, 4]], R: 100, label: 'R1' }, { id: 'R2', type: 'resistor', pts: [[4, 4], [4, 7]], R: 200, label: 'R2' },
      ...path([4, 1], [10, 1]),
      { id: 'R3', type: 'resistor', pts: [[10, 1], [10, 4]], R: 150, label: 'R3' }, { id: 'R4', type: 'resistor', pts: [[10, 4], [10, 7]], R: 220, label: 'R4' },
      ...path([4, 4], [6, 4]), { type: 'voltmeter', pts: [[6, 4], [8, 4]] }, ...path([8, 4], [10, 4]),
      ...path([10, 7], [10, 8], [2, 8]), ...path([4, 7], [4, 8]),
    ] },
  },
  {
    id: 'rc', name: 'RC timer', note: 'Flip the two way switch to charge, flip back to discharge through the same resistor.',
    circuit: { cols: 14, rows: 9, parts: [
      { type: 'battery', pts: [[2, 7], [2, 2]], V: 6 }, ...path([2, 2], [4, 2]),
      { type: 'spdt', pts: [[6, 3], [4, 2], [4, 4]] }, ...path([4, 4], [4, 7]),
      { type: 'resistor', pts: [[6, 3], [9, 3]], R: 10000 }, { type: 'capacitor', pts: [[9, 3], [9, 7]], C: 2.2e-4 },
      ...path([9, 7], [2, 7]),
    ] },
  },
  {
    id: 'led', name: 'LED with resistor', note: 'A 9 V battery, a current limiting resistor and a red LED. Try removing the resistor.',
    circuit: { cols: 14, rows: 9, parts: [
      { type: 'battery', pts: [[3, 6], [3, 3]], V: 9 }, ...path([3, 3], [5, 3]), { type: 'resistor', pts: [[5, 3], [8, 3]], R: 330 }, ...path([8, 3], [9, 3]),
      { type: 'led', pts: [[9, 3], [9, 6]], color: 'red' }, { type: 'ammeter', pts: [[9, 6], [6, 6]] }, ...path([6, 6], [3, 6]),
    ] },
  },
  {
    id: 'rl', name: 'Inductor and bulb', note: 'An inductor resists changes in current. Close the switch and watch the current rise along a curve instead of jumping.',
    circuit: { cols: 14, rows: 9, parts: [
      { type: 'battery', pts: [[3, 6], [3, 3]], V: 6 }, ...path([3, 3], [4, 3]), { type: 'switch', pts: [[4, 3], [6, 3]], closed: false },
      { type: 'inductor', pts: [[6, 3], [9, 3]], L: 5 }, ...path([9, 3], [10, 3]), { type: 'bulb', pts: [[10, 3], [10, 6]] }, { type: 'ammeter', pts: [[10, 6], [7, 6]] }, ...path([7, 6], [3, 6]),
    ] },
  },
  {
    id: 'stair', name: 'Staircase switch', note: 'Two way switches at the top and bottom of the stairs. Either one changes the light.',
    circuit: { cols: 14, rows: 9, parts: [
      { type: 'battery', pts: [[2, 7], [2, 3]], V: 6 }, { type: 'spdt', pts: [[2, 3], [4, 2], [4, 4]] },
      ...path([4, 2], [9, 2]), ...path([4, 4], [9, 4]), { type: 'spdt', pts: [[11, 3], [9, 2], [9, 4]] },
      ...path([11, 3], [12, 3]), { type: 'bulb', pts: [[12, 3], [12, 7]] }, ...path([12, 7], [2, 7]),
    ] },
  },
];
