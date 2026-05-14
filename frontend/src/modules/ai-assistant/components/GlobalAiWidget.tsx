/**
 * AiAssistantHomeMockPage.tsx
 *
 * Mock page for AI Assistant UI Refinements (ChatGPT Clone Aesthetic).
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Bot, User, Trash2, AlertTriangle, Info, Plus, MessageSquare, Clock, Sparkles, Database, FileText, Wrench, Menu, ArrowUp, PanelLeftClose, PanelLeftOpen, PanelRight, Maximize2, X } from 'lucide-react';
import {
  aiAssistantApi,
  ChatMessageDTO,
  AiToolCallResultDTO,
  AiProposalDTO,
  ChatRuntimeMetadataDTO,
  ChatRuntimeModelProfileDTO,
  ChatMessageMetadata,
  streamMessage,
  AiStreamEvent,
} from '../../../api/aiAssistantApi';
import { client } from '../../../api/client';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { AiToolResultsPanel } from '../components/AiToolResultsPanel';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { FeedbackButtons } from '../components/FeedbackButtons';
import { AiErrorDisplay } from '../components/AiErrorDisplay';
import { QuickActionButtons } from './QuickActionButtons';
import { Link } from 'react-router-dom';

interface DisplayMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: string;
  provider?: string;
  model?: string | null;
  toolResults?: AiToolCallResultDTO[];
  proposal?: AiProposalDTO | null;
  runtimeWarnings?: string[];
  modelProfile?: ChatRuntimeModelProfileDTO;
  runtimeStatus?: string;
  selectedSkills?: string[];
  allowedToolIds?: string[];
  toolCallsRequested?: string[];
  toolCallResults?: ChatRuntimeMetadataDTO['toolResults'];
  feedback?: 'positive' | 'negative' | null;
  error?: unknown;
}

interface ConversationSummary {
  conversationId: string;
  title?: string;
  messageCount?: number;
  lastMessageAt?: string;
  createdAt?: string;
  /** @deprecated — use title instead */
  lastMessage?: ChatMessageDTO;
}

