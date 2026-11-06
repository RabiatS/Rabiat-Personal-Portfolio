#!/usr/bin/env python3
"""Build lab/crna-lab/data/drugs.json from FDA drug labels.

How it works
1. For each drug, ask openFDA (api.fda.gov/drug/label.json) for candidate labels by exact generic name and route.
2. Pick one label per drug: prefer the NDA holder (the reference label), the current PLR format, the preferred route
   and the newest effective date.
3. Download that label's SPL XML from DailyMed (dailymed.nlm.nih.gov/dailymed/services/v2/spls/<setid>.xml) and read
   the sections by their LOINC codes (2 Dosage and Administration, 4 Contraindications, 12.1 Mechanism of Action ...).
4. Extract each field verbatim (whole sentences, trimmed at a sentence boundary when long) and record the section it
   came from. When a label does not state something, the field says "Not stated in the FDA label". Nothing is guessed.
5. Timeline numbers (onset, peak, duration in minutes) come only from tools/timeline-curation.json, where every number
   carries a verbatim quote. The build checks that each quote really appears in the chosen label, and drops it if not.

Run:  python3 lab/crna-lab/tools/build-drugs.py            (uses a cache in $LABEL_CACHE or the system temp folder)
      python3 lab/crna-lab/tools/build-drugs.py --refresh  (download everything again)
Public domain data: FDA labeling via openFDA and DailyMed (National Library of Medicine).
"""
import json, os, re, sys, tempfile, time, urllib.parse, urllib.request
import xml.etree.ElementTree as ET

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', 'data', 'drugs.json')
CURATION = os.path.join(HERE, 'timeline-curation.json')
CACHE = os.environ.get('LABEL_CACHE') or os.path.join(tempfile.gettempdir(), 'crna-label-cache')
REFRESH = '--refresh' in sys.argv
NS = '{urn:hl7-org:v3}'
NOT_STATED = 'Not stated in the FDA label'

