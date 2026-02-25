/**
 * GoMarble MCP Bridge Server
 * Uses EventSource for proper SSE lifecycle management.
 */

import express from 'express';
import cors from 'cors';
import { readFileSync } from 'fs';
import { EventSource } from 'eventsource';

// Load .env file (server-side doesn't have Vite's env loading)
try {
  const envContent = readFileSync(new URL('./.env', import.meta.url), 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        const key = trimmed.slice(0, eqIdx).trim();
        const val = trimmed.slice(eqIdx + 1).trim();
        if (!process.env[key]) process.env[key] = val;
      }
    }
  });
} catch { /* .env not found - use existing env vars */ }

import { existsSync } from 'fs';
import { join, dirname as pathDirname } from 'path';
import { fileURLToPath as pathFileURLToPath } from 'url';

const __serverFilename = pathFileURLToPath(import.meta.url);
const __serverDirname = pathDirname(__serverFilename);

const app = express();
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:4173'],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

const PORT = process.env.PORT || 3456;

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), service: 'Meta Media Buying Tool' });
});
const GOMARBLE_SSE = 'https://apps.gomarble.ai/mcp-api/sse';
let API_KEY = process.env.VITE_GOMARBLE_API_KEY || '';

// ─── MCP Session using EventSource ──────────────────────────────────────────

async function mcpSessionCall(toolName, toolArgs, timeoutMs = 60000) {
  let es = null;
  let timer = null;

  return new Promise((resolveOuter, rejectOuter) => {
    let settled = false;
    function settle(fn, val) {
      if (settled) return;
      settled = true;
      if (es) { es.close(); es = null; }
      if (timer) { clearTimeout(timer); timer = null; }
      fn(val);
    }

    timer = setTimeout(() => settle(rejectOuter, new Error('Session timeout')), timeoutMs);

    // Response handlers keyed by JSON-RPC id
    const pending = new Map();
    let msgUrl = null;
    let phase = 'connecting'; // connecting → initializing → calling → done

    // Create EventSource with auth headers
    es = new EventSource(GOMARBLE_SSE, {
      fetch: (url, init) => fetch(url, {
        ...init,
        headers: { ...init?.headers, 'Authorization': `Bearer ${API_KEY}` },
      }),
    });

    // Handle endpoint event
    es.addEventListener('endpoint', (event) => {
      msgUrl = `https://apps.gomarble.ai${event.data}`;
      console.log(`[MCP] Endpoint: ${msgUrl}`);
      phase = 'initializing';

      // Start the initialize → notify → call chain
      doInitialize().catch(err => settle(rejectOuter, err));
    });

    // Handle message events (JSON-RPC responses)
    es.addEventListener('message', (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.id != null && pending.has(data.id)) {
          const { resolve } = pending.get(data.id);
          pending.delete(data.id);
          resolve(data);
        }
      } catch { /* invalid JSON */ }
    });

    es.addEventListener('error', (event) => {
      if (phase === 'connecting') {
        settle(rejectOuter, new Error(`SSE connection failed: ${event.message || 'unknown'}`));
      }
      // After connecting, errors during the session are handled by the call chain
    });

    // POST a JSON-RPC message and wait for response via SSE
    function postRpc(id, method, params) {
      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timeout waiting for ${method} response`));
        }, 30000);

        pending.set(id, {
          resolve: (data) => { clearTimeout(timeout); resolve(data); },
        });

        fetch(msgUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
          body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
        }).then(r => {
          if (r.status !== 200 && r.status !== 202) {
            r.text().then(body => {
              clearTimeout(timeout);
              pending.delete(id);
              reject(new Error(`POST ${r.status}: ${body}`));
            });
          }
        }).catch(err => {
          clearTimeout(timeout);
          pending.delete(id);
          reject(err);
        });
      });
    }

    // Send fire-and-forget notification
    function notify(method) {
      fetch(msgUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${API_KEY}` },
        body: JSON.stringify({ jsonrpc: '2.0', method }),
      }).catch(() => {});
    }

    async function doInitialize() {
      // Poll for transport readiness
      const start = Date.now();
      let delay = 500;
      let lastErr = null;

      while (Date.now() - start < 20000) {
        await new Promise(r => setTimeout(r, delay));
        try {
          const resp = await postRpc(1, 'initialize', {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'meta-ads-dashboard', version: '1.0.0' },
          });

          // Check for error in response
          if (resp.error) {
            throw new Error(`MCP error ${resp.error.code}: ${resp.error.message}`);
          }

          console.log(`[MCP] Initialized after ${Date.now() - start}ms`);

          // Send notification
          notify('notifications/initialized');
          await new Promise(r => setTimeout(r, 500));

          // Make the actual tool call
          phase = 'calling';
          const isToolsList = toolName === '__tools_list__';
          const result = await postRpc(2,
            isToolsList ? 'tools/list' : 'tools/call',
            isToolsList ? {} : { name: toolName, arguments: toolArgs || {} }
          );

          if (result.error) {
            settle(rejectOuter, new Error(`MCP error ${result.error.code}: ${result.error.message}`));
            return;
          }

          // Parse result
          phase = 'done';
          if (result.result?.content) {
            const tc = result.result.content.find(c => c.type === 'text');
            if (tc) {
              try { settle(resolveOuter, JSON.parse(tc.text)); }
              catch { settle(resolveOuter, { data: tc.text }); }
              return;
            }
          }
          settle(resolveOuter, result.result || result);
          return;

        } catch (err) {
          lastErr = err;
          const isTransport = err.message.includes('No transport found') || err.message.includes('POST 400');
          if (isTransport) {
            console.log(`[MCP] Transport not ready after ${Date.now() - start}ms, polling...`);
            delay = Math.min(delay * 1.5, 3000);
            continue;
          }
          // Non-transport error during init
          throw err;
        }
      }
      throw lastErr || new Error('Transport never became ready');
    }
  });
}

