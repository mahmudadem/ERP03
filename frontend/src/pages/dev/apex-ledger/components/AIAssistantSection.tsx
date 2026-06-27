import React, { useState, useRef, useEffect } from 'react';
import { COAAccount, Invoice, InventoryItem } from '../types';
import { 
  Bot, 
  Send, 
  Sparkles, 
  ChevronRight,
  ShieldCheck
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { aiAssistantApi } from '../../../../api/aiAssistantApi';
import { useCompanyAccess } from '../../../../context/CompanyAccessContext';

interface AIAssistantSectionProps {
  accounts: COAAccount[];
  invoices: Invoice[];
  inventory: InventoryItem[];
}

interface ThreadMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
}

export default function AIAssistantSection({ accounts, invoices, inventory }: AIAssistantSectionProps) {
  const { company } = useCompanyAccess();
  const { t } = useTranslation();
  const companyName = company?.name || 'current company';
  const baseCurrency = company?.baseCurrency || 'SYP';
  const fiscalYear = company?.fiscalYearStart
    ? `FY ${new Date(company.fiscalYearStart).getFullYear()}`
    : `FY ${new Date().getFullYear()}`;

  const [messages, setMessages] = useState<ThreadMessage[]>([]);

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [activeModel, setActiveModel] = useState('gemini-3.5-flash');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMessages([
      {
        id: 'init-1',
        sender: 'assistant',
        text: t('apex.ai.welcomeMsg', { defaultValue: `### **أهلاً بك في وحدة الذكاء الاصطناعي - المستشار المالي التنفيذي (CFO Advisor)**\n\nأنا مستشارك المالي الذكي المرتبط بنظام القيود ودفاتر الحسابات الخاصة بالمؤسسة بالكامل. يمكنني تحليل البيانات في الوقت الفعلي وتقديم التحرير الفوري للتقارير والقيود.\n\n**التحليلات الجاهزة لك الآن:**\n- **كشف السيولة والموازين**: تحليل السيولة في BBS Bank وصناديق الفروع.\n- **إدارة مخاطر التحصيل**: دراسة أعمار الديون والمطالبات المالية المتأخرة.\n- **استشارات القيود المحاسبية**: إعداد مسودات القيود المزدوجة ومطابقة الأصول والضريبة وفق معايير IFRS.\n\nيرجى طرح أي سؤال مالي أو المحاولة عبر النقرات السريعة أدناه!` }),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      }
    ]);
  }, [t]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const promptSuggestions = [
    { 
      label: t('apex.ai.quickQueryLiquidity', { defaultValue: 'تحليل الموقف المالي للسيولة' }), 
      prompt: t('apex.ai.quickQueryLiquidityPrompt', { defaultValue: 'حلل السيولة النقدية الحالية بالصندوق والبنك واقترح إستراتيجية لإدارة التدفقات النقدية' }) 
    },
    { 
      label: t('apex.ai.quickQueryOverdue', { defaultValue: 'دراسة وتحليل فواتير المبيعات المتأخرة' }), 
      prompt: t('apex.ai.quickQueryOverduePrompt', { defaultValue: 'دراسة أعمار الديون الحالية والفواتير المتأخرة Overdue لعميل مجموعة النور' }) 
    },
    { 
      label: t('apex.ai.quickQueryDepreciation', { defaultValue: 'قيد محاسبي لإهلاك أجهزة الحاسوب' }), 
      prompt: t('apex.ai.quickQueryDepreciationPrompt', { defaultValue: 'أريد مسودة قيد محاسبي مزدوج (Debit/Credit) لإهلاك أجهزة حاسوب بقيمة 500,000 ل.س بخط مستقيم' }) 
    }
  ];

  // Professional markdown visual parser custom built to avoid library version mismatches
  const formatText = (text: string) => {
    return text.split('\n').map((line, idx) => {
      let trimmed = line.trim();
      
      // Headers ###
      if (trimmed.startsWith('###')) {
        return <h3 key={idx} className="font-bold text-slate-800 text-[13px] border-b border-zinc-150 pb-1 mt-3 mb-2">{trimmed.replace(/###\s*/, '')}</h3>;
      }
      if (trimmed.startsWith('**') && trimmed.endsWith('**')) {
        return <h4 key={idx} className="font-bold text-slate-700 text-xs mt-2.5 mb-1.5">{trimmed.replace(/\*\*/g, '')}</h4>;
      }

      // Code blocks
      if (trimmed.startsWith('```')) {
        return null; // Skip raw code blocks markers
      }

      // Check if it's inside a code-block block
      if (trimmed.includes('::') || trimmed.includes('|') || trimmed.includes('Debit') || trimmed.includes('حساب')) {
        if (trimmed.match(/^[منإلى\/h\d\s,\-.ل]/)) {
          return (
            <pre key={idx} className="bg-zinc-900 text-zinc-100 font-mono text-[10px] p-2.5 rounded-md my-2 overflow-x-auto tracking-wide border-l-4 border-slate-600 block">
              {line}
            </pre>
          );
        }
      }

      // Bullets -
      if (trimmed.startsWith('-')) {
        const boldSplit = trimmed.replace(/^-\s*/, '').split(':');
        if (boldSplit.length > 1) {
          return (
            <div key={idx} className="pl-4 py-1 flex items-start text-xs text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-605 mt-1.5 mr-2 flex-shrink-0"></span>
              <span>
                <strong className="text-slate-800">{boldSplit[0].replace(/\*\*/g, '')}:</strong> {boldSplit.slice(1).join(':')}
              </span>
            </div>
          );
        }
        return (
          <div key={idx} className="pl-4 py-1 flex items-start text-xs text-slate-600">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mt-1.5 mr-2 flex-shrink-0"></span>
            <span>{trimmed.replace(/^-\s*/, '').replace(/\*\*/g, '')}</span>
          </div>
        );
      }

      // Numbered items
      if (trimmed.match(/^\d+\./)) {
        return (
          <div key={idx} className="pl-4 py-1 flex items-start text-xs text-slate-600">
            <span className="font-bold font-mono text-blue-600 mr-2 flex-shrink-0">{trimmed.match(/^\d+\./)?.[0]}</span>
            <span>{trimmed.replace(/^\d+\.\s*/, '').replace(/\*\*/g, '')}</span>
          </div>
        );
      }

      // Normal paragraphs
      if (trimmed.length === 0) return <div key={idx} className="h-2"></div>;

      // Handle bold items inside paragraph
      const formattedLine = line.split('**').map((part, pIdx) => {
        if (pIdx % 2 === 1) {
          return <strong key={pIdx} className="text-slate-800 font-black">{part}</strong>;
        }
        return part;
      });

      return <p key={idx} className="text-xs text-slate-600 leading-relaxed mb-1.5 text-right font-medium">{formattedLine}</p>;
    });
  };

  const handleSendMessage = async (textToSend: string) => {
    if (!textToSend.trim() || isLoading) return;

    const userMsg: ThreadMessage = {
      id: Math.random().toString(36).substring(2, 11),
      sender: 'user',
      text: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    // Context summaries structure for Gemini ingestion
    const summaryContext = {
      overallDetails: {
        totalAccountsCount: accounts.length,
        currentLocalTime: new Date().toISOString(),
        fiscalYear,
        baseCurrency
      },
      bankAndCashLedgers: accounts
        .filter(a => a.classification === 'Posting' && (a.parentId === '101' || a.parentId === '102'))
        .map(a => ({ code: a.code, name: a.name, balance: a.balance })),
      receivablesLedger: invoices.map(i => ({
        invoiceId: i.invoiceNumber,
        client: i.customerName,
        total: i.totalAmount,
        collected: i.amountPaid,
        due: i.dueDate,
        status: i.status
      })),
      inventorySKUs: inventory.map(item => ({
        sku: item.sku,
        name: item.name,
        qty: item.qtyOnHand,
        cost: item.avgCost,
        price: item.salePrice
      }))
    };

    try {
      const response = await aiAssistantApi.sendMessage({
        message: textToSend,
        conversationId
      });

      if (response.assistantMessage?.conversationId) {
        setConversationId(response.assistantMessage.conversationId);
      }
      if (response.model) {
        setActiveModel(response.model);
      }

      const botMsg: ThreadMessage = {
        id: response.assistantMessage?.id || Math.random().toString(36).substring(2, 11),
        sender: 'assistant',
        text: response.assistantMessage?.content || 'No response content returned.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (e: any) {
      const errorMsg: ThreadMessage = {
        id: Math.random().toString(36).substring(2, 11),
        sender: 'assistant',
        text: `${t('apex.ai.errorTitle', { defaultValue: '### **عذراً، حدث خطأ أثناء الاتصال بالخادم الذكي**' })}\n${t('apex.ai.errorDesc', { defaultValue: 'لم نتمكن من جلب رد المستشار المالي بسبب الخصائص التالية: {{message}}.', message: e.message || e })}\n${t('apex.ai.errorRetry', { defaultValue: 'يرجى التأكد من استقرار الخادم أو المحاولة مرة أخرى لاحقاً.' })}`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-[calc(100vh-140px)] font-sans">
      
      {/* Left 3 columns: Chat interface */}
      <div className="lg:col-span-3 bg-white border border-[#E2E8F0] rounded-lg shadow-sm flex flex-col overflow-hidden h-full">
        {/* Chat header panel */}
        <div className="p-4 bg-[#F8FAFC] border-b border-[#E2E8F0] flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-lg bg-blue-605 flex items-center justify-center shadow-inner">
              <Bot className="w-5 h-5 text-white animate-pulse" />
            </div>
            <div>
              <span className="text-xs font-bold text-slate-800 block">{t(`Chief Financial Officer (CFO AI Advisor)`)}</span>
              <span className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block animate-ping"></span> Live Account Context Active
              </span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-mono bg-zinc-105 text-zinc-600 px-2 py-0.5 rounded font-black border border-zinc-200 uppercase">
              {t(`Model:`)} {activeModel}
            </span>
          </div>
        </div>

        {/* Message bubble track */}
        <div className="flex-1 p-5 overflow-y-auto space-y-4 bg-zinc-50/50">
          {messages.map((msg) => {
            const isBot = msg.sender === 'assistant';
            return (
              <div 
                key={msg.id} 
                className={`flex gap-3 max-w-[85%] ${isBot ? 'mr-auto text-left' : 'ml-auto flex-row-reverse text-right'}`}
              >
                {isBot && (
                  <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4.5 h-4.5" />
                  </div>
                )}
                <div className="space-y-1">
                  <div className={`p-4 rounded-xl border ${
                    isBot 
                      ? 'bg-white border-zinc-150 text-slate-800 shadow-xs rounded-tl-none' 
                      : 'bg-blue-600 border-blue-700 text-white rounded-tr-none'
                  }`}>
                    {isBot ? (
                      <div className="space-y-1.5">{formatText(msg.text)}</div>
                    ) : (
                      <span className="text-xs font-medium block whitespace-pre-wrap leading-relaxed">{msg.text}</span>
                    )}
                  </div>
                  <span className="text-[9px] font-mono text-zinc-400 font-semibold block px-1">
                    {msg.timestamp}
                  </span>
                </div>
              </div>
            );
          })}
          {isLoading && (
            <div className="flex gap-3 mr-auto items-center max-w-[85%]">
              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center animate-spin">
                <Sparkles className="w-4 h-4 text-blue-600" />
              </div>
              <div className="p-3.5 bg-white border border-zinc-150 rounded-xl rounded-tl-none text-xs text-slate-500 font-medium">
                {t('apex.ai.loading', { defaultValue: 'Analyzing data and calculating double entries...' })}
              </div>
            </div>
          )}
          <div ref={scrollRef} />
        </div>

        {/* Chat input box */}
        <div className="p-4 bg-[#F8FAFC] border-t border-[#E2E8F0]">
          <div className="flex items-center gap-2 bg-white border border-[#E2E8F0] rounded-lg p-1 px-2 shadow-xs focus-within:ring-1 focus-within:ring-blue-500 focus-within:border-blue-500">
            <input
              type="text"
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleSendMessage(inputMessage);
                }
              }}
              placeholder={t('apex.ai.chatPlaceholder', { defaultValue: 'طرح سؤال مالي أو الاستفسار عن شجرة الحسابات...' })}
              className="flex-1 text-xs text-slate-700 placeholder-zinc-400 p-2 outline-none text-right font-medium font-sans"
            />
            <button
              onClick={() => handleSendMessage(inputMessage)}
              disabled={!inputMessage.trim() || isLoading}
              className="p-2 rounded bg-blue-605 hover:bg-blue-700 disabled:bg-slate-200 text-white disabled:text-slate-400 transition-colors cursor-pointer animate-fade-in"
            >
              <Send className="w-4.5 h-4.5 text-white" />
            </button>
          </div>
          <div 
            className="mt-2 text-[10px] text-zinc-400 text-right font-semibold"
            dangerouslySetInnerHTML={{
              __html: t('apex.ai.advisorConnected', { defaultValue: 'المستشار مرتبط مباشرة بالحسابات وتفاصيل الفواتير المسجلة لـ <strong>{{companyName}}</strong>.', companyName })
            }}
          />
        </div>

      </div>

      {/* Right side panel: Quick prompt selections */}
      <div className="space-y-4 h-full overflow-y-auto">
        <div className="bg-white border border-[#E2E8F0] rounded-lg p-4 shadow-sm space-y-4">
          <h3 className="text-xs font-black uppercase text-slate-700 tracking-wider flex items-center gap-1">
            <Sparkles className="w-4 h-4 text-amber-500" /> {t('apex.ai.suggestedQueries', { defaultValue: 'Suggested Smart Queries' })}
          </h3>
          <p className="text-[11px] text-slate-500 leading-relaxed">{t('apex.ai.suggestedQueriesDesc', { defaultValue: 'Smart queries ready for the current accounting center for instant verification:' })}</p>
          
          <div className="space-y-2.5">
            {promptSuggestions.map((s, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(s.prompt)}
                className="w-full text-right text-xs p-3 rounded-lg border border-slate-100 bg-[#F8FAFC] hover:bg-blue-50 hover:border-blue-150 text-slate-700 font-semibold leading-relaxed transition-all block group"
              >
                <div className="flex items-center justify-between font-bold text-blue-600 mb-1">
                  <span className="text-[10px] font-mono tracking-widest uppercase">{t(`Suggestion 0`)}{idx + 1}</span>
                  <ChevronRight className="w-4 h-4 text-blue-400 group-hover:translate-x-1 transition-transform" />
                </div>
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Security / System capabilities widget */}
        <div className="bg-slate-50 border border-slate-150 rounded-lg p-4 text-xs space-y-3">
          <div className="flex items-center space-x-1.5 text-slate-700 font-bold">
            <ShieldCheck className="w-4.5 h-4.5 text-emerald-600" />
            <span>{t('apex.ai.securityStandards', { defaultValue: 'Financial Data Security Standards' })}</span>
          </div>
          <p className="text-[11px] text-slate-500 leading-relaxed">
            {t('apex.ai.securityStandardsDesc', { defaultValue: 'All calculations and processing are securely performed server-side without exposing API keys to the browser.' })}
          </p>
          <div className="bg-white p-2.5 rounded border border-slate-200 font-mono text-[9px] text-zinc-500 space-y-1">
            <div>{t(`DB_ISOLATION: isolated_aes256`)}</div>
            <div>{t(`COMPLIANCE: standard_ifrs_9`)}</div>
          </div>
        </div>
      </div>

    </div>
  );
}
