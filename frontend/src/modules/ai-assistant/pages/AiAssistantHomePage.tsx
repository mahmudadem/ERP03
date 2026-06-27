/**
 * AiAssistantHomePage.tsx
 *
 * Main AI Assistant page with chat interface and conversation sidebar.
 * Only accessible when the ai-assistant module is installed and permitted.
 * The assistant is advisory-only — it cannot mutate business records.
 */

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next'; import { Send, Bot, Trash2, AlertCircle, AlertTriangle, Info, Plus, MessageSquare, Clock, Sparkles, FileText, Wrench, Mic, PanelLeftClose, PanelLeft, Copy, Check, Pin, PinOff, Edit3, Download, Archive, Paperclip, Globe, Lightbulb} from 'lucide-react';
import { Spinner } from '../../../components/ui/Spinner';
import {
  aiAssistantApi,
  ChatMessageDTO,
  AiToolCallResultDTO,
  AiProposalDTO,
  ChatRuntimeMetadataDTO,
  ChatRuntimeModelProfileDTO,
  ChatMessageMetadata,
  ConversationMetaDTO,
  streamMessage,
  AiStreamEvent,
  AiStreamError,
} from '../../../api/aiAssistantApi';
import { useRBAC } from '../../../api/rbac/useRBAC';
import { AiToolResultsPanel } from '../components/AiToolResultsPanel';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { QuickActionButtons } from '../components/QuickActionButtons';
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
  isProviderError?: boolean;
  allowedToolIds?: string[];
  toolCallsRequested?: string[];
  toolCallResults?: ChatRuntimeMetadataDTO['toolResults'];
  actualRounds?: number;
  usage?: { promptTokens?: number; completionTokens?: number; totalTokens?: number };
  durationMs?: number;
  creditsUsed?: number;
}

