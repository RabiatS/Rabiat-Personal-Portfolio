#!/usr/bin/env python3
"""Regenerate the model timeline in lab/index.html (the Lab tab) from
lab/models.json. Run after adding or editing a model. Idempotent.

lab/models.json is the single source of truth. The timeline groups models by
the month they came out ("released", or "found.month" when the date that
matters is when Rabiat found it), newest first. Two kinds of entry:
  - live models, which run in the browser and have a page at lab/<slug>/
  - "watch" entries, too big for a browser, which link to an official demo

Refuses to write if an entry isn't ready to ship: a live model with no mirror
sha, a variant file without a size, a missing page, a bad date, or an em dash
anywhere. `--draft` skips only the mirror check, for previewing locally;
never commit a draft build.
"""
import json, re, pathlib, datetime, html, sys

root = pathlib.Path(__file__).parent
draft = '--draft' in sys.argv
data = json.loads((root / 'lab/models.json').read_text(encoding='utf-8'))
MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
KINDS = ['Vision', 'Audio', 'Language', 'Data', 'Body', 'Space', 'Science']  # filter labels live in lab/index.html

# ---------- checks ----------
problems = []
def strings(x, where='models.json'):
    if isinstance(x, str):
        yield where, x
    elif isinstance(x, dict):
        for k, v in x.items(): yield from strings(v, f'{where}.{k}')
    elif isinstance(x, list):
        for i, v in enumerate(x): yield from strings(v, f'{where}[{i}]')
for where, s in strings(data):
    if '\u2014' in s: problems.append(f'em dash in {where}')
def month_ok(s): return bool(re.fullmatch(r'\d{4}-(0[1-9]|1[0-2])', s or ''))
for m in data['models']:
    slug = m['slug']
    if m.get('kind') not in KINDS: problems.append(f'{slug}: kind must be one of {KINDS}')
    if not month_ok(m.get('released')): problems.append(f'{slug}: "released" must be YYYY-MM')
    if m.get('found') and not month_ok(m['found'].get('month')): problems.append(f'{slug}: "found.month" must be YYYY-MM')
    if m.get('watch'):
        if not m['watch'].get('url', '').startswith('https://'): problems.append(f'{slug}: watch.url must be https')
        if not m.get('why'): problems.append(f'{slug}: a watch entry needs "why" (what makes it too big)')
        continue
    if not draft and not re.fullmatch(r'[0-9a-f]{40}', m['mirror'].get('sha') or ''):
        problems.append(f'{slug}: no mirror sha yet (run tools-mirror-model.py --slug {slug})')
    try: datetime.date.fromisoformat(m['added'])
    except (KeyError, ValueError): problems.append(f'{slug}: "added" is not an ISO date')
    for v in m['variants']:
        for f in v['files']:
            if not isinstance(m['files'].get(f), int): problems.append(f'{slug}: {f} has no byte size')
    if not (root / 'lab' / slug / 'index.html').exists(): problems.append(f'{slug}: lab/{slug}/index.html is missing')
if problems:
    sys.exit('Not regenerated:\n  ' + '\n  '.join(problems))

def when(m): return (m.get('found') or {}).get('month') or m['released']
def month_name(ym): y, mo = map(int, ym.split('-')); return f'{MONTHS[mo - 1]} {y}'
def sizes(m):
    mbs = sorted({round(sum(m['files'][f] for f in v['files']) / 1e6) for v in m['variants']})
    def fmt(n): return f'{n / 1000:.1f} GB' if n >= 1000 else f'{n} MB'
    return fmt(mbs[0]) if len(mbs) == 1 else f'{fmt(mbs[0])} to {fmt(mbs[-1])}'

for m in data['models']:
    for key in ('video', 'poster'):
        f = (m.get('preview') or {}).get(key)
        if f and not (root / 'lab' / f).is_file(): problems.append(f"{m['slug']}: preview {key} {f} is missing")
if problems:
    sys.exit('Not regenerated:\n  ' + '\n  '.join(problems))

# newest month first; inside a month, JSON order
models = sorted(data['models'], key=when, reverse=True)

def card(m):
    e = html.escape
    meta = f'<span class="kind">{e(m["kind"])}</span> · {e(m["task"])}'
    note = ''
    if m.get('found'):
        note = f'\n          <p class="lab-note muted">{e(m["found"]["note"])} Released {month_name(m["released"])}.</p>'
    if m.get('watch'):
        url = e(m['watch']['url'])
        return f'''        <article class="card lab-card lab-watch" data-kind="{m['kind']}" data-watch>
          <p class="lab-meta">{meta}</p>
          <h3><a href="{url}" target="_blank" rel="noopener" style="color:inherit">{e(m['name'])}</a></h3>
          <p class="lab-by muted">{e(m['maker'])} · {e(m['license']['name'])}</p>
          <p class="muted">{e(m['blurb'])}</p>{note}
          <p class="lab-fit muted">Too big to run here: {e(m['why'])}</p>
          <div style="margin-top: 10px;">
            <a href="{url}" target="_blank" rel="noopener" style="font-size: 13px; color: inherit; opacity: 0.8; font-weight: 600;">▶ {e(m['watch'].get('label', 'Watch the demo'))} ↗</a>
          </div>
        </article>'''
    clip = ''
    if m.get('preview'):
        # a looping screen recording of the demo; assets/previews.js plays it while on screen
        v, p = e(m['preview']['video']), e(m['preview']['poster'])
        clip = (f'\n          <a class="preview-media" href="{m["slug"]}/" tabindex="-1" aria-hidden="true">'
                f'<video data-preview muted loop playsinline preload="none" poster="{p}"><source src="{v}" type="video/mp4"></video></a>')
    return f'''        <article class="card lab-card" data-slug="{m['slug']}" data-kind="{m['kind']}">{clip}
          <p class="lab-meta">{meta}</p>
          <h3><a href="{m['slug']}/" style="color:inherit">{e(m['name'])}</a></h3>
          <p class="lab-by muted">{e(m['maker'])} · {e(m['license']['name'])}</p>
          <p class="muted">{e(m['blurb'])}</p>{note}
          <p class="lab-fit muted" data-fit>{sizes(m)}</p>
          <div style="margin-top: 10px;">
            <a href="{m['slug']}/" style="font-size: 13px; color: inherit; opacity: 0.8; font-weight: 600;">▶ Try ↗</a>
          </div>
        </article>'''

sections = []
for ym in sorted({when(m) for m in models}, reverse=True):
    cards = '\n'.join(card(m) for m in models if when(m) == ym)
    sections.append(f'''      <section class="lab-month" data-month="{ym}">
        <h2 class="lab-month-h"><time datetime="{ym}">{month_name(ym)}</time></h2>
        <div class="grid cards-3">
{cards}
        </div>
      </section>''')

def replace_block(path, start, end, body):
    src = path.read_text(encoding='utf-8')
    new, n = re.subn(re.escape(start) + r'.*?' + re.escape(end),
                     lambda _: start + '\n' + body + '\n' + end, src, count=1, flags=re.S)
    assert n == 1, f'markers not found in {path}'
    path.write_text(new, encoding='utf-8')

replace_block(root / 'lab/index.html', '<!-- LAB-LIST:START -->', '<!-- LAB-LIST:END -->', '\n'.join(sections))
live = sum(1 for m in models if not m.get('watch'))
print(f'Regenerated lab/index.html ({live} live models, {len(models) - live} to watch, {len(sections)} months).')
