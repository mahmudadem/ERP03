/**
 * StepLayout - 12-Column Grid Layout Editor
 * All elements (SYSTEM, CORE, SHARED) in unified draggable grid
 */

import React, { useState } from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';
import { FieldDefinition } from '../../types/FieldTypes';
import { Button } from '../../../../../components/ui/Button';
import { getSystemFields } from '../../registries/systemFields';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
}

interface GridElement {
  id: string;
  type: 'SYSTEM' | 'FIELD';
  data: FieldDefinition | { id: string; label: string };
  gridRow: number;
  gridColumn: number;
  gridColumnSpan: number;
  style?: any;
}

export const StepLayout: React.FC<Props> = ({ definition, updateDefinition }) => {
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [isTestRunOpen, setIsTestRunOpen] = useState(false);
  const [draggedElement, setDraggedElement] = useState<GridElement | null>(null);
  
  // Initialize grid elements from definition
  const initializeGridElements = (): GridElement[] => {
    const elements: GridElement[] = [];
    
    // Add header fields first (they go in main content area)
    const headerFields = (definition.headerFields || []) as FieldDefinition[];
    let currentRow = 1;
    let currentCol = 1;
    
    headerFields.forEach((field) => {
      const span = field.gridColumnSpan || (field.width === 'full' ? 12 : field.width === '1/2' ? 6 : 3);
      
      // Check if we need to wrap to next row
      if (currentCol + span > 13) {
        currentRow++;
        currentCol = 1;
      }
      
      elements.push({
        id: `field_${field.id}`,
        type: 'FIELD',
        data: field,
        gridRow: field.gridRow || currentRow,
        gridColumn: field.gridColumn || currentCol,
        gridColumnSpan: span,
        style: field.style || {}
      });
      
      // Move column position
      currentCol += span;
      
      // If we filled the row, move to next row
      if (currentCol > 12) {
        currentRow++;
        currentCol = 1;
      }
    });
    
    // Add system fields (they go at top-right, separate rows)
    const systemFieldIds = ((definition as any).systemFields || []) as string[];
    const systemFieldDefs = getSystemFields();
    
    systemFieldIds.forEach((fieldId, index) => {
      const fieldDef = systemFieldDefs.find(f => f.id === fieldId);
      if (fieldDef) {
        elements.push({
          id: `system_${fieldId}`,
          type: 'SYSTEM',
          data: fieldDef,
          gridRow: index + 1, // Stack vertically at top
          gridColumn: 10, // Start at column 10 (right side)
          gridColumnSpan: 3, // Take 3 columns
          style: {}
        });
      }
    });
    
    return elements;
  };
  
  const [gridElements, setGridElements] = useState<GridElement[]>(initializeGridElements());
  const selectedElement = gridElements.find(e => e.id === selectedElementId);
  
  const handleDragStart = (element: GridElement) => {
    setDraggedElement(element);
  };
  
  const handleDrop = (targetRow: number, targetCol: number) => {
    if (!draggedElement) return;
    
    setGridElements(prev => prev.map(el => 
      el.id === draggedElement.id 
        ? { ...el, gridRow: targetRow, gridColumn: targetCol }
        : el
    ));
    setDraggedElement(null);
  };
  
  const handleElementUpdate = (updates: Partial<GridElement>) => {
    if (!selectedElementId) return;
    
    setGridElements(prev => prev.map(el =>
      el.id === selectedElementId
        ? { ...el, ...updates, style: { ...(el.style || {}), ...(updates.style || {}) } }
        : el
    ));
  };
  
  // Render 12-column grid with better layout
  const renderGrid = () => {
    const maxRow = Math.max(...gridElements.map(e => e.gridRow), 6);
    const rows = Array.from({ length: maxRow }, (_, i) => i + 1);
    
    return (
      <div className="space-y-1">
        {rows.map(rowNum => {
          // Get all elements that START in this row
          const rowElements = gridElements.filter(e => e.gridRow === rowNum);
          
          return (
            <div key={rowNum} className="grid grid-cols-12 gap-2 min-h-[70px]">
              {Array.from({ length: 12 }, (_, colNum) => colNum + 1).map(colNum => {
                // Find element that STARTS at this exact position
                const element = rowElements.find(e => e.gridColumn === colNum);
                
                // If there's an element starting here, render it
                if (element) {
                  const isSelected = selectedElementId === element.id;
                  const fieldData = element.data as FieldDefinition;
                  
                  return (
                    <div
                      key={`${rowNum}-${colNum}`}
                      draggable
                      onDragStart={() => handleDragStart(element)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(rowNum, colNum)}
                      onClick={() => setSelectedElementId(element.id)}
                      className={`p-3 border-2 rounded relative transition-all ${
                        isSelected 
                          ? 'ring-2 ring-indigo-500 bg-indigo-50 border-indigo-300' 
                          : 'bg-white border-gray-300 hover:border-indigo-400 hover:shadow-sm'
                      }`}
                      style={{
                        gridColumn: `span ${element.gridColumnSpan}`,
                        cursor: 'move',
                        ...element.style
                      }}
                    >
                      {/* Type Badge */}
                      <div className="absolute -top-2 -left-2 z-10">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold shadow-sm ${
                          element.type === 'SYSTEM' ? 'bg-gray-500 text-white' :
                          fieldData.category === 'CORE' ? 'bg-red-500 text-white' :
                          'bg-blue-500 text-white'
                        }`}>
                          {element.type === 'SYSTEM' ? 'SYS' : fieldData.category}
                        </span>
                      </div>
                      
                      {/* Field Label */}
                      <div className="text-xs font-bold text-gray-700 mb-1" style={element.style}>
                        {fieldData.label}
                      </div>
                      
                      {/* Field Preview */}
                      <div className="text-xs text-gray-500 truncate" style={element.style}>
                        {fieldData.placeholder || fieldData.name || 'Value'}
                      </div>
                      
                      {/* Grid Position Info */}
                      <div className="text-[9px] text-gray-400 mt-2 font-mono">
                        R{element.gridRow} C{element.gridColumn}+{element.gridColumnSpan}
                      </div>
                      
                      {/* Drag Handle Indicator */}
                      {isSelected && (
                        <div className="absolute top-1 right-1 text-gray-400">
                          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z"/>
                          </svg>
                        </div>
                      )}
                    </div>
                  );
                }
                
                // Check if this cell is occupied by a spanning element from earlier in the row
                const isOccupied = rowElements.some(e => 
                  e.gridColumn < colNum && e.gridColumn + e.gridColumnSpan > colNum
                );
                
                if (isOccupied) {
                  // This cell is covered by a spanning element, skip it
                  return null;
                }
                
                // Empty grid cell (drop zone)
                return (
                  <div
                    key={`${rowNum}-${colNum}`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => handleDrop(rowNum, colNum)}
                    className="border border-dashed border-gray-300 rounded bg-gray-50 hover:bg-indigo-50 hover:border-indigo-300 transition-colors flex items-center justify-center"
                  >
                    <span className="text-[9px] text-gray-400 font-mono">
                      {rowNum}.{colNum}
                    </span>
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    );
  };
  
  return (
    <div className="h-full flex flex-col p-4">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200">
        <div>
          <h3 className="text-lg font-bold text-gray-900">12-Column Grid Layout Editor</h3>
          <p className="text-sm text-gray-500">Drag any element to reposition in the grid</p>
        </div>
        <Button variant="primary" onClick={() => setIsTestRunOpen(true)}>
          Test Run
        </Button>
      </div>

      <div className="flex-1 flex gap-6">
        {/* Canvas Area */}
        <div className="flex-1 bg-gray-50 rounded border border-gray-200 p-6 overflow-y-auto">
          <div className="bg-white rounded border border-gray-200 p-6 max-w-6xl mx-auto">
            {renderGrid()}
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-72 bg-white rounded border border-gray-200 p-4 overflow-y-auto">
          <h4 className="font-bold text-gray-900 mb-4 pb-2 border-b border-gray-200">
            Element Properties
          </h4>
          
          {selectedElement ? (
            <div className="space-y-4">
              {/* Type Badge */}
              <div className="text-xs">
                <span className={`px-2 py-1 rounded font-bold ${
                  selectedElement.type === 'SYSTEM' ? 'bg-gray-100 text-gray-700' :
                  (selectedElement.data as FieldDefinition).category === 'CORE' ? 'bg-red-100 text-red-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {selectedElement.type === 'SYSTEM' ? 'SYSTEM' : (selectedElement.data as FieldDefinition).category}
                </span>
              </div>

              {/* Grid Position */}
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Row</label>
                  <input 
                    type="number" 
                    min="1"
                    value={selectedElement.gridRow}
                    onChange={(e) => handleElementUpdate({ gridRow: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Col</label>
                  <input 
                    type="number" 
                    min="1"
                    max="12"
                    value={selectedElement.gridColumn}
                    onChange={(e) => handleElementUpdate({ gridColumn: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-medium text-gray-700 mb-1">Span</label>
                  <input 
                    type="number" 
                    min="1"
                    max="12"
                    value={selectedElement.gridColumnSpan}
                    onChange={(e) => handleElementUpdate({ gridColumnSpan: parseInt(e.target.value) })}
                    className="w-full px-2 py-1 border border-gray-300 rounded text-xs"
                  />
                </div>
              </div>

              {/* Styling options... (keeping the existing ones) */}
              <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-200">
                Position in 12-column grid. Drag to move quickly.
              </div>
            </div>
          ) : (
            <div className="text-center py-10 text-gray-400 text-sm">
              Click an element to configure
            </div>
          )}
        </div>
      </div>

      {/* Test Run Modal */}
      {isTestRunOpen && (
        <div className="fixed inset-0 z-50 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded w-full max-w-6xl h-[85vh] flex flex-col">
            <div className="bg-gray-900 px-6 py-4 flex justify-between items-center rounded-t">
              <h3 className="text-lg font-bold text-white">
                Test Run: {definition.code} - {definition.name}
              </h3>
              <button 
                onClick={() => setIsTestRunOpen(false)}
                className="text-white hover:text-gray-300 text-2xl"
              >
                ×
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
              <div className="bg-white rounded border border-gray-200 p-6 max-w-6xl mx-auto">
                {/* Render preview using grid elements */}
                <div className="space-y-2">
                  {Array.from({ length: Math.max(...gridElements.map(e => e.gridRow), 10) }, (_, i) => i + 1).map(rowNum => {
                    const rowElements = gridElements.filter(e => e.gridRow === rowNum);
                    if (!rowElements.length) return null;
                    
                    return (
                      <div key={rowNum} className="grid grid-cols-12 gap-4">
                        {rowElements.map(element => {
                          const fieldData = element.data as FieldDefinition;
                          
                          return (
                            <div
                              key={element.id}
                              className="flex flex-col"
                              style={{
                                gridColumn: `${element.gridColumn} / span ${element.gridColumnSpan}`,
                                ...element.style
                              }}
                            >
                              {element.type === 'SYSTEM' ? (
                                // System field rendering
                                <div className="text-xs" style={element.style}>
                                  {fieldData.id === 'status' && (
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium">Status:</span>
                                      <span className="px-2 py-0.5 bg-green-100 text-green-700 font-bold rounded">PENDING</span>
                                    </div>
                                  )}
                                  {fieldData.id === 'created_date' && <div>Created: {new Date().toLocaleString()}</div>}
                                  {fieldData.id === 'document_number' && <div>Document Number: Pending</div>}
                                  {fieldData.id === 'created_by' && <div>Created By: John Doe</div>}
                                  {fieldData.id === 'updated_date' && <div>Updated: {new Date().toLocaleString()}</div>}
                                  {fieldData.id === 'updated_by' && <div>Updated By: Jane Smith</div>}
                                </div>
                              ) : (
                                // Regular field rendering
                                <>
                                  <label 
                                    className="block mb-1 text-xs font-medium text-gray-700"
                                    style={element.style}
                                  >
                                    {fieldData.label}
                                    {fieldData.required && <span className="text-red-500 ml-1">*</span>}
                                  </label>
                                  <input
                                    type={fieldData.type === 'NUMBER' ? 'number' : fieldData.type === 'DATE' ? 'date' : 'text'}
                                    placeholder={fieldData.placeholder}
                                    readOnly={fieldData.readOnly}
                                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                                    style={element.style}
                                  />
                                </>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>

                {/* Lines Table */}
                <div className="mt-8">
                  <div className="border border-gray-200 rounded overflow-hidden">
                    <div className="bg-gray-50 border-b border-gray-200 grid grid-cols-12 gap-4 px-4 py-2">
                      <div className="col-span-1 text-xs font-bold text-gray-600">#</div>
                      <div className="col-span-4 text-xs font-bold text-gray-600">Account</div>
                      <div className="col-span-2 text-xs font-bold text-gray-600">Debit</div>
                      <div className="col-span-2 text-xs font-bold text-gray-600">Credit</div>
                      <div className="col-span-3 text-xs font-bold text-gray-600">Notes</div>
                    </div>
                    {[1, 2, 3, 4, 5].map(i => (
                      <div key={i} className="border-b border-gray-100 grid grid-cols-12 gap-4 px-4 py-2">
                        <div className="col-span-1 text-xs text-gray-400">{i}</div>
                        <div className="col-span-4">
                          <input type="text" className="w-full h-8 px-2 border border-gray-200 rounded text-sm" placeholder="Account" />
                        </div>
                        <div className="col-span-2">
                          <input type="number" className="w-full h-8 px-2 border border-gray-200 rounded text-sm" placeholder="0.00" />
                        </div>
                        <div className="col-span-2">
                          <input type="number" className="w-full h-8 px-2 border border-gray-200 rounded text-sm" placeholder="0.00" />
                        </div>
                        <div className="col-span-3">
                          <input type="text" className="w-full h-8 px-2 border border-gray-200 rounded text-sm" placeholder="Notes" />
                        </div>
                      </div>
                    ))}
                    <div className="px-4 py-2 bg-gray-50 text-center text-indigo-600 text-xs font-bold border-t border-gray-200 cursor-pointer hover:bg-gray-100">
                      + Add Line
                    </div>
                  </div>
                </div>

                {/* Calculations */}
                <div className="mt-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="border border-gray-200 rounded p-3">
                      <div className="text-xs text-gray-600 mb-1">TOTAL DEBIT</div>
                      <div className="text-lg font-bold text-gray-900">0.00</div>
                    </div>
                    <div className="border border-gray-200 rounded p-3">
                      <div className="text-xs text-gray-600 mb-1">TOTAL CREDIT</div>
                      <div className="text-lg font-bold text-gray-900">0.00</div>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="pt-6 border-t border-gray-200 mt-6">
                  <div className="flex gap-3 justify-end">
                    <button className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Cancel
                    </button>
                    <button className="px-4 py-2 border border-gray-300 rounded text-sm font-medium text-gray-700 hover:bg-gray-50">
                      Save as Draft
                    </button>
                    <button className="px-4 py-2 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700">
                      Submit for Approval
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
