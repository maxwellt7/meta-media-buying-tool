import { useState, useRef, useEffect, useCallback } from 'react';
import { sendChatMessage, hasClaudeKey } from '../services/claude';

const STORAGE_KEY = 'meta_chat_conversations';

const QUICK_PROMPTS = [
  'How should I structure my campaigns?',
  'Which ads should I kill?',
  'How can I improve ROAS?',
  'Suggest a scaling strategy',
  'What does my account health look like?',
  'How should I allocate my budget?',
];

// ─── Conversation Persistence ────────────────────────────────────────────────

function loadConversations() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return [];
}

function saveConversations(convos) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(convos));
  } catch {}
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function getConvoTitle(messages) {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'New Chat';
  const text = firstUser.content;
  return text.length > 40 ? text.slice(0, 40) + '…' : text;
}

function formatTimestamp(ts) {
  const d = new Date(ts);
  const now = new Date();
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function ChatAdvisor({ data }) {
  const [conversations, setConversations] = useState(loadConversations);
  const [activeConvoId, setActiveConvoId] = useState(null);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const activeConvo = conversations.find(c => c.id === activeConvoId);
  const messages = activeConvo?.messages || [];

  // Persist whenever conversations change
  useEffect(() => {
    saveConversations(conversations);
  }, [conversations]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  // ── Actions ──

  function createNewChat() {
    const newConvo = {
      id: generateId(),
      messages: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setConversations(prev => [newConvo, ...prev]);
    setActiveConvoId(newConvo.id);
    setInput('');
    inputRef.current?.focus();
  }

  function deleteConversation(id) {
    setConversations(prev => prev.filter(c => c.id !== id));
    if (activeConvoId === id) setActiveConvoId(null);
  }

  function updateConvoMessages(convoId, newMessages) {
    setConversations(prev =>
      prev.map(c =>
        c.id === convoId
          ? { ...c, messages: newMessages, updatedAt: Date.now() }
          : c
      )
    );
  }

  const handleSend = async (text) => {
    const content = (text || input).trim();
    if (!content || loading) return;

    // Auto-create a conversation if none active
    let convoId = activeConvoId;
    if (!convoId) {
      const newConvo = {
        id: generateId(),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      };
      setConversations(prev => [newConvo, ...prev]);
      convoId = newConvo.id;
      setActiveConvoId(convoId);
    }

    const userMessage = { role: 'user', content };
    const currentMessages = conversations.find(c => c.id === convoId)?.messages || [];
    const updatedMessages = [...currentMessages, userMessage];
    updateConvoMessages(convoId, updatedMessages);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = updatedMessages.map(m => ({ role: m.role, content: m.content }));
      const response = await sendChatMessage(apiMessages, data);
      const withResponse = [...updatedMessages, { role: 'assistant', content: response }];
      updateConvoMessages(convoId, withResponse);
    } catch (err) {
      const withError = [...updatedMessages, { role: 'assistant', content: `Error: ${err.message}` }];
      updateConvoMessages(convoId, withError);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // ── No API Key State ──

  if (!hasClaudeKey()) {
    return (
      <div className="card p-8 text-center">
        <div className="text-3xl mb-3">🔑</div>
        <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-2">
          Anthropic API Key Required
        </div>
        <div className="text-xs text-[var(--color-text-muted)] max-w-md mx-auto">
          To use the Chat Advisor, add your Anthropic API key in the <strong>Settings</strong> tab under "Claude API Key".
          The advisor uses Claude to answer questions about your account using live data.
        </div>
      </div>
    );
  }

  // ── Render ──

  return (
    <div className="flex" style={{ height: 'calc(100vh - 200px)' }}>
      {/* Sidebar */}
      <div
        className="flex flex-col border-r border-[var(--color-border)] transition-all overflow-hidden"
        style={{ width: sidebarOpen ? '260px' : '0px', minWidth: sidebarOpen ? '260px' : '0px' }}
      >
        {/* New Chat Button */}
        <div className="p-3 border-b border-[var(--color-border)]">
          <button
            type="button"
            onClick={createNewChat}
            className="w-full px-3 py-2 rounded-lg text-xs font-medium transition-all flex items-center justify-center gap-2"
            style={{
              background: 'var(--color-primary)',
              color: '#ffffff',
            }}
          >
            ✚ New Chat
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="px-3 py-6 text-center text-[10px] text-[var(--color-text-muted)]">
              No conversations yet.<br />Start a new chat above.
            </div>
          )}
          {conversations.map(convo => (
            <div
              key={convo.id}
              className="group flex items-center gap-2 px-3 py-2.5 cursor-pointer transition-colors border-b border-[#1e293b22]"
              style={{
                background: convo.id === activeConvoId ? 'var(--color-bg-elevated)' : 'transparent',
                borderLeft: convo.id === activeConvoId ? '2px solid var(--color-primary)' : '2px solid transparent',
              }}
              onClick={() => setActiveConvoId(convo.id)}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--color-text-primary)] truncate font-medium">
                  {getConvoTitle(convo.messages)}
                </div>
                <div className="text-[10px] text-[var(--color-text-muted)] mt-0.5 flex items-center gap-2">
                  <span>{convo.messages.length} msgs</span>
                  <span>·</span>
                  <span>{formatTimestamp(convo.updatedAt)}</span>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); deleteConversation(convo.id); }}
                className="opacity-0 group-hover:opacity-100 text-[var(--color-text-muted)] hover:text-[#ef4444] transition-all text-sm px-1"
                title="Delete"
              >
                ✕
              </button>
            </div>
          ))}
        </div>

        {/* Sidebar Footer */}
        {conversations.length > 0 && (
          <div className="p-2 border-t border-[var(--color-border)] text-center">
            <button
              type="button"
              onClick={() => { if (confirm('Delete all conversations?')) { setConversations([]); setActiveConvoId(null); } }}
              className="text-[10px] text-[var(--color-text-muted)] hover:text-[#ef4444] transition-colors"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-[var(--color-border)]">
          <button
            type="button"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] transition-colors"
            title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          >
            {sidebarOpen ? '◀' : '▶'}
          </button>
          <div className="text-xs text-[var(--color-text-muted)] tracking-wider uppercase">
            {activeConvo ? getConvoTitle(messages) : 'Chat Advisor'}
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto px-4 pr-2 space-y-3 py-4">
          {messages.length === 0 && (
            <div className="text-center py-12">
              <div className="text-sm font-semibold text-[var(--color-text-primary)] mb-1">
                {activeConvo ? 'Start chatting' : 'Chat Advisor'}
              </div>
              <div className="text-xs text-[var(--color-text-muted)] mb-6 max-w-md mx-auto">
                Ask anything about your Meta ad account. The advisor has access to your live metrics,
                campaign verdicts, signals, and budget data.
              </div>
              <div className="flex flex-wrap justify-center gap-2 max-w-lg mx-auto">
                {QUICK_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    onClick={() => handleSend(prompt)}
                    className="px-3 py-1.5 rounded-full text-[11px] transition-all"
                    style={{
                      background: 'var(--color-bg-elevated)',
                      color: 'var(--color-text-secondary)',
                      border: '1px solid var(--color-border)',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-primary)';
                      e.currentTarget.style.color = 'var(--color-primary)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = 'var(--color-border)';
                      e.currentTarget.style.color = 'var(--color-text-secondary)';
                    }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className="flex gap-3"
              style={{ justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}
            >
              {msg.role === 'assistant' && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}
                >
                  🤖
                </div>
              )}
              <div
                className="max-w-[75%] rounded-xl px-4 py-2.5 text-xs leading-relaxed"
                style={{
                  background: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-bg-elevated)',
                  color: msg.role === 'user' ? '#ffffff' : 'var(--color-text-primary)',
                  border: msg.role === 'user' ? 'none' : '1px solid var(--color-border)',
                  whiteSpace: 'pre-wrap',
                }}
              >
                {msg.content}
              </div>
              {msg.role === 'user' && (
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm"
                  style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}
                >
                  👤
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-sm"
                style={{ background: 'var(--color-primary)', color: '#fff' }}
              >
                🤖
              </div>
              <div
                className="rounded-xl px-4 py-3 text-xs"
                style={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-border)' }}
              >
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" />
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" style={{ animationDelay: '0.2s' }} />
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-primary)] animate-pulse" style={{ animationDelay: '0.4s' }} />
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts (when conversation is active) */}
        {messages.length > 0 && (
          <div className="flex flex-wrap gap-1.5 px-4 mb-2">
            {QUICK_PROMPTS.slice(0, 4).map((prompt) => (
              <button
                key={prompt}
                onClick={() => handleSend(prompt)}
                disabled={loading}
                className="px-2.5 py-1 rounded-full text-[10px] transition-all disabled:opacity-40"
                style={{
                  background: 'var(--color-bg-elevated)',
                  color: 'var(--color-text-muted)',
                  border: '1px solid var(--color-border)',
                }}
              >
                {prompt}
              </button>
            ))}
          </div>
        )}

        {/* Input Area */}
        <div className="px-4 pb-3">
          <div
            className="flex items-center gap-2 rounded-lg px-3 py-2"
            style={{
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-border)',
            }}
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about your campaigns, metrics, or strategy..."
              disabled={loading}
              className="flex-1 bg-transparent text-xs text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] outline-none disabled:opacity-50"
            />
            <button
              type="button"
              onClick={() => handleSend()}
              disabled={!input.trim() || loading}
              className="px-3 py-1.5 rounded-md text-xs font-medium transition-all disabled:opacity-30"
              style={{
                background: 'var(--color-primary)',
                color: '#ffffff',
              }}
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
