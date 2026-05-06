/**
 * AiAssistantHomePage.tsx
 *
 * Main AI Assistant page with chat interface and conversation sidebar.
 * Only accessible when the ai-assistant module is installed and permitted.
 * The assistant is advisory-only — it cannot mutate business records.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Bot, User, Trash2, AlertCircle, Plus, MessageSquare, Clock, Sparkles, Database } from 'lucide-react';
import { aiAssistantApi, SendChatMessageResponse, ChatMessageDTO, AiToolCallResultDTO } from '../../../api/aiAssistantApi';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { AiToolResultsPanel } from '../components/AiToolResultsPanel';
import { MarkdownRenderer } from '../components/MarkdownRenderer';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  isMock?: boolean;
  toolResults?: AiToolCallResultDTO[];
}

interface ConversationSummary {
  conversationId: string;
  lastMessage: ChatMessageDTO;
}

export const AiAssistantHomePage: React.FC = () => {
  const { t } = useTranslation('aiAssistant');
  const { hasPermission } = useRBAC();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canChat = hasPermission('ai-assistant.chat.use');

  const extractToolResults = useCallback((metadata: unknown): AiToolCallResultDTO[] => {
    const meta = metadata as Record<string, unknown> | null;
    if (!meta || !Array.isArray(meta.toolResults)) return [];

    return (meta.toolResults as Array<Record<string, unknown>>)
      .map((entry) => ({
        toolName: String(entry.toolName || ''),
        result: {
          success: Boolean((entry.result as any)?.success),
          data: ((entry.result as any)?.data || null) as Record<string, unknown> | null,
          error: (entry.result as any)?.error,
          errorCode: (entry.result as any)?.errorCode,
        },
      }))
      .filter(item => !!item.toolName);
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Load conversation list
  const loadConversationList = useCallback(async () => {
    try {
      const result = await aiAssistantApi.getRecentConversations(20);
      if (result.conversations) {
        setConversations(result.conversations);
      }
    } catch {
      // Silently fail — sidebar works without history
    }
  }, []);

  // Load a specific conversation's messages
  const loadConversation = useCallback(async (convId: string) => {
    try {
      const result = await aiAssistantApi.getConversationMessages(convId);
      const historyMessages: DisplayMessage[] = (result.messages || []).map((msg: ChatMessageDTO) => ({
        id: msg.id,
        role: msg.role as 'user' | 'assistant' | 'system',
        content: msg.content,
        timestamp: msg.createdAt,
        isMock: msg.provider === 'mock',
        toolResults: extractToolResults(msg.metadata),
      }));
      setConversationId(convId);
      setMessages(historyMessages);
    } catch {
      console.warn('[AI Assistant] Could not load conversation');
    }
  }, []);

  // Initial load: conversation list + most recent conversation
  useEffect(() => {
    if (!canChat) return;

    const init = async () => {
      try {
        const result = await aiAssistantApi.getRecentConversations(20);
        if (result.conversations && result.conversations.length > 0) {
          setConversations(result.conversations);
          // Load the most recent conversation
          const lastConv = result.conversations[0];
          await loadConversation(lastConv.conversationId);
        }
      } catch {
        // Start with empty state — user can begin a new conversation
      }
    };

    init();
  }, [canChat, loadConversation]);

  // Refresh conversation list after sending a message
  const refreshConversations = useCallback(() => {
    loadConversationList();
  }, [loadConversationList]);

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || isLoading) return;

    setError(null);

    // Add user message immediately
    const userMessage: DisplayMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const response: SendChatMessageResponse = await aiAssistantApi.sendMessage({
        message: trimmed,
        conversationId,
      });

      // Store conversation ID for continuity
      if (!conversationId) {
        setConversationId(response.userMessage.conversationId);
      }

      // Add assistant response
      const assistantMessage: DisplayMessage = {
        id: response.assistantMessage.id,
        role: 'assistant',
        content: response.assistantMessage.content,
        timestamp: response.assistantMessage.createdAt,
        isMock: response.provider === 'mock',
        toolResults: extractToolResults(response.assistantMessage.metadata),
      };

      setMessages(prev => [...prev, assistantMessage]);
      // Refresh the sidebar conversation list
      refreshConversations();
    } catch (err: any) {
      const status = err?.response?.status;
      const errorMsg = err?.response?.data?.error?.message || err?.message || 'Failed to send message';

      // Rate limit errors (429) and disabled AI (403) should show inline in chat only,
      // not as a global error toast
      if (status === 429 || status === 403) {
        const prefix = status === 429
          ? t('chat.rateLimited', 'Rate limit reached')
          : t('chat.disabled', 'AI Assistant disabled');
        setMessages(prev => [
          ...prev,
          {
            id: `error_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ ${prefix}: ${errorMsg}`,
            timestamp: new Date().toISOString(),
          },
        ]);
        setError(null);
      } else {
        setError(errorMsg);
        setMessages(prev => [
          ...prev,
          {
            id: `error_${Date.now()}`,
            role: 'assistant',
            content: `⚠️ ${t('chat.error', 'Error')}: ${errorMsg}`,
            timestamp: new Date().toISOString(),
          },
        ]);
      }
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  }, [input, isLoading, conversationId, t, refreshConversations, extractToolResults]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
  };

  const handleSelectConversation = async (convId: string) => {
    await loadConversation(convId);
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await aiAssistantApi.deleteConversation(convId);
      // If deleting the active conversation, reset
      if (convId === conversationId) {
        setMessages([]);
        setConversationId(undefined);
      }
      // Refresh the list
      loadConversationList();
    } catch {
      // Silently fail
    }
  };

  // Group conversations by date
  const groupConversationsByDate = (convs: ConversationSummary[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);

    const groups: { label: string; conversations: ConversationSummary[] }[] = [];
    const todayConvs: ConversationSummary[] = [];
    const yesterdayConvs: ConversationSummary[] = [];
    const olderConvs: ConversationSummary[] = [];

    for (const conv of convs) {
      const date = new Date(conv.lastMessage.createdAt);
      if (date >= today) {
        todayConvs.push(conv);
      } else if (date >= yesterday) {
        yesterdayConvs.push(conv);
      } else {
        olderConvs.push(conv);
      }
    }

    if (todayConvs.length > 0) groups.push({ label: t('chat.today', 'Today'), conversations: todayConvs });
    if (yesterdayConvs.length > 0) groups.push({ label: t('chat.yesterday', 'Yesterday'), conversations: yesterdayConvs });
    if (olderConvs.length > 0) groups.push({ label: t('chat.older', 'Older'), conversations: olderConvs });

    return groups;
  };

  const conversationGroups = groupConversationsByDate(conversations);

  // Get a preview of the message content (first line, truncated)
  const getPreview = (content: string, maxLength: number = 60) => {
    // Strip markdown, AI prefixes, and grab first readable line
    const cleanContent = content.replace(/^(AI:\s*)+/i, '').replace(/[*#`|>]/g, '').trim();
    const firstLine = cleanContent.split('\n')[0] || t('chat.emptyMessage', 'Message');
    return firstLine.length > maxLength ? firstLine.substring(0, maxLength) + '...' : firstLine;
  };

  const handleQuickAction = (promptText: string) => {
    setInput(promptText);
    if (inputRef.current) {
      inputRef.current.focus();
      // Auto-trigger send after small delay to let state update
      setTimeout(() => {
        handleSend();
      }, 50);
    }
  };

  const quickActions = [
    { label: t('chat.quickTb', 'Trial Balance'), prompt: t('chat.quickTbPrompt', 'Show me the trial balance summary') },
    { label: t('chat.quickPnl', 'Profit & Loss'), prompt: t('chat.quickPnlPrompt', 'Generate a profit and loss report') },
    { label: t('chat.quickBs', 'Balance Sheet'), prompt: t('chat.quickBsPrompt', 'What is the current balance sheet?') },
  ];

  if (!canChat) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h2 className="text-lg font-medium text-gray-600">
            {t('chat.noPermission', 'No Permission')}
          </h2>
          <p className="text-sm text-gray-400 mt-1">
            {t('chat.noPermissionDesc', 'You do not have permission to use the AI Assistant.')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-[calc(100vh-120px)] max-w-6xl mx-auto">
      {/* Sidebar - Conversation History */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0'} flex-shrink-0 border-r bg-white transition-all duration-200 overflow-hidden flex flex-col`}>
        {/* Sidebar Header */}
        <div className="flex items-center justify-between px-3 py-3 border-b">
          <h2 className="text-sm font-semibold text-gray-700 truncate">
            {t('chat.history', 'History')}
          </h2>
          <button
            onClick={handleNewConversation}
            className="p-1 text-indigo-600 hover:bg-indigo-50 rounded transition-colors"
            title={t('chat.newConversation', 'New conversation')}
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {/* Conversation List */}
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-gray-400">
              {t('chat.noHistory', 'No previous conversations')}
            </div>
          )}
          {conversationGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pt-3 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {group.label}
              </div>
              {group.conversations.map((conv) => (
                <button
                  key={conv.conversationId}
                  onClick={() => handleSelectConversation(conv.conversationId)}
                  className={`w-full text-left px-3 py-2 hover:bg-gray-50 transition-colors group ${
                    conv.conversationId === conversationId ? 'bg-indigo-50 border-l-2 border-indigo-500' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MessageSquare className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-gray-700 truncate font-medium">
                        {conv.lastMessage.role === 'user'
                          ? getPreview(conv.lastMessage.content)
                          : getPreview(conv.lastMessage.content)
                        }
                      </div>
                      <div className="flex items-center gap-1 mt-0.5">
                        <Clock className="w-3 h-3 text-gray-300" />
                        <span className="text-xs text-gray-400">
                          {new Date(conv.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDeleteConversation(conv.conversationId); }}
                      className="opacity-0 group-hover:opacity-100 p-1 text-gray-400 hover:text-red-500 transition-all"
                      title="Delete"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </button>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b bg-white">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors lg:hidden"
              title={sidebarOpen ? 'Hide history' : 'Show history'}
            >
              <MessageSquare className="w-5 h-5" />
            </button>
            <Bot className="w-6 h-6 text-indigo-600" />
            <h1 className="text-lg font-semibold text-gray-900">
              {t('chat.title', 'AI Assistant')}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="hidden lg:flex items-center gap-1 px-2 py-1 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
              title={sidebarOpen ? 'Hide history' : 'Show history'}
            >
              <MessageSquare className="w-4 h-4" />
            </button>
            <button
              onClick={handleNewConversation}
              className="flex items-center gap-1 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-md transition-colors"
              title={t('chat.newConversation', 'New conversation')}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">{t('chat.newConversation', 'New')}</span>
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full max-w-2xl mx-auto px-4">
              <div className="text-center mb-8">
                <div className="w-20 h-20 bg-indigo-50 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner">
                  <Sparkles className="w-10 h-10 text-indigo-600" />
                </div>
                <h2 className="text-2xl font-bold text-gray-800 mb-3 tracking-tight">
                  {t('chat.welcome', 'Welcome to AI Assistant')}
                </h2>
                <p className="text-base text-gray-500">
                  {t('chat.welcomeDesc', 'Ask questions about your ERP data, get explanations, summaries, and suggestions. The assistant is advisory-only and cannot modify business records.')}
                </p>
              </div>
              
              <div className="w-full flex flex-wrap justify-center gap-3">
                {quickActions.map((action, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setInput(action.prompt);
                      if (inputRef.current) inputRef.current.focus();
                    }}
                    className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-200 rounded-full hover:border-indigo-300 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 text-sm font-medium text-gray-600 hover:text-indigo-600"
                  >
                    <Sparkles className="w-4 h-4 opacity-50" />
                    {action.label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-4 ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-2 duration-300`}
            >
              {msg.role === 'assistant' && (
                <div className="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-indigo-50 to-white border border-indigo-100 shadow-sm flex items-center justify-center mt-1">
                  <Sparkles className="w-5 h-5 text-indigo-600" />
                </div>
              )}
              <div
                className={`max-w-[85%] sm:max-w-[75%] px-5 py-3.5 shadow-sm ${
                  msg.role === 'user'
                    ? 'bg-gradient-to-br from-indigo-500 to-indigo-600 text-white rounded-2xl rounded-tr-sm'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm'
                }`}
              >
                <div className="text-sm whitespace-pre-wrap leading-relaxed">
                  {msg.role === 'assistant' ? (
                     <MarkdownRenderer content={msg.content} />
                  ) : (
                     <div dir="auto">{msg.content}</div>
                  )}
                </div>
                {msg.role === 'assistant' && msg.toolResults && msg.toolResults.length > 0 && (
                  <AiToolResultsPanel toolResults={msg.toolResults} />
                )}
                {msg.isMock && msg.role === 'assistant' && (
                  <div className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" />
                    {t('chat.mockLabel', 'Mock response — for development only')}
                  </div>
                )}
              </div>
            </div>
          ))}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="bg-white border border-gray-200 rounded-lg px-4 py-3">
                <div className="flex gap-1">
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 rounded-full bg-indigo-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 sm:p-6 bg-gradient-to-t from-gray-50/80 to-transparent sticky bottom-0 z-10">
          <div className="max-w-4xl mx-auto w-full relative">
            {error && (
              <div className="mb-3 px-4 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 shadow-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="relative bg-white border border-gray-300 rounded-3xl shadow-sm focus-within:shadow-md focus-within:border-indigo-500 focus-within:ring-2 focus-within:ring-indigo-500/20 transition-all">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  e.target.style.height = 'auto';
                  e.target.style.height = `${Math.min(e.target.scrollHeight, 200)}px`;
                }}
                onKeyDown={handleKeyDown}
                placeholder={t('chat.placeholder', 'Ask about your ERP data...')}
                disabled={isLoading}
                rows={1}
                dir="auto"
                className="block w-full max-h-[200px] min-h-[64px] py-5 pr-[72px] pl-6 rtl:pl-[72px] rtl:pr-6 bg-transparent border-none outline-none focus:ring-0 resize-none disabled:opacity-50 text-sm md:text-base leading-relaxed overflow-y-auto m-0 rounded-3xl"
                style={{ boxShadow: 'none' }}
              />
              <div className="absolute right-2 rtl:right-auto rtl:left-2 top-1/2 -translate-y-1/2 flex items-center justify-center">
                <button
                  onClick={handleSend}
                  disabled={isLoading || !input.trim()}
                  className="w-12 h-12 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 hover:shadow-lg disabled:opacity-40 disabled:hover:shadow-none disabled:cursor-not-allowed transition-all flex items-center justify-center"
                >
                  <Send className="w-5 h-5 rtl:-scale-x-100" />
                </button>
              </div>
            </div>
            <p className="text-[11px] text-gray-500 mt-2.5 text-center font-medium">
              {t('chat.disclaimer', 'AI responses are advisory-only. They cannot create, modify, or delete business records.')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiAssistantHomePage;