IV = ['INTRAVENOUS']
INH = ['RESPIRATORY (INHALATION)']
# key, display name, category, study group, exact openFDA generic names, preferred routes, title words to avoid
DRUGS = [
    # Anesthesia
    ('propofol', 'Propofol', 'anesthesia', 'Induction agent', ['PROPOFOL'], IV, []),
    ('etomidate', 'Etomidate', 'anesthesia', 'Induction agent', ['ETOMIDATE'], IV, []),
    ('ketamine', 'Ketamine', 'anesthesia', 'Induction agent', ['KETAMINE HYDROCHLORIDE'], IV, []),
    ('methohexital', 'Methohexital', 'anesthesia', 'Induction agent', ['METHOHEXITAL SODIUM'], IV, []),
    ('dexmedetomidine', 'Dexmedetomidine', 'anesthesia', 'Sedative', ['DEXMEDETOMIDINE HYDROCHLORIDE', 'DEXMEDETOMIDINE'], IV, ['SUBLINGUAL', 'FILM']),
    ('midazolam', 'Midazolam', 'anesthesia', 'Sedative', ['MIDAZOLAM HYDROCHLORIDE', 'MIDAZOLAM'], IV, ['SYRUP', 'NASAL', 'AUTOINJECTOR', 'SODIUM CHLORIDE']),
    ('fentanyl', 'Fentanyl', 'anesthesia', 'Opioid', ['FENTANYL CITRATE'], IV, ['BUCCAL', 'NASAL', 'SUBLINGUAL', 'TRANSDERMAL', 'BUPIVACAINE', 'ROPIVACAINE']),
    ('sufentanil', 'Sufentanil', 'anesthesia', 'Opioid', ['SUFENTANIL CITRATE'], IV, ['SUBLINGUAL', 'TABLET']),
    ('remifentanil', 'Remifentanil', 'anesthesia', 'Opioid', ['REMIFENTANIL HYDROCHLORIDE'], IV, []),
    ('alfentanil', 'Alfentanil', 'anesthesia', 'Opioid', ['ALFENTANIL HYDROCHLORIDE'], IV, []),
    ('hydromorphone', 'Hydromorphone', 'anesthesia', 'Opioid', ['HYDROMORPHONE HYDROCHLORIDE'], IV, ['TABLET', 'ORAL', 'LIQUID', 'SUPPOSITORY']),
    ('morphine', 'Morphine', 'anesthesia', 'Opioid', ['MORPHINE SULFATE'], IV, ['TABLET', 'ORAL', 'EXTENDED', 'CAPSULE', 'SOLUTION, ORAL', 'PRESERVATIVE-FREE INTRATHECAL']),
    ('succinylcholine', 'Succinylcholine', 'anesthesia', 'Neuromuscular blocker (depolarizing)', ['SUCCINYLCHOLINE CHLORIDE'], IV, []),
    ('rocuronium', 'Rocuronium', 'anesthesia', 'Neuromuscular blocker (nondepolarizing)', ['ROCURONIUM BROMIDE'], IV, []),
    ('vecuronium', 'Vecuronium', 'anesthesia', 'Neuromuscular blocker (nondepolarizing)', ['VECURONIUM BROMIDE'], IV, []),
    ('cisatracurium', 'Cisatracurium', 'anesthesia', 'Neuromuscular blocker (nondepolarizing)', ['CISATRACURIUM BESYLATE'], IV, []),
    ('neostigmine', 'Neostigmine', 'anesthesia', 'Reversal agent', ['NEOSTIGMINE METHYLSULFATE'], IV, ['GLYCOPYRROLATE']),
    ('glycopyrrolate', 'Glycopyrrolate', 'anesthesia', 'Anticholinergic', ['GLYCOPYRROLATE'], IV, ['TABLET', 'ORAL', 'NEOSTIGMINE', 'INHALATION']),
    ('sugammadex', 'Sugammadex', 'anesthesia', 'Reversal agent', ['SUGAMMADEX', 'SUGAMMADEX SODIUM'], IV, []),
    ('lidocaine', 'Lidocaine', 'anesthesia', 'Local anesthetic', ['LIDOCAINE HYDROCHLORIDE'], ['INFILTRATION', 'EPIDURAL', 'PERINEURAL'], ['EPINEPHRINE', 'DEXTROSE', 'JELLY', 'TOPICAL', 'OINTMENT', 'PATCH', 'SPRAY', 'CREAM', 'KIT']),
    ('bupivacaine', 'Bupivacaine', 'anesthesia', 'Local anesthetic', ['BUPIVACAINE HYDROCHLORIDE'], ['INFILTRATION', 'EPIDURAL', 'PERINEURAL'], ['EPINEPHRINE', 'DEXTROSE', 'SPINAL', 'LIPOSOM', 'MELOXICAM', 'KIT']),
    ('ropivacaine', 'Ropivacaine', 'anesthesia', 'Local anesthetic', ['ROPIVACAINE HYDROCHLORIDE'], ['EPIDURAL', 'INFILTRATION', 'PERINEURAL'], ['KIT', 'FENTANYL']),
    ('chloroprocaine', 'Chloroprocaine', 'anesthesia', 'Local anesthetic', ['CHLOROPROCAINE HYDROCHLORIDE'], ['INFILTRATION', 'EPIDURAL', 'PERINEURAL', 'CAUDAL BLOCK'], ['OPHTHALMIC', 'GEL', 'INTRATHECAL', 'KIT']),
    ('sevoflurane', 'Sevoflurane', 'anesthesia', 'Volatile anesthetic', ['SEVOFLURANE'], INH, []),
    ('desflurane', 'Desflurane', 'anesthesia', 'Volatile anesthetic', ['DESFLURANE'], INH, []),
    ('isoflurane', 'Isoflurane', 'anesthesia', 'Volatile anesthetic', ['ISOFLURANE'], INH, []),
    ('nitrous-oxide', 'Nitrous oxide', 'anesthesia', 'Inhaled gas', ['NITROUS OXIDE'], INH, []),
    # Cardiac
    ('phenylephrine', 'Phenylephrine', 'cardiac', 'Vasopressor', ['PHENYLEPHRINE HYDROCHLORIDE'], IV, ['OPHTHALMIC', 'NASAL', 'TABLET', 'KETOROLAC']),
    ('ephedrine', 'Ephedrine', 'cardiac', 'Vasopressor', ['EPHEDRINE SULFATE', 'EPHEDRINE HYDROCHLORIDE'], IV, ['TABLET', 'GUAIFENESIN']),
    ('norepinephrine', 'Norepinephrine', 'cardiac', 'Vasopressor', ['NOREPINEPHRINE BITARTRATE', 'NOREPINEPHRINE BITARTRATE IN DEXTROSE', 'NOREPINEPHRINE BITARTRATE IN SODIUM CHLORIDE'], IV, []),
    ('epinephrine', 'Epinephrine', 'cardiac', 'Vasopressor', ['EPINEPHRINE'], IV, ['AUTO-INJECTOR', 'AUTOINJECTOR', 'NASAL', 'LIDOCAINE', 'ARTICAINE', 'BUPIVACAINE', 'PREFILLED SYRINGE FOR IM']),
    ('vasopressin', 'Vasopressin', 'cardiac', 'Vasopressor', ['VASOPRESSIN'], IV, []),
    ('dopamine', 'Dopamine', 'cardiac', 'Inotrope', ['DOPAMINE HYDROCHLORIDE'], IV, []),
    ('dobutamine', 'Dobutamine', 'cardiac', 'Inotrope', ['DOBUTAMINE HYDROCHLORIDE', 'DOBUTAMINE'], IV, []),
    ('milrinone', 'Milrinone', 'cardiac', 'Inotrope', ['MILRINONE LACTATE'], IV, []),
    ('esmolol', 'Esmolol', 'cardiac', 'Beta blocker', ['ESMOLOL HYDROCHLORIDE'], IV, []),
    ('labetalol', 'Labetalol', 'cardiac', 'Beta blocker', ['LABETALOL HYDROCHLORIDE'], IV, ['TABLET']),
    ('metoprolol', 'Metoprolol', 'cardiac', 'Beta blocker', ['METOPROLOL TARTRATE'], IV, ['TABLET', 'HYDROCHLOROTHIAZIDE']),
    ('hydralazine', 'Hydralazine', 'cardiac', 'Vasodilator', ['HYDRALAZINE HYDROCHLORIDE'], IV, ['TABLET', 'ISOSORBIDE']),
    ('nicardipine', 'Nicardipine', 'cardiac', 'Calcium channel blocker', ['NICARDIPINE HYDROCHLORIDE'], IV, ['CAPSULE']),
    ('clevidipine', 'Clevidipine', 'cardiac', 'Calcium channel blocker', ['CLEVIDIPINE'], IV, []),
    ('nitroglycerin', 'Nitroglycerin', 'cardiac', 'Vasodilator', ['NITROGLYCERIN', 'NITROGLYCERIN IN DEXTROSE'], IV, ['SUBLINGUAL', 'TRANSDERMAL', 'OINTMENT', 'SPRAY', 'TABLET', 'RECTAL']),
    ('nitroprusside', 'Nitroprusside', 'cardiac', 'Vasodilator', ['SODIUM NITROPRUSSIDE'], IV, []),
    ('amiodarone', 'Amiodarone', 'cardiac', 'Antiarrhythmic', ['AMIODARONE HYDROCHLORIDE'], IV, ['TABLET']),
    ('adenosine', 'Adenosine', 'cardiac', 'Antiarrhythmic', ['ADENOSINE'], IV, []),
    ('diltiazem', 'Diltiazem', 'cardiac', 'Calcium channel blocker', ['DILTIAZEM HYDROCHLORIDE'], IV, ['TABLET', 'CAPSULE', 'EXTENDED']),
    ('atropine', 'Atropine', 'cardiac', 'Anticholinergic', ['ATROPINE SULFATE'], IV, ['OPHTHALMIC', 'PRALIDOXIME', 'AUTO-INJECTOR', 'DIPHENOXYLATE', 'TABLET']),
    ('digoxin', 'Digoxin', 'cardiac', 'Antiarrhythmic', ['DIGOXIN'], IV, ['TABLET', 'ELIXIR', 'ORAL']),
    ('heparin', 'Heparin', 'cardiac', 'Anticoagulant', ['HEPARIN SODIUM'], IV, ['DEXTROSE', 'SODIUM CHLORIDE', 'LOCK FLUSH', 'FLUSH']),
    ('protamine', 'Protamine', 'cardiac', 'Reversal agent', ['PROTAMINE SULFATE'], IV, []),
    # Supporting
    ('ondansetron', 'Ondansetron', 'supporting', 'Antiemetic', ['ONDANSETRON HYDROCHLORIDE', 'ONDANSETRON'], IV, ['TABLET', 'ORALLY', 'ORAL', 'FILM']),
    ('dexamethasone', 'Dexamethasone', 'supporting', 'Corticosteroid', ['DEXAMETHASONE SODIUM PHOSPHATE'], IV, ['OPHTHALMIC', 'OTIC', 'TABLET', 'LIDOCAINE', 'KIT']),
    ('metoclopramide', 'Metoclopramide', 'supporting', 'Antiemetic', ['METOCLOPRAMIDE HYDROCHLORIDE', 'METOCLOPRAMIDE'], IV, ['TABLET', 'ORAL', 'NASAL']),
    ('scopolamine', 'Scopolamine', 'supporting', 'Antiemetic', ['SCOPOLAMINE'], ['TRANSDERMAL'], []),
    ('naloxone', 'Naloxone', 'supporting', 'Reversal agent', ['NALOXONE HYDROCHLORIDE'], IV, ['NASAL', 'AUTO-INJECTOR', 'BUPRENORPHINE', 'PENTAZOCINE', 'TABLET']),
    ('flumazenil', 'Flumazenil', 'supporting', 'Reversal agent', ['FLUMAZENIL'], IV, []),
    ('dantrolene', 'Dantrolene', 'supporting', 'Muscle relaxant (malignant hyperthermia)', ['DANTROLENE SODIUM'], IV, ['CAPSULE']),
    ('ketorolac', 'Ketorolac', 'supporting', 'NSAID', ['KETOROLAC TROMETHAMINE'], IV, ['OPHTHALMIC', 'NASAL', 'TABLET', 'PHENYLEPHRINE']),
    ('acetaminophen', 'Acetaminophen (IV)', 'supporting', 'Analgesic', ['ACETAMINOPHEN'], IV, ['TABLET', 'ORAL', 'SUPPOSITORY', 'IBUPROFEN']),
    ('famotidine', 'Famotidine', 'supporting', 'H2 blocker', ['FAMOTIDINE'], IV, ['TABLET', 'ORAL', 'IBUPROFEN', 'CALCIUM']),
]

