// MCP (Model Context Protocol): step through a real session between an AI app (host), its MCP clients and two servers.
const STEPS = [
  { who: ['host', 'cal'], title: 'Connect and introduce', note: 'The app starts an MCP client for each server. They shake hands: protocol version and what each side supports.',
    msg: { jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'chat-app', version: '1.0' } } } },
  { who: ['cal', 'host'], title: 'Server answers', note: 'The server says who it is and that it offers tools (it could also offer resources and prompts).',
    msg: { jsonrpc: '2.0', id: 1, result: { protocolVersion: '2025-06-18', capabilities: { tools: {} }, serverInfo: { name: 'calendar', version: '2.1' } } } },
  { who: ['host', 'cal'], title: 'List the tools', note: 'The client asks what tools exist. Each comes with a name, a description and a JSON Schema for its inputs.',
    msg: { jsonrpc: '2.0', id: 2, method: 'tools/list' } },
  { who: ['cal', 'host'], title: 'Tool descriptions', note: 'These descriptions are put into the model\'s context so it knows what it can ask for.',
    msg: { jsonrpc: '2.0', id: 2, result: { tools: [{ name: 'find_free_time', description: 'Find open slots on the user\'s calendar', inputSchema: { type: 'object', properties: { day: { type: 'string' }, minutes: { type: 'number' } }, required: ['day', 'minutes'] } }] } } },
  { who: ['user', 'model'], title: 'You ask something', note: 'You type: "Find me 30 minutes on Friday." The model sees your message plus the tool list.',
    msg: { role: 'user', content: 'Find me 30 minutes on Friday.' } },
  { who: ['model', 'host'], title: 'The model picks a tool', note: 'The model does not run anything. It writes a request to use a tool, with arguments that fit the schema. The app may ask you to approve.',
    msg: { type: 'tool_use', name: 'find_free_time', input: { day: 'Friday', minutes: 30 } } },
  { who: ['host', 'cal'], title: 'The client calls it', note: 'The client turns that into a tools/call message to the right server.',
    msg: { jsonrpc: '2.0', id: 3, method: 'tools/call', params: { name: 'find_free_time', arguments: { day: 'Friday', minutes: 30 } } } },
  { who: ['cal', 'host'], title: 'The server does the work', note: 'The server runs real code (here, reading a calendar) and returns content.',
    msg: { jsonrpc: '2.0', id: 3, result: { content: [{ type: 'text', text: 'Free: 10:00 to 10:30, 14:00 to 15:00' }], isError: false } } },
  { who: ['host', 'model'], title: 'Result goes back to the model', note: 'The result is added to the context, and the loop continues: the model can call another tool or answer.',
    msg: { type: 'tool_result', content: 'Free: 10:00 to 10:30, 14:00 to 15:00' } },
  { who: ['model', 'user'], title: 'The model answers', note: 'The answer uses real data it fetched, instead of guessing.',
    msg: { role: 'assistant', content: 'You are free Friday 10:00 to 10:30, or any 30 minutes between 14:00 and 15:00.' } },
];
const NODES = {
  user: { x: 0.1, y: 0.5, label: 'You' },
  model: { x: 0.32, y: 0.2, label: 'Model' },
  host: { x: 0.36, y: 0.62, label: 'App (host)\nMCP clients' },
  cal: { x: 0.8, y: 0.32, label: 'Calendar\nMCP server' },
  files: { x: 0.8, y: 0.74, label: 'Files\nMCP server' },
};
export default {
  mount(ctx) {
    ctx.tall();
    const wrap = ctx.h(`<div style="display:grid;grid-template-rows:minmax(260px,1fr) auto;gap:12px;height:100%;min-height:520px">
      <div class="mcp-diagram" style="position:relative;border:1px solid var(--border);border-radius:12px;overflow:hidden"></div>
      <div><p class="eyebrow mcp-step"></p><pre class="code mcp-json" style="max-height:220px;overflow:auto;white-space:pre-wrap"></pre></div></div>`);
    ctx.stage.append(wrap);
    const box = wrap.querySelector('.mcp-diagram');
    const cv = ctx.canvas({ parent: box }); const g = cv.ctx;
    let i = 0; let t0 = performance.now(); let auto = false; let lastAuto = 0;
    const json = wrap.querySelector('.mcp-json'); const stepLbl = wrap.querySelector('.mcp-step');
    const C = ctx.colors;
    function show() {
      const s = STEPS[i];
      stepLbl.textContent = `Step ${i + 1} of ${STEPS.length} · ${s.title}`;
      json.textContent = JSON.stringify(s.msg, null, 2);
      note.textContent = s.note; t0 = performance.now();
    }
    ctx.loop((t) => {
      const { w, h } = cv; if (!w) return;
      g.clearRect(0, 0, w, h);
      const P = (k) => [NODES[k].x * w, NODES[k].y * h];
      // links
      g.strokeStyle = C.borderStrong; g.lineWidth = 1.5; g.setLineDash([4, 5]);
      for (const [a, b] of [['user', 'host'], ['model', 'host'], ['host', 'cal'], ['host', 'files']]) { const [x1, y1] = P(a); const [x2, y2] = P(b); g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke(); }
      g.setLineDash([]);
      const s = STEPS[i]; const active = new Set(s.who);
      for (const [k, n] of Object.entries(NODES)) {
        const [x, y] = P(k); const on = active.has(k); const bw = Math.min(150, w * 0.2); const bh = 54;
        g.fillStyle = on ? '#12302c' : C.surface2; g.strokeStyle = on ? C.c1 : C.borderStrong; g.lineWidth = on ? 2 : 1;
        g.beginPath(); g.roundRect(x - bw / 2, y - bh / 2, bw, bh, 10); g.fill(); g.stroke();
        g.fillStyle = on ? C.text : C.muted; g.font = '600 13px Rajdhani, sans-serif'; g.textAlign = 'center';
        n.label.split('\n').forEach((ln, j, arr) => g.fillText(ln.toUpperCase(), x, y + 5 + (j - (arr.length - 1) / 2) * 15));
      }
      // moving message dot
      const [a, b] = s.who; const [x1, y1] = P(a); const [x2, y2] = P(b);
      const p = Math.min(1, (performance.now() - t0) / 900); const e = p * p * (3 - 2 * p);
      g.fillStyle = s.msg.jsonrpc ? C.c2 : C.c3; g.beginPath(); g.arc(x1 + (x2 - x1) * e, y1 + (y2 - y1) * e, 7, 0, Math.PI * 2); g.fill();
      g.font = '500 11px "DM Mono", monospace'; g.fillStyle = C.muted; g.textAlign = 'left';
      g.fillText(s.msg.jsonrpc ? 'JSON-RPC over MCP' : 'inside the app', 12, h - 12);
      if (auto && t - lastAuto > 2.6) { lastAuto = t; i = (i + 1) % STEPS.length; show(); }
    });
    const note = ctx.h('<p class="lede"></p>');
    const nav = ctx.h('<div class="row"><button class="btn ghost sm" data-a="prev">Back</button><button class="btn sm" data-a="next">Next step</button><button class="btn ghost sm" data-a="auto">Play</button></div>');
    nav.addEventListener('click', (e) => {
      const a = e.target.closest('button')?.dataset.a; if (!a) return;
      if (a === 'next') i = Math.min(STEPS.length - 1, i + 1);
      if (a === 'prev') i = Math.max(0, i - 1);
      if (a === 'auto') { auto = !auto; e.target.textContent = auto ? 'Pause' : 'Play'; }
      show();
    });
    ctx.panel.append(
      ctx.h('<h2 class="k-h">MCP: plugging tools into AI</h2>'),
      ctx.h('<p class="muted">The Model Context Protocol is an open standard for connecting AI apps to tools and data. Step through one real conversation.</p>'),
      note, nav,
      ctx.h('<div class="card tip"><p>Before MCP, every AI app needed custom code for every service it talked to. MCP is like a USB port for AI: a service writes one <b>MCP server</b>, and any app that speaks MCP (the <b>host</b>, with one <b>client</b> per server) can use it.</p><p>The model never touches the server directly. It only asks to use a tool; the app runs the call and hands back the result. That is the same agent loop from the previous chapter, with a standard plug.</p></div>'),
      ctx.h('<div class="card try"><p>Press Next step and watch which boxes light up. Yellow dots are MCP messages between app and server; violet dots stay inside the app. Notice the model only ever talks to the app.</p></div>'),
      ctx.h(`<details class="more"><summary>Going deeper</summary><div>
        <p><b>Three things a server can offer.</b> Tools (actions the model can call, like find_free_time), resources (data the app can read, like a file or a database row) and prompts (reusable templates a user can pick).</p>
        <p><b>Messages.</b> MCP uses JSON-RPC 2.0: requests with an id and a method (initialize, tools/list, tools/call, resources/read), responses with a result or error, and notifications with no reply.</p>
        <p><b>Transports.</b> stdio for a local server the app launches as a process, and Streamable HTTP for remote servers, usually with OAuth for sign in.</p>
        <p><b>Safety.</b> Tools can act on your behalf, so good hosts ask before risky calls, show what will run, and treat text that comes back from tools as data, not instructions, because a web page or email can contain a prompt injection.</p>
        <p>MCP was introduced by Anthropic in November 2024 as an open specification and is now supported by many AI apps and services.</p></div></details>`),
    );
    show();
    ctx.quiz([
      { q: 'Who actually runs a tool call in MCP?', choices: ['The model itself', 'The app (host) through its MCP client, and the server does the work', 'The user'], answer: 1, why: 'The model only requests a tool; the host sends tools/call and the server executes it.' },
      { q: 'How does the model learn which tools exist?', choices: ['It guesses', 'The client calls tools/list and the descriptions go into its context', 'Tools are built into the model weights'], answer: 1, why: 'tools/list returns names, descriptions and input schemas.' },
      { q: 'Which is NOT one of the three things an MCP server can offer?', choices: ['Tools', 'Resources', 'Model weights'], answer: 2, why: 'Servers offer tools, resources and prompts.' },
    ]);
  },
};
