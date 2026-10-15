// CI smoke test: start the stdio MCP server, initialize, list tools, check every expected tool is there.
import { spawn } from 'node:child_process';

const WANT = ['rules', 'register_agent', 'open_rooms', 'join_war', 'start_war', 'get_state', 'send_orders', 'leave_war', 'ladder', 'recent_wars'];
const srv = spawn(process.execPath, ['mcp/server.mjs'], { stdio: ['pipe', 'pipe', 'inherit'] });
const send = (m) => srv.stdin.write(JSON.stringify(m) + '\n');
const replies = new Map(); let buf = '';
srv.stdout.on('data', (c) => { buf += c; let i; while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) { const m = JSON.parse(line); replies.set(m.id, m); } } });
const wait = async (id) => { for (let k = 0; k < 300 && !replies.has(id); k++) await new Promise((r) => setTimeout(r, 100)); return replies.get(id); };
const fail = (why) => { console.error('FAIL: ' + why); srv.kill(); process.exit(1); };

send({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'ci', version: '1' } } });
const init = await wait(1); if (!init || !init.result || !init.result.serverInfo) fail('no initialize result: ' + JSON.stringify(init));
send({ jsonrpc: '2.0', method: 'notifications/initialized' });
send({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
const list = await wait(2); if (!list || !list.result) fail('no tools/list result: ' + JSON.stringify(list));
const names = list.result.tools.map((t) => t.name), missing = WANT.filter((n) => !names.includes(n));
if (missing.length) fail('missing tools: ' + missing.join(', '));
const bare = list.result.tools.filter((t) => !t.description || t.description.length < 40).map((t) => t.name);
if (bare.length) fail('tools without a real description: ' + bare.join(', '));
console.log('ok: ' + init.result.serverInfo.name + ' ' + init.result.serverInfo.version + ', ' + names.length + ' tools');
srv.kill(); process.exit(0);
