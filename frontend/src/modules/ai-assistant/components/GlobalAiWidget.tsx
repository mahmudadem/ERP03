import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Send, Bot, User, Trash2, AlertTriangle, Info, Plus, MessageSquare, Clock, Sparkles, Database, FileText, Wrench, Menu, ArrowUp, PanelLeftClose, PanelLeftOpen, PanelRight, Maximize2, X, Mic } from 'lucide-react';
import { useLocation } from 'react-router-dom';
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
import { useRBAC } from '../../../api/rbac/useRBAC';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { AiToolResultsPanel } from '../components/AiToolResultsPanel';
import { MarkdownRenderer } from '../components/MarkdownRenderer';
import { FeedbackButtons } from '../components/FeedbackButtons';
import { AiErrorDisplay } from '../components/AiErrorDisplay';
import { QuickActionButtons } from './QuickActionButtons';

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
}

export const GlobalAiWidget: React.FC = () => {
  const { t, i18n } = useTranslation('aiAssistant');
  const { hasPermission, isOwner, isSuperAdmin } = useRBAC();
  const { permissionsLoaded } = useCompanyAccess();
  const location = useLocation();

  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [view, setView] = useState<'chat' | 'history'>('chat');
  const [isOpen, setIsOpen] = useState(() => localStorage.getItem('ai_widget_open') === 'true');

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    localStorage.setItem('ai_widget_open', String(isOpen));
  }, [isOpen]);

  const canChat = hasPermission('ai-assistant.chat.use');
  const isAiPage = location.pathname.startsWith('/ai-assistant');

  // Load latest conversation on mount or when ID changes
  const loadConversation = useCallback(async (id: string) => {
    try {
      setIsLoading(true);
      const { messages: history } = await aiAssistantApi.getConversationMessages(id);
      setMessages(history.map(m => ({
        id: m.id,
        role: m.role,
        content: m.content,
        timestamp: m.createdAt,
        modelProfile: m.metadata?.modelProfile,
        toolResults: m.metadata?.toolCallResults?.map((tr: any) => ({
          toolName: tr.toolName,
          approved: tr.approved,
          rejectionReason: tr.rejectionReason,
          result: tr.result || {} // Provide required result field
        })),
        proposal: m.metadata?.proposal,
      })));
      setConversationId(id);
    } catch (err) {
      console.error('Failed to load conversation', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Fetch initial state and conversations
  useEffect(() => {
    if (canChat || isOwner || isSuperAdmin) {
      aiAssistantApi.getRecentConversations(20).then(({ conversations: convs }) => {
        setConversations(convs);
        if (convs.length > 0 && messages.length === 0) {
          loadConversation(convs[0].conversationId);
        }
      }).catch(console.error);
    }
  }, [canChat, isOwner, isSuperAdmin, loadConversation]);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const handleSendMessage = useCallback(async (textOverride?: string) => {
    const text = textOverride || input;
    if (!text.trim() || isLoading) return;

    const userMsg: DisplayMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);
    setError(null);

    try {
      let assistantContent = '';
      const assistantMsgId = (Date.now() + 1).toString();
      setStreamingContent('');

      await streamMessage(
        {
          message: text,
          conversationId,
        },
        (event: AiStreamEvent) => {
          if (event.type === 'token') {
            console.log('[AI] Token received:', event.content);
            assistantContent += event.content;
            setStreamingContent(assistantContent);
          } else if (event.type === 'done') {
            console.log('[AI] Stream done', event.metadata);
            setConversationId(event.metadata?.runtimeMeta?.conversationId);
            const finalContent = assistantContent;
            setStreamingContent('');
            
            setMessages(prev => {
              const assistantMsg: DisplayMessage = {
                id: assistantMsgId,
                role: 'assistant',
                content: finalContent,
                timestamp: new Date().toISOString(),
                modelProfile: (event as any).metadata?.runtimeMeta?.modelProfile,
                toolResults: (event as any).metadata?.runtimeMeta?.toolResults?.map((tr: any) => ({
                  toolName: tr.toolName,
                  approved: tr.approved,
                  rejectionReason: tr.rejectionReason,
                  result: tr.result || {}
                })),
                proposal: (event as any).metadata?.runtimeMeta?.proposal,
                runtimeWarnings: (event as any).metadata?.runtimeMeta?.runtimeWarnings
              };
              return [...prev, assistantMsg];
            });
          } else if (event.type === 'error') {
            console.error('[AI] Stream error:', event.message);
            setError(event.message);
            setStreamingContent('');
          }
        }
      );
    } catch (err) {
      console.error('Failed to send message', err);
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, conversationId]);

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
  }, [isRecording]);

  const startNewChat = () => {
    setMessages([]);
    setConversationId(undefined);
    setError(null);
  };

  if ((!canChat && !isOwner && !isSuperAdmin) || isAiPage) {
    return null;
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 rtl:right-auto rtl:left-6 z-[99999] w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl hover:scale-110 transition-all flex items-center justify-center group"
      >
        <MessageSquare className="w-7 h-7" />
        <span className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 border-2 border-white rounded-full"></span>
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 rtl:right-auto rtl:left-6 z-[99999] w-[420px] h-[650px] max-h-[85vh] bg-white rounded-2xl shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex flex-col overflow-hidden border border-gray-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-4 flex items-center justify-between text-white">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
            <Bot className="w-6 h-6" />
          </div>
          <div>
            <h3 className="font-bold text-sm">Global AI Assistant</h3>
            <p className="text-[10px] opacity-80">Online & Ready</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setView(view === 'history' ? 'chat' : 'history')} className="p-2 hover:bg-white/10 rounded-lg" title="History">
            <Clock className="w-4 h-4" />
          </button>
          <button onClick={startNewChat} className="p-2 hover:bg-white/10 rounded-lg" title="New Chat">
            <Plus className="w-4 h-4" />
          </button>
          <button onClick={() => setIsOpen(false)} className="p-2 hover:bg-white/10 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* History View */}
      {view === 'history' && (
        <div className="flex-1 overflow-y-auto bg-white p-2">
          <h4 className="text-xs font-bold text-gray-400 px-3 py-2 uppercase tracking-wider">Recent Conversations</h4>
          <div className="space-y-1">
            {conversations.map(c => (
              <button
                key={c.conversationId}
                onClick={() => {
                  loadConversation(c.conversationId);
                  setView('chat');
                }}
                className={`w-full text-left p-3 rounded-xl hover:bg-indigo-50 transition-colors flex items-center gap-3 group ${conversationId === c.conversationId ? 'bg-indigo-50 border border-indigo-100' : ''}`}
              >
                <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 group-hover:bg-white group-hover:text-indigo-500 transition-colors">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-700 truncate">{c.title || 'Untitled Conversation'}</p>
                  <p className="text-[10px] text-gray-400">{c.lastMessageAt ? new Date(c.lastMessageAt).toLocaleDateString() : 'New chat'}</p>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Chat View */}
      {view === 'chat' && (
        <>
          <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-gray-50/50 scroll-smooth">
        {messages.length === 0 && !isLoading && (
          <div className="space-y-6">
            <div className="text-center py-4">
              <Sparkles className="w-10 h-10 text-indigo-500 mx-auto mb-2 opacity-50" />
              <p className="text-sm text-gray-500">{t('chat.welcome', 'How can I assist you today?')}</p>
            </div>
            <QuickActionButtons 
              onSendMessage={(text) => handleSendMessage(text)} 
              hasMessages={messages.length > 0} 
              compact={true} 
            />
          </div>
        )}

        {messages.map((msg) => (
          <div key={msg.id} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
            <div className={`max-w-[90%] p-4 rounded-2xl text-sm ${
              msg.role === 'user'
                ? 'bg-indigo-600 text-white rounded-tr-none shadow-indigo-200 shadow-lg'
                : 'bg-white text-gray-800 rounded-tl-none shadow-sm border border-gray-100'
            }`}>
              <MarkdownRenderer content={msg.content} />
              
              {msg.toolResults && msg.toolResults.length > 0 && (
                <div className="mt-3">
                  <AiToolResultsPanel toolResults={msg.toolResults} />
                </div>
              )}
            </div>
            <span className="text-[9px] text-gray-400 mt-1 px-1">
              {msg.role === 'assistant' ? 'AI Assistant' : 'You'}
            </span>
          </div>
        ))}

        {streamingContent && (
          <div className="flex flex-col items-start animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="max-w-[90%] p-4 rounded-2xl text-sm bg-white text-gray-800 rounded-tl-none shadow-sm border border-indigo-100 ring-1 ring-indigo-500/10">
              <div className="flex items-center gap-2 mb-2 text-indigo-500">
                <Bot className="w-3.5 h-3.5 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-wider">AI Assistant is typing...</span>
              </div>
              <div className="text-sm leading-relaxed whitespace-pre-wrap text-gray-800 font-sans">
                {streamingContent}
                <span className="inline-block w-1.5 h-4 ml-0.5 bg-indigo-400 animate-pulse align-middle" />
              </div>
            </div>
          </div>
        )}

        {isLoading && !streamingContent && (
          <div className="flex items-center gap-2 text-indigo-500 animate-pulse text-xs">
            <Bot className="w-4 h-4" />
            <span>AI is thinking...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
        </div>

        {/* Input area - only show in chat view */}
        {error && <div className="px-4 py-2 bg-red-50 text-red-600 text-[10px] border-t border-red-100">{error}</div>}
        <div className="p-4 bg-white border-t border-gray-100">
          <div className="relative flex items-center">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="Ask anything..."
              className="w-full pl-4 pr-20 py-3 bg-gray-50 border-none rounded-xl text-sm resize-none focus:ring-2 focus:ring-indigo-500/20 max-h-32"
            />
            <div className="absolute right-2 flex items-center gap-1">
              <button
                onClick={toggleRecording}
                className={`p-2 rounded-lg transition-all ${
                  isRecording 
                    ? 'bg-red-500 text-white animate-pulse shadow-lg' 
                    : 'text-gray-400 hover:bg-gray-100'
                }`}
                title="Voice Message"
              >
                <Mic className="w-4 h-4" />
              </button>
              <button
                onClick={() => handleSendMessage()}
                disabled={isLoading || !input.trim()}
                className="p-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-30 transition-all shadow-md"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </>
    )}
    </div>
  );
};