LOINC = {
    'indications': '34067-9', 'dosage': '34068-7', 'contra': '34070-3', 'adverse': '34084-4', 'moa': '43679-0',
    'pd': '43681-6', 'pk': '43682-4', 'clinpharm': '34090-1', 'overdose': '34088-5', 'wp': '43685-7',
    'warnings': '34071-1', 'precautions': '42232-9', 'boxed': '34066-1',
}
CODE_NAME = {
    '34067-9': 'Indications and Usage', '34068-7': 'Dosage and Administration', '34070-3': 'Contraindications',
    '34084-4': 'Adverse Reactions', '43679-0': 'Mechanism of Action', '43681-6': 'Pharmacodynamics',
    '43682-4': 'Pharmacokinetics', '34090-1': 'Clinical Pharmacology', '34088-5': 'Overdosage',
    '43685-7': 'Warnings and Precautions', '34071-1': 'Warnings', '42232-9': 'Precautions', '34066-1': 'Boxed Warning',
    '34089-3': 'Description', '34073-7': 'Drug Interactions', '34092-7': 'Clinical Studies', '42229-5': 'Unnamed section',
}
DEFAULT_TITLE = {
    'indications': 'Indications and Usage', 'dosage': 'Dosage and Administration', 'contra': 'Contraindications',
    'adverse': 'Adverse Reactions', 'moa': 'Mechanism of Action', 'pd': 'Pharmacodynamics', 'pk': 'Pharmacokinetics',
    'clinpharm': 'Clinical Pharmacology', 'overdose': 'Overdosage', 'wp': 'Warnings and Precautions',
    'warnings': 'Warnings', 'precautions': 'Precautions', 'boxed': 'Boxed Warning',
}


def get(url, path, binary=False):
    if os.path.exists(path) and not REFRESH:
        with open(path, 'rb') as f:
            return f.read()
    for attempt in range(4):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'crna-lab-study-aid (rabiatsadiq.com)'})
            with urllib.request.urlopen(req, timeout=60) as r:
                data = r.read()
            with open(path, 'wb') as f:
                f.write(data)
            time.sleep(0.25)
            return data
        except urllib.error.HTTPError as e:
            if e.code == 404:
                return None
            time.sleep(2 + attempt * 2)
        except Exception:
            time.sleep(2 + attempt * 2)
    return None


