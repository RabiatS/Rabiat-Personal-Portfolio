#!/usr/bin/env python3
"""Regenerate EMBEDDED_PROJECTS in assets/script.js from assets/projects.json.

assets/projects.json is the single source of truth. The embedded copy exists
only so the projects page still works when opened over file:// (no fetch).
Run this after editing projects.json. Idempotent.
"""
import json, re, pathlib

root = pathlib.Path(__file__).parent
data = json.loads((root / 'assets/projects.json').read_text(encoding='utf-8'))
# `template` entries are unwritten stubs and stay out of the live grid.
shown = [p for p in data['projects'] if p.get('status') != 'template']

KEYS = ['id', 'title', 'subtitle', 'category', 'tags', 'description', 'github',
        'demo', 'ppt', 'caseStudy', 'status', 'images', 'year']

def emit(p):
    return '    {' + ','.join(
        f'{k}:{json.dumps(p[k], ensure_ascii=False)}' for k in KEYS if k in p) + '}'

block = ('  // GENERATED from assets/projects.json - do not hand-edit.\n'
         '  // Offline/file:// fallback used when fetch() of the JSON is unavailable.\n'
         '  const EMBEDDED_PROJECTS = [\n'
         + ',\n'.join(emit(p) for p in shown) + '\n  ];')

path = root / 'assets/script.js'
src = path.read_text(encoding='utf-8')
new, n = re.subn(
    r'  // GENERATED from assets/projects\.json.*?\n  const EMBEDDED_PROJECTS = \[\n.*?\n  \];',
    block, src, count=1, flags=re.S)
assert n == 1, 'EMBEDDED_PROJECTS block not found'
path.write_text(new, encoding='utf-8')
print(f'Regenerated EMBEDDED_PROJECTS with {len(shown)} projects.')
