// Builds ask/index.json: every passage "Ask my portfolio" can quote, cut from
// what is already published on the site. Nothing here is written by hand, so
// an answer on /ask/ is always a quote with a link back to where it came from.
//
// Run it from the repo root whenever a source changes (no packages needed,
// Node 18 or newer):
//
//   node ask/build-index.mjs
//
// Sources, in the order they are read:
//   index.html                 hero, experience, education, skills, awards
//   assets/projects.json       every project except status "template"
//   assets/writing.json        Field Notes (plus writing.html's intro)
//   case-studies/*.html        one passage per heading section
//   lab/models.json            the Lab cards (lab/index.html for the hand-made ones)
//   lab/study/index.html       Study Lab subjects, plus each kit lab's chapters
//   cool.html                  tools, playground, Brain Gym
//   coursework.html            semesters and courses
//   contact.html, projects.html, vr.html   a short passage each
//
// Each passage is { id, kind, title, url, text }. url is relative to the site
// root and points at the section where it can (#id, or a #:~:text= fragment
// that scrolls to the heading). Passages are about 40 to 120 words, split on
// sentence boundaries inside a heading section.
//
// Curated answers live in ask/answers.json and are read by the page directly,
// so editing them does not need this script.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

// ---------- text helpers ----------
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', middot: '·', hellip: '...', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"', mdash: '-', ndash: '-', times: 'x', rarr: '', larr: '', copy: '(c)' };
function decode(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n) => (n.toLowerCase() in ENT ? ENT[n.toLowerCase()] : m));
}

