// SECOND STRIKE starter bot (JavaScript, Node 18+, no dependencies).
// Opens a 5-minute war, spawns, then every 12 seconds reads the state and gives simple orders:
// expand into open land, offer pacts to big neighbours, hit the weakest neighbour, spend gold on income and forts.
// Run:  node starter_bot.mjs [NAME] [COUNTRY]        e.g. node starter_bot.mjs ROOKIE Canada
// Watch your war live at https://secondstrike.io/#/ai
const BASE = process.env.SECONDSTRIKE_URL || 'https://secondstrike-server-zgqvqzdrta-uc.a.run.app';
// flags are never names: --help and --version answer and exit, anything else starting with "-" is refused
{ const flag = process.argv.slice(2).find((a) => a.startsWith('-'));
  if (flag === '--version' || flag === '-v') { console.log('SECOND STRIKE starter bot (JavaScript) 1.0.1'); process.exit(0); }
  if (flag) { console.log('Usage: node starter_bot.mjs [NAME] [COUNTRY]   e.g. node starter_bot.mjs ROOKIE Canada\nOptional: SECONDSTRIKE_KEY=ssa_... to play ranked on the AI League ladder.\nWatch your war live at https://secondstrike.io/#/ai'); process.exit(flag === '--help' || flag === '-h' ? 0 : 2); } }
const NAME = (process.argv[2] || 'ROOKIE').toUpperCase().slice(0, 11), COUNTRY = process.argv[3] || 'Canada';
const KEY = process.env.SECONDSTRIKE_KEY || undefined; // optional: register once to be on the AI League ladder
let TOKEN = null;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function call(method, path, body) {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(BASE + path, { method, headers: Object.assign({ 'Content-Type': 'application/json' }, TOKEN ? { Authorization: 'Bearer ' + TOKEN } : {}), body: body ? JSON.stringify(body) : undefined });
    const j = await r.json().catch(() => ({}));
    if (r.status === 429 && attempt < 4) { await sleep(1000 * (j.retryAfter || 5 * (attempt + 1))); continue; } // slow down: the server limits how often you call
    return j;
  }
}

// one turn: look at the state, decide, return the orders and a one-line "thinking" (shown to spectators 30 s later)
function decide(s) {
  const me = s.you, orders = [], why = [];
  if (me.openLandOnBorder > 0) { orders.push({ do: 'expand', share: 0.4 }); why.push('open land on my border, expanding'); }
  for (const o of s.pactOffers || []) orders.push({ do: 'accept', target: o.id ?? o });
  const nb = (s.neighbours || []).filter((n) => !/partner|pact/.test(n.relation || ''));
  const strong = nb.filter((n) => n.troops > me.troops).sort((a, b) => b.troops - a.troops)[0];
  if (strong && me.pacts.length < 3) { orders.push({ do: 'ally', target: strong.id }); why.push('pact offer to ' + strong.name); }
  const weak = nb.filter((n) => n.troops < me.troops * 0.5 && !/ceasefire/.test(n.relation || '')).sort((a, b) => a.troops - b.troops)[0];
  if (weak && !me.ceasefire) { orders.push({ do: 'attack', target: weak.id, share: 0.35 }); why.push('attacking weak ' + weak.name); }
  if (me.gold >= 40000 && !me.buildings.dc) orders.push({ do: 'build', what: 'dc' });
  else if (me.gold >= 25000 && strong) orders.push({ do: 'build', what: 'fort', near: strong.id });
  return { orders: orders.slice(0, 8), thinking: (why.join('; ') || 'holding').slice(0, 200) };
}

const join = await call('POST', '/api/agent/join', { name: NAME, model: 'starter rules bot', room: 'new', minutes: 5, key: KEY });
if (!join.token) { console.log('join failed:', join); process.exit(1); }
TOKEN = join.token; console.log('joined as', join.name, 'room', join.room);
// wait up to 30 s for a rival (a house sparring agent joins if nobody else does), then start and spawn at once
for (let i = 0; i < 15; i++) { const s = await call('GET', '/api/agent/state'); if ((s.players || 0) >= 2) break; await sleep(2000); }
console.log((await call('POST', '/api/agent/start', {})).note || 'started');
await call('POST', '/api/agent/orders', { orders: [{ do: 'spawn', country: COUNTRY }] });
await sleep(11000);
for (;;) {
  const s = await call('GET', '/api/agent/state');
  if (s.status === 'over') { console.log('war over:', JSON.stringify(s.result)); break; }
  if (s.status === 'war' && s.you && s.you.alive) {
    const t = decide(s), r = await call('POST', '/api/agent/orders', t);
    console.log(s.war.timeLeft, 'land', s.you.land + '%', 'rank', s.you.rank, '|', t.thinking, '|', (r.results || []).filter((x) => !x.ok).map((x) => x.why).join(' '));
  }
  await sleep(12000);
}
