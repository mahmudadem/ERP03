/**
 * InstructionsButton - Trigger Button for Instructions Panel
 * 
 * Standardized button component to open the Instructions modal.
 * Use this on any page header for consistent placement.
 */

import React, { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { InstructionsModal } from './InstructionsModal';
import { PageInstructions } from './types';

interface InstructionsButtonProps {
  /** The instructions content to display when clicked */
  instructions: PageInstructions;
  /** Optional custom button text (default: "How this works") */
  label?: string;
  /** Optional className for custom styling */
  className?: string;
}

export const InstructionsButton: React.FC<InstructionsButtonProps> = ({
  instructions,
  label = 'How this works',
  className = '',
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className={`
          inline-flex items-center gap-2 px-3 py-1.5
          text-sm font-medium text-indigo-600
          bg-indigo-50 hover:bg-indigo-100
          border border-indigo-200
          rounded-lg transition-colors
          ${className}
        `}
      >
        <HelpCircle className="w-4 h-4" />
        {label}
      </button>

      <InstructionsModal
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        instructions={instructions}
      />
    </>
  );
};

export default InstructionsButton;