// Retry wrapper: retries entire session from scratch
async function mcpToolCall(toolName, toolArgs, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      return await mcpSessionCall(toolName, toolArgs);
    } catch (err) {
      const isTransient = err.message.includes('No transport found') ||
        err.message.includes('POST 400') ||
        err.message.includes('SSE') ||
        err.message.includes('Transport never');
      if (isTransient && attempt < maxRetries - 1) {
        const delay = 3000 * (attempt + 1);
        console.log(`[MCP] Session failed: ${err.message.slice(0, 80)}. Retrying in ${delay}ms (${attempt + 2}/${maxRetries})...`);
        await new Promise(r => setTimeout(r, delay));
        continue;
      }
      throw err;
    }
  }
}

function mcpToolsList() {
  return mcpToolCall('__tools_list__', null);
}

// ─── REST API ────────────────────────────────────────────────────────────────

// Queue to serialize MCP calls (GoMarble may limit concurrent sessions)
let callQueue = Promise.resolve();

app.post('/api/mcp/tool', (req, res) => {
  const { name, arguments: args } = req.body;
  if (!name) return res.status(400).json({ error: 'Missing tool name' });

  callQueue = callQueue.then(async () => {
    try {
      console.log(`[API] ${name}...`);
      const result = await mcpToolCall(name, args);
      console.log(`[API] ${name} ✅`);
      res.json(result);
    } catch (err) {
      console.error(`[API] ${name} ❌:`, err.message);
      res.status(500).json({ error: err.message });
    }
  });
});

app.get('/api/mcp/tools', async (req, res) => {
  try {
    const result = await mcpToolsList();
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/mcp/status', (req, res) => {
  res.json({ connected: true, initialized: true, hasApiKey: !!API_KEY });
});

app.post('/api/mcp/reconnect', (req, res) => {
  if (req.body?.apiKey) {
    API_KEY = req.body.apiKey;
    console.log('[MCP] API key updated from frontend');
  }
  res.json({ status: 'ok' });
});

// Serve static frontend in production
const distPath = join(__serverDirname, 'dist');
if (existsSync(distPath)) {
  // Serve index.html with no-cache so new deploys take effect immediately
  const indexPath = join(distPath, 'index.html');
  app.use(express.static(distPath, {
    setHeaders: (res, filePath) => {
      if (filePath === indexPath) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  }));
  app.get('/{*splat}', (req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.sendFile(indexPath);
  });
}

app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 GoMarble MCP Bridge on http://localhost:${PORT}`);
  console.log(`   API Key: ${API_KEY ? '✅' : '❌ missing'}`);
  console.log(`   Mode: EventSource session per call\n`);
});
