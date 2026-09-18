#!/usr/bin/env python3
"""Regenerate the piece list in writing.html and the lead-in on cool.html from
assets/writing.json. Run after editing the JSON. Idempotent.

assets/writing.json is the single source of truth. Pieces are sorted newest
first. Both pages carry marker comments; the block between them is replaced.
"""
import json, re, pathlib, datetime, html

root = pathlib.Path(__file__).parent
data = json.loads((root / 'assets/writing.json').read_text(encoding='utf-8'))
pieces = sorted(data['pieces'], key=lambda p: p['date'], reverse=True)

def nice_date(s):
    d = datetime.date.fromisoformat(s)
    return d.strftime('%b %Y')

def card(p):
    topics = ''.join(f'<span class="tag">{html.escape(t)}</span>' for t in p['topics'])
    return f'''        <article class="card fn-card">
          <a class="fn-thumb" href="{p['href']}" aria-hidden="true" tabindex="-1"
             style="--img:url('/{p['image']}')"></a>
          <div class="fn-body">
            <p class="fn-meta"><span class="fn-kind">{html.escape(p['kind'])}</span> · {nice_date(p['date'])} · {html.escape(p['readTime'])} read</p>
            <h3><a href="{p['href']}" style="color:inherit">{html.escape(p['title'])}</a></h3>
            <p class="muted">{html.escape(p['blurb'])}</p>
            <div class="badges" style="margin-top:12px;justify-content:flex-start">{topics}</div>
          </div>
        </article>'''

def replace_block(path, start, end, body):
    src = path.read_text(encoding='utf-8')
    new, n = re.subn(re.escape(start) + r'.*?' + re.escape(end),
                     start + '\n' + body + '\n' + end, src, count=1, flags=re.S)
    assert n == 1, f'markers not found in {path}'
    path.write_text(new, encoding='utf-8')

replace_block(root / 'writing.html', '<!-- FIELD-NOTES:START -->', '<!-- FIELD-NOTES:END -->',
              '\n'.join(card(p) for p in pieces))

# Cool page carries the three newest as a lead-in
lead = '\n'.join(
    f'''          <li><a href="{p['href']}">{html.escape(p['title'])}</a> <span class="muted">· {html.escape(p['kind'])}, {nice_date(p['date'])}</span></li>'''
    for p in pieces[:3])
replace_block(root / 'cool.html', '<!-- FIELD-NOTES-LEAD:START -->', '<!-- FIELD-NOTES-LEAD:END -->', lead)
print(f'Regenerated writing.html ({len(pieces)} pieces) and the Cool lead-in.')