export const GlobalAiWidget: React.FC = () => {
  const { t } = useTranslation('aiAssistant');
  const { hasPermission } = useRBAC();
  const { permissionsLoaded, companyId } = useCompanyAccess();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isOpen, setIsOpen] = useState(() => {
    return localStorage.getItem('ai_widget_open') === 'true';
  });
  
  useEffect(() => {
    localStorage.setItem('ai_widget_open', isOpen.toString());
  }, [isOpen]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const canChat = hasPermission('ai-assistant.chat.use');

  const extractRuntimeMetadata = useCallback((metadata: unknown, responseRuntimeMeta?: ChatRuntimeMetadataDTO): Partial<DisplayMessage> => {
    const meta = (metadata || {}) as ChatMessageMetadata;
    const runtimeMeta = responseRuntimeMeta;

    const modelProfile = runtimeMeta?.modelProfile || meta.modelProfile;
    const runtimeWarnings = runtimeMeta?.runtimeWarnings || meta.runtimeWarnings || [];
    const toolCallsRequested = runtimeMeta?.toolCallsRequested || meta.toolCallsRequested || [];
    const toolCallResults = runtimeMeta?.toolResults || meta.toolCallResults || [];

    return {
      runtimeStatus: runtimeMeta?.runtimeStatus || meta.runtimeStatus,
      selectedSkills: runtimeMeta?.selectedSkills || meta.selectedSkills || [],
      allowedToolIds: runtimeMeta?.allowedToolIds || meta.allowedToolIds || [],
      modelProfile,
      runtimeWarnings,
      toolCallsRequested,
      toolCallResults,
    };
  }, []);

  const extractToolResults = useCallback((metadata: unknown): AiToolCallResultDTO[] => {
    const meta = metadata as ChatMessageMetadata | null;
    if (!meta || !Array.isArray(meta.toolResults)) return [];

    return (meta.toolResults as unknown as Array<Record<string, unknown>>)
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

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadConversationList = useCallback(async () => {
    try {
      const resp = await client.get('/tenant/ai-assistant/conversations', {
        params: { limit: 20 },
        headers: { 'X-Silent-Error': 'true' },
      });
      const result = resp as any;
      if (result?.conversations) {
        setConversations(result.conversations);
      }
    } catch {
      // Silently fail — AI widget is non-critical
    }
  }, []);

  const loadConversation = useCallback(async (convId: string) => {
    try {
      const resp = await client.get(`/tenant/ai-assistant/conversations/${convId}/messages`, {
        headers: { 'X-Silent-Error': 'true' },
      });
      const result = resp as any;
      const historyMessages: DisplayMessage[] = (result?.messages || []).map((msg: ChatMessageDTO) => {
        const runtime = extractRuntimeMetadata(msg.metadata);
        return {
          id: msg.id,
          role: msg.role as 'user' | 'assistant' | 'system',
          content: msg.content,
          timestamp: msg.createdAt,
          provider: msg.provider,
          model: msg.model,
          toolResults: extractToolResults(msg.metadata),
          proposal: (msg.metadata as ChatMessageMetadata)?.proposal as AiProposalDTO || null,
          feedback: msg.feedback || null,
          ...runtime,
        };
      });
      setConversationId(convId);
      setMessages(historyMessages);
    } catch {
      console.warn('[AI Assistant] Could not load conversation');
    }
  }, [extractRuntimeMetadata, extractToolResults]);

  useEffect(() => {
    if (!canChat || !permissionsLoaded) return;

    const init = async () => {
      try {
        const resp = await client.get('/tenant/ai-assistant/conversations', {
          params: { limit: 20 },
          headers: { 'X-Silent-Error': 'true' },
        });
        const result = resp as any;
        if (result?.conversations && result.conversations.length > 0) {
          setConversations(result.conversations);
          const lastConv = result.conversations[0];
          await loadConversation(lastConv.conversationId);
        }
      } catch (err: any) {
        // Silently ignore 403 (permission denied) and 404 (not found)
        const status = err?.response?.status;
        if (status !== 403 && status !== 404) {
          console.warn('[AI Assistant] Failed to load conversations:', err);
        }
      }
    };
    init();
  }, [canChat, permissionsLoaded, loadConversation]);

  const refreshConversations = useCallback(() => {
    loadConversationList();
  }, [loadConversationList]);

  const handleSend = useCallback(async (messageOverride?: string) => {
    const trimmed = (messageOverride ?? input).trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const userMessage: DisplayMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    // Create a placeholder assistant message for streaming updates
    const streamId = `streaming_${Date.now()}`;
    const placeholderMessage: DisplayMessage = {
      id: streamId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage, placeholderMessage]);
    setInput('');
    setIsLoading(true);

    // Accumulate streaming state outside React for synchronous updates within the callback
    let accumulatedContent = '';
    const toolCallsRequested: string[] = [];
    const toolCallResults: ChatRuntimeMetadataDTO['toolResults'] = [];
    const toolResults: AiToolCallResultDTO[] = [];

    try {
      await streamMessage(
        { message: trimmed, conversationId },
        (event: AiStreamEvent) => {
          switch (event.type) {
            case 'token':
              accumulatedContent += event.content;
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, content: accumulatedContent } : m
              ));
              break;

            case 'tool_call':
              // TODO: yield tool_call events from backend for UI transparency
              // Currently dead code — backend only emits tool_result, not tool_call
              break;

            case 'tool_result':
              toolCallResults.push({
                toolName: event.toolName,
                approved: event.approved,
                rejectionReason: event.approved ? undefined : 'Tool execution failed',
              });
              toolResults.push({
                toolName: event.toolName,
                result: {
                  success: event.approved,
                  data: event.approved ? (event.data as Record<string, unknown> | null) ?? null : null,
                  ...(!event.approved ? { error: 'Tool execution failed' } : {}),
                },
              });
              setMessages(prev => prev.map(m =>
                m.id === streamId ? {
                  ...m,
                  toolCallResults: [...toolCallResults],
                  toolResults: [...toolResults],
                } : m
              ));
              break;

            case 'done': {
              const meta = event.metadata;
              const runtimeMeta = meta.runtimeMeta;
              setMessages(prev => prev.map(m =>
                m.id === streamId ? {
                  ...m,
                  content: accumulatedContent || m.content,
                  provider: meta.provider,
                  model: meta.model,
                  runtimeStatus: runtimeMeta?.runtimeStatus,
                  selectedSkills: runtimeMeta?.selectedSkills,
                  allowedToolIds: runtimeMeta?.allowedToolIds,
                  modelProfile: runtimeMeta?.modelProfile,
                  runtimeWarnings: runtimeMeta?.runtimeWarnings,
                  toolCallsRequested: toolCallsRequested.length > 0 ? toolCallsRequested : runtimeMeta?.toolCallsRequested,
                  toolCallResults: toolCallResults.length > 0 ? toolCallResults : runtimeMeta?.toolResults,
                  toolResults: toolResults.length > 0 ? toolResults : undefined,
                  proposal: (runtimeMeta?.proposal as unknown as AiProposalDTO) || null,
                } : m
              ));
              if (runtimeMeta?.conversationId && !conversationId) {
                setConversationId(runtimeMeta.conversationId);
              }
              break;
            }

            case 'error':
              setMessages(prev => prev.map(m =>
                m.id === streamId ? { ...m, error: new Error(event.message) } : m
              ));
              break;
          }
        },
      );

      refreshConversations();
    } catch (err: any) {
      setMessages(prev => prev.map(m =>
        m.id === streamId ? { ...m, error: err } : m
      ));
      setError(null);
    } finally {
      setIsLoading(false);
      setTimeout(() => {
        if (inputRef.current) {
          inputRef.current.focus();
        }
      }, 50);
    }
  }, [input, isLoading, conversationId, refreshConversations]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleRetry = useCallback(() => {
    // Remove the last error message, find the last user message content to re-send
    setMessages(prev => {
      const lastMsg = prev[prev.length - 1];
      if (lastMsg?.error) {
        return prev.slice(0, -1);
      }
      return prev;
    });
    // Find last user message content to pre-fill for re-send
    const lastUserContent = [...messages].reverse().find(m => m.role === 'user')?.content;
    if (lastUserContent) {
      setInput(lastUserContent);
    }
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  }, [messages]);

  const handleNewConversation = () => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 50);
  };

  const handleSelectConversation = async (convId: string) => {
    await loadConversation(convId);
  };

  const handleDeleteConversation = async (convId: string) => {
    try {
      await aiAssistantApi.deleteConversation(convId);
      if (convId === conversationId) {
        setMessages([]);
        setConversationId(undefined);
      }
      loadConversationList();
    } catch {
      // Silently fail
    }
  };

  const groupConversationsByDate = (convs: ConversationSummary[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);

    const groups: { label: string; conversations: ConversationSummary[] }[] = [];
    const todayConvs: ConversationSummary[] = [];
    const yesterdayConvs: ConversationSummary[] = [];
    const olderConvs: ConversationSummary[] = [];

    for (const conv of convs) {
      const dateStr = conv.lastMessageAt || conv.lastMessage?.createdAt || conv.createdAt || '';
      const date = dateStr ? new Date(dateStr) : new Date(0);
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

  const getPreview = (content: string, maxLength: number = 60) => {
    const cleanContent = content.replace(/^(AI:\s*)+/i, '').replace(/[*#`|>]/g, '').trim();
    const firstLine = cleanContent.split('\n')[0] || t('chat.emptyMessage', 'Message');
    return firstLine.length > maxLength ? firstLine.substring(0, maxLength) + '...' : firstLine;
  };

  const formatModelProvider = (msg: DisplayMessage): string => {
    const provider = msg.provider || msg.modelProfile?.provider || 'ai';
    const model = msg.model || msg.modelProfile?.modelName || 'model';
    return t('chat.modelLabel', 'Model: {{model}} · {{provider}}', { model, provider });
  };

  const formatModelStatus = (status: string): string => {
    switch (status) {
      case 'tested': return t('chat.testedModel', 'Tested model');
      case 'experimental': return t('chat.experimentalModel', 'Experimental model');
      case 'custom': return t('chat.customModelWarning', 'Custom model');
      default: return t('chat.untestedModelWarning', 'Untested model');
    }
  };

  const getVisibleRuntimeWarnings = (msg: DisplayMessage): string[] => {
    const warnings = [...(msg.runtimeWarnings || [])];
    const warningMessage = msg.modelProfile?.warningMessage;
    if (warningMessage && !warnings.includes(warningMessage)) {
      warnings.push(warningMessage);
    }
    return warnings.filter(Boolean);
  };

  // Quick actions are rendered by QuickActionButtons component

  if (!canChat) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:shadow-xl hover:bg-indigo-700 transition-all flex items-center justify-center rtl:right-auto rtl:left-6"
      >
        <MessageSquare className="w-6 h-6" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-[9999] w-[380px] h-[650px] max-h-[85vh] bg-white rounded-2xl shadow-[0_10px_40px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden border border-gray-200 rtl:right-auto rtl:left-6">
      {/* Widget Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-3 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shadow-inner">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div>
            <h3 className="font-semibold text-white text-sm leading-tight">ERP Assistant</h3>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-green-400 border border-green-500 shadow-sm"></span>
              <span className="text-[10px] text-indigo-50 font-medium">Active</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button 
             onClick={() => setSidebarOpen(!sidebarOpen)}
             className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-md transition-colors"
          >
             <Menu className="w-5 h-5" />
          </button>
          <button 
             onClick={() => setIsOpen(false)}
             className="text-white/80 hover:text-white p-1.5 hover:bg-white/10 rounded-md transition-colors"
          >
             <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative bg-gray-50">
        {/* Sidebar Overlay */}
        {sidebarOpen && (
          <div className="absolute inset-y-0 left-0 w-[240px] bg-white border-r border-gray-200 shadow-xl z-20 flex flex-col rtl:left-auto rtl:right-0 rtl:border-r-0 rtl:border-l">
            <div className="p-3 border-b border-gray-100">
               <button onClick={handleNewConversation} className="w-full flex items-center gap-2 px-3 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-md hover:bg-indigo-100 transition-colors">
                  <Plus className="w-4 h-4" /> New Chat
               </button>
            </div>
<div className="flex-1 overflow-y-auto p-2">
                {conversations.length === 0 && (
                  <div className="text-xs text-gray-400 text-center mt-4">{t('chat.noConversations', 'No previous chats')}</div>
                )}
                {conversations.map(conv => {
                  const displayTitle = conv.title || (conv.lastMessage ? getPreview(conv.lastMessage.content, 30) : t('chat.untitledConversation', 'New conversation'));
                  const timeLabel = conv.lastMessageAt
                    ? new Date(conv.lastMessageAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
                    : '';
                  return (
                    <button
                      key={conv.conversationId}
                      onClick={() => { handleSelectConversation(conv.conversationId); setSidebarOpen(false); }}
                      className={`w-full text-left p-2.5 rounded-lg text-sm mb-1 ${conv.conversationId === conversationId ? 'bg-gray-100 font-semibold text-gray-900' : 'hover:bg-gray-50 text-gray-600'}`}
                    >
                      <div className="truncate font-medium">{displayTitle}</div>
                      <div className="flex items-center gap-2 mt-0.5">
                        {conv.messageCount != null && (
                          <span className="text-[10px] text-gray-400">{conv.messageCount} {t('chat.messages', 'messages')}</span>
                        )}
                        {timeLabel && (
                          <span className="text-[10px] text-gray-400">{timeLabel}</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 flex flex-col relative w-full h-full">
           <div className="flex-1 overflow-y-auto px-4 py-4 w-full">
             {messages.length === 0 && (
               <div className="flex flex-col items-center justify-center flex-1 mt-10">
                  <div className="w-14 h-14 bg-white border border-gray-200 shadow-sm rounded-full flex items-center justify-center mb-4">
                     <Bot className="w-7 h-7 text-indigo-600" />
                  </div>
                  <h2 className="text-lg font-semibold text-gray-800 mb-6 text-center">
                    How can I help you today?
                  </h2>
                  <div className="flex flex-col gap-2 w-full">
                    <QuickActionButtons
                      onSendMessage={(msg) => handleSend(msg)}
                      hasMessages={messages.length > 0}
                    />
                  </div>
               </div>
             )}

             <div className="space-y-5 pb-2">
               {messages.map((msg) => (
                 <div key={msg.id} className={`flex w-full animate-in fade-in duration-300 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                   {msg.role === 'assistant' && (
                     <div className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-200 bg-white flex items-center justify-center mr-2 shadow-sm">
                       <Bot className="w-4 h-4 text-black" />
                     </div>
                   )}
                   <div className={`${msg.role === 'user' ? 'max-w-[85%]' : 'max-w-[85%] flex-1'}`}>
                     {msg.role === 'user' ? (
                       <div className="flex flex-col items-end">
                         <div className="px-4 py-2.5 bg-indigo-600 text-white rounded-2xl rounded-tr-sm text-[14px] leading-relaxed shadow-sm">
                           <div dir="auto">{msg.content}</div>
                         </div>
                       </div>
                     ) : (
<div className="text-gray-800 text-[14px] leading-relaxed prose prose-slate prose-sm max-w-none bg-white border border-gray-200 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm">
                          {msg.error ? (
                            <AiErrorDisplay error={msg.error} onRetry={handleRetry} />
                          ) : (
                            <>
                              <MarkdownRenderer content={msg.content} />
                              
                              {msg.toolResults && msg.toolResults.length > 0 && (
                                <div className="mt-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                  <AiToolResultsPanel toolResults={msg.toolResults} />
                                </div>
                              )}
                              {msg.proposal && (
                                <div className="mt-3 p-3 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors">
                                  <Link to={`/ai-assistant/proposals/${msg.proposal.id}`} className="block text-sm text-indigo-700 font-semibold hover:underline">
                                    View Proposal: {msg.proposal.title}
                                  </Link>
                                </div>
                              )}
                              {!msg.id.startsWith('streaming_') && (
                                <FeedbackButtons
                                  messageId={msg.id}
                                  currentFeedback={msg.feedback}
                                  companyId={companyId || ''}
                                  onFeedbackSubmitted={(msgId, newFeedback) => {
                                    setMessages(prev => prev.map(m =>
                                      m.id === msgId ? { ...m, feedback: newFeedback } : m
                                    ));
                                  }}
                                />
                              )}
                            </>
                          )}
                       </div>
                     )}
                   </div>
                 </div>
               ))}
               
               {isLoading && (
                 <div className="flex w-full animate-in fade-in duration-300">
                   <div className="flex-shrink-0 w-7 h-7 rounded-full border border-gray-200 bg-white flex items-center justify-center mr-2 shadow-sm">
                     <Bot className="w-4 h-4 text-black" />
                   </div>
                   <div className="text-gray-900 flex items-center gap-1 mt-2">
                     <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" />
                     <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '150ms' }} />
                     <div className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-pulse" style={{ animationDelay: '300ms' }} />
                   </div>
                 </div>
               )}
             </div>
             <div ref={messagesEndRef} />
           </div>
           
{/* Input */}
            <div className="p-3 bg-white border-t border-gray-200">
               <div dir="auto" className="relative flex items-end bg-gray-50 border border-gray-300 focus-within:border-indigo-500 rounded-2xl transition-all duration-200 p-1">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => {
                    setInput(e.target.value);
                    e.target.style.height = 'auto';
                    e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
                  }}
                  onKeyDown={handleKeyDown}
                  placeholder="Your message..."
                  disabled={isLoading}
                  rows={1}
                  dir="auto"
                  autoFocus
                  className="flex-1 max-h-[120px] min-h-[40px] py-2.5 px-3 bg-transparent border-none outline-none focus:ring-0 resize-none disabled:opacity-50 text-[14px] leading-relaxed m-0 placeholder-gray-400"
                />
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className="mb-1 mr-1 w-8 h-8 bg-indigo-600 text-white rounded-full disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center flex-shrink-0"
                >
                  <Send className="w-4 h-4 rtl:-scale-x-100 ml-0.5" />
                </button>
              </div>
              <div className="mt-2 text-center">
                <span className="text-[10px] text-gray-400">Powered by OpenCode AI</span>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
};
