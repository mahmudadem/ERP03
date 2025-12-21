/**
 * StepLayoutEditor.tsx
 * 
 * Visual layout editor step - Preserves existing UX from old designer.
 * Adds CORE/SHARED/PERSONAL enforcement with visual indicators.
 * 
 * Features:
 * - Live preview canvas
 * - Drag & drop field reordering
 * - Properties panel with styling
 * - Classic vs Windows mode
 * - Test Run preview
 * - Category enforcement (CORE fields locked)
 */

import React, { useState } from 'react';
import { VoucherTypeCode, DisplayMode } from '../../types/VoucherLayoutV2';
import { FieldDefinitionV2 } from '../../types/FieldDefinitionV2';

interface Props {
  voucherType: VoucherTypeCode;
  fields: FieldDefinitionV2[];
  mode: DisplayMode;
  onFieldsUpdate: (fields: FieldDefinitionV2[]) => void;
  onModeChange: (mode: DisplayMode) => void;
}

export const StepLayoutEditor: React.FC<Props> = ({
  voucherType,
  fields,
  mode,
  onFieldsUpdate,
  onModeChange
}) => {
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isTestRunOpen, setIsTestRunOpen] = useState(false);

  const selectedField = fields.find(f => f.id === selectedFieldId);

  // Update a single field
  const handleFieldUpdate = (updates: Partial<FieldDefinitionV2>) => {
    if (!selectedFieldId) return;
    
    const updatedFields = fields.map(f =>
      f.id === selectedFieldId ? { ...f, ...updates } : f
    );
    
    onFieldsUpdate(updatedFields);
  };

  // Reorder fields via drag & drop
  const handleReorder = (dragIndex: number, dropIndex: number) => {
    if (dragIndex === dropIndex) return;
    
    const newFields = [...fields];
    const [draggedItem] = newFields.splice(dragIndex, 1);
    newFields.splice(dropIndex, 0, draggedItem);
    
    onFieldsUpdate(newFields);
  };

  // Move field backward/forward
  const moveField = (index: number, direction: 'backward' | 'forward') => {
    const newIndex = direction === 'backward' ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= fields.length) return;
    
    handleReorder(index, newIndex);
  };

  // Get category icon
  const getCategoryIcon = (category: FieldDefinitionV2['category']) => {
    switch (category) {
      case 'CORE':
        return (
          <svg className="w-3 h-3 text-red-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
          </svg>
        );
      case 'SHARED':
        return (
          <svg className="w-3 h-3 text-blue-600" fill="currentColor" viewBox="0 0 20 20">
            <path d="M15 8a3 3 0 10-2.977-2.63l-4.94 2.47a3 3 0 100 4.319l4.94 2.47a3 3 0 10.895-1.789l-4.94-2.47a3.027 3.027 0 000-.74l4.94-2.47C13.456 7.68 14.19 8 15 8z" />
          </svg>
        );
      case 'PERSONAL':
        return (
          <svg className="w-3 h-3 text-purple-600" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
          </svg>
        );
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
        <div>
          <h3 className="text-xl font-bold text-gray-900">Visual Layout Editor</h3>
          <p className="text-sm text-gray-600 mt-1">Drag fields to move. Click to style.</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Mode Toggle */}
          <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                mode === 'classic' 
                  ? 'bg-white shadow text-gray-900' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => onModeChange('classic')}
            >
              Classic
            </button>
            <button
              className={`px-4 py-2 rounded-md transition-colors ${
                mode === 'windows' 
                  ? 'bg-white shadow text-gray-900' 
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              onClick={() => onModeChange('windows')}
            >
              Windows
            </button>
          </div>

          {/* Test Run Button */}
          <button
            onClick={() => setIsTestRunOpen(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Test Run
          </button>
        </div>
      </div>

      {/* Main Content: Canvas + Properties */}
      <div className="flex-1 flex gap-6 min-h-[600px]">
        {/* ═══════════════════════════════════════════════════════════ */}
        {/* CANVAS AREA (Left - Live Preview) */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className={`flex-1 bg-gray-100 rounded-xl border border-gray-200 p-8 overflow-y-auto ${
          mode === 'windows' ? 'flex justify-center items-start' : ''
        }`}>
          <div className={`
            transition-all duration-300 ease-in-out
            ${mode === 'windows' 
              ? 'w-[900px] bg-white rounded-xl shadow-2xl border border-gray-200/50' 
              : 'w-full bg-white rounded-lg shadow-sm border border-gray-200'
            }
          `}>
            {/* Voucher Content */}
            <div className={`p-8 bg-white min-h-[600px] flex flex-col ${
              mode === 'windows' ? 'rounded-xl' : ''
            }`}>
              
              {/* Header Area (Read-only wireframe) */}
              <div className="mb-6 pb-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">
                      {voucherType.replace('_', ' ')}
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">Draft</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-400">Voucher No</p>
                    <p className="text-sm font-medium text-gray-900">Pending</p>
                  </div>
                </div>
              </div>

              {/* Body Area (Field Grid) */}
              <div className="mb-8">
                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">
                  Body
                </h4>
                
                <div 
                  className="grid grid-cols-4 gap-x-6 gap-y-6"
                  onDragOver={(e) => e.preventDefault()}
                >
                  {fields.map((field, index) => {
                    const colSpan = field.width === 'full' ? 'col-span-4' : 
                                  field.width === '1/2' ? 'col-span-2' : 'col-span-1';
                    const isSelected = selectedFieldId === field.id;
                    const style = field.style || {};
                    const isCoreField = field.category === 'CORE';

                    return (
                      <div
                        key={field.id}
                        onDrop={(e) => {
                          e.preventDefault();
                          const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
                          if (!isNaN(dragIndex)) {
                            handleReorder(dragIndex, index);
                          }
                        }}
                        onClick={() => setSelectedFieldId(field.id)}
                        className={`
                          ${colSpan} group cursor-pointer relative transition-all duration-200
                          ${isSelected ? 'ring-2 ring-indigo-500 rounded p-1 -m-1' : 'hover:scale-[1.01]'}
                        `}
                      >
                        {/* Field Actions (Visible when selected) */}
                        {isSelected && (
                          <div className="absolute -top-3 right-2 flex gap-1 z-20 bg-white shadow-md border border-gray-200 rounded-full px-1 py-0.5">
                            {/* Category Indicator */}
                            <div className="px-2 py-1 flex items-center gap-1">
                              {getCategoryIcon(field.category)}
                              <span className="text-xs font-medium text-gray-600">
                                {field.category}
                              </span>
                            </div>
                            
                            {/* Move Buttons (disabled for CORE if first/last) */}
                            <button
                              title="Move Backward"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(index, 'backward');
                              }}
                              disabled={index === 0}
                              className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                              </svg>
                            </button>

                            {/* Drag Handle (disabled for CORE) */}
                            <button
                              title={isCoreField ? "CORE fields cannot be reordered freely" : "Drag to Move"}
                              className={`p-1 hover:bg-gray-100 rounded-full ${
                                isCoreField ? 'text-gray-300 cursor-not-allowed' : 'text-gray-400 cursor-grab active:cursor-grabbing'
                              }`}
                              draggable={!isCoreField}
                              onDragStart={(e) => {
                                if (isCoreField) {
                                  e.preventDefault();
                                  return;
                                }
                                e.dataTransfer.setData('text/plain', index.toString());
                                e.dataTransfer.effectAllowed = 'move';
                              }}
                            >
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path d="M7 2a2 2 0 10-.001 4.001A2 2 0 007 2zm0 6a2 2 0 10-.001 4.001A2 2 0 007 8zm0 6a2 2 0 10-.001 4.001A2 2 0 007 14zm6-8a2 2 0 10-.001 4.001A2 2 0 0013 6zm0 6a2 2 0 10-.001 4.001A2 2 0 0013 12zm0 6a2 2 0 10-.001 4.001A2 2 0 0013 18z"/>
                              </svg>
                            </button>

                            <button
                              title="Move Forward"
                              onClick={(e) => {
                                e.stopPropagation();
                                moveField(index, 'forward');
                              }}
                              disabled={index === fields.length - 1}
                              className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600 disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                              </svg>
                            </button>
                          </div>
                        )}

                        {/* Field Label */}
                        <label
                          className="block mb-2 text-[10px] tracking-wider font-bold"
                          style={{
                            color: style.color || '#9ca3af',
                            fontWeight: style.fontWeight || 'bold',
                            fontSize: style.fontSize,
                            fontStyle: style.fontStyle,
                            textAlign: style.textAlign as any,
                            textTransform: (style.textTransform as any) || 'uppercase'
                          }}
                        >
                          {field.label}
                        </label>

                        {/* Field Input (Wireframe) */}
                        <div
                          className="w-full h-9 border rounded-md bg-white flex items-center px-3"
                          style={{
                            backgroundColor: style.backgroundColor,
                            padding: style.padding,
                            borderWidth: style.borderWidth || '1px',
                            borderColor: style.borderColor || '#e5e7eb',
                            borderRadius: style.borderRadius
                          }}
                        >
                          <span className="text-sm text-gray-300 truncate font-light">
                            {field.placeholder || '...'}
                          </span>
                        </div>

                        {/* CORE Field Lock Indicator */}
                        {isCoreField && (
                          <div className="absolute bottom-1 left-1 bg-red-100 text-red-700 px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5">
                            <svg className="w-2.5 h-2.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            LOCKED
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {fields.length === 0 && (
                    <div className="col-span-4 py-12 text-center text-gray-400 border-2 border-dashed border-gray-200 rounded-lg">
                      No fields to display
                    </div>
                  )}
                </div>
              </div>

              {/* Lines Area (Wireframe) */}
              <div className="mt-2 flex-1">
                <h4 className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">
                  Lines
                </h4>
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  {/* Table Header */}
                  <div className="bg-gray-50 border-b border-gray-200 grid grid-cols-12 gap-4 px-4 py-2">
                    <div className="col-span-1 text-[10px] font-bold text-gray-500 uppercase">#</div>
                    <div className="col-span-3 text-[10px] font-bold text-gray-500 uppercase">Account</div>
                    <div className="col-span-2 text-[10px] font-bold text-gray-500 uppercase">Debit</div>
                    <div className="col-span-2 text-[10px] font-bold text-gray-500 uppercase">Credit</div>
                    <div className="col-span-4 text-[10px] font-bold text-gray-500 uppercase">Notes</div>
                  </div>
                  {/* Empty Rows */}
                  {[1, 2, 3].map(i => (
                    <div key={i} className="border-b border-gray-100 grid grid-cols-12 gap-4 px-4 py-2 bg-white">
                      <div className="col-span-1 h-7 border border-gray-100 rounded bg-white"></div>
                      <div className="col-span-3 h-7 border border-gray-100 rounded bg-white"></div>
                      <div className="col-span-2 h-7 border border-gray-100 rounded bg-white"></div>
                      <div className="col-span-2 h-7 border border-gray-100 rounded bg-white"></div>
                      <div className="col-span-4 h-7 border border-gray-100 rounded bg-white"></div>
                    </div>
                  ))}
                  <div className="px-4 py-2 bg-indigo-50 text-center text-indigo-600 text-xs font-bold border-t border-indigo-100">
                    + Add Line
                  </div>
                </div>
              </div>

              {/* Actions Area (Wireframe) */}
              <div className="mt-6 pt-6 border-t border-gray-100">
                <div className="flex justify-between gap-3">
                  <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                    Cancel
                  </button>
                  <div className="flex gap-3">
                    <button className="px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Save as Draft
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
                      Submit for Approval
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════ */}
        {/* PROPERTIES PANEL (Right) */}
        {/* ═══════════════════════════════════════════════════════════ */}
        <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col max-h-[800px]">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
            </svg>
            <h4 className="font-bold text-gray-900">Field Properties</h4>
          </div>

          <div className="p-4 flex-1 overflow-y-auto space-y-6">
            {selectedField ? (
              <>
                {/* Field Info */}
                <div className="pb-4 border-b border-gray-200">
                  <div className="flex items-center gap-2 mb-2">
                    {getCategoryIcon(selectedField.category)}
                    <span className="text-xs font-bold text-gray-600 uppercase">
                      {selectedField.category} Field
                    </span>
                  </div>
                  <h5 className="font-bold text-gray-900">{selectedField.label}</h5>
                  <p className="text-xs text-gray-600 mt-1">{selectedField.semanticMeaning}</p>
                </div>

                {/* Label Text */}
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Display Label
                  </label>
                  <input
                    type="text"
                    value={selectedField.label}
                    onChange={(e) => handleFieldUpdate({ label: e.target.value })}
                    disabled={!selectedField.canRenameLabel}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm disabled:bg-gray-100 disabled:cursor-not-allowed"
                    placeholder="Field label"
                  />
                  {!selectedField.canRenameLabel && (
                    <p className="text-xs text-amber-600 mt-1">⚠️ Label cannot be changed for this field</p>
                  )}
                </div>

                {/* Width Slider */}
                <div className="border-t pt-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                    Width (Columns)
                  </label>
                  <div className="flex items-center gap-4">
                    <input
                      type="range"
                      min="1"
                      max="4"
                      step="1"
                      value={selectedField.width === 'full' ? 4 : selectedField.width === '1/2' ? 2 : 1}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        const width = val === 4 ? 'full' : val === 2 ? '1/2' : '1/4';
                        handleFieldUpdate({ width: width as any });
                      }}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-sm font-medium text-gray-700 w-8 text-center">
                      {selectedField.width === 'full' ? 4 : selectedField.width === '1/2' ? 2 : 1}
                    </span>
                  </div>
                </div>

                {/* Typography & Color */}
                <div className="border-t pt-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-3">
                    Typography & Color
                  </label>

                  <div className="grid grid-cols-2 gap-3">
                    {/* Text Color */}
                    <div>
                      <span className="text-xs text-gray-600 block mb-1">Text Color</span>
                      <input
                        type="color"
                        value={selectedField.style?.color || '#000000'}
                        onChange={(e) => handleFieldUpdate({
                          style: { ...selectedField.style, color: e.target.value }
                        })}
                        className="h-8 w-full border rounded cursor-pointer"
                      />
                    </div>

                    {/* Background */}
                    <div>
                      <span className="text-xs text-gray-600 block mb-1">Background</span>
                      <input
                        type="color"
                        value={selectedField.style?.backgroundColor || '#ffffff'}
                        onChange={(e) => handleFieldUpdate({
                          style: { ...selectedField.style, backgroundColor: e.target.value }
                        })}
                        className="h-8 w-full border rounded cursor-pointer"
                      />
                    </div>

                    {/* Font Weight */}
                    <div>
                      <span className="text-xs text-gray-600 block mb-1">Font Weight</span>
                      <select
                        value={selectedField.style?.fontWeight || 'normal'}
                        onChange={(e) => handleFieldUpdate({
                          style: { ...selectedField.style, fontWeight: e.target.value as any }
                        })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      >
                        <option value="normal">Normal</option>
                        <option value="500">Medium</option>
                        <option value="bold">Bold</option>
                      </select>
                    </div>

                    {/* Font Size */}
                    <div>
                      <span className="text-xs text-gray-600 block mb-1">Font Size</span>
                      <select
                        value={selectedField.style?.fontSize || 'base'}
                        onChange={(e) => handleFieldUpdate({
                          style: { ...selectedField.style, fontSize: e.target.value as any }
                        })}
                        className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                      >
                        <option value="sm">Small</option>
                        <option value="base">Normal</option>
                        <option value="lg">Large</option>
                        <option value="xl">Extra Large</option>
                      </select>
                    </div>

                    {/* Text Align */}
                    <div className="col-span-2">
                      <span className="text-xs text-gray-600 block mb-1">Text Align</span>
                      <div className="flex border rounded overflow-hidden">
                        {['left', 'center', 'right'].map((align) => (
                          <button
                            key={align}
                            onClick={() => handleFieldUpdate({
                              style: { ...selectedField.style, textAlign: align as any }
                            })}
                            className={`flex-1 py-1.5 text-xs hover:bg-gray-100 transition-colors ${
                              selectedField.style?.textAlign === align 
                                ? 'bg-indigo-50 text-indigo-600 font-bold' 
                                : 'text-gray-600'
                            }`}
                          >
                            {align.charAt(0).toUpperCase() + align.slice(1)}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Enforcement Warning */}
                {selectedField.category === 'CORE' && (
                  <div className="border-t pt-4">
                    <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                      <div className="flex gap-2">
                        <svg className="w-4 h-4 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                        <div>
                          <p className="text-xs font-bold text-red-900">CORE Field</p>
                          <p className="text-xs text-red-700 mt-1">
                            This field is required by the accounting system. You can customize its appearance but cannot remove or hide it.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-12 text-gray-400">
                <svg className="w-12 h-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.188 2.239l.777 2.897M5.136 7.965l-2.898-.777M13.95 4.05l-2.122 2.122m-5.657 5.656l-2.12 2.122" />
                </svg>
                <p className="text-sm">Click a field to customize</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Test Run Modal - Rendered with actual fields */}
      {isTestRunOpen && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
              <h3 className="text-lg font-bold text-white">
                Test Run: {voucherType.replace('_', ' ')} ({mode.toUpperCase()} Mode)
              </h3>
              <button
                onClick={() => setIsTestRunOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
              <div className={`mx-auto ${mode === 'windows' ? 'max-w-4xl' : 'max-w-6xl'}`}>
                <div className="bg-white rounded-lg shadow-lg p-8">
                  {/* Voucher Form Preview */}
                  <div className="mb-6 pb-4 border-b border-gray-200">
                    <h2 className="text-xl font-bold text-gray-900 mb-1">
                      {voucherType.replace('_', ' ')}
                    </h2>
                    <p className="text-sm text-gray-500">Draft • Preview Mode</p>
                  </div>

                  {/* Render Actual Fields */}
                  <div className="grid grid-cols-4 gap-6">
                    {fields.map(field => {
                      const colSpan = field.width === 'full' ? 'col-span-4' : 
                                    field.width === '1/2' ? 'col-span-2' : 'col-span-1';
                      const style = field.style || {};

                      return (
                        <div key={field.id} className={colSpan}>
                          <label
                            className="block mb-2 text-sm font-medium"
                            style={{
                              color: style.color ||'#374151',
                              fontWeight: style.fontWeight || 'medium',
                              fontSize: style.fontSize || '0.875rem',
                              textAlign: style.textAlign as any
                            }}
                          >
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </label>
                          
                          {/* Render appropriate input based on type */}
                          {field.type === 'TEXTAREA' ? (
                            <textarea
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              rows={3}
                              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                              style={{
                                backgroundColor: style.backgroundColor,
                                borderColor: style.borderColor,
                                borderWidth: style.borderWidth
                              }}
                            />
                          ) : field.type === 'SELECT' ? (
                            <select
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              style={{
                                backgroundColor: style.backgroundColor,
                                borderColor: style.borderColor,
                                borderWidth: style.borderWidth
                              }}
                            >
                              <option value="">Select {field.label}</option>
                            </select>
                          ) : field.type === 'DATE' ? (
                            <input
                              type="date"
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              style={{
                                backgroundColor: style.backgroundColor,
                                borderColor:style.borderColor,
                                borderWidth: style.borderWidth
                              }}
                            />
                          ) : field.type === 'NUMBER' ? (
                            <input
                              type="number"
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder={field.placeholder || '0.00'}
                              style={{
                                backgroundColor: style.backgroundColor,
                                borderColor: style.borderColor,
                                borderWidth: style.borderWidth
                              }}
                            />
                          ) : (
                            <input
                              type="text"
                              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                              placeholder={field.placeholder || `Enter ${field.label.toLowerCase()}`}
                              style={{
                                backgroundColor: style.backgroundColor,
                                borderColor: style.borderColor,
                                borderWidth: style.borderWidth
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* System Metadata Preview */}
                  <div className="mt-6 pt-6 border-t border-gray-200">
                    <h4 className="text-sm font-bold text-gray-700 mb-3">System Information</h4>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Voucher Number</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-400 italic">
                          Pending
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Status</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm">
                          <span className="inline-block px-2 py-0.5 bg-yellow-100 text-yellow-800 rounded text-xs font-medium">
                            Draft
                          </span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Created At</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-400 italic">
                          Pending
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Created By</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-400 italic">
                          Pending
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Updated At</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-400 italic">
                          Pending
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">Updated By</label>
                        <div className="px-3 py-2 bg-gray-50 border border-gray-200 rounded text-sm text-gray-400 italic">
                          Pending
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-8 pt-6 border-t border-gray-200 flex justify-end gap-3">
                    <button className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 font-medium">
                      Cancel
                    </button>
                    <button className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 font-medium">
                      Save as Draft
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium">
                      Submit
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
