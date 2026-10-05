#!/usr/bin/env python3
"""Copy a Lab model's files to Rabiat's own Hugging Face account, so the page
never breaks or changes because an upstream repo moved.

    python3 tools-mirror-model.py --slug moonshine --dry-run
    python3 tools-mirror-model.py --slug moonshine

Reads lab/models.json. Downloads only the files listed under the model's
"files" from source.repo at source.sha, checks every size, adds the upstream
LICENSE and a README that credits the source, uploads the lot to mirror.repo
and writes the new commit sha back into lab/models.json as mirror.sha.

Needs huggingface_hub (python3 -m pip install --user huggingface_hub) and a
write token (hf auth login). The token is never printed.
"""
import argparse, json, pathlib, shutil, sys, tempfile, urllib.request

root = pathlib.Path(__file__).parent
models_path = root / 'lab/models.json'


def fmt(o, level=0):
    """JSON with short objects and lists kept on one line, so models.json stays readable."""
    flat = json.dumps(o, ensure_ascii=False)
    if not isinstance(o, (dict, list)) or len(flat) + 2 * level <= 100:
        return flat
    pad, inner = '  ' * level, '  ' * (level + 1)
    if isinstance(o, dict):
        body = ',\n'.join(f'{inner}{json.dumps(k)}: {fmt(v, level + 1)}' for k, v in o.items())
        return '{\n' + body + f'\n{pad}}}'
    body = ',\n'.join(f'{inner}{fmt(v, level + 1)}' for v in o)
    return '[\n' + body + f'\n{pad}]'


def write_models(data):
    models_path.write_text(fmt(data) + '\n', encoding='utf-8')


def src_text(src):
    host = src.get('host', 'hf')
    if host == 'github':
        return f"files from [github.com/{src['repo']}](https://github.com/{src['repo']}) at commit `{src['sha']}`"
    if host == 'url':
        return f"files from {src['base']}"
    if host == 'local':
        return 'files gathered from the sources listed below'
    return f"the files from [{src['repo']}](https://huggingface.co/{src['repo']}) at commit `{src['sha']}`"


def readme(m):
    src, lic, up = m['source'], m['license'], m['upstream']
    on_hf = src.get('host', 'hf') == 'hf'
    base_line = f"base_model: {up['baseModel']}\n" if on_hf else ''
    base_url = f"https://huggingface.co/{up['baseModel']}" if on_hf else up['url']
    return f'''---
license: {lic['id'].lower()}
{base_line}library_name: transformers.js
pipeline_tag: {m['task']}
---

# {m['name']}, for the web

A copy of {src_text(src)}, trimmed to the files that [rabiatsadiq.com/lab](https://www.rabiatsadiq.com/lab/{m['slug']}/) loads in the browser. It lives here so the page can't change or disappear under it.

- Original model: {up['name']}, [{up['url']}]({up['url']})
- Base weights: [{up['baseModel']}]({base_url})
- Licence: {lic['name']}, see LICENSE. The weights are unchanged.
'''


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--slug', required=True)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    data = json.loads(models_path.read_text(encoding='utf-8'))
    m = next((x for x in data['models'] if x['slug'] == args.slug), None)
    if not m:
        sys.exit(f'No model with slug {args.slug!r} in lab/models.json')
    if m.get('watch'):
        sys.exit(f'{args.slug} is a watch entry: nothing to mirror')
    for v in m['variants']:
        missing = [f for f in v['files'] if f not in m['files']]
        if missing:
            sys.exit(f'Variant files not listed under "files": {missing}')

    from huggingface_hub import HfApi, hf_hub_download
    api = HfApi()
    src, dst = m['source'], m['mirror']

    host = src.get('host', 'hf')
    if host == 'hf':
        remote = {i.path: i.size for i in api.get_paths_info(src['repo'], list(m['files']), revision=src['sha'])}
        for path, size in m['files'].items():
            if remote.get(path) != size:
                sys.exit(f'{path}: models.json says {size} bytes, {src["repo"]}@{src["sha"][:7]} has {remote.get(path)}')
    where = {'hf': f'{src.get("repo")}@{(src.get("sha") or "")[:7]}', 'github': f'github:{src.get("repo")}@{(src.get("sha") or "")[:7]}',
             'url': src.get('base'), 'local': src.get('dir')}[host]

    total = sum(m['files'].values())
    print(f'{where}  ->  {dst["repo"]}')
    for path, size in m['files'].items():
        print(f'  {size / 1e6:9.2f} MB  {path}')
    print(f'  {total / 1e6:9.2f} MB  total, plus README.md and LICENSE')
    if args.dry_run:
        print('Dry run: nothing downloaded or uploaded.')
        return

    with tempfile.TemporaryDirectory() as tmp:
        dl, up = pathlib.Path(tmp, 'dl'), pathlib.Path(tmp, 'up')
        for path in m['files']:
            (up / path).parent.mkdir(parents=True, exist_ok=True)
            if host == 'hf':
                got = pathlib.Path(hf_hub_download(src['repo'], path, revision=src['sha'], local_dir=dl))
                shutil.move(str(got), up / path)
            elif host == 'local':
                shutil.copy(root / src['dir'] / path, up / path)
            else:  # github or a versioned url
                url = (f'https://raw.githubusercontent.com/{src["repo"]}/{src["sha"]}/' if host == 'github' else src['base']) + path
                with urllib.request.urlopen(url) as r:
                    (up / path).write_bytes(r.read())
            if (up / path).stat().st_size != m['files'][path]:
                sys.exit(f'{path}: size does not match models.json')
        with urllib.request.urlopen(m['license']['text']) as r:
            (up / 'LICENSE').write_bytes(r.read())
        for extra in m.get('mirrorExtras', []):  # e.g. NOTICE or second licence for bundled parts
            with urllib.request.urlopen(extra['url']) as r:
                (up / extra['name']).write_bytes(r.read())
        (up / 'README.md').write_text(readme(m), encoding='utf-8')

        api.create_repo(dst['repo'], repo_type='model', exist_ok=True)
        info = api.upload_folder(repo_id=dst['repo'], folder_path=up,
                                 commit_message=f'Copy of {src["repo"]}@{src["sha"][:7]} for rabiatsadiq.com/lab')
    sha = info.oid
    print(f'Uploaded {dst["repo"]}@{sha}')

    # Re-read under the same lock tools-lab-entry.py uses, then write the sha back,
    # so an entry added meanwhile is never overwritten.
    import fcntl
    with open(root / 'lab/.models.lock', 'w') as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        data = json.loads(models_path.read_text(encoding='utf-8'))
        next(x for x in data['models'] if x['slug'] == args.slug)['mirror']['sha'] = sha
        write_models(data)
    print('Wrote mirror.sha into lab/models.json')


if __name__ == '__main__':
    main()
