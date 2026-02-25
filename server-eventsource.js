/**
 * Minimal EventSource implementation for Node.js with custom headers support.
 * Used by the MCP bridge server to connect to GoMarble SSE with auth.
 */

import https from 'https';
import http from 'http';
import { URL } from 'url';

export default class EventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  constructor(url, options = {}) {
    this.url = url;
    this.readyState = EventSource.CONNECTING;
    this._listeners = {};
    this._connect(options);
  }

  addEventListener(event, fn) {
    if (!this._listeners[event]) this._listeners[event] = [];
    this._listeners[event].push(fn);
  }

  close() {
    this.readyState = EventSource.CLOSED;
    if (this._req) {
      this._req.destroy();
      this._req = null;
    }
  }

  _emit(event, data) {
    const listeners = this._listeners[event] || [];
    listeners.forEach(fn => fn({ data, type: event }));
  }

  _connect(options) {
    const parsed = new URL(this.url);
    const mod = parsed.protocol === 'https:' ? https : http;

    const reqOptions = {
      hostname: parsed.hostname,
      port: parsed.port,
      path: parsed.pathname + parsed.search,
      method: 'GET',
      headers: {
        'Accept': 'text/event-stream',
        'Cache-Control': 'no-cache',
        ...(options.headers || {}),
      },
    };

    this._req = mod.request(reqOptions, (res) => {
      if (res.statusCode !== 200) {
        this.readyState = EventSource.CLOSED;
        if (this.onerror) this.onerror(new Error(`SSE HTTP ${res.statusCode}`));
        return;
      }

      this.readyState = EventSource.OPEN;

      let buffer = '';
      let currentEvent = 'message';
      let currentData = '';

      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        buffer += chunk;
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (line.startsWith('event:')) {
            currentEvent = line.slice(6).trim();
          } else if (line.startsWith('data:')) {
            currentData = line.slice(5).trim();
          } else if (line === '') {
            // Dispatch event
            if (currentData) {
              this._emit(currentEvent, currentData);
              currentEvent = 'message';
              currentData = '';
            }
          }
        }
      });

      res.on('end', () => {
        this.readyState = EventSource.CLOSED;
        if (this.onerror) this.onerror(new Error('SSE connection ended'));
      });

      res.on('error', (err) => {
        this.readyState = EventSource.CLOSED;
        if (this.onerror) this.onerror(err);
      });
    });

    this._req.on('error', (err) => {
      this.readyState = EventSource.CLOSED;
      if (this.onerror) this.onerror(err);
    });

    this._req.end();
  }
}
