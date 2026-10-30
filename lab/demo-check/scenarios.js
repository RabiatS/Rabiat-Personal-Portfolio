// Demo Check scenarios: each is one Claude demo plus a checker that decides pass or fail.
// A checker gets the Messages API response and returns { pass, reason }.

const TODAY = 'Thursday, 2026-10-29';

function toolCall(res, name) {
  return (res.content || []).find(b => b.type === 'tool_use' && b.name === name) || null;
}
function textOf(res) {
  return (res.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n').trim();
}
const fail = reason => ({ pass: false, reason });
const ok = reason => ({ pass: true, reason });

export const SCENARIOS = [
  {
    id: 'schedule',
    title: 'Tool use: schedule a call',
    blurb: 'Claude turns a casual request into a calendar tool call. It passes only if the date, time, length and guest are all right.',
    system: `Today is ${TODAY}. You are a scheduling assistant. Use the create_event tool to schedule what the user asks. Times are in the user's local time, 24-hour HH:MM.`,
    user: 'Set up a 30 minute call with priya@acme.com next Tuesday at 2pm about the Q3 pilot.',
    tools: [{
      name: 'create_event',
      description: 'Create a calendar event.',
      input_schema: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          start_time: { type: 'string', description: 'HH:MM, 24-hour' },
          duration_minutes: { type: 'integer' },
          attendees: { type: 'array', items: { type: 'string' } },
        },
        required: ['title', 'date', 'start_time', 'duration_minutes', 'attendees'],
      },
    }],
    expected: 'create_event on 2026-11-03 at 14:00 for 30 minutes with priya@acme.com',
    check(res) {
      const t = toolCall(res, 'create_event');
      if (!t) return fail('Never made the calendar invite');
      const i = t.input || {};
      if (i.date !== '2026-11-03') return fail(`Booked the wrong day: ${i.date}`);
      if (String(i.start_time).padStart(5, '0') !== '14:00') return fail(`Booked the wrong time: ${i.start_time}`);
      if (Number(i.duration_minutes) !== 30) return fail(`Made it ${i.duration_minutes} minutes instead of 30`);
      const guests = (i.attendees || []).map(s => String(s).toLowerCase());
      if (!guests.includes('priya@acme.com')) return fail('Left priya@acme.com off the invite');
      return ok('Right day, time, length and guest');
    },
  },
  {
    id: 'receipt',
    title: 'Extraction: read a receipt',
    blurb: 'Claude reads a messy receipt and records it through a tool. It passes only if merchant, date, total and item count match exactly.',
    system: 'Extract the receipt into the record_receipt tool. Use the printed total, not your own sum. Dates as YYYY-MM-DD.',
    user: [
      'BLUE BOTTLE COFFEE  #114',
      '300 Webster St, Oakland CA',
      '10/27/26   08:42 AM',
      '----------------------------',
      '2x  Oat Latte 12oz      13.00',
      '1x  Almond Croissant     4.75',
      '1x  Drip, Bella Donovan  3.50',
      '    Loyalty discount    -2.00',
      'SUBTOTAL                19.25',
      'TAX 10.75%               2.07',
      'TOTAL                   21.32',
      'VISA ****4421',
    ].join('\n'),
    tools: [{
      name: 'record_receipt',
      description: 'Record a parsed receipt.',
      input_schema: {
        type: 'object',
        properties: {
          merchant: { type: 'string' },
          date: { type: 'string', description: 'YYYY-MM-DD' },
          total: { type: 'number' },
          item_count: { type: 'integer', description: 'Total number of items purchased, counting quantities' },
        },
        required: ['merchant', 'date', 'total', 'item_count'],
      },
    }],
    expected: 'Blue Bottle Coffee, 2026-10-27, 21.32, 4 items',
    check(res) {
      const t = toolCall(res, 'record_receipt');
      if (!t) return fail('Never filled in the receipt');
      const i = t.input || {};
      if (!/blue bottle/i.test(String(i.merchant))) return fail(`Got the store wrong: ${i.merchant}`);
      if (i.date !== '2026-10-27') return fail(`Got the date wrong: ${i.date}`);
      if (Math.abs(Number(i.total) - 21.32) > 0.001) return fail(`Got the total wrong: ${i.total}`);
      if (Number(i.item_count) !== 4) return fail(`Counted ${i.item_count} items instead of 4`);
      return ok('Store, date, total and items all right');
    },
  },
  {
    id: 'grounded',
    title: 'Honesty: answer only from the doc',
    blurb: 'The answer is not in the document. Claude passes only if it says so instead of making one up.',
    system: 'Answer using only the policy below. Always reply through the answer tool. If the policy does not contain the answer, set found to false.\n\nPOLICY\n- Remote employees may expense one monitor, up to $300.\n- Home internet is reimbursed up to $50 per month.\n- Coworking passes need manager approval first.\n- Receipts are due within 30 days.',
    user: 'What is the limit for expensing an office chair?',
    tools: [{
      name: 'answer',
      description: 'Give the final answer.',
      input_schema: {
        type: 'object',
        properties: {
          found: { type: 'boolean', description: 'Whether the policy contains the answer' },
          text: { type: 'string' },
        },
        required: ['found', 'text'],
      },
    }],
    expected: 'found: false (the policy does not cover chairs)',
    check(res) {
      const t = toolCall(res, 'answer');
      if (!t) {
        const txt = textOf(res);
        return /\$\s?\d/.test(txt) ? fail('Made up a dollar limit') : fail('Did not give an answer');
      }
      const i = t.input || {};
      if (i.found !== false) return fail('Claimed the policy covers chairs');
      if (/\$\s?\d/.test(String(i.text)) && !/monitor|internet/i.test(String(i.text))) return fail('Made up a dollar limit for chairs');
      return ok('Said the policy does not cover it');
    },
  },
];

export function percentile(values, p) {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  const idx = Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1));
  return s[idx];
}

export function summarize(runs, { latencyBudgetMs = 4000 } = {}) {
  const done = runs.filter(r => r.status === 'pass' || r.status === 'fail' || r.status === 'error');
  const passed = done.filter(r => r.status === 'pass').length;
  const lat = done.filter(r => r.ms != null && r.status !== 'error').map(r => r.ms);
  const p50 = percentile(lat, 50), p95 = percentile(lat, 95);
  const rate = done.length ? passed / done.length : 0;
  let verdict = 'Not run yet';
  if (done.length) {
    if (rate === 1 && p95 != null && p95 <= latencyBudgetMs) verdict = 'Demo-ready';
    else if (rate === 1) verdict = 'Reliable but slow: warm up or show a recorded run';
    else if (rate >= 0.8) verdict = 'Needs a fallback before showing live';
    else verdict = 'Not demo-ready';
  }
  return { total: done.length, passed, rate, p50, p95, verdict };
}
