import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Bot, Plus, MessageSquare, Sparkles, PanelLeftClose, PanelLeft, Moon, Sun, Copy, Check, Square, ChevronDown } from 'lucide-react';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

const MOCK_RESPONSES = [
  `That's a great question! Here's what I found in your ERP data:

Based on the **Q3 financial analysis**, there are several interesting trends worth highlighting:

1. **Revenue Growth** — Q3 revenue increased by **23%** compared to Q2, driven primarily by the new product line launch in August.
2. **Cost Optimization** — Operating expenses decreased by 8% after the restructuring in July. The savings are mainly in administrative overhead.
3. **Customer Retention** — Repeat customer rate improved to 78%, up from 71% last quarter.

Here's a quick summary:

| Metric | Q2 | Q3 | Change |
|--------|-----|-----|--------|
| Revenue | $245K | $301K | +23% |
| COGS | $112K | $128K | +14% |
| Gross Margin | 54% | 57% | +3pp |
| Operating Exp | $89K | $74K | -17% |

Would you like me to dive deeper into any of these areas? I can pull up detailed reports for revenue breakdown, expense analysis, or customer segments.`,
  `Let me check your **accounts receivable aging** reports.

Current AR aging breakdown:

• **0–30 days:** $45,230 (62%)
• **31–60 days:** $18,400 (25%)
• **61–90 days:** $7,850 (11%)
• **90+ days:** $1,520 (2%)

**Key insight:** Your collection rate of **94%** is well above the industry average of 88%. The few overdue items are concentrated in 3 customer accounts.

**Recommended actions:**
1. Send automated reminders for the 61–90 day bucket
2. Schedule a follow-up call for the 90+ day accounts
3. Consider adjusting credit limits for consistently late payers

Would you like me to generate a detailed AR report or set up a collection workflow?`,
  `I've analyzed **inventory levels** across all warehouses. Here's the current status:

**Stock Overview:**
- Total active SKUs: 1,247
- Items below reorder level: **23**
- Overstocked items (90+ days supply): 12
- Dead stock (no movement in 180 days): 5

*Top 5 items needing reorder:*

| SKU | Item Name | Current Stock | Reorder Level |
|-----|-----------|:-----------:|:-------------:|
| SKU-0042 | Bearing Assembly A | 12 | 50 |
| SKU-0189 | Hydraulic Seal Kit | 8 | 35 |
| SKU-0231 | Control Module v3 | 3 | 25 |
| SKU-0456 | Sensor Array Type F | 15 | 40 |
| SKU-0712 | Mounting Bracket HD | 6 | 30 |

I suggest setting up **automated reorder triggers** for these items. Would you like me to walk you through the configuration?`,
  `Here's your **Profit & Loss summary** for the current period:

\`\`\`
Revenue:          $892,450
COGS:            $412,300
Gross Profit:    $480,150  (53.8%)
Operating Exp:   $245,000
Net Income:      $235,150  (26.3%)
\`\`\`

**Notable highlights:**
1. Gross margin improved by **4.2%** — the supplier renegotiations in Q2 are paying off
2. Operating expenses at 101% of budget — slightly over, but within acceptable range
3. Net income margin of 26.3% is the highest this fiscal year

The balance sheet looks healthy too. Would you like me to run a cash flow projection or compare against last year's numbers?`,
  `Let me look up **last month's sales performance**.

Here's the breakdown by channel:

| Channel | Revenue | Orders | Avg Order Value |
|---------|:------:|:-----:|:--------------:|
| Direct | $184K | 312 | $590 |
| Online | $92K | 445 | $207 |
| Partner | $67K | 89 | $753 |
| Retail | $41K | 178 | $230 |

**Total: $384K across 1,024 orders**

The star performer this month was the **Direct channel** with a 31% month-over-month increase. Online sales dipped slightly — likely due to the website maintenance period in week 2.

Want me to analyze conversion rates or customer acquisition costs by channel?`,
];

const MOCK_CONVERSATIONS = [
  { id: 'conv1', title: 'Q3 Financial Analysis', messageCount: 8, lastMessageAt: new Date().toISOString() },
  { id: 'conv2', title: 'Inventory Optimization', messageCount: 12, lastMessageAt: new Date(Date.now() - 3600000 * 2).toISOString() },
  { id: 'conv3', title: 'Accounts Receivable Review', messageCount: 5, lastMessageAt: new Date(Date.now() - 86400000).toISOString() },
  { id: 'conv4', title: 'Supplier Negotiation Prep', messageCount: 3, lastMessageAt: new Date(Date.now() - 86400000 * 2).toISOString() },
  { id: 'conv5', title: 'Budget Planning 2026', messageCount: 15, lastMessageAt: new Date(Date.now() - 86400000 * 5).toISOString() },
  { id: 'conv6', title: 'Cash Flow Forecast', messageCount: 7, lastMessageAt: new Date(Date.now() - 86400000 * 7).toISOString() },
  { id: 'conv7', title: 'Vendor Performance Review', messageCount: 4, lastMessageAt: new Date(Date.now() - 86400000 * 10).toISOString() },
];

