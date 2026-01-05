/**
 * InstructionsModal - Reusable Instructions Panel Component
 * 
 * Displays contextual operational guidance for any ERP page.
 * Uses a slide-over panel design for non-intrusive help access.
 */

import React from 'react';
import { X, AlertTriangle, Lightbulb, HelpCircle } from 'lucide-react';
import { PageInstructions } from './types';

interface InstructionsModalProps {
  /** Whether the modal is visible */
  isOpen: boolean;
  /** Callback to close the modal */
  onClose: () => void;
  /** The instructions content to display */
  instructions: PageInstructions;
}

/**
 * Renders markdown-like content with basic formatting
 * Supports: **bold**, bullet points (•), line breaks
 */
function renderContent(content: string): React.ReactNode {
  // Split by double newline for paragraphs
  const paragraphs = content.split('\n\n');
  
  return paragraphs.map((para, idx) => {
    // Handle bullet points
    if (para.includes('\n•') || para.startsWith('•')) {
      const lines = para.split('\n');
      return (
        <div key={idx} className="mb-3">
          {lines.map((line, lineIdx) => {
            if (line.startsWith('•')) {
              return (
                <div key={lineIdx} className="flex items-start gap-2 ml-2 mb-1">
                  <span className="text-indigo-500 dark:text-indigo-400 mt-1">•</span>
                  <span>{formatBold(line.slice(1).trim())}</span>
                </div>
              );
            }
            return <p key={lineIdx} className="font-semibold text-gray-800 dark:text-[var(--color-text-primary)] mb-1">{formatBold(line)}</p>;
          })}
        </div>
      );
    }
    
    // Regular paragraph
    return <p key={idx} className="mb-3 text-gray-600 dark:text-[var(--color-text-secondary)]">{formatBold(para)}</p>;
  });
}

/**
 * Converts **text** to bold spans
 */
function formatBold(text: string): React.ReactNode {
  const parts = text.split(/\*\*(.*?)\*\*/g);
  return parts.map((part, idx) => 
    idx % 2 === 1 ? <strong key={idx} className="font-semibold text-gray-800 dark:text-[var(--color-text-primary)]">{part}</strong> : part
  );
}

export const InstructionsModal: React.FC<InstructionsModalProps> = ({
  isOpen,
  onClose,
  instructions,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/30 z-40 transition-opacity"
        onClick={onClose}
      />
      
      {/* Slide-over Panel */}
      <div className="fixed inset-y-0 right-0 w-full max-w-lg bg-white dark:bg-[var(--color-bg-secondary)] shadow-2xl z-50 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-[var(--color-border)] bg-gradient-to-r from-indigo-50 to-white dark:from-indigo-900/20 dark:to-[var(--color-bg-secondary)]">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <HelpCircle className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-[var(--color-text-primary)]">{instructions.title}</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-[var(--color-bg-tertiary)] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-500 dark:text-[var(--color-text-muted)]" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Overview */}
          <p className="text-gray-600 dark:text-[var(--color-text-secondary)] mb-6 pb-4 border-b border-gray-100 dark:border-[var(--color-border)]">
            {instructions.overview}
          </p>

          {/* Sections */}
          {instructions.sections.map((section, idx) => (
            <div key={idx} className="mb-6">
              <h3 className="text-base font-bold text-gray-900 dark:text-[var(--color-text-primary)] mb-3 flex items-center gap-2">
                <span className="w-6 h-6 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400 rounded-full flex items-center justify-center text-xs font-bold">
                  {idx + 1}
                </span>
                {section.title}
              </h3>
              
              <div className="text-sm leading-relaxed">
                {renderContent(section.content)}
              </div>
              
              {/* Warning Callout */}
              {section.warning && (
                <div className="mt-3 flex gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/50 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-300">{section.warning}</p>
                </div>
              )}
              
              {/* Tip Callout */}
              {section.tip && (
                <div className="mt-3 flex gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/50 rounded-lg">
                  <Lightbulb className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-800 dark:text-blue-300">{section.tip}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Footer Warnings */}
        {instructions.footerWarnings && instructions.footerWarnings.length > 0 && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-[var(--color-bg-primary)] border-t border-gray-200 dark:border-[var(--color-border)]">
            <p className="text-xs font-semibold text-gray-500 dark:text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
              Important Notes
            </p>
            <ul className="space-y-1">
              {instructions.footerWarnings.map((warning, idx) => (
                <li key={idx} className="text-xs text-gray-600 dark:text-[var(--color-text-secondary)] flex items-start gap-2">
                  <span className="text-amber-500 dark:text-amber-400">•</span>
                  {warning}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
};

export default InstructionsModal;
