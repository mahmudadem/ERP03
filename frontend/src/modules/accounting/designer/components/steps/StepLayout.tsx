import React, { useState } from 'react';
import { VoucherTypeDefinition } from '../../../../../designer-engine/types/VoucherTypeDefinition';
import { FieldDefinition } from '../../../../../designer-engine/types/FieldDefinition';
import { Button } from '../../../../../components/ui/Button';
import { DynamicVoucherRenderer } from '../../../../../designer-engine/components/DynamicVoucherRenderer';

interface Props {
  definition: Partial<VoucherTypeDefinition>;
  updateDefinition: (updates: Partial<VoucherTypeDefinition>) => void;
}

export const StepLayout: React.FC<Props> = ({ definition, updateDefinition }) => {
  const [viewMode, setViewMode] = useState<'classic' | 'windows'>('windows');
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [isTestRunOpen, setIsTestRunOpen] = useState(false);

  const headerFields = definition.headerFields || [];
  const selectedField = headerFields.find(f => f.id === selectedFieldId);

  const handleFieldUpdate = (updates: Partial<FieldDefinition>) => {
    if (!selectedFieldId) return;
    const newFields = headerFields.map(f => 
      f.id === selectedFieldId ? { ...f, ...updates } : f
    );
    updateDefinition({ headerFields: newFields });
  };

  return (
    <div className="h-full flex flex-col">
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-6">
        <div>
          <h3 className="text-lg font-bold text-gray-900">Visual Layout Editor</h3>
          <p className="text-sm text-gray-500">Drag fields to move. Drag right edge to resize.</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
            <button 
              className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'classic' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setViewMode('classic')}
            >
              Classic
            </button>
            <button 
              className={`px-3 py-1.5 rounded-md transition-colors ${viewMode === 'windows' ? 'bg-white shadow text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
              onClick={() => setViewMode('windows')}
            >
              Windows
            </button>
          </div>
          <Button 
            variant="primary" 
            className="bg-indigo-600 hover:bg-indigo-700 text-white flex items-center gap-2"
            onClick={() => setIsTestRunOpen(true)}
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            Test Run
          </Button>
        </div>
      </div>

      <div className="flex-1 flex gap-6 min-h-[500px]">
        {/* Canvas Area with Live Preview */}
        <div className={`flex-1 bg-gray-100 rounded-xl border border-gray-200 p-8 overflow-y-auto ${viewMode === 'windows' ? 'flex justify-center' : ''}`}>
          
          {/* Live Preview Container */}
          <div 
            className={`
              transition-all duration-300 ease-in-out
              ${viewMode === 'windows' 
                ? 'w-[900px] bg-white rounded-xl shadow-2xl border border-gray-200/50' 
                : 'w-full bg-white rounded-lg shadow-sm border border-gray-200'
              }
            `}
          >
            {/* Content Area */}
            <div className={`p-8 bg-white min-h-[600px] flex flex-col ${viewMode === 'windows' ? 'rounded-b-xl' : ''}`}>
              
                {/* Header Fields Section */}
                <div className="mb-8">
                    <div 
                        className="grid grid-cols-4 gap-x-6 gap-y-6"
                        onDragOver={(e) => e.preventDefault()}
                    >
                        {headerFields.map((field, index) => {
                            const colSpan = field.width === 'full' ? 'col-span-4' : field.width === '1/2' ? 'col-span-2' : 'col-span-1';
                            const isSelected = selectedFieldId === field.id;
                            const style = field.style || {};

                            return (
                                <div 
                                    key={field.id}
                                    onDrop={(e) => {
                                        e.preventDefault();
                                        const dragIndex = parseInt(e.dataTransfer.getData('text/plain'));
                                        const dropIndex = index;
                                        
                                        if (isNaN(dragIndex) || dragIndex === dropIndex) return;

                                        const newFields = [...headerFields];
                                        const [draggedItem] = newFields.splice(dragIndex, 1);
                                        newFields.splice(dropIndex, 0, draggedItem);
                                        
                                        updateDefinition({ headerFields: newFields });
                                    }}
                                    onClick={() => setSelectedFieldId(field.id)}
                                    className={`
                                        ${colSpan} group cursor-pointer relative transition-all duration-200
                                        ${isSelected ? 'ring-2 ring-indigo-500 rounded p-1 -m-1' : 'hover:scale-[1.01] active:scale-[0.99]'}
                                    `}
                                >
                                    {/* Action Query: Move Buttons & Drag Handle */}
                                    {isSelected && (
                                        <div className="absolute -top-3 right-2 flex gap-1 z-20 bg-white shadow-sm border rounded-full px-1 py-0.5">
                                             <button 
                                                title="Move Backward"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (index === 0) return;
                                                    const newFields = [...headerFields];
                                                    const temp = newFields[index - 1];
                                                    newFields[index - 1] = newFields[index];
                                                    newFields[index] = temp;
                                                    updateDefinition({ headerFields: newFields });
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600"
                                             >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
                                             </button>
                                             <button 
                                                title="Drag to Move"
                                                className="p-1 hover:bg-gray-100 rounded-full text-gray-400 cursor-grab active:cursor-grabbing"
                                                draggable
                                                onDragStart={(e) => {
                                                    e.dataTransfer.setData('text/plain', index.toString());
                                                    e.dataTransfer.effectAllowed = 'move';
                                                }}
                                             >
                                                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M7 2a2 2 0 1 0-.001 4.001A2 2 0 0 0 7 2zm0 6a2 2 0 1 0-.001 4.001A2 2 0 0 0 7 8zm0 6a2 2 0 1 0-.001 4.001A2 2 0 0 0 7 14zm6-8a2 2 0 1 0-.001 4.001A2 2 0 0 0 13 6zm0 6a2 2 0 1 0-.001 4.001A2 2 0 0 0 13 12zm0 6a2 2 0 1 0-.001 4.001A2 2 0 0 0 13 18z"/></svg>
                                             </button>
                                             <button 
                                                title="Move Forward"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    if (index === headerFields.length - 1) return;
                                                    const newFields = [...headerFields];
                                                    const temp = newFields[index + 1];
                                                    newFields[index + 1] = newFields[index];
                                                    newFields[index] = temp;
                                                    updateDefinition({ headerFields: newFields });
                                                }}
                                                className="p-1 hover:bg-gray-100 rounded-full text-gray-500 hover:text-indigo-600"
                                             >
                                                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" /></svg>
                                             </button>
                                        </div>
                                    )}

                                    <label 
                                        className="block mb-2 text-[10px] tracking-wider font-bold text-gray-400"
                                        style={{
                                            color: style.color,
                                            fontWeight: style.fontWeight,
                                            fontSize: style.fontSize,
                                            fontStyle: style.fontStyle,
                                            textAlign: style.textAlign,
                                            textTransform: style.textTransform || 'uppercase'
                                        }}
                                    >
                                        {field.label}
                                    </label>
                                    
                                    {/* Input Simulation - Wireframe Style */}
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
                                        <span className="text-sm text-gray-300 truncate font-light">{field.placeholder || field.name}</span>
                                    </div>
                                </div>
                            );
                        })}
                        
                        {headerFields.length === 0 && (
                            <div className="col-span-4 py-12 text-center text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                                Drag fields here
                            </div>
                        )}
                    </div>
                </div>

                {/* Body Table Wireframe */}
                <div className="mt-2 flex-1">
                     <h4 className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">
                        Body
                    </h4>
                    <div className="border border-gray-200 rounded-lg overflow-hidden mb-8">
                        {/* Table Header */}
                        <div className="bg-gray-50 border-b border-gray-200 grid grid-cols-12 gap-4 px-4 py-2">
                            <div className="col-span-1 text-[10px] font-bold text-gray-500 uppercase">#</div>
                            <div className="col-span-3 text-[10px] font-bold text-gray-500 uppercase">Account</div>
                            <div className="col-span-2 text-[10px] font-bold text-gray-500 uppercase">Debit</div>
                            <div className="col-span-2 text-[10px] font-bold text-gray-500 uppercase">Credit</div>
                            <div className="col-span-4 text-[10px] font-bold text-gray-500 uppercase">Notes</div>
                        </div>
                        {/* Empty Rows Wireframe */}
                        {[1, 2, 3].map(i => (
                            <div key={i} className="border-b border-gray-100 grid grid-cols-12 gap-4 px-4 py-2 bg-white">
                                <div className="col-span-1 h-8 border border-gray-100 rounded bg-white"></div>
                                <div className="col-span-3 h-8 border border-gray-100 rounded bg-white"></div>
                                <div className="col-span-2 h-8 border border-gray-100 rounded bg-white"></div>
                                <div className="col-span-2 h-8 border border-gray-100 rounded bg-white"></div>
                                <div className="col-span-4 h-8 border border-gray-100 rounded bg-white"></div>
                            </div>
                        ))}
                        <div className="px-4 py-2 bg-indigo-50 text-center text-indigo-600 text-xs font-bold border-t border-indigo-100">
                            + Add Line
                        </div>
                    </div>
                </div>

                {/* Footer / Extra Wireframe */}
                <div className="mt-auto">
                    <h4 className="text-[10px] uppercase tracking-wider font-bold text-gray-400 mb-2">
                        Extra Notes
                    </h4>
                    <div className="h-24 border border-gray-200 rounded-lg bg-white mb-6 p-4">
                        <span className="text-gray-300 text-sm italic">Additional notes or instructions...</span>
                    </div>

                    {/* Action Buttons Wireframe */}
                    <div className="grid grid-cols-4 gap-4 pt-6 border-t border-gray-100">
                        <div className="h-10 border border-gray-200 rounded shadow-sm bg-white flex items-center justify-center text-gray-600 text-sm font-medium">Print Voucher</div>
                        <div className="h-10 border border-gray-200 rounded shadow-sm bg-white flex items-center justify-center text-gray-600 text-sm font-medium">Email PDF</div>
                        <div className="h-10 border border-gray-200 rounded shadow-sm bg-white flex items-center justify-center text-gray-600 text-sm font-medium">Download PDF</div>
                        <div className="h-10 border border-gray-200 rounded shadow-sm bg-white flex items-center justify-center text-gray-600 text-sm font-medium">Import CSV</div>
                    </div>
                </div>

            </div>
          </div>
        </div>

        {/* Properties Panel */}
        <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            <h4 className="font-bold text-gray-900">Field Properties</h4>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto space-y-6">
            {selectedField ? (
              <>
                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Display Settings</label>
                   <div className="space-y-3">
                        <div>
                            <span className="text-xs text-gray-600 block mb-1">Label Text</span>
                            <input 
                                type="text" 
                                value={selectedField.label} 
                                onChange={(e) => handleFieldUpdate({ label: e.target.value })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                        </div>
                   </div>
                </div>

                <div className="border-t pt-4">
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Typography & Color</label>
                   
                   <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-xs text-gray-600 block mb-1">Text Color</span>
                            <div className="flex gap-2">
                                <input 
                                    type="color" 
                                    value={selectedField.style?.color || '#000000'} 
                                    onChange={(e) => handleFieldUpdate({ 
                                        style: { ...selectedField.style, color: e.target.value } 
                                    })}
                                    className="h-8 w-8 border rounded cursor-pointer"
                                />
                            </div>
                        </div>

                        <div>
                            <span className="text-xs text-gray-600 block mb-1">Background</span>
                             <div className="flex gap-2">
                                <input 
                                    type="color" 
                                    value={selectedField.style?.backgroundColor || '#ffffff'} 
                                    onChange={(e) => handleFieldUpdate({ 
                                        style: { ...selectedField.style, backgroundColor: e.target.value } 
                                    })}
                                    className="h-8 w-8 border rounded cursor-pointer"
                                />
                            </div>
                        </div>

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

                        <div>
                            <span className="text-xs text-gray-600 block mb-1">Text Align</span>
                            <div className="flex border rounded overflow-hidden">
                                {['left', 'center', 'right'].map((align) => (
                                    <button
                                        key={align}
                                        onClick={() => handleFieldUpdate({
                                            style: { ...selectedField.style, textAlign: align as any }
                                        })}
                                        className={`flex-1 py-1 text-xs hover:bg-gray-100 ${selectedField.style?.textAlign === align ? 'bg-indigo-50 text-indigo-600 font-bold' : 'text-gray-500'}`}
                                    >
                                        {align.charAt(0).toUpperCase()}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div>
                            <span className="text-xs text-gray-600 block mb-1">Transform</span>
                            <select 
                                value={selectedField.style?.textTransform || 'none'}
                                onChange={(e) => handleFieldUpdate({
                                    style: { ...selectedField.style, textTransform: e.target.value as any }
                                })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            >
                                <option value="none">None</option>
                                <option value="uppercase">Uppercase</option>
                                <option value="lowercase">Lowercase</option>
                            </select>
                        </div>
                   </div>
                </div>

                <div className="border-t pt-4">
                   <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">Box Model</label>
                   <div className="grid grid-cols-2 gap-3">
                        <div>
                            <span className="text-xs text-gray-600 block mb-1">Padding</span>
                            <input 
                                type="text" 
                                placeholder="e.g. 4px"
                                value={selectedField.style?.padding || ''} 
                                onChange={(e) => handleFieldUpdate({ 
                                    style: { ...selectedField.style, padding: e.target.value } 
                                })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                        </div>
                        <div>
                            <span className="text-xs text-gray-600 block mb-1">Radius</span>
                            <input 
                                type="text" 
                                placeholder="e.g. 4px"
                                value={selectedField.style?.borderRadius || ''} 
                                onChange={(e) => handleFieldUpdate({ 
                                    style: { ...selectedField.style, borderRadius: e.target.value } 
                                })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                        </div>
                         <div>
                            <span className="text-xs text-gray-600 block mb-1">Border Width</span>
                            <input 
                                type="text" 
                                placeholder="e.g. 1px"
                                value={selectedField.style?.borderWidth || ''} 
                                onChange={(e) => handleFieldUpdate({ 
                                    style: { ...selectedField.style, borderWidth: e.target.value } 
                                })}
                                className="w-full border border-gray-300 rounded px-2 py-1.5 text-sm"
                            />
                        </div>
                         <div>
                            <span className="text-xs text-gray-600 block mb-1">Border Color</span>
                            <div className="flex gap-2">
                                <input 
                                    type="color" 
                                    value={selectedField.style?.borderColor || '#e5e7eb'} 
                                    onChange={(e) => handleFieldUpdate({ 
                                        style: { ...selectedField.style, borderColor: e.target.value } 
                                    })}
                                    className="h-8 w-8 border rounded cursor-pointer"
                                />
                            </div>
                        </div>
                   </div>
                </div>

                <div className="border-t pt-4">
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Width (Columns)</label>
                  <div className="flex items-center gap-4 mt-2">
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
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-sm font-medium text-gray-700 w-8 text-center">
                      {selectedField.width === 'full' ? 4 : selectedField.width === '1/2' ? 2 : 1}
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <p>Select a field on the canvas to configure styling.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Test Run Modal */}
      {isTestRunOpen && (
        <div className="fixed inset-0 z-[60] overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-5xl h-[85vh] flex flex-col overflow-hidden">
            <div className="bg-gray-900 px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full border-2 border-green-500 flex items-center justify-center">
                   <svg className="w-4 h-4 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd" /></svg>
                </div>
                <h3 className="text-lg font-bold text-white">
                  Test Run: {definition.name || 'New Voucher Type'} ({viewMode.toUpperCase()} Mode)
                </h3>
              </div>
              <button 
                onClick={() => setIsTestRunOpen(false)}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-8 bg-gray-100">
               <div className={`mx-auto ${viewMode === 'windows' ? 'max-w-4xl' : 'max-w-6xl'}`}>
                  <DynamicVoucherRenderer 
                    definition={definition as any}
                    initialValues={{}}
                    onSubmit={() => alert('This is a test run. No data will be saved.')}
                    customComponents={{}} // Add custom components if needed
                  />
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
