#!/usr/bin/env python3
"""Regenerate the model cards in lab/index.html (the Lab tab) from
lab/models.json. Run after adding or editing a model. Idempotent.

lab/models.json is the single source of truth. Models are listed newest first
(by "added"). The page carries marker comments; the block between them is
replaced.

Refuses to write if a model isn't ready to ship: no mirror sha, a variant file
without a size, a bad date, a missing page, or an em dash anywhere.
"""
import json, re, pathlib, datetime, html, sys

root = pathlib.Path(__file__).parent
data = json.loads((root / 'lab/models.json').read_text(encoding='utf-8'))

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
for m in data['models']:
    slug = m['slug']
    if not re.fullmatch(r'[0-9a-f]{40}', m['mirror'].get('sha') or ''):
        problems.append(f'{slug}: no mirror sha yet (run tools-mirror-model.py --slug {slug})')
    try: datetime.date.fromisoformat(m['added'])
    except ValueError: problems.append(f'{slug}: "added" is not an ISO date')
    for v in m['variants']:
        for f in v['files']:
            if not isinstance(m['files'].get(f), int): problems.append(f'{slug}: {f} has no byte size')
    if not (root / 'lab' / slug / 'index.html').exists(): problems.append(f'{slug}: lab/{slug}/index.html is missing')
if problems:
    sys.exit('Not regenerated:\n  ' + '\n  '.join(problems))

models = sorted(data['models'], key=lambda m: m['added'], reverse=True)  # stable: JSON order breaks ties

def day(s): d = datetime.date.fromisoformat(s); return f'{d.day} {d.strftime("%b %Y")}'
def sizes(m):
    mbs = sorted({round(sum(m['files'][f] for f in v['files']) / 1e6) for v in m['variants']})
    return f'{mbs[0]} MB' if len(mbs) == 1 else f'{mbs[0]} to {mbs[-1]} MB'

def card(m):
    e = html.escape
    return f'''        <article class="card lab-card" data-slug="{m['slug']}">
          <p class="lab-meta"><span class="kind">{e(m['kind'])}</span> · <time datetime="{m['added']}">{day(m['added'])}</time></p>
          <h3><a href="{m['slug']}/" style="color:inherit">{e(m['name'])}</a></h3>
          <p class="muted">{e(m['blurb'])}</p>
          <p class="lab-fit muted" data-fit>{e(m['license']['name'])} · {sizes(m)}</p>
          <div style="margin-top: 10px;">
            <a href="{m['slug']}/" style="font-size: 13px; color: inherit; opacity: 0.8; font-weight: 600;">▶ Try ↗</a>
          </div>
        </article>'''

def replace_block(path, start, end, body):
    src = path.read_text(encoding='utf-8')
    new, n = re.subn(re.escape(start) + r'.*?' + re.escape(end),
                     lambda _: start + '\n' + body + '\n' + end, src, count=1, flags=re.S)
    assert n == 1, f'markers not found in {path}'
    path.write_text(new, encoding='utf-8')

replace_block(root / 'lab/index.html', '<!-- LAB-LIST:START -->', '<!-- LAB-LIST:END -->',
              '\n'.join(card(m) for m in models))
print(f'Regenerated lab/index.html ({len(models)} models).')
