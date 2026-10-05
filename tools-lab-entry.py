#!/usr/bin/env python3
"""Add or replace one Lab entry in lab/models.json from a JSON file.

    python3 tools-lab-entry.py lab/<slug>/entry.json

The file holds one entry (same shape as an item of models.json "models").
An entry with the same slug is replaced in place; a new one is appended.
Holds a lock while it reads and writes, so several people (or agents) can
add entries at once without overwriting each other.
"""
import fcntl, importlib.util, json, pathlib, sys

root = pathlib.Path(__file__).parent
spec = importlib.util.spec_from_file_location('mirror', root / 'tools-mirror-model.py')
mirror = importlib.util.module_from_spec(spec); spec.loader.exec_module(mirror)

entry = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding='utf-8'))
assert entry.get('slug'), 'entry needs a slug'
with open(root / 'lab/.models.lock', 'w') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX)
    data = json.loads((root / 'lab/models.json').read_text(encoding='utf-8'))
    i = next((i for i, m in enumerate(data['models']) if m['slug'] == entry['slug']), None)
    if i is None:
        data['models'].append(entry)
    else:
        data['models'][i] = entry
    mirror.write_models(data)
print(('Replaced ' if i is not None else 'Added ') + entry['slug'])