def candidates(key, generics, routes):
    names = ' '.join(f'openfda.generic_name.exact:"{g}"' for g in generics)
    q = f'({names})'
    url = 'https://api.fda.gov/drug/label.json?' + urllib.parse.urlencode({'search': q, 'limit': 100})
    raw = get(url, os.path.join(CACHE, f'ofda-{key}.json'))
    if not raw:
        return []
    d = json.loads(raw)
    return d.get('results', [])


def score(r, generics, routes, avoid):
    o = r.get('openfda', {})
    gn = [g.upper() for g in o.get('generic_name', [])]
    if not any(g in generics for g in gn):
        return None
    if o.get('product_type', [''])[0] != 'HUMAN PRESCRIPTION DRUG':
        return None
    blob = ' '.join(r.get('package_label_principal_display_panel', [])[:2] + r.get('spl_product_data_elements', [])[:1]).upper()
    title = ' '.join(r.get('description', [])[:1]).upper()[:400]
    for a in avoid:
        if a in blob[:600] or a in ' '.join(o.get('route', [])) or a in ' '.join(o.get('brand_name', [])).upper():
            return None
    rts = o.get('route', [])
    s = 0
    if any(rt in rts for rt in routes):
        s += 40
    elif routes:
        s -= 30
    app = (o.get('application_number') or [''])[0]
    if app.startswith('NDA') or app.startswith('BLA'):
        s += 30
    if o.get('is_original_packager', [False])[0]:
        s += 5
    if 'mechanism_of_action' in r:
        s += 15
    if 'pharmacodynamics' in r:
        s += 4
    if 'pharmacokinetics' in r:
        s += 4
    if 'dosage_and_administration' in r:
        s += 10
    if 'pharm_class_epc' in o:
        s += 6
    s += int(r.get('effective_time', '0')[:4] or 0) - 2015  # newer is a little better
    return s


# ---------- SPL XML -> sections ----------
def clean(t):
    t = t.replace(' ', ' ').replace('\t', ' ')
    t = t.replace('\u2014', ', ').replace('\u2013', '-').replace('‒', '-').replace('‐', '-').replace('‑', '-')
    t = t.replace('‘', "'").replace('’', "'").replace('“', '"').replace('”', '"').replace('•', '-')
    t = re.sub(r'[ \r\f\v]+', ' ', t)
    t = re.sub(r' *\n *', '\n', t)
    t = re.sub(r'\n{2,}', '\n', t)
    t = re.sub(r' ([,.;:])', r'\1', t)
    return t.strip()


NL = '\u0001'


def flat_text(e):
    return re.sub(r'\s+', ' ', ''.join(e.itertext())).strip()


def text_of(el, skip_sections=True):
    """Readable text of one SPL section: paragraphs and list items on their own lines, tables as 'cell | cell' rows.
    Subsections and the Highlights excerpts are left out (they are read separately)."""
    out = []

    def walk(e):
        tag = e.tag.replace(NS, '')
        if skip_sections and tag == 'section' and e is not el:
            return
        if tag in ('title', 'excerpt', 'renderMultiMedia', 'observationMedia') and e is not el:
            return
        if tag == 'table':
            cap = e.find(NS + 'caption')
            if cap is not None:
                out.append(NL + flat_text(cap) + NL)
            for tr in e.iter(NS + 'tr'):
                cells = [flat_text(td) for td in tr if td.tag.replace(NS, '') in ('td', 'th')]
                cells = [c for c in cells if c]
                if cells:
                    out.append(NL + ' | '.join(cells) + NL)
            return
        if tag in ('paragraph', 'item', 'list'):
            out.append(NL)
        if tag == 'item':
            out.append('- ')
        if tag == 'br':
            out.append(NL)
        if e.text:
            out.append(e.text)
        for c in e:
            walk(c)
            if c.tail:
                out.append(c.tail)
        if tag in ('paragraph', 'item'):
            out.append(NL)

    for c in el:
        if c.tag.replace(NS, '') in ('title', 'code', 'id', 'effectiveTime', 'excerpt'):
            continue
        walk(c)
        if c.tail:
            out.append(c.tail)
    t = re.sub(r'\s+', ' ', ''.join(out)).replace(NL, '\n')
    t = re.sub(r'-\s*\n\s*-', '-', t)
    t = re.sub(r'(?m)^\s*-\s*$', '', t)
    t = '\n'.join(l for l in t.split('\n') if not re.match(r'^\s*(Figure|Fig\.)\s*\d+[.:]?', l.strip()))
    return clean(t)


class Sec:
    def __init__(self, el, parent=None):
        self.el = el
        c = el.find(NS + 'code')
        self.code = c.get('code') if c is not None else ''
        ti = el.find(NS + 'title')
        self.title = re.sub(r'\s+', ' ', clean(''.join(ti.itertext()))).strip() if ti is not None else ''
        ex = el.find(NS + 'excerpt')
        self.hl = flat_text(ex) if ex is not None else ''
        self.parent = parent
        self.label = self.title or (parent.label if parent else '') or CODE_NAME.get(self.code, 'Unnamed section')
        self.own = text_of(el)
        self.kids = [Sec(k, self) for k in el.findall(NS + 'component/' + NS + 'section')]

    def all(self):
        yield self
        for k in self.kids:
            yield from k.all()

    def full(self):
        parts = [self.own] if self.own else []
        for k in self.kids:
            sub = k.full()
            if sub:
                parts.append((k.title + '\n' if k.title else '') + sub)
        return '\n'.join(parts).strip()


