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
import argparse, json, pathlib, re, shutil, sys, tempfile, urllib.request

root = pathlib.Path(__file__).parent
models_path = root / 'lab/models.json'


def readme(m):
    src, lic, up = m['source'], m['license'], m['upstream']
    return f'''---
license: {lic['id'].lower()}
base_model: {up['baseModel']}
library_name: transformers.js
pipeline_tag: {m['task']}
---

# {m['name']}, for the web

A copy of the ONNX files from [{src['repo']}](https://huggingface.co/{src['repo']}) at commit `{src['sha']}`, trimmed to the files that [rabiatsadiq.com/lab](https://www.rabiatsadiq.com/lab/{m['slug']}/) loads in the browser. It lives here so the page can't change or disappear under it.

- Original model: {up['name']}, [{up['url']}]({up['url']})
- Base weights: [{up['baseModel']}](https://huggingface.co/{up['baseModel']})
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
    for v in m['variants']:
        missing = [f for f in v['files'] if f not in m['files']]
        if missing:
            sys.exit(f'Variant files not listed under "files": {missing}')

    from huggingface_hub import HfApi, hf_hub_download
    api = HfApi()
    src, dst = m['source'], m['mirror']

    remote = {i.path: i.size for i in api.get_paths_info(src['repo'], list(m['files']), revision=src['sha'])}
    for path, size in m['files'].items():
        if remote.get(path) != size:
            sys.exit(f'{path}: models.json says {size} bytes, {src["repo"]}@{src["sha"][:7]} has {remote.get(path)}')

    total = sum(m['files'].values())
    print(f'{src["repo"]}@{src["sha"][:7]}  ->  {dst["repo"]}')
    for path, size in m['files'].items():
        print(f'  {size / 1e6:9.2f} MB  {path}')
    print(f'  {total / 1e6:9.2f} MB  total, plus README.md and LICENSE')
    if args.dry_run:
        print('Dry run: nothing downloaded or uploaded.')
        return

    with tempfile.TemporaryDirectory() as tmp:
        dl, up = pathlib.Path(tmp, 'dl'), pathlib.Path(tmp, 'up')
        for path in m['files']:
            got = pathlib.Path(hf_hub_download(src['repo'], path, revision=src['sha'], local_dir=dl))
            if got.stat().st_size != m['files'][path]:
                sys.exit(f'{path}: downloaded size does not match')
            (up / path).parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(got), up / path)
        with urllib.request.urlopen(m['license']['text']) as r:
            (up / 'LICENSE').write_bytes(r.read())
        (up / 'README.md').write_text(readme(m), encoding='utf-8')

        api.create_repo(dst['repo'], repo_type='model', exist_ok=True)
        info = api.upload_folder(repo_id=dst['repo'], folder_path=up,
                                 commit_message=f'Copy of {src["repo"]}@{src["sha"][:7]} for rabiatsadiq.com/lab')
    sha = info.oid
    print(f'Uploaded {dst["repo"]}@{sha}')

    # Write only the sha back, so the hand-formatted JSON keeps its layout.
    text = models_path.read_text(encoding='utf-8')
    pat = re.compile(r'("mirror": \{ "repo": "' + re.escape(dst['repo']) + r'", "sha": )(null|"[0-9a-f]*")')
    text, n = pat.subn(lambda mm: f'{mm.group(1)}"{sha}"', text)
    if n != 1:
        sys.exit(f'Could not find the mirror line for {dst["repo"]}; set mirror.sha to {sha} by hand')
    models_path.write_text(text, encoding='utf-8')
    print('Wrote mirror.sha into lab/models.json')


if __name__ == '__main__':
    main()