export const AiAssistantHomePage: React.FC = () => {
  const { t, i18n } = useTranslation('aiAssistant');
  const { hasPermission } = useRBAC();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [streamingContent, setStreamingContent] = useState('');
  const [streamingStage, setStreamingStage] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [conversations, setConversations] = useState<ConversationMetaDTO[]>([]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [hasSentFirst, setHasSentFirst] = useState(false);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ai_pinned_msgs') || '[]')); } catch { return new Set<string>(); }
  });
  const [pinnedConvs, setPinnedConvs] = useState<Set<string>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem('ai_pinned_convs') || '[]')); } catch { return new Set<string>(); }
  });
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; msgId: string } | null>(null);
  const [editingConvId, setEditingConvId] = useState<string | null>(null);
  const [editingConvTitle, setEditingConvTitle] = useState('');
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [hintIdx, setHintIdx] = useState(0);
  const [currentModel, setCurrentModel] = useState<string | null>(null);
  const [isModelReachable, setIsModelReachable] = useState(false);

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
        durationMs: typeof entry.durationMs === 'number' ? entry.durationMs : undefined,
        round: typeof entry.round === 'number' ? entry.round : undefined,
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
       const historyMessages: DisplayMessage[] = (result.messages || []).map((msg: ChatMessageDTO) => {
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
           ...runtime,
         };
       });
       setConversationId(convId);
       setMessages(historyMessages);
       
       // Set current model from the most recent assistant message if available
       const recentAssistantMsg = historyMessages
         .slice()
         .reverse()
         .find(m => m.role === 'assistant' && m.model);
       if (recentAssistantMsg?.model) {
         setCurrentModel(recentAssistantMsg.model);
       }
     } catch {
       console.warn('[AI Assistant] Could not load conversation');
     }
   }, [extractRuntimeMetadata, extractToolResults]);

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

  const handleSend = useCallback(async (messageOverride?: string) => {
    const trimmed = (messageOverride ?? input).trim();
    if (!trimmed || isLoading) return;

    setError(null);
    const streamId = `stream_${Date.now()}`;

    // Add user message immediately
    const userMessage: DisplayMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setHasSentFirst(true);
    setIsLoading(true);
    setStreamingContent('');
    setStreamingStage('thinking');

    // Accumulate streaming state outside React for synchronous updates within the callback
    const sendStartTime = Date.now();
    let accumulatedContent = '';
    const toolCallsRequested: string[] = [];
    const toolCallResults: ChatRuntimeMetadataDTO['toolResults'] = [];
    const toolResults: AiToolCallResultDTO[] = [];
    let actualRounds = 1;

    try {
      await streamMessage(
        { message: trimmed, conversationId },
        (event: AiStreamEvent) => {
          if (event.type === 'status') {
            setStreamingStage(event.stage);
          } else if (event.type === 'token') {
            setStreamingStage(null);
            accumulatedContent += event.content;
            setStreamingContent(accumulatedContent);
          } else if (event.type === 'tool_result') {
            const toolSucceeded = event.approved && !event.error;
            toolCallResults.push({
              toolName: event.toolName,
              approved: toolSucceeded,
              rejectionReason: toolSucceeded ? undefined : (event as any).error || 'Tool execution failed',
            });

            // Deduplicate: replace previous result for the same toolName
            const existingIdx = toolResults.findIndex(r => r.toolName === event.toolName);
            const newEntry: AiToolCallResultDTO = {
              toolName: event.toolName,
              durationMs: (event as any).durationMs,
              round: (event as any).round,
              result: {
                success: toolSucceeded,
                data: toolSucceeded ? (event.data as Record<string, unknown> | null) ?? null : null,
                error: (event as any).error || (!toolSucceeded ? 'Tool execution failed' : undefined),
              },
            };

            if (existingIdx !== -1) {
              toolResults[existingIdx] = newEntry;
            } else {
              toolResults.push(newEntry);
            }
            } else if (event.type === 'done') {
              const meta = event.metadata;
              const runtimeMeta = meta.runtimeMeta;
              setStreamingContent('');
              setStreamingStage(null);
              
              const assistantMsg: DisplayMessage = {
                id: `final_${Date.now()}`,
                role: 'assistant',
                content: accumulatedContent || '...',
                timestamp: new Date().toISOString(),
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
                actualRounds: runtimeMeta?.actualRounds || actualRounds,
                usage: meta.usage,
                durationMs: meta.durationMs ?? (Date.now() - sendStartTime),
                creditsUsed: meta.creditsUsed,
              };
              
              // Update current model state and reachability
              if (meta.model) {
                setCurrentModel(meta.model);
                setIsModelReachable(true);
              } else {
                setIsModelReachable(false);
              }
             
             // Update current model state
             if (meta.model) {
               setCurrentModel(meta.model);
             }

            setMessages(prev => [...prev, assistantMsg]);

            if (runtimeMeta?.conversationId && !conversationId) {
              setConversationId(runtimeMeta.conversationId);
            }
          } else if (event.type === 'error') {
            setError(event.message);
            setStreamingContent('');
            setStreamingStage(null);
          }
        },
      );

      refreshConversations();
    } catch (err: any) {
      const isStreamError = err instanceof AiStreamError;
      const status = isStreamError ? err.status : undefined;
      const errorMsg = err?.message || t('chat.errors.generic', 'Something went wrong. Please try again.');
      const isProviderError = /api key|provider|diagnostics|ai settings/i.test(errorMsg);

      if (status === 429 || status === 403) {
        const prefix = status === 429
          ? t('chat.rateLimited', 'Rate limit reached')
          : t('chat.disabled', 'AI Assistant disabled');
        setMessages(prev => prev.map(m =>
          m.id === streamId ? {
            ...m,
            content: `⚠️ ${prefix}: ${errorMsg}`,
          } : m
        ));
        setError(null);
      } else if (isProviderError) {
        setMessages(prev => prev.map(m =>
          m.id === streamId ? {
            ...m,
            content: `⚠️ ${t('chat.providerNotAvailable', 'AI provider is not available')}: ${errorMsg}`,
            isProviderError: true,
          } : m
        ));
        setError(null);
      } else {
        setError(errorMsg);
        setMessages(prev => prev.map(m =>
          m.id === streamId ? {
            ...m,
            content: `⚠️ ${t('chat.error', 'Error')}: ${errorMsg}`,
          } : m
        ));
      }
    } finally {
      setIsLoading(false);
      setStreamingStage(null);
      inputRef.current?.focus();
    }
  }, [input, isLoading, conversationId, t, refreshConversations]);

  const toggleRecording = useCallback(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Your browser does not support voice recognition.');
      return;
    }

    if (isRecording) {
      setIsRecording(false);
      return;
    }

    const recognition = new SpeechRecognition();
    if (i18n.language.startsWith('ar')) recognition.lang = 'ar-SA';
    else if (i18n.language.startsWith('tr')) recognition.lang = 'tr-TR';
    else recognition.lang = 'en-US';

    recognition.interimResults = true;
    recognition.continuous = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = (event: any) => {
      console.error('Speech recognition error', event.error);
      setError(`Voice error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      const transcript = Array.from(event.results)
        .map((result: any) => result[0])
        .map((result: any) => result.transcript)
        .join('');
      
      setInput(transcript);
    };

    recognition.start();
  }, [isRecording, i18n.language]);

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
  const groupConversationsByDate = (convs: ConversationMetaDTO[]) => {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);

    const groups: { label: string; conversations: ConversationMetaDTO[] }[] = [];
    const todayConvs: ConversationMetaDTO[] = [];
    const yesterdayConvs: ConversationMetaDTO[] = [];
    const olderConvs: ConversationMetaDTO[] = [];

    for (const conv of convs) {
      const dateStr = conv.lastMessageAt || conv.createdAt || '';
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

  // Get a preview of the message content (first line, truncated)
  const getPreview = (content: string, maxLength: number = 60) => {
    // Strip markdown, AI prefixes, and grab first readable line
    const cleanContent = content.replace(/^(AI:\s*)+/i, '').replace(/[*#`|>]/g, '').trim();
    const firstLine = cleanContent.split('\n')[0] || t('chat.emptyMessage', 'Message');
    return firstLine.length > maxLength ? firstLine.substring(0, maxLength) + '...' : firstLine;
  };

  const getVisibleRuntimeWarnings = (msg: DisplayMessage): string[] => {
    const warnings = [...(msg.runtimeWarnings || [])];
    const warningMessage = msg.modelProfile?.warningMessage;
    if (warningMessage && !warnings.includes(warningMessage)) {
      warnings.push(warningMessage);
    }
    return warnings.filter(Boolean);
  };

  const isClarificationMessage = (msg: DisplayMessage): boolean => {
    if (msg.runtimeStatus === 'clarification') return true;
    if (msg.proposal?.missingInfo && msg.proposal.missingInfo.length > 0) return true;
    const lower = msg.content.toLowerCase();
    return lower.includes('i need additional information') || lower.includes('please provide');
  };

  const formatModelProvider = (msg: DisplayMessage): string => {
    const provider = msg.provider || msg.modelProfile?.provider || 'ai';
    const model = msg.model || msg.modelProfile?.modelName || 'model';
    return t('chat.modelLabel', 'Model: {{model}} · {{provider}}', { model, provider });
  };

  const formatModelStatus = (status: string): string => {
    switch (status) {
      case 'recommended':
      case 'CERTIFIED':
        return t('chat.certifiedModel', 'Certified model');
      case 'tested':
        return t('chat.testedModel', 'Tested model');
      case 'experimental':
        return t('chat.experimentalModel', 'Experimental model');
      case 'custom':
        return t('chat.customModelWarning', 'Custom model — results may vary');
      default:
        return t('chat.untestedModelWarning', 'Untested model — response quality not verified');
    }
  };

  // Quick actions are rendered by QuickActionButtons component

  // ─── Hints & Follow-ups ────────────────────────────────────────
  const hints =
    i18n.language.startsWith('ar')
      ? ['اسأل عن تقرير المبيعات', 'اعرض حالة المخزون', 'حلل التدفق النقدي', 'قارن الأداء الربع سنوي']
      : i18n.language.startsWith('tr')
        ? ['Satış raporunu sor', 'Stok durumunu göster', 'Nakit akışını analiz et', 'Çeyreklik performansı karşılaştır']
        : ['Ask about sales report', 'Show inventory status', 'Analyze cash flow', 'Compare quarterly performance'];

  useEffect(() => {
    if (hasSentFirst) return;
    const interval = setInterval(() => setHintIdx(i => (i + 1) % hints.length), 3000);
    return () => clearInterval(interval);
  }, [hasSentFirst, hints.length]);

  const suggestionTopics = [
    'What were our top-selling products last month?',
    'Show me accounts that are overdue by 60+ days',
    'Compare Q3 vs Q2 revenue growth',
    'Which suppliers have the best on-time delivery rate?',
    'What is our current cash conversion cycle?',
    'Show me inventory turnover by warehouse',
    'List employees with pending expense reports',
    'What is our gross margin trend this year?',
  ];

  // ─── Context Menu Handlers ─────────────────────────────────────
  const closeContextMenu = () => setContextMenu(null);

  const handleContextMenu = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, msgId });
  };

  const handleRenameConv = (convId: string, currentTitle: string) => {
    setEditingConvId(convId);
    setEditingConvTitle(currentTitle || '');
  };

  const handleSaveRename = (convId: string) => {
    const trimmed = editingConvTitle.trim();
    if (!trimmed) { setEditingConvId(null); return; }
    setConversations(prev => prev.map(c => c.conversationId === convId ? { ...c, title: trimmed } : c));
    if (convId === conversationId) {
      // Also update the conversation list from server if needed
    }
    setEditingConvId(null);
  };

  const handleTogglePinMsg = (msgId: string) => {
    setPinnedIds(prev => {
      const next = new Set(prev);
      if (next.has(msgId)) next.delete(msgId); else next.add(msgId);
      localStorage.setItem('ai_pinned_msgs', JSON.stringify([...next]));
      return next;
    });
  };

  const handleTogglePinConv = (convId: string) => {
    setPinnedConvs(prev => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId); else next.add(convId);
      localStorage.setItem('ai_pinned_convs', JSON.stringify([...next]));
      return next;
    });
  };

  const handleDownloadMsg = (content: string) => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'ai-response.md';
    a.click(); URL.revokeObjectURL(url);
  };

  const isRtl = i18n.dir() === 'rtl';

  // ─── Render conversation sidebar item ──────────────────────────
  const renderConvItem = (conv: ConversationMetaDTO) => {
    const isEditing = editingConvId === conv.conversationId;
    const fullTitle = conv.title || t('chat.untitledConversation', 'New conversation');
    return (
      <div key={conv.conversationId} className="relative group">
        {isEditing ? (
          <input
            autoFocus
            value={editingConvTitle}
            onChange={e => setEditingConvTitle(e.target.value)}
            onBlur={() => handleSaveRename(conv.conversationId)}
            onKeyDown={e => { if (e.key === 'Enter') handleSaveRename(conv.conversationId); if (e.key === 'Escape') setEditingConvId(null); }}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-400 bg-white"
            dir="auto"
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <button
            onClick={() => handleSelectConversation(conv.conversationId)}
            onDoubleClick={() => handleRenameConv(conv.conversationId, fullTitle)}
            onContextMenu={e => handleContextMenu(e, conv.conversationId)}
            title={fullTitle}
            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors ${
              conv.conversationId === conversationId ? 'bg-gray-200/70' : 'hover:bg-gray-100'
            }`}
          >
            <div className="text-sm text-gray-700 truncate font-medium">{fullTitle}</div>
            <div className="flex items-center gap-2 mt-0.5">
              {pinnedConvs.has(conv.conversationId) && <Pin className="w-3 h-3 text-gray-400" />}
              {conv.messageCount != null && (
                <span className="text-xs text-gray-400">{conv.messageCount} {t(`msgs`)}</span>
              )}
              {conv.lastMessageAt && (
                <span className="text-xs text-gray-400">
                  {new Date(conv.lastMessageAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </button>
        )}
      </div>
    );
  };

  // ─── Close context menu on click anywhere ──────────────────────
  useEffect(() => { if (!contextMenu) return; const cb = () => setContextMenu(null); window.addEventListener('click', cb); return () => window.removeEventListener('click', cb); }, [contextMenu]);

  // ─── Follow-ups after last assistant message ───────────────────
  useEffect(() => {
    if (messages.length === 0) { setFollowUps([]); return; }
    const last = messages[messages.length - 1];
    if (last.role === 'assistant') {
      const shuffled = [...suggestionTopics].sort(() => Math.random() - 0.5);
      setFollowUps(shuffled.slice(0, 3));
    } else {
      setFollowUps([]);
    }
  }, [messages]);

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
    <div className="flex h-full bg-white">
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-[25%] min-w-[200px] max-w-xs' : 'w-0'} flex-shrink-0 bg-gray-50 border-r border-gray-200 transition-all duration-300 overflow-hidden flex flex-col`}>
        <div className="p-4">
          <button
            onClick={handleNewConversation}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            {t('chat.newConversation', 'New chat')}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
          {conversations.length === 0 && (
            <div className="px-3 py-8 text-center text-xs text-gray-400">
              {t('chat.noHistory', 'No previous conversations')}
            </div>
          )}
          {/* Pinned conversations */}
          {pinnedConvs.size > 0 && (
            <div>
              <div className="px-3 pt-4 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider flex items-center gap-1.5">
                <Pin className="w-3 h-3" /> {t('chat.pinned', 'Pinned')}
              </div>
              {conversations.filter(c => pinnedConvs.has(c.conversationId)).map(conv => renderConvItem(conv))}
            </div>
          )}
          {conversationGroups.map((group) => (
            <div key={group.label}>
              <div className="px-3 pt-4 pb-1 text-xs font-medium text-gray-400 uppercase tracking-wider">
                {group.label}
              </div>
              {group.conversations.filter(c => !pinnedConvs.has(c.conversationId)).map(conv => renderConvItem(conv))}
            </div>
          ))}
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar */}
        <div className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 bg-white/90 backdrop-blur-sm sticky top-0 z-10">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={sidebarOpen ? t('chat.hideHistory', 'Hide history') : t('chat.showHistory', 'Show history')}
            >
              {sidebarOpen ? <PanelLeftClose className="w-5 h-5" /> : <PanelLeft className="w-5 h-5" />}
            </button>
            <Bot className="w-5 h-5 text-gray-500" />
            <h1 className="text-sm font-medium text-gray-600">
              {t('chat.title', 'AI Assistant')}
            </h1>
              <span className="sm:inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 text-[11px] text-gray-500 bg-gray-100/60 rounded-full">
                <Globe className="w-3 h-3" />
                ERP Data · Advisory
              </span>
              {currentModel && (
                <span className="sm:inline-flex items-center gap-1.5 ml-2 px-2.5 py-1 text-[11px] text-gray-500 bg-gray-100/60 rounded-full ml-2">
                  <Bot className="w-3 h-3" />
                  <span className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${isModelReachable ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span>{currentModel}</span>
                  </span>
                </span>
              )}
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={handleNewConversation}
              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              title={t('chat.newConversation', 'New conversation')}
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Messages Container */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-3xl mx-auto w-full">
            {/* Welcome Screen */}
            {messages.length === 0 && !streamingContent && (
              <div className="flex flex-col items-center justify-center min-h-[50vh] px-4 py-12">
                <div className="w-20 h-20 mb-6 relative">
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl animate-pulse-slow opacity-30 blur-xl" />
                  <div className="relative w-full h-full bg-gradient-to-br from-blue-500 to-violet-600 rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                    <Sparkles className="w-10 h-10 text-white" />
                  </div>
                </div>
                <h1 className="text-3xl sm:text-4xl font-semibold text-gray-900 mb-3 tracking-tight text-center">
                  {t('chat.welcome', 'Welcome to AI Assistant')}
                </h1>
                <p className="text-gray-500 text-center max-w-md leading-relaxed mb-8">
                  {t('chat.welcomeDesc', 'Ask questions about your ERP data, get explanations, summaries, and suggestions. The assistant is advisory-only and cannot modify business records.')}
                </p>
                <QuickActionButtons
                  onSendMessage={(msg) => handleSend(msg)}
                  hasMessages={messages.length > 0}
                  compact={false}
                />
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
                    onContextMenu={e => handleContextMenu(e, msg.id)}
                    className={`flex gap-4 px-4 sm:px-6 lg:px-8 py-5 ${
                      msg.role === 'assistant' ? 'bg-gray-50/60' : 'bg-white'
                    } animate-fade-in`}
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
                      <div className="text-sm sm:text-base text-gray-800 leading-relaxed">
                        {msg.role === 'assistant' ? (
                          <MarkdownRenderer content={msg.content} />
                        ) : (
                          <div dir="auto">{msg.content}</div>
                        )}
                      </div>

                      {/* Meta badges row */}
                      {msg.role === 'assistant' && (
                        <div className="flex flex-wrap items-center gap-2 mt-3">
                          {(msg.provider || msg.model || msg.modelProfile) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100/60 px-2 py-1 text-[11px] text-gray-500">
                              <Info className="w-3 h-3" />
                              {formatModelProvider(msg)}
                            </span>
                          )}
                          {msg.modelProfile?.status && msg.modelProfile.status !== 'recommended' && msg.modelProfile.status !== 'CERTIFIED' && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-1 text-[11px] text-amber-700 border border-amber-100">
                              <AlertTriangle className="w-3 h-3" />
                              {formatModelStatus(msg.modelProfile.status)}
                            </span>
                          )}
                          {msg.modelProfile?.textOnlyMode && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-50 px-2 py-1 text-[11px] text-slate-600 border border-slate-100">
                              <Bot className="w-3 h-3" />
                              {t('chat.textOnlyMode', 'Text-only mode')}
                            </span>
                          )}
                          {((msg.toolResults && msg.toolResults.length > 0) || (msg.toolCallsRequested && msg.toolCallsRequested.length > 0)) && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-[11px] text-indigo-700 border border-indigo-100">
                              <Wrench className="w-3 h-3" />
                              {t('chat.toolsUsed', 'Tools used')}
                            </span>
                          )}
                          {msg.durationMs != null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100/60 px-2 py-1 text-[11px] text-gray-500">
                              <Clock className="w-3 h-3" />
                              {msg.durationMs < 1000
                                ? `${msg.durationMs}ms`
                                : `${(msg.durationMs / 1000).toFixed(1)}s`}
                            </span>
                          )}
                          {msg.usage?.totalTokens != null && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-gray-100/60 px-2 py-1 text-[11px] text-gray-500" title={`Prompt: ${msg.usage.promptTokens ?? '?'} · Completion: ${msg.usage.completionTokens ?? '?'}`}>
                              <Sparkles className="w-3 h-3" />
                              {msg.usage.totalTokens.toLocaleString()} tokens
                            </span>
                          )}
                          {msg.creditsUsed != null && msg.creditsUsed > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[11px] text-emerald-700 border border-emerald-100">
                              <Sparkles className="w-3 h-3" />
                              {msg.creditsUsed} {msg.creditsUsed === 1 ? 'credit' : 'credits'}
                            </span>
                          )}
                        </div>
                      )}

                      {/* Runtime Warnings */}
                      {msg.role === 'assistant' && getVisibleRuntimeWarnings(msg).length > 0 && (
                        <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                          <div className="flex items-center gap-1.5 font-medium mb-1">
                            <AlertTriangle className="w-3.5 h-3.5" />
                            {t('chat.runtimeWarning', 'Runtime warning')}
                          </div>
                          <ul className="list-disc pl-5 rtl:pl-0 rtl:pr-5 space-y-1">
                            {getVisibleRuntimeWarnings(msg).map((warning, index) => (
                              <li key={`${msg.id}-warning-${index}`}>{warning}</li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Clarification */}
                      {msg.role === 'assistant' && isClarificationMessage(msg) && (
                        <div className="mt-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                          <div className="flex items-center gap-1.5 font-medium mb-1">
                            <Info className="w-3.5 h-3.5" />
                            {t('chat.clarificationTitle', 'AI needs more information')}
                          </div>
                          <div>{t('chat.clarificationPrompt', 'Please provide the requested details before any tool execution or proposal can continue.')}</div>
                        </div>
                      )}

                      {/* Tool Results */}
                      {msg.role === 'assistant' && msg.toolResults && msg.toolResults.length > 0 && (
                        <AiToolResultsPanel toolResults={msg.toolResults} />
                      )}

                      {/* Proposal Card */}
                      {msg.role === 'assistant' && msg.proposal && (
                        <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <FileText className="w-4 h-4 text-blue-600" />
                            <span className="text-sm font-medium text-blue-800">
                              {t('proposals.sandboxBadge', 'AI Proposal · Sandbox · No ERP changes')}
                            </span>
                          </div>
                          <Link
                            to={`/ai-assistant/proposals/${msg.proposal.id}`}
                            className="text-sm text-blue-600 hover:underline font-medium"
                          >
                            {msg.proposal.title}
                          </Link>
                          <p className="text-xs text-blue-600 mt-1">
                            {t(`proposals.status.${msg.proposal.status}`, msg.proposal.status)} · {t('proposals.table.risk', 'Risk')}: {t(`proposals.risk.${msg.proposal.riskLevel}`, msg.proposal.riskLevel)}
                          </p>
                        </div>
                      )}

                      {/* Provider Error */}
                      {msg.isProviderError && msg.role === 'assistant' && (
                        <div className="mt-3 pt-2 border-t border-amber-100">
                          <Link
                            to="/ai-assistant/settings"
                            className="inline-flex items-center gap-1.5 text-sm text-amber-700 hover:text-amber-800 hover:underline font-medium"
                          >
                            <AlertCircle className="w-4 h-4" />
                            {t('chat.checkSettingsAndDiag', 'Check AI Settings & Run Diagnostics')}
                          </Link>
                        </div>
                      )}

                      {/* Copy + Timestamp footer */}
                      <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-[11px] text-gray-400">
                          {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {msg.role === 'assistant' && (
                          <button
                            onClick={() => copyToClipboard(msg.content, msg.id)}
                            className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
                          >
                            {copiedId === msg.id ? (
                              <><Check className="w-3 h-3" /> {t(`Copied`)}</>
                            ) : (
                              <><Copy className="w-3 h-3" /> {t(`Copy`)}</>
                            )}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Thinking / Status Indicator */}
              {streamingStage && !streamingContent && (
                <div className="flex gap-4 px-4 sm:px-6 lg:px-8 py-5 bg-gray-50/60 animate-fade-in">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <Spinner size="sm" variant="indigo" />
                    <span className="text-sm text-gray-500 animate-pulse">
                      {streamingStage === 'thinking' && t('chat.status.thinking', 'Thinking...')}
                      {streamingStage === 'fetching_data' && t('chat.status.fetchingData', 'Fetching data...')}
                      {streamingStage === 'analyzing' && t('chat.status.analyzing', 'Analyzing...')}
                      {streamingStage === 'generating' && t('chat.status.generating', 'Generating response...')}
                    </span>
                  </div>
                </div>
              )}

              {/* Streaming Content */}
              {streamingContent && (
                <div className="flex gap-4 px-4 sm:px-6 lg:px-8 py-5 bg-gray-50/60 animate-fade-in">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center shadow-sm">
                      <Bot className="w-4 h-4 text-white" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0 pt-0.5">
                    <div className="text-sm sm:text-base text-gray-800 leading-relaxed">
                      <MarkdownRenderer content={streamingContent} />
                      <span className="inline-block w-[3px] h-[1.1em] bg-blue-500 animate-pulse align-text-bottom ml-0.5 rounded-sm" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Follow-up suggestions after last assistant message */}
            {followUps.length > 0 && !streamingContent && (
              <div className="px-4 sm:px-6 lg:px-8 pb-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[11px] text-gray-400 font-medium mr-1">{t('chat.followUp', 'Follow up')}:</span>
                  {followUps.map((q, i) => (
                    <button
                      key={i}
                      onClick={() => handleSend(q)}
                      className="px-3 py-1.5 text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full hover:bg-gray-100 hover:border-gray-300 hover:text-gray-700 transition-all"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Context Menu Overlay */}
        {contextMenu && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-lg py-1 min-w-[160px] animate-fade-in"
            style={{ left: contextMenu.x, top: contextMenu.y }}
            onClick={e => e.stopPropagation()}
          >
            {contextMenu.msgId.startsWith('conv') ? (
              // Conversation context menu
              <>
                <button onClick={() => { handleRenameConv(contextMenu.msgId, conversations.find(c => c.conversationId === contextMenu.msgId)?.title || ''); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <Edit3 className="w-4 h-4" /> Rename
                </button>
                <button onClick={() => { handleTogglePinConv(contextMenu.msgId); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  {pinnedConvs.has(contextMenu.msgId) ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  {pinnedConvs.has(contextMenu.msgId) ? 'Unpin' : 'Pin'}
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { handleDeleteConversation(contextMenu.msgId); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </>
            ) : (
              // Message context menu
              <>
                <button onClick={() => { copyToClipboard(messages.find(m => m.id === contextMenu.msgId)?.content || '', contextMenu.msgId); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <Copy className="w-4 h-4" /> {copiedId === contextMenu.msgId ? 'Copied' : 'Copy'}
                </button>
                <button onClick={() => { handleTogglePinMsg(contextMenu.msgId); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  {pinnedIds.has(contextMenu.msgId) ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                  {pinnedIds.has(contextMenu.msgId) ? 'Unpin' : 'Pin'}
                </button>
                <button onClick={() => { handleDownloadMsg(messages.find(m => m.id === contextMenu.msgId)?.content || ''); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors">
                  <Download className="w-4 h-4" /> Download
                </button>
                <div className="border-t border-gray-100 my-1" />
                <button onClick={() => { setMessages(prev => prev.filter(m => m.id !== contextMenu.msgId)); setContextMenu(null); }} className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors">
                  <Trash2 className="w-4 h-4" /> Delete
                </button>
              </>
            )}
          </div>
        )}

        {/* Input Bar */}
        <div className="border-t border-gray-100 bg-white">
          <div className="max-w-3xl mx-auto w-full px-4 py-3">
            {error && (
              <div className="mb-3 px-4 py-2.5 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 shadow-sm">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <div className="relative bg-white border border-gray-300 rounded-2xl shadow-sm focus-within:border-gray-400 focus-within:shadow-md transition-all">
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
                className={`block w-full max-h-[200px] min-h-[52px] py-3 bg-transparent border-none outline-none focus:ring-0 resize-none disabled:opacity-50 text-sm leading-relaxed rounded-2xl ${
                  isRtl ? 'pl-28 pr-3 pb-12' : 'pr-28 pl-3 pb-12'
                }`}
              />
              {/* Gradient fade covering button area */}
              <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-white via-white/90 to-transparent pointer-events-none rounded-b-2xl z-[1]" />
              {/* Attachment — opposite side from send */}
              <div className={`absolute bottom-1.5 flex items-center z-[2] ${isRtl ? 'right-1.5' : 'left-1.5'}`}>
                <button
                  className="w-9 h-9 rounded-xl transition-all flex items-center justify-center text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                  title={t('chat.upload', 'Upload file')}
                >
                  <Paperclip className="w-[18px] h-[18px]" />
                </button>
              </div>
              {/* Mic + Send — always on the reading-direction side (right for LTR, left for RTL) */}
              <div className={`absolute bottom-1.5 flex items-center gap-0.5 z-[2] ${isRtl ? 'left-1.5' : 'right-1.5'}`}>
                <button
                  onClick={toggleRecording}
                  className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center ${
                    isRecording
                      ? 'bg-red-500 text-white animate-pulse shadow-lg'
                      : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'
                  }`}
                  title="Voice Message"
                >
                  <Mic className="w-[18px] h-[18px]" />
                </button>
                <button
                  onClick={() => handleSend()}
                  disabled={isLoading || !input.trim()}
                  className={`w-9 h-9 rounded-xl transition-all flex items-center justify-center ${
                    input.trim()
                      ? 'bg-gray-800 text-white hover:bg-gray-700 shadow-sm'
                      : 'text-gray-300 cursor-not-allowed'
                  }`}
                >
                  <Send className={`w-[18px] h-[18px] ${isRtl ? 'scale-x-[-1]' : ''}`} />
                </button>
              </div>
            </div>
            {/* Rotating hints — show until first message sent */}
            {!hasSentFirst && !streamingContent && (
              <div className="flex items-center justify-center gap-2 mt-2.5">
                <Lightbulb className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                <span className="text-xs text-gray-400 animate-fade-in" key={hintIdx}>
                  {hints[hintIdx]}
                </span>
              </div>
            )}
            {hasSentFirst && (
              <p className="text-[11px] text-gray-400 text-center mt-2.5">
                {t('chat.disclaimer', 'AI responses are advisory-only. They cannot create, modify, or delete business records.')}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AiAssistantHomePage;