def nice_title(t, fallback):
    t = re.sub(r'[\s:\-]+$', '', re.sub(r'\s+', ' ', clean(t or '')))
    if not t:
        return fallback
    m = re.match(r'^(\d+(?:\.\d+)*)\s+(.*)$', t)
    if m:
        num, rest = m.group(1), m.group(2)
        rest = rest.title() if rest.isupper() else rest
        rest = re.sub(r'\bAnd\b', 'and', rest)
        rest = re.sub(r'\bOf\b', 'of', rest)
        rest = re.sub(r'\bIn\b', 'in', rest)
        return f'{num} {rest}'
    t2 = t.title() if t.isupper() else t
    return re.sub(r'\b(And|Of|In|For|The)\b', lambda m: m.group(1).lower(), t2)


def parse_spl(xml):
    root = ET.fromstring(xml)
    meta = {
        'title': clean(' '.join(root.find(NS + 'title').itertext())) if root.find(NS + 'title') is not None else '',
        'version': root.find(NS + 'versionNumber').get('value') if root.find(NS + 'versionNumber') is not None else '',
        'effective': root.find(NS + 'effectiveTime').get('value') if root.find(NS + 'effectiveTime') is not None else '',
    }
    org = root.find(f'{NS}author/{NS}assignedEntity/{NS}representedOrganization/{NS}name')
    meta['manufacturer'] = clean(org.text) if org is not None and org.text else ''
    body = root.find(f'{NS}component/{NS}structuredBody')
    secs = [Sec(s) for s in body.findall(f'{NS}component/{NS}section')] if body is not None else []
    flat = [x for s in secs for x in s.all()]
    return meta, secs, flat


# ---------- text helpers ----------
ABBR = r'(?:approx|e\.g|i\.e|vs|Fig|No|Dr|Inc|min|hr|hrs|sec|Ref|ca|et al|U\.S|mg|mcg|kg|mL|Vol|Sect)'


def sentences(t):
    t = re.sub(r'\s*\n\s*', ' \n ', t)
    parts = re.split(r'(?<=[.!?])\s+(?=[A-Z(\[])|\s\n\s', t)
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        if out and re.search(r'\b' + ABBR + r'\.$', out[-1]) and not out[-1].endswith('\n'):
            out[-1] += ' ' + p
        else:
            out.append(p)
    return [re.sub(r'\s+', ' ', s).strip() for s in out if len(s.strip()) > 2]


def trim(t, n):
    t = t.strip()
    if len(t) <= n:
        return t, False
    cut = t[:n]
    m = max(cut.rfind('. '), cut.rfind('.\n'))
    if m > n * 0.45:
        return cut[:m + 1].strip(), True
    m = cut.rfind(' ')
    return cut[:m].rstrip(',;: ') + ' ...', True


def strip_refs(t):
    t = re.sub(r'\s*\[\s*see [^\]]*\]', '', t, flags=re.I)
    t = re.sub(r'\s*\(\s*see [^)]*\d[^)]*\)', '', t, flags=re.I)
    t = re.sub(r'\s*\[\s*\d+(?:\.\d+)?(?:\s*,\s*\d+(?:\.\d+)?)*\s*\]', '', t)
    return re.sub(r'\s{2,}', ' ', t).strip()


def first_with(flat, key):
    code = LOINC[key]
    for s in flat:
        if s.code == code:
            return s
    return None


def by_title(flat, pat):
    for s in flat:
        if re.search(pat, s.title, re.I):
            return s
    return None


def field(text, section, excerpt=False):
    return {'text': text, 'src': section, **({'excerpt': True} if excerpt else {})}


def missing():
    return {'text': NOT_STATED, 'src': None}


TIME = r'\b\d+(?:\.\d+)?\s*(?:to|-|or|and)?\s*\d*(?:\.\d+)?\s*(?:seconds?|minutes?|mins?|hours?|hrs?|h)\b'


def find_time_sentences(secs, pat, avoid=None, limit=2):
    found = []
    for title, text in secs:
        for s in sentences(text):
            if re.search(r'\b(infants?|pediatric|neonates?|children|rats?|dogs?|rabbits?|monkeys?)\b', s, re.I):
                continue
            if not re.search(pat, s, re.I):
                continue
            if avoid and re.search(avoid, s, re.I):
                continue
            if len(s) > 520:
                continue
            sc = 0
            if re.search(TIME, s, re.I):
                sc += 5
            if re.search(r'\badult', s, re.I):
                sc += 1
            if re.search(r'\b(pediatric|neonat|infant|child|rat|dog|animal|in vitro)\b', s, re.I):
                sc -= 3
            found.append((sc, title, s))
    found.sort(key=lambda x: -x[0])
    out, seen = [], set()
    for sc, title, s in found:
        if sc < 4 or s in seen:
            continue
        seen.add(s)
        out.append({'text': strip_refs(s), 'src': title})
        if len(out) >= limit:
            break
    return out


DOSE_WORDS = r'(mg/kg|mcg/kg|mg|mcg|units?|mL/kg|mL|%|MAC|concentration|mcg/min|mg/min)'


