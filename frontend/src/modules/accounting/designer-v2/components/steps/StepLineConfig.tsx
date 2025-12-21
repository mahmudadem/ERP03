/**
 * StepLineConfig.tsx
 * 
 * Configure line table columns for journal entries.
 * Essential columns (Account, Debit, Credit) are locked.
 * Optional columns can be added/removed and reordered.
 */

import React, { useState } from 'react';
import { 
  LineColumnDefinition, 
  ESSENTIAL_LINE_COLUMNS, 
  OPTIONAL_LINE_COLUMNS,
  getDefaultLineTableConfig,
  isEssentialColumn
} from '../../types/LineTableConfiguration';

interface Props {
  columns: LineColumnDefinition[];
  onColumnsChange: (columns: LineColumnDefinition[]) => void;
}

export const StepLineConfig: React.FC<Props> = ({ columns: initialColumns, onColumnsChange }) => {
  const [columns, setColumns] = useState<LineColumnDefinition[]>(
    initialColumns.length > 0 ? initialColumns : getDefaultLineTableConfig().columns
  );

  const toggleColumn = (columnId: string) => {
    const column = [...ESSENTIAL_LINE_COLUMNS, ...OPTIONAL_LINE_COLUMNS].find(c => c.id === columnId);
    if (!column || isEssentialColumn(columnId)) return; // Can't toggle essential columns

    const exists = columns.some(c => c.id === columnId);

    if (exists) {
      // Remove column
      const newColumns = columns.filter(c => c.id !== columnId);
      setColumns(newColumns);
      onColumnsChange(newColumns);
    } else {
      // Add column
      const newColumns = [...columns, { ...column, visible: true }];
      setColumns(newColumns);
      onColumnsChange(newColumns);
    }
  };

  const moveColumn = (index: number, direction: 'up' | 'down') => {
    const newIndex = direction === 'up' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= columns.length) return;

    const newColumns = [...columns];
    [newColumns[index], newColumns[newIndex]] = [newColumns[newIndex], newColumns[index]];
    
    setColumns(newColumns);
    onColumnsChange(newColumns);
  };

  return (
    <div className="max-w-5xl mx-auto py-6">
      {/* Header */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Configure Line Table
        </h2>
        <p className="text-gray-600">
          Customize which columns appear in the transaction lines table
        </p>
      </div>

      {/* Info Box */}
      <div className="mb-8 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">Essential columns cannot be removed</p>
            <p>Account, Debit, and Credit are required for proper accounting and cannot be hidden.</p>
          </div>
        </div>
      </div>

      {/* Current Columns */}
      <div className="mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
          </svg>
          Selected Columns ({columns.length})
        </h3>

        <div className="space-y-2">
          {columns.map((column, index) => {
            const essential = isEssentialColumn(column.id);

            return (
              <div
                key={column.id}
                className={`p-4 rounded-lg border-2 flex items-center gap-4 ${
                  essential
                    ? 'bg-red-50 border-red-200'
                    : 'bg-white border-gray-200'
                }`}
              >
                {/* Reorder Buttons */}
                <div className="flex flex-col gap-1">
                  <button
                    onClick={() => moveColumn(index, 'up')}
                    disabled={index === 0}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Up"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                    </svg>
                  </button>
                  <button
                    onClick={() => moveColumn(index, 'down')}
                    disabled={index === columns.length - 1}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-30 disabled:cursor-not-allowed"
                    title="Move Down"
                  >
                    <svg className="w-4 h-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>

                {/* Column Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-1">
                    <h4 className="font-semibold text-gray-900">{column.label}</h4>
                    {essential && (
                      <span className="px-2 py-0.5 bg-red-200 text-red-800 text-xs font-bold rounded">
                        ESSENTIAL
                      </span>
                    )}
                    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded">
                      {column.type}
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Order: {index + 1} | Width: {column.width}px | Align: {column.align}
                  </p>
                </div>

                {/* Remove Button */}
                {!essential && (
                  <button
                    onClick={() => toggleColumn(column.id)}
                    className="p-2 text-red-600 hover:bg-red-100 rounded transition-colors"
                    title="Remove column"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                  </button>
                )}

                {essential && (
                  <div className="p-2">
                    <svg className="w-5 h-5 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Available Columns */}
      <div>
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <svg className="w-5 h-5 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
          </svg>
          Available Columns
        </h3>

        <div className="grid grid-cols-2 gap-4">
          {OPTIONAL_LINE_COLUMNS.filter(col => !columns.some(c => c.id === col.id)).map(column => (
            <button
              key={column.id}
              onClick={() => toggleColumn(column.id)}
              className="p-4 bg-white border-2 border-gray-200 rounded-lg text-left hover:border-blue-400 hover:shadow-sm transition-all"
            >
              <h4 className="font-semibold text-gray-900 mb-1">{column.label}</h4>
              <p className="text-xs text-gray-600 mb-2">
                Width: {column.width}px | Type: {column.type}
              </p>
              <span className="inline-block px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                + Add Column
              </span>
            </button>
          ))}

          {OPTIONAL_LINE_COLUMNS.every(col => columns.some(c => c.id === col.id)) && (
            <div className="col-span-2 text-center py-8 text-gray-500">
              <p>All available columns have been added</p>
            </div>
          )}
        </div>
      </div>

      {/* Summary */}
      <div className="mt-10 bg-gray-50 border border-gray-200 rounded-lg p-6">
        <h4 className="font-bold text-gray-900 mb-3">Configuration Summary</h4>
        <div className="grid grid-cols-3 gap-6">
          <div>
            <div className="text-2xl font-bold text-red-600">{ESSENTIAL_LINE_COLUMNS.length}</div>
            <div className="text-sm text-gray-600">Essential (locked)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-blue-600">
              {columns.filter(c => !isEssentialColumn(c.id)).length}
            </div>
            <div className="text-sm text-gray-600">Optional (selected)</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{columns.length}</div>
            <div className="text-sm text-gray-600">Total columns</div>
          </div>
        </div>
      </div>
    </div>
  );
};