const MODELS = ['ERP Analytics v2', 'Financial Expert', 'Inventory Specialist', 'Sales Advisor'];

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

function generateId(): string {
  return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export const ChatGptMockPage: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeConversation, setActiveConversation] = useState<string | null>(null);
  const [showWelcome, setShowWelcome] = useState(true);
  const [isTyping, setIsTyping] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [modelOpen, setModelOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [inputChars, setInputChars] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const stopFlag = useRef(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingContent, isTyping]);

  const simulateStreaming = useCallback(async (responseText: string) => {
    stopFlag.current = false;
    setIsStreaming(true);
    setIsTyping(true);
    setShowWelcome(false);

    await new Promise(r => setTimeout(r, 400 + Math.random() * 600));
    if (stopFlag.current) { cleanup(); return; }

    setIsTyping(false);
    let accumulated = '';
    const tokens = responseText.split(/(\s+)/);

    for (let i = 0; i < tokens.length; i++) {
      if (stopFlag.current) break;
      await new Promise(resolve => setTimeout(resolve, 8 + Math.random() * 25));
      accumulated += tokens[i];
      setStreamingContent(accumulated);
    }

    if (stopFlag.current) {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: accumulated || '(response stopped)',
        timestamp: new Date().toISOString(),
      }]);
    } else {
      setMessages(prev => [...prev, {
        id: generateId(),
        role: 'assistant',
        content: accumulated,
        timestamp: new Date().toISOString(),
      }]);
    }

    setStreamingContent('');
    setIsStreaming(false);

    function cleanup() {
      setStreamingContent('');
      setIsStreaming(false);
      setIsTyping(false);
    }
  }, []);

  const stopStreaming = () => {
    stopFlag.current = true;
  };

  const handleSend = useCallback((messageOverride?: string) => {
    const trimmed = (messageOverride ?? input).trim();
    if (!trimmed || isStreaming) return;

    setMessages(prev => [...prev, {
      id: generateId(),
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    }]);
    setInput('');
    setInputChars(0);
    setShowWelcome(false);

    const response = MOCK_RESPONSES[Math.floor(Math.random() * MOCK_RESPONSES.length)];
    simulateStreaming(response);
  }, [input, isStreaming, simulateStreaming]);

  const handleNewConversation = () => {
    stopFlag.current = true;
    setMessages([]);
    setActiveConversation(null);
    setStreamingContent('');
    setShowWelcome(true);
    setIsStreaming(false);
    setIsTyping(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const copyToClipboard = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {}
  };

  const groupConversations = (convs: typeof MOCK_CONVERSATIONS) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);

    const groups: { label: string; conversations: typeof MOCK_CONVERSATIONS }[] = [];
    const todayConvs = convs.filter(c => new Date(c.lastMessageAt) >= today);
    const yesterdayConvs = convs.filter(c => {
      const d = new Date(c.lastMessageAt);
      return d >= yesterday && d < today;
    });
    const olderConvs = convs.filter(c => new Date(c.lastMessageAt) < yesterday);

    if (todayConvs.length) groups.push({ label: 'Today', conversations: todayConvs });
    if (yesterdayConvs.length) groups.push({ label: 'Yesterday', conversations: yesterdayConvs });
    if (olderConvs.length) groups.push({ label: 'Older', conversations: olderConvs });

    return groups;
  };

  const conversationGroups = groupConversations(MOCK_CONVERSATIONS);

  const containerClass = darkMode
    ? 'bg-gray-900 text-gray-100'
    : 'bg-white text-gray-900';

  const sidebarClass = darkMode
    ? 'bg-gray-950 border-gray-800'
    : 'bg-gray-50 border-gray-200';

  const messageRowClass = (role: string) => {
    if (darkMode) return role === 'assistant' ? 'bg-gray-800/40' : 'bg-gray-900';
    return role === 'assistant' ? 'bg-gray-50/60' : 'bg-white';
  };

  const inputBorderClass = darkMode
    ? 'border-gray-700 focus-within:border-gray-500 bg-gray-800'
    : 'border-gray-300 focus-within:border-gray-400 bg-white';

  return (
    <div className={`flex h-screen overflow-hidden transition-colors duration-300 ${containerClass}`}>
      {/* Sidebar */}
      <div
        className={`${
          sidebarOpen ? 'w-[25%] min-w-[200px] max-w-xs' : 'w-0'
        } flex-shrink-0 border-r transition-all duration-300 overflow-hidden flex flex-col ${sidebarClass}`}
      >
        <div className="p-4">
          <button
            onClick={handleNewConversation}
            className={`w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all shadow-sm ${
              darkMode
                ? 'bg-gray-800 border border-gray-700 text-gray-200 hover:bg-gray-700 hover:border-gray-600'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 hover:border-gray-300'
            }`}
          >
            <Plus className="w-4 h-4" />
            New chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {conversationGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pt-4 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {group.label}
              </div>
              {group.conversations.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => setActiveConversation(conv.id)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors group flex items-center gap-3 ${
                    conv.id === activeConversation
                      ? darkMode ? 'bg-gray-700/60' : 'bg-gray-200/70'
                      : darkMode ? 'hover:bg-gray-800' : 'hover:bg-gray-100'
                  }`}
                >
                  <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className={`text-sm truncate font-medium ${darkMode ? 'text-gray-200' : 'text-gray-700'}`}>
                      {conv.title}
                    </div>
                    <div className="text-xs text-gray-400 mt-0.5">
                      {conv.messageCount} messages
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className={`flex items-center justify-between px-4 py-2.5 border-b sticky top-0 z-10 transition-colors duration-300 ${
          darkMode ? 'border-gray-800 bg-gray-900/90' : 'border-gray-100 bg-white/90'
        } backdrop-blur-sm`}>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>

            {/* Model Selector */}
            <div className="relative ml-2">
              <button
                onClick={() => setModelOpen(!modelOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                  darkMode
                    ? 'text-gray-300 hover:bg-gray-800'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <Sparkles className="w-4 h-4" />
                {selectedModel}
                <ChevronDown className="w-3 h-3 opacity-60" />
              </button>
              {modelOpen && (
                <>
                  <div className="fixed inset-0 z-10" onClick={() => setModelOpen(false)} />
                  <div className={`absolute top-full mt-1 left-0 w-48 rounded-xl shadow-lg border z-20 py-1 ${
                    darkMode ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-200'
                  }`}>
                    {MODELS.map((m) => (
                      <button
                        key={m}
                        onClick={() => { setSelectedModel(m); setModelOpen(false); }}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors ${
                          m === selectedModel
                            ? darkMode ? 'bg-gray-700 text-white' : 'bg-gray-100 text-gray-900'
                            : darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setDarkMode(!darkMode)}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'text-gray-400 hover:text-yellow-400 hover:bg-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title={darkMode ? 'Light mode' : 'Dark mode'}
            >
              {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
            </button>
            <button
              onClick={handleNewConversation}
              className={`p-2 rounded-lg transition-colors ${
                darkMode ? 'text-gray-400 hover:text-gray-200 hover:bg-gray-800' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
              }`}
              title="New conversation"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div className={`flex-1 overflow-y-auto ${darkMode ? 'scrollbar-thin scrollbar-thumb-gray-700' : ''}`}>
          <div className="max-w-3xl mx-auto w-full">
            {/* Welcome Screen */}
            {showWelcome && messages.length === 0 && (
              <div className="flex flex-col items-center justify-center min-h-[75vh] px-4 relative overflow-hidden">
                <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
                  style={{
                    backgroundImage: 'radial-gradient(circle at 25% 25%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 75% 75%, #8b5cf6 0%, transparent 50%)',
                  }}
                />
                <div className="relative">
                  <div className="w-20 h-20 mb-6 relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl animate-pulse-slow opacity-30 blur-xl" />
                    <div className="relative w-full h-full bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                      <Sparkles className="w-10 h-10 text-white" />
                    </div>
                  </div>
                  <h1 className={`text-3xl sm:text-4xl font-semibold mb-3 tracking-tight text-center transition-colors ${
                    darkMode ? 'text-white' : 'text-gray-900'
                  }`}>
                    How can I help you today?
                  </h1>
                  <p className={`text-center max-w-md mx-auto leading-relaxed mb-8 ${
                    darkMode ? 'text-gray-400' : 'text-gray-500'
                  }`}>
                    Ask about financial reports, inventory levels, sales trends, or anything in your ERP data.
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg mx-auto">
                    {[
                      'Show me Q3 financial summary',
                      'Inventory items below reorder level',
                      'Accounts receivable aging report',
                      'Last month sales by channel',
                    ].map((prompt) => (
                      <button
                        key={prompt}
                        onClick={() => handleSend(prompt)}
                        className={`text-left px-4 py-3 text-sm rounded-xl border transition-all ${
                          darkMode
                            ? 'text-gray-300 bg-gray-800 border-gray-700 hover:bg-gray-700 hover:border-gray-600'
                            : 'text-gray-600 bg-gray-50 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                        }`}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Messages */}
            <div className="pb-6">
              {messages.map((msg, idx) => {
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const isSameRole = prevMsg?.role === msg.role;
                const showAvatar = !isSameRole;

                return (
                  <div
                    key={msg.id}
                    className={`flex gap-4 px-4 sm:px-6 lg:px-8 py-5 transition-colors duration-300 ${messageRowClass(msg.role)} animate-fade-in`}
                    style={{ animationDuration: '0.3s' }}
                  >
                    <div className="flex-shrink-0">
                      {showAvatar ? (
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
                        <Bot className="w-4 h-4 text-white" />
                      </div>
                      ) : (
                        <div className="w-8" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 pt-0.5 group">
                      <div className={`text-sm sm:text-base leading-relaxed ${
                        darkMode ? 'text-gray-200' : 'text-gray-800'
                      }`}>
                        {msg.role === 'assistant' ? (
                          <MarkdownRenderer content={msg.content} />
                        ) : (
                          <div>{msg.content}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                          {formatTime(msg.timestamp)}
                        </span>
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className={`flex items-center gap-1 text-[11px] transition-colors ${
                              darkMode ? 'text-gray-500 hover:text-gray-300' : 'text-gray-400 hover:text-gray-600'
                            }`}
                          >
                            {copiedId === msg.id ? (
                              <><Check className="w-3 h-3" /> Copied</>
                            ) : (
                              <><Copy className="w-3 h-3" /> Copy</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Typing Indicator */}
              {isTyping && !streamingContent && (
                <div className={`flex gap-4 px-4 sm:px-6 lg:px-8 py-5 transition-colors ${darkMode ? 'bg-gray-800/40' : 'bg-gray-50/60'} animate-fade-in`}>
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pt-2">
                    <div className="flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                    </div>
                  </div>
                </div>
              )}

              {/* Streaming Content */}
              {streamingContent && (
                <div className={`flex gap-4 px-4 sm:px-6 lg:px-8 py-5 transition-colors ${darkMode ? 'bg-gray-800/40' : 'bg-gray-50/60'} animate-fade-in`}>
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className={`text-sm sm:text-base leading-relaxed ${darkMode ? 'text-gray-200' : 'text-gray-800'}`}>
                      <MarkdownRenderer content={streamingContent} />
                      <span className="inline-block w-[3px] h-[1.1em] bg-blue-500 animate-pulse align-text-bottom ml-0.5 rounded-sm" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>

        {/* Input Bar */}
        <div className={`border-t transition-colors duration-300 ${darkMode ? 'border-gray-800 bg-gray-900' : 'border-gray-100 bg-white'}`}>
          <div className="max-w-3xl mx-auto w-full px-4 py-3">
            <div className={`relative border rounded-2xl shadow-sm transition-all ${
              isStreaming ? 'opacity-70' : ''
            } ${inputBorderClass}`}>
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  setInputChars(e.target.value.length);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder="Message AI Assistant..."
                disabled={isStreaming}
                rows={1}
                className={`block w-full max-h-[200px] min-h-[52px] py-3.5 pr-14 pl-5 bg-transparent border-none outline-none focus:ring-0 resize-none disabled:opacity-50 text-sm leading-relaxed rounded-2xl ${
                  darkMode ? 'text-gray-100 placeholder-gray-500' : 'text-gray-800 placeholder-gray-400'
                }`}
              />
              <div className="absolute right-2 bottom-2 flex items-center gap-1">
                {isStreaming ? (
                  <button
                    onClick={stopStreaming}
                    className="w-9 h-9 bg-red-500 text-white rounded-xl hover:bg-red-600 transition-all flex items-center justify-center animate-pulse"
                    title="Stop generating"
                  >
                    <Square className="w-4 h-4 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim()}
                    className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center ${
                      input.trim()
                        ? 'bg-gray-800 text-white hover:bg-gray-700 shadow-sm'
                        : 'text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Send className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center justify-between mt-2.5">
              <p className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                Mock demo — responses are simulated
              </p>
              {inputChars > 0 && (
                <span className={`text-[11px] ${darkMode ? 'text-gray-500' : 'text-gray-400'}`}>
                  {inputChars} characters
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatGptMockPage;