def extract(drug, rec, meta, flat, epc_fallback=None):
    key, name, category, group, generics, routes, avoid = drug
    o = rec.get('openfda', {})
    def T(s, k):
        return nice_title(s.title, DEFAULT_TITLE[k]) if s else DEFAULT_TITLE[k]

    res = {}
    # Class: FDA Established Pharmacologic Class (SPL indexing)
    epc = [re.sub(r'\s*\[EPC\]$', '', c) for c in o.get('pharm_class_epc', [])]
    moa_cls = [re.sub(r'\s*\[MoA\]$', '', c) for c in o.get('pharm_class_moa', [])]
    # Class: the label's own words ("X is a ... "), read from Indications, Description, Mechanism or Clinical Pharmacology.
    # The FDA Established Pharmacologic Class from openFDA indexing is kept separately when the chosen label has it.
    names = [w.lower() for w in [name.split()[0], *(g.split()[0] for g in generics), *(o.get('brand_name') or [])] if w]
    cls = None
    for code in ('34067-9', '34089-3', '43679-0', '34090-1'):
        for sx in flat:
            if sx.code != code:
                continue
            for sn in sentences(sx.full())[:10]:
                subj = sn.split(' is ')[0].split(' are ')[0].lower() if (' is ' in sn or ' are ' in sn) else ''
                if not subj or len(subj) > 90 or not any(nm.lower() in subj for nm in names):
                    continue
                m = re.search(r'\b(?:is|are)\s+(?:an?|the)\s+(.{3,110}?)(?=\s+(?:with|that|whose|which|indicated|used|for|and is|possessing|producing|since|formed|added|having|in the|of the class)\b|[,;:.(]|$)', sn)
                if m and re.search(r'(agent|anesthetic|agonist|antagonist|blocker|inhibitor|benzodiazepine|opioid|vasodilator|vasoconstrictor|catecholamine|glycoside|anticoagulant|corticosteroid|glucocorticoid|relaxant|analgesic|antiarrhythmic|amine|sympathomimetic|barbiturate|anticholinergic|antiemetic|cyclodextrin|inotrope|hormone|drug|antimuscarinic)', m.group(1), re.I):
                    cls = (m.group(1).strip(), nice_title(sx.label, DEFAULT_TITLE.get('indications')))
                    break
            if cls:
                break
        if cls:
            break
    if cls:
        res['class'] = {'text': cls[0][0].upper() + cls[0][1:], 'src': cls[1]}
    elif epc:
        res['class'] = {'text': '; '.join(epc), 'src': 'FDA Established Pharmacologic Class (SPL indexing)'}
    else:
        res['class'] = missing()
    if epc:
        res['epc'] = {'text': '; '.join(epc), 'src': 'FDA Established Pharmacologic Class (SPL indexing)'}
    if moa_cls:
        res['moaClass'] = {'text': '; '.join(moa_cls), 'src': 'FDA pharmacologic class, mechanism (SPL indexing)'}

    # Mechanism
    s = first_with(flat, 'moa') or by_title(flat, r'mechanism of action')
    if s and s.full():
        t, ex = trim(strip_refs(s.full()), 700)
        res['mechanism'] = field(t, T(s, 'moa'), ex)
    else:
        cp = first_with(flat, 'clinpharm')
        sub = None
        if cp and not cp.own:
            sub = next((k for k in cp.all() if k is not cp and k.own and re.search(r'mechanism|pharmacodynamic|general|action', k.title, re.I)), None) or next((k for k in cp.all() if k is not cp and k.own), None)
        if cp and cp.own:
            t, ex = trim(strip_refs(cp.own), 520)
            res['mechanism'] = field(t, T(cp, 'clinpharm'), ex)
        elif sub:
            t, ex = trim(strip_refs(sub.own), 520)
            res['mechanism'] = field(t, nice_title(sub.label, T(cp, 'clinpharm')), ex)
        else:
            res['mechanism'] = missing()

    # Time course sources
    pools = []
    seen_secs = set()
    for k in ('pd', 'clinpharm', 'pk', 'dosage', 'moa'):
        sec = first_with(flat, k)
        if sec:
            for sub in sec.all():
                if id(sub) in seen_secs or re.search(r'pediatric|neonat|infant|child|animal|pregnan', sub.label, re.I):
                    continue
                seen_secs.add(id(sub))
                pools.append((nice_title(sub.label, T(sec, k)), sub.own))
    res['onset'] = find_time_sentences(pools, r'\bonset\b|time to onset|\b(?:begins|starts|develops) (?:in|within)', avoid=r'of the end of|after discontinu|after stopping|recovery|withdrawal|half-life|\binfants?\b|pediatric|\brats?\b') or missing()
    res['peak'] = find_time_sentences(pools, r'\bpeak\b|\bmaximum (?:plasma |serum )?(?:concentration|effect|response)|\bmaximal (?:effect|response)|\bmaxim(?:um|al) (?:block|neuromuscular block)|\bT\s?max\b', avoid=r'peak expiratory|peak flow|peak airway|peak inspiratory') or missing()
    res['duration'] = find_time_sentences(pools, r'\bduration of (?:action|effect|block|neuromuscular|analgesi|anesthesia|sedation)|\bclinical duration|\bduration\b.{0,40}\b(?:effect|action|block)|\blasts?\b|\bpersist', avoid=r'duration of (?:treatment|therapy|exposure|infusion)|duration of the infusion') or missing()
    hl = find_time_sentences(pools, r'half-life|half life|t1/2', limit=1)
    res['halfLife'] = hl or missing()

    # Dosing: verbatim subsections of section 2 that contain doses, adults first
    ds = first_with(flat, 'dosage')
    dosing = []
    if ds:
        units = list(ds.all())
        cands = []
        for i, k in enumerate(units):
            txt = k.own
            if not txt:
                continue
            head = nice_title(k.title, '')
            first, _, rest = txt.partition('\n')
            if not head and 2 < len(first) < 90 and not first.rstrip().endswith('.') and rest:
                head, txt = first.strip().rstrip(':'), rest
            if not re.search(r'\d', txt) or not re.search(DOSE_WORDS, txt):
                continue
            ctx_title = ' '.join(filter(None, [head, nice_title(k.parent.label, '') if k.parent else '']))
            sc = 0
            if re.search(r'adult', ctx_title, re.I): sc += 4
            if re.search(r'recommended|dosage|dosing|dose|induction|maintenance|intubation|infusion|bolus|block|anesthesia|sedation|hypotension|treatment|prevention|reversal|use in|premedication|adjunct|single', head or ctx_title, re.I): sc += 3
            if re.search(r'pediatric|child|neonat|infant|geriatric|elderly|renal|hepatic|burn|neuromuscular disease|medication errors', head, re.I) and not re.search(r'adult', head, re.I): sc -= 9
            if re.search(r'preparation|compatib|storage|dilution|admixture|handling|monitor|important|discontinu|stability|incompatib|switching|transition|converting|antacid', head, re.I): sc -= 6
            if re.search(r'mg/kg|mcg/kg|\d\s*mg\b|\d\s*mcg\b|units', txt[:500]): sc += 2
            if re.search(r'general|instructions', head, re.I): sc -= 2
            if k is ds: sc -= 1
            cands.append((sc, i, k, head, txt))
        if any(c[0] >= 0 for c in cands):
            cands = [c for c in cands if c[0] >= 0]
        order = sorted(cands, key=lambda x: -x[0])[:4]
        order.sort(key=lambda x: x[1])
        for sc, i, k, head, txt in order:
            t, ex = trim(strip_refs(txt), 900)
            dosing.append({'title': head or nice_title(k.label, 'Dosage and Administration'), 'text': t, 'src': nice_title(k.label, T(ds, 'dosage')), **({'excerpt': True} if ex else {})})
    res['dosing'] = dosing or [{'title': 'Dosage', **missing()}]
    res['route'] = {'text': ', '.join(r.title() for r in o.get('route', [])) or NOT_STATED, 'src': 'SPL product data (route of administration)'}

    # Adverse effects
    ar = first_with(flat, 'adverse')
    if ar and ar.full():
        txt = ar.full()
        hl = [x for x in sentences(ar.hl.split('To report')[0]) if re.search(r'most (?:common|frequent|commonly)', x, re.I) and len(x) < 700] if ar.hl else []
        common = [x for x in sentences(txt) if re.search(r'most (?:common|frequent|commonly)', x, re.I) and len(x) < 700]
        listy = [x for x in sentences(txt) if re.search(r'(incidence|frequen|reported|occurr)', x, re.I) and x.count(',') >= 3 and len(x) < 700]
        if hl:
            t, ex = trim(strip_refs(re.sub(r'\s*\(\s*\d+(?:\.\d+)?\s*\)\s*$', '', hl[0])), 600)
            ar_src = 'Highlights, ' + T(ar, 'adverse')
        elif common:
            t, ex = trim(strip_refs(common[0]), 600)
        elif listy:
            t, ex = trim(strip_refs(listy[0]), 600)
        else:
            t, ex = trim(strip_refs(txt), 500)
        res['adverse'] = field(t, ar_src if hl else T(ar, 'adverse'), ex)
    else:
        res['adverse'] = missing()

    # Contraindications
    ci = first_with(flat, 'contra')
    if ci and ci.full():
        t, ex = trim(strip_refs(ci.full()), 650)
        res['contraindications'] = field(t, T(ci, 'contra'), ex)
    else:
        res['contraindications'] = missing()

    # Boxed warning (title line or first sentences)
    bw = first_with(flat, 'boxed')
    if bw and bw.full():
        t, ex = trim(strip_refs(bw.full()), 420)
        res['boxedWarning'] = field(t, T(bw, 'boxed'), ex)

    # Reversal / antidote: sentences in Overdosage (then Warnings) that name an antagonist or antidote
    rev_pat = r'\b(naloxone|nalmefene|flumazenil|protamine|sugammadex|neostigmine|edrophonium|pyridostigmine|physostigmine|lipid emulsion|antidote|opioid antagonist|narcotic antagonist|benzodiazepine (?:receptor )?antagonist|reversal agent|anticholinesterase|cholinesterase inhibitor|acetylcysteine|phentolamine|digoxin immune fab|digibind|digifab|methylene blue|hydroxocobalamin|sodium thiosulfate|dantrolene)'
    named = r'\b(naloxone|nalmefene|flumazenil|protamine|sugammadex|neostigmine|edrophonium|pyridostigmine|physostigmine|lipid emulsion|antidote|digoxin immune fab|dantrolene|acetylcysteine|phentolamine)'
    rev = []
    for k in ('overdose', 'wp', 'warnings', 'precautions'):
        sec = first_with(flat, k)
        if not sec:
            continue
        for sub in sec.all():
            for x in sentences(sub.own):
                if re.search(rev_pat if k == 'overdose' else named, x, re.I) and 40 < len(x) < 480 and x.rstrip().endswith('.') and not re.search(r'\bnot (?:been )?(?:studied|established)\b|drug interactions', x, re.I):
                    rev.append({'text': strip_refs(x).lstrip('- '), 'src': nice_title(sub.label, T(sec, k))})
        if rev:
            break
    # A reversal agent's own label describes what it reverses, so keep it from echoing itself
    if group == 'Reversal agent':
        res['reversal'] = {'text': 'This drug is itself a reversal agent. See Indications.', 'src': None, 'na': True}
    else:
        res['reversal'] = rev[:2] or missing()

    # Indication (short)
    ind = first_with(flat, 'indications')
    if ind and ind.full():
        t, ex = trim(strip_refs(ind.full()), 520)
        res['indications'] = field(t, T(ind, 'indications'), ex)
    else:
        res['indications'] = missing()
    return res


