// A pasted or dropped table to series. Finds the columns of numbers, a date
// column if there is one, and how far apart the dates are.
//   readTable(text) -> { cols: [{ name, values }], pick, step, end } or null

const DAY = 864e5;

function splitLine(line, d) {
  const out = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) {
      if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c;
    } else if (c === '"') q = true;
    else if (c === d) { out.push(cur); cur = ''; } else cur += c;
  }
  out.push(cur);
  return out.map((s) => s.trim());
}

function num(cell) {
  let t = String(cell ?? '').trim().replace(/[$€£¥%\s]/g, '');
  if (!t) return NaN;
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(t)) t = t.replace(/,/g, '');
  if (!/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return NaN;
  return Number(t);
}

function date(cell) {
  const t = String(cell ?? '').trim();
  if (!t || /^[-+]?\d+(\.\d+)?$/.test(t)) return null; // plain numbers aren't dates
  const ms = Date.parse(t.length === 7 && /^\d{4}-\d{2}$/.test(t) ? `${t}-01T00:00` : /^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T00:00` : t);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

// Columns that only count up (an index, a year, a month number) aren't the series.
function counts(values) {
  let up = 0, n = 0;
  for (let i = 1; i < values.length; i++) {
    if (!Number.isFinite(values[i]) || !Number.isFinite(values[i - 1])) continue;
    n++; if (values[i] >= values[i - 1]) up++;
  }
  return n > 0 && up === n;
}

export function readTable(text) {
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n').filter((l) => l.trim() && !/^\s*#/.test(l));
  if (!lines.length) return null;
  const sample = lines.slice(0, 30);
  const delim = ['\t', ';', ','].map((d) => [d, sample.reduce((n, l) => n + splitLine(l, d).length - 1, 0)]).sort((a, b) => b[1] - a[1])[0];
  let rows = lines.map((l) => (delim[1] ? splitLine(l, delim[0]) : l.trim().split(/\s+/)));
  // One long line of numbers is one series.
  if (rows.length === 1 && rows[0].length >= 8) rows = rows[0].map((c) => [c]);

  const width = Math.max(...rows.slice(0, 30).map((r) => r.length));
  const head = rows[0].some((c) => c && Number.isNaN(num(c)) && !date(c)) ? rows.shift() : null;
  if (rows.length < 8) return null;

  const cols = [];
  let dates = null;
  for (let j = 0; j < width; j++) {
    const cells = rows.map((r) => r[j]);
    const values = cells.map(num);
    const good = values.filter(Number.isFinite).length;
    const name = (head?.[j] || '').trim() || `Column ${j + 1}`;
    if (good >= Math.max(8, 0.6 * rows.length)) { cols.push({ name, values, counts: counts(values) }); continue; }
    if (!dates) {
      const ds = cells.map(date);
      if (ds.filter(Boolean).length >= 0.8 * rows.length) dates = ds;
    }
  }
  if (!cols.length) return null;

  // Trim rows with no value at either end of every column.
  const any = (i) => cols.some((c) => Number.isFinite(c.values[i]));
  let a = 0, b = rows.length;
  while (a < b && !any(a)) a++;
  while (b > a && !any(b - 1)) b--;
  for (const c of cols) c.values = c.values.slice(a, b);
  if (dates) dates = dates.slice(a, b);

  // Calendar parts (year, month, day) can stand in for a date column.
  const part = (re) => cols.find((c) => re.test(c.name));
  const yr = part(/^(year|yr)$/i), mo = part(/^(month|mon|mo)$/i), dy = part(/^(day|dd)$/i);
  if (!dates && yr) dates = yr.values.map((y, i) => (Number.isFinite(y) ? new Date(y, mo ? (mo.values[i] || 1) - 1 : 0, dy ? dy.values[i] || 1 : 1) : null));

  // The series is the first column that isn't a counter or a calendar part.
  const skip = /^(year|yr|month|mon|mo|day|dd|date|time|hour|minute|week|quarter|index|idx|id|no|#|decimal date)$/i;
  let pick = cols.findIndex((c) => !c.counts && !skip.test(c.name));
  if (pick < 0) pick = cols.findIndex((c) => !c.counts);
  if (pick < 0) pick = cols.length - 1;

  // Even spacing, from the median gap between dates.
  let step = null, end = null;
  if (dates) {
    const ts = dates.map((d) => d?.getTime()).filter(Number.isFinite);
    const gaps = ts.slice(1).map((t, i) => t - ts[i]).filter((g) => g > 0).sort((x, y) => x - y);
    const g = gaps[Math.floor(gaps.length / 2)];
    if (g) {
      step = Math.abs(g - 36e5) < 6e5 ? 'hour' : Math.abs(g - DAY) < 3 * 36e5 ? 'day' : Math.abs(g - 7 * DAY) < DAY
        ? 'week' : g >= 27 * DAY && g <= 32 * DAY ? 'month' : g >= 360 * DAY && g <= 370 * DAY ? 'year' : null;
      end = dates.at(-1) || new Date(ts.at(-1));
    }
  }
  return { cols: cols.map(({ name, values }) => ({ name, values })), pick, step: end ? step : null, end };
}
