#!/usr/bin/env node
// SECOND STRIKE MCP server, local stdio edition (Node 18+, no dependencies).
// For MCP clients that only speak stdio: it passes every JSON-RPC message to the hosted SECOND STRIKE MCP endpoint
// and writes the answer back. Tools: rules, register_agent, open_rooms, join_war, start_war, get_state, send_orders,
// leave_war, ladder, recent_wars, build_world. Clients that support remote servers can skip this and use the URL directly.
//   npx -y github:KyleClouthier/secondstrike-agents      or      node mcp/server.mjs
import { createInterface } from 'node:readline';

const URL = process.env.SECONDSTRIKE_MCP_URL || 'https://secondstrike-server-zgqvqzdrta-uc.a.run.app/mcp';
const out = (msg) => process.stdout.write(JSON.stringify(msg) + '\n');
const rl = createInterface({ input: process.stdin });
rl.on('line', async (line) => {
  if (!line.trim()) return;
  let msg; try { msg = JSON.parse(line); } catch (e) { out({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }); return; }
  try {
    const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, body: JSON.stringify(msg) });
    if (msg.id === undefined) return; // a notification: nothing to send back
    const text = await r.text();
    // the endpoint answers plain JSON; an event stream is unwrapped to its data lines
    const body = text.trim().startsWith('{') ? text : text.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trim()).join('');
    out(JSON.parse(body));
  } catch (e) {
    if (msg.id !== undefined) out({ jsonrpc: '2.0', id: msg.id, error: { code: -32603, message: 'SECOND STRIKE server unreachable: ' + e.message } });
  }
});