def main():
    os.makedirs(CACHE, exist_ok=True)
    try:
        cur = json.load(open(CURATION))
    except FileNotFoundError:
        cur = {}
    out = []
    stats = {'fields_sourced': 0, 'fields_not_stated': 0}
    for drug in DRUGS:
        key, name, category, group, generics, routes, avoid = drug
        cands = candidates(key, generics, routes)
        scored = [(score(r, [g.upper() for g in generics], routes, avoid), r) for r in cands]
        scored = [x for x in scored if x[0] is not None]
        if scored:
            scored.sort(key=lambda x: -x[0])
            rec = scored[0][1]
        else:
            # Not in openFDA: fall back to a DailyMed search by name
            raw = get('https://dailymed.nlm.nih.gov/dailymed/services/v2/spls.json?' + urllib.parse.urlencode({'drug_name': generics[0].split()[0].lower()}), os.path.join(CACHE, f'dm-{key}.json'))
            hits = json.loads(raw).get('data', []) if raw else []
            hits = [h for h in hits if 'INJECTION' in h['title'].upper() or not routes or routes == INH]
            if not hits:
                print(f'!! no label for {key}', file=sys.stderr)
                continue
            rec = {'set_id': hits[0]['setid'], 'openfda': {'generic_name': [generics[0]]}}
        setid = rec['set_id']
        epc_fb = None
        xml = get(f'https://dailymed.nlm.nih.gov/dailymed/services/v2/spls/{setid}.xml', os.path.join(CACHE, f'spl-{setid}.xml'))
        if not xml:
            print(f'!! no SPL for {key} {setid}', file=sys.stderr)
            continue
        meta, secs, flat = parse_spl(xml)
        f = extract(drug, rec, meta, flat, epc_fb)
        o = rec.get('openfda', {})
        label = {
            'setid': setid, 'version': meta['version'] or rec.get('version', ''), 'effective': meta['effective'] or rec.get('effective_time', ''),
            'manufacturer': meta['manufacturer'] or (o.get('manufacturer_name') or [''])[0],
            'brand': (o.get('brand_name') or [''])[0], 'generic': (o.get('generic_name') or [''])[0],
            'application': (o.get('application_number') or [''])[0], 'title': meta['title'][:220],
            'url': f'https://dailymed.nlm.nih.gov/dailymed/drugInfo.cfm?setid={setid}',
        }
        # Curated timeline numbers, each checked against the label text
        tl = {}
        alltext = re.sub(r'\s+', ' ', '\n'.join((nice_title(s.title, '') + '\n' + s.own) for s in flat))
        for kind, v in (cur.get(key) or {}).items():
            if kind.startswith('_'):
                continue
            if kind == 'class':
                q = re.sub(r'\s+', ' ', v['quote']).strip()
                sec = next((nice_title(s.label, '') for s in flat if q in re.sub(r'\s+', ' ', s.own)), None)
                if sec is not None:
                    f['class'] = {'text': v['text'], 'src': sec, 'quote': q}
                else:
                    print(f'!! class quote not found for {key}: {q[:80]}', file=sys.stderr)
                continue
            q = re.sub(r'\s+', ' ', v['quote']).strip()
            if q and q in alltext:
                sec = next((nice_title(s.label, '') for s in flat if q in re.sub(r'\s+', ' ', s.own)), None)
                if not sec:
                    sec = v.get('src')
                tl[kind] = {'min': v['min'], 'max': v.get('max', v['min']), 'qual': v.get('qual', 'range'), 'quote': q, 'src': sec or v.get('src'), **({'mid': v['mid']} if 'mid' in v else {}), **({'context': v['context']} if v.get('context') else {})}
            else:
                print(f'!! timeline quote not found for {key}.{kind}: {q[:80]}', file=sys.stderr)
        # Where a timeline number was curated, show the full label sentence that holds it as that field's text
        for kind, v in tl.items():
            sent = None
            for sx in flat:
                for sn in sentences(sx.own):
                    if v['quote'] in re.sub(r'\s+', ' ', sn) or re.sub(r'\s+', ' ', sn) in v['quote']:
                        sent = (strip_refs(re.sub(r'\s+', ' ', sn)).lstrip('- '), nice_title(sx.label, v['src'] or ''))
                        break
                if sent:
                    break
            if sent and len(sent[0]) < 600:
                items = [{'text': sent[0], 'src': sent[1]}]
            else:
                items = [{'text': v['quote'], 'src': v['src']}]
            if kind == 'offset':
                f['offset'] = items
            else:
                prev = f.get(kind) if isinstance(f.get(kind), list) else []
                f[kind] = items + [p for p in prev if p['text'] != items[0]['text']][:1]
        entry = {'id': key, 'name': name, 'category': category, 'group': group, 'label': label, **f, 'timeline': tl, 'notes': ''}
        for k2 in ('class', 'mechanism', 'onset', 'peak', 'duration', 'adverse', 'contraindications', 'reversal', 'dosing'):
            v = entry[k2]
            ok = (isinstance(v, list) and v and v[0].get('src')) or (isinstance(v, dict) and v.get('src'))
            stats['fields_sourced' if ok else 'fields_not_stated'] += 1
        out.append(entry)
        print(f'{key:16s} {label["manufacturer"][:28]:28s} v{label["version"]:>3s} {label["effective"]}  {label["application"]}', file=sys.stderr)
    doc = {
        'built': time.strftime('%Y-%m-%d'),
        'source': 'FDA drug labeling (structured product labeling) via openFDA and DailyMed, U.S. National Library of Medicine. Public domain.',
        'notStated': NOT_STATED,
        'stats': {**stats, 'drugs': len(out)},
        'drugs': out,
    }
    with open(OUT, 'w') as fh:
        json.dump(doc, fh, ensure_ascii=False, separators=(',', ':'))
    print(f'wrote {OUT}: {len(out)} drugs, {stats}', file=sys.stderr)


if __name__ == '__main__':
    main()