// The site's own copy sometimes has long dashes; the index never does.
// A range like "2023 - 2024" reads "2023 to 2024"; anything else becomes " - ".
const MONTH = '(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*';
function tidy(s) {
  return s
    .replace(new RegExp(`(\\d{4}|${MONTH})\\s*[\\u2013\\u2014]\\s*(?=\\d|${MONTH}|Present|Now)`, 'g'), '$1 to ')
    .replace(/\s*[–—]\s*/g, ' - ')
    .replace(/[←-⇿↗]/g, '') // arrows from link labels
    .replace(/\p{Extended_Pictographic}[\u{1F3FB}-\u{1F3FF}️]?/gu, '')
    .replace(/\s+([.,;:!?])/g, '$1')
    .replace(/([.!?])(?:\s*\.)+(?=\s|$)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

// HTML to plain text. Block ends become newlines so sentences do not run together.
function text(html) {
  return tidy(decode(html
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<(script|style|svg|noscript|template|video|audio|canvas|button|select|iframe)\b[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<\/(p|div|li|h[1-6]|section|article|figcaption|blockquote|td|tr|dd|dt|summary)>/gi, '. ')
    .replace(/<[^>]+>/g, ' ')))
    .replace(/(\.\s*){2,}/g, '. ')
    .replace(/([!?:])\./g, '$1')
    .replace(/^\.\s*/, '')
    .trim();
}
const inner = (html, re) => { const m = html.match(re); return m ? m[1] : ''; };
const words = (s) => s.split(/\s+/).filter(Boolean).length;
// A sentence ends at . ! or ? followed by a space and a capital, digit or quote,
// so "B.S." and "reward.py" stay whole.
const sentences = (s) => s.split(/(?<=[.!?]["')\]]*)\s+(?=[A-Z0-9"'(])/).map((x) => x.trim()).filter(Boolean);

// A heading section to passages of about 40 to 120 words, on sentence boundaries.
function split(body, max = 120, target = 80) {
  const out = [];
  let cur = [];
  let n = 0;
  for (const s of sentences(body)) {
    const w = words(s);
    if (n && n + w > max) { out.push(cur.join(' ')); cur = []; n = 0; }
    cur.push(s); n += w;
    if (n >= target) { out.push(cur.join(' ')); cur = []; n = 0; }
  }
  if (cur.length) {
    // A short tail joins the passage before it rather than standing alone.
    if (out.length && n < 40) out[out.length - 1] += ' ' + cur.join(' ');
    else out.push(cur.join(' '));
  }
  return out;
}

// A link that scrolls to a heading when the page has no id there.
// Text fragments are supported by Chrome, Edge, Safari and Firefox; elsewhere
// the page simply opens at the top.
// Whole words only: a fragment that stops mid-word does not match.
const frag = (s) => '#:~:text=' + encodeURIComponent(s.split(/\s+/).slice(0, 8).join(' ')).replace(/-/g, '%2D');

// ---------- collect ----------
const docs = [];
const seen = new Map();
function add(kind, title, url, body, { min = 6 } = {}) {
  body = tidy(body);
  if (words(body) < min) return;
  const parts = split(body);
  parts.forEach((part, i) => {
    const base = (kind + '-' + title).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60);
    let id = parts.length > 1 ? `${base}-${i + 1}` : base;
    const k = seen.get(id) || 0; seen.set(id, k + 1);
    if (k) id += `-${k + 1}`;
    docs.push({ id, kind, title: tidy(title), url, text: part });
  });
}

// Sections of a page by id: <section id="x"> ... </section> (not nested on this site).
const section = (html, id) => inner(html, new RegExp(`<section[^>]*\\bid="${id}"[^>]*>([\\s\\S]*?)</section>`, 'i'));
// Pieces of a block that start with the same opening tag, e.g. every <li class="t-item">.
const pieces = (html, open) => html.split(open).slice(1);

// ---------- index.html ----------
{
  const html = read('index.html');
  const hero = inner(html, /<section class="hero[^"]*"[^>]*>([\s\S]*?)<\/section>/i);
  const h1 = text(inner(hero, /<h1>([\s\S]*?)<\/h1>/i));
  const lead = text(inner(hero, /<p class="lead">([\s\S]*?)<\/p>/i));
  const tags = [...inner(hero, /<div class="badges">([\s\S]*?)<\/div>/i).matchAll(/<span class="tag">([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
  add('About', 'About Rabiat', 'index.html', `${h1} ${lead} Focus areas: ${tags.join(', ')}.`);

  for (const li of pieces(section(html, 'experience'), '<li class="t-item">')) {
    const role = text(inner(li, /<h3>([\s\S]*?)<\/h3>/i));
    const when = text(inner(li, /<strong>([\s\S]*?)<\/strong>/i));
    const what = text(inner(li, /<p class="muted" style="margin-top: 8px;">([\s\S]*?)<\/p>/i));
    const tg = [...li.matchAll(/<span class="tag"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
    // Scroll to the role itself: the first words of its heading.
    const anchor = role.split(' · ')[0];
    add('Experience', role, `index.html${frag(anchor)}`, `${role}. ${when}. ${what}${tg.length ? ` Areas: ${tg.join(', ')}.` : ''}`);
  }

  const cards = (id) => pieces(section(html, id), '<article class="card">').map((a) => ({
    h: text(inner(a, /<h3[^>]*>([\s\S]*?)<\/h3>/i)),
    p: [...a.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[1])).join('. '),
    tags: [...a.matchAll(/<span class="tag"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1])),
  }));
  const edu = cards('education').map((c) => [c.h, c.p, c.tags.length ? `(${c.tags.join(', ')})` : ''].filter(Boolean).join(': ').replace(/: \(/, ' (')).join('. ');
  add('Education', 'Education', 'index.html#education', `Education and academic background. ${edu}.`);

  const skills = pieces(section(html, 'skills'), '<div class="card">').map((c) => {
    const h = text(inner(c, /<h3[^>]*>([\s\S]*?)<\/h3>/i));
    const t = [...c.matchAll(/<span class="tag"[^>]*>([\s\S]*?)<\/span>/g)].map((m) => text(m[1]));
    return `${h}: ${t.join(', ')}.`;
  });
  add('Skills', 'Skills and technologies', 'index.html#skills', `Skills and technologies I work with. ${skills.join(' ')}`);

  for (const c of cards('awards')) add('Awards', c.h, 'index.html#awards', `Awards and recognition. ${c.h}. ${c.p}`);
}

// ---------- projects.json ----------
const projects = JSON.parse(read('assets/projects.json')).projects.filter((p) => p.status !== 'template');
const internal = (u) => u && !/^https?:/i.test(u);
function projectUrl(p) {
  if (p.caseStudy) return p.caseStudy;
  if (internal(p.demo)) return p.demo;
  return `projects.html#${p.id}`;
}
for (const p of projects) {
  const extra = [
    p.awards?.length ? `Awards: ${p.awards.join(', ')}.` : '',
    `${p.category}${p.year ? `, ${p.year}` : ''}${p.status === 'in-progress' ? ', in progress' : ''}.`,
    p.tags?.length ? `Tags: ${p.tags.join(', ')}.` : '',
    p.technologies?.length ? `Built with ${p.technologies.join(', ')}.` : '',
  ].filter(Boolean).join(' ');
  add('Project', p.title, projectUrl(p), `${p.title}: ${p.subtitle || ''}. ${p.description || ''} ${p.longDescription || ''} ${extra}`);
}

// ---------- writing ----------
const writing = JSON.parse(read('assets/writing.json')).pieces;
{
  const html = read('writing.html');
  const intro = inner(html, /<div class="fn-intro">([\s\S]*?)<\/div>/i);
  add('Writing', 'Field Notes', 'writing.html', text(intro));
}
for (const w of writing) {
  add(w.kind, w.title, w.href, `${w.title}. ${w.kind}, ${w.date ? w.date.slice(0, 7) : ''}, ${w.readTime || ''} read. ${w.blurb} Topics: ${(w.topics || []).join(', ')}.`);
}

// ---------- case studies, one passage per heading section ----------
const titleFor = new Map();
for (const p of projects) if (p.caseStudy) titleFor.set(p.caseStudy, p.title);
for (const w of writing) titleFor.set(w.href, w.title); // writing titles win: they name the page
const SKIP = /sources|references|further reading|credits|bibliography|^(notes|read next|more|next)$/i;
for (const f of fs.readdirSync(path.join(root, 'case-studies')).filter((f) => f.endsWith('.html')).sort()) {
  const rel = `case-studies/${f}`;
  let html = read(rel);
  html = inner(html, /<main\b[^>]*>([\s\S]*?)<\/main>/i) || inner(html, /<body\b[^>]*>([\s\S]*?)<\/body>/i);
  html = html.replace(/<(header|nav|footer|aside class="toc)[\s\S]*?<\/\1>/gi, ' ');
  const name = titleFor.get(rel) || text(inner(read(rel), /<title>([\s\S]*?)<\/title>/i)).split(' | ')[0];
  const kind = writing.find((w) => w.href === rel)?.kind === 'Essay' ? 'Essay' : 'Case study';
  const heads = [...html.matchAll(/<h2\b([^>]*)>([\s\S]*?)<\/h2>/gi)];
  const intro = html.slice(0, heads[0]?.index ?? html.length);
  add(kind, name, rel, text(intro));
  heads.forEach((h, i) => {
    const head = text(h[2]);
    if (SKIP.test(head)) return;
    const body = html.slice(h.index + h[0].length, heads[i + 1]?.index ?? html.length);
    // An id on the h2, or on the <section> it opens, beats a text fragment.
    const before = html.slice(Math.max(0, h.index - 300), h.index);
    const id = inner(h[1], /\bid="([^"]+)"/) || inner(before, /<section[^>]*\bid="([^"]+)"[^>]*>\s*$/);
    add(kind, `${name}: ${head}`, rel + (id ? `#${id}` : frag(head)), `${head}. ${text(body)}`);
  });
}

// ---------- the Lab ----------
{
  const html = read('lab/index.html');
  add('Lab', 'The Lab', 'lab/', [
    text(inner(html, /<h1>([\s\S]*?)<\/h1>/i)),
    text(inner(html, /<p class="lead"[^>]*>([\s\S]*?)<\/p>/i)),
    text(inner(html, /<p class="muted cool-sub">([\s\S]*?)<\/p>/i)),
  ].join('. '));
  const models = JSON.parse(read('lab/models.json')).models;
  const names = new Set(models.map((m) => m.name));
  for (const m of models) {
    const page = exists(`lab/${m.slug}/index.html`);
    const url = page ? `lab/${m.slug}/` : m.watch?.url || 'lab/';
    add('Lab', m.name, url, [
      `${m.name}, by ${m.maker}. Lab model: ${m.kind}, ${m.task}.`,
      m.blurb,
      m.try || '',
      m.params ? `${m.params} parameters.` : '',
      page ? 'Runs on your own device in the browser, nothing uploaded.' : m.why ? `Too big to run here: ${m.why}` : '',
      m.license?.name ? `Licence: ${m.license.name}.` : '',
    ].filter(Boolean).join(' '));
  }
  // Hand-made cards with no models.json entry (Demo Check, Study Lab).
  for (const a of pieces(html, '<article class="card lab-card')) {
    const h = inner(a, /<h3><a href="([^"]+)"[^>]*>([\s\S]*?)<\/a><\/h3>/i);
    const title = text(inner(a, /<h3><a[^>]*>([\s\S]*?)<\/a><\/h3>/i));
    if (!title || names.has(title)) continue;
    const href = 'lab/' + h.replace(/^\.\//, '');
    const ps = [...a.matchAll(/<p class="([^"]*)"[^>]*>([\s\S]*?)<\/p>/g)].map((m) => text(m[2]));
    add('Lab', title, /^https?:/.test(h) ? h : href, `${title}. ${ps.join('. ')}.`);
  }
}

// ---------- Study Lab ----------
{
  const html = read('lab/study/index.html');
  const about = text(inner(html, /<div class="pop" id="about"[^>]*>([\s\S]*?)<\/div>/i));
  const subjects = [...html.matchAll(/<a class="subject[^"]*" href="([^"]+)"[\s\S]*?<h2>([\s\S]*?)<\/h2><p>([\s\S]*?)<\/p>/g)]
    .map((m) => ({ href: 'lab/' + m[1].replace(/^\.\.\//, ''), name: text(m[2]), blurb: text(m[3]) }));
  add('Study Lab', 'Study Lab', 'lab/study/', `Study Lab, part of the Lab. ${text(inner(html, /<h1>([\s\S]*?)<\/h1>/i))} ${about} Subjects: ${subjects.map((s) => s.name).join(', ')}.`);
  const str = (src, key) => (src.match(new RegExp(`${key}: '((?:[^'\\\\]|\\\\.)*)'`)) || [])[1]?.replace(/\\'/g, "'") || '';
  for (const s of subjects) {
    add('Study Lab', `Study Lab: ${s.name}`, s.href, `${s.name}, a Study Lab subject. ${s.blurb}`);
    const file = `${s.href}index.html`;
    if (!exists(file)) continue;
    const src = read(file);
    const chapters = [...src.matchAll(/ch\('[^']*',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)',\s*'((?:[^'\\]|\\.)*)'\)/g)]
      .map((m) => `${m[1].replace(/\\'/g, "'")}: ${m[3].replace(/\\'/g, "'")}`);
    if (chapters.length) {
      const title = str(src, 'title') || s.name;
      add('Study Lab', `${title}: what it covers`, s.href, `${title}. ${str(src, 'intro')} ${str(src, 'overview')}`);
      add('Study Lab', `${title}: chapters`, s.href, `${title} chapters. ${chapters.join('. ')}.`);
    } else {
      const desc = decode(inner(src, /<meta name="description" content="([^"]*)"/i));
      add('Study Lab', `Study Lab: ${s.name}`, s.href, desc);
    }
  }
}

// ---------- cool.html ----------
{
  const html = read('cool.html');
  const main = inner(html, /<main\b[^>]*>([\s\S]*?)<\/main>/i) || html;
  add('Cool', 'Cool page', 'cool.html', text(inner(main, /<p class="lead"[^>]*>([\s\S]*?)<\/p>/i)) + ' Field Notes, tools, a playground of effects and small games, and Brain Gym.');
  // Walk the page in order so every card knows the heading it sits under.
  const marks = [...main.matchAll(/<h2 class="cool-h2">([\s\S]*?)<\/h2>|<h3 class="cool-sub-h">([\s\S]*?)<\/h3>|<article class="card"[^>]*>([\s\S]*?)<\/article>|<h2 [^>]*>([\s\S]*?)<\/h2>/g)];
  let group = 'Cool';
  for (const m of marks) {
    if (m[1] || m[4]) { group = text(m[1] || m[4]); continue; }
    if (m[2]) continue;
    const a = m[3];
    const title = text(inner(a, /<h3>(?:<a[^>]*>)?([\s\S]*?)(?:<\/a>)?<\/h3>/i));
    const href = inner(a, /<h3><a href="([^"]+)"/i);
    if (!title || !href) continue;
    const body = [...a.matchAll(/<p class="muted"[^>]*>([\s\S]*?)<\/p>/g)].map((x) => text(x[1])).join(' ');
    const kind = /tool/i.test(group) ? 'Tool' : /brain/i.test(group) ? 'Brain Gym' : 'Playground';
    add(kind, title, href, `${title}. ${group}. ${body}`, { min: 4 });
  }
  const listen = inner(main, /<h2 class="cool-h2">What I'm listening to<\/h2>\s*<p[^>]*>([\s\S]*?)<\/p>/i);
  if (listen) add('Cool', "What I'm listening to", 'cool.html', `What I'm listening to. ${text(listen)}`, { min: 4 });
}

// ---------- coursework.html ----------
{
  const html = read('coursework.html');
  add('Coursework', 'Coursework', 'coursework.html', text(inner(html, /<p class="lead"[^>]*>([\s\S]*?)<\/p>/i)));
  for (const card of pieces(html, '<div class="semester-card">')) {
    const t = text(inner(card, /<div class="semester-title">([\s\S]*?)<\/div>/i));
    const sub = text(inner(card, /<div class="semester-subtitle">([\s\S]*?)<\/div>/i));
    const courses = [...card.matchAll(/<(?:span|a)[^>]*class="course-name"[^>]*>([\s\S]*?)<\/(?:span|a)>\s*<span class="course-category">([\s\S]*?)<\/span>/g)]
      .map((m) => `${text(m[1])} (${text(m[2])})`);
    if (courses.length) add('Coursework', `Coursework: ${t}`, `coursework.html${frag(t)}`, `${t}, ${sub}. Courses: ${courses.join(', ')}.`);
  }
}

// ---------- a few more pages ----------
{
  const html = read('contact.html');
  const email = inner(html, /data-email="([^"]+)"/);
  add('Contact', 'Contact', 'contact.html', `Contact Rabiat. ${text(inner(html, /<h1>([\s\S]*?)<\/h1>/i))}. ${text(inner(html, /<p class="lead"[^>]*>([\s\S]*?)<\/p>/i))} Email ${email}, or find Rabiat on LinkedIn (linkedin.com/in/rabiat-sadiq) and GitHub (github.com/RabiatS).`);
  const pr = read('projects.html');
  add('Projects', 'All projects', 'projects.html', `Projects. ${text(inner(pr, /<p class="lead"[^>]*>([\s\S]*?)<\/p>/i))}`);
  const vr = read('vr.html');
  add('VR', 'View this site in VR', 'vr.html', `View this site in VR. ${decode(inner(vr, /<meta name="description" content="([^"]*)"/i))} On a headset that supports WebXR, such as the Quest Browser, you spawn inside the portfolio hero with the featured project cards around you.`);
}

// ---------- write ----------
const out = { built: new Date().toISOString().slice(0, 10), count: docs.length, docs };
const json = JSON.stringify(out, null, 0).replace(/\},\{/g, '},\n{');
if (/[–—]/.test(json)) throw new Error('A long dash slipped into the index');
fs.writeFileSync(path.join(here, 'index.json'), json + '\n');
const byKind = docs.reduce((m, d) => ((m[d.kind] = (m[d.kind] || 0) + 1), m), {});
const lens = docs.map((d) => words(d.text)).sort((a, b) => a - b);
console.log(`Wrote ask/index.json: ${docs.length} passages, ${(fs.statSync(path.join(here, 'index.json')).size / 1024).toFixed(0)} KB`);
console.log('By kind:', byKind);
console.log(`Words per passage: min ${lens[0]}, median ${lens[lens.length >> 1]}, max ${lens.at(-1)}`);
