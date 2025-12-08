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
        {/* Canvas Area */}
        <div className="flex-1 bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-4 overflow-y-auto">
          
          {/* Header Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                Header Section
              </div>
              <div className="flex gap-1 text-gray-400">
                <svg className="w-4 h-4 cursor-pointer hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                <svg className="w-4 h-4 cursor-pointer hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <div className="p-4 grid grid-cols-4 gap-4">
              {headerFields.map(field => {
                const colSpan = field.width === 'full' ? 'col-span-4' : field.width === '1/2' ? 'col-span-2' : 'col-span-1';
                const isSelected = selectedFieldId === field.id;
                
                return (
                  <div 
                    key={field.id}
                    className={`
                      ${colSpan} relative group cursor-pointer
                      border rounded-md p-3 transition-all duration-200
                      ${isSelected ? 'border-indigo-500 ring-1 ring-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300 hover:shadow-sm bg-white'}
                    `}
                    onClick={() => setSelectedFieldId(field.id)}
                  >
                    <div className="text-xs font-medium text-gray-500 mb-1">{field.label}</div>
                    <div className="h-8 bg-gray-50 rounded border border-gray-100 w-full"></div>
                    
                    {/* Resize Handle (Visual Only) */}
                    <div className="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize hover:bg-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                );
              })}
              {headerFields.length === 0 && (
                <div className="col-span-4 py-8 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-lg">
                  No header fields defined. Go back to "Fields" step to add some.
                </div>
              )}
            </div>
          </div>

          {/* Body Section */}
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gray-50 px-4 py-2 border-b border-gray-200 flex justify-between items-center">
              <div className="flex items-center gap-2 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" /></svg>
                Body Section
              </div>
              <div className="flex gap-1 text-gray-400">
                <svg className="w-4 h-4 cursor-pointer hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                <svg className="w-4 h-4 cursor-pointer hover:text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </div>
            </div>
            <div className="p-4">
              <div className="w-full h-24 bg-gray-50 border border-gray-200 rounded flex items-center justify-center text-gray-400 text-sm">
                Line Items Table
              </div>
            </div>
          </div>

        </div>

        {/* Properties Panel */}
        <div className="w-80 bg-white rounded-xl border border-gray-200 shadow-sm flex flex-col">
          <div className="p-4 border-b border-gray-200 flex items-center gap-2">
            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" /></svg>
            <h4 className="font-bold text-gray-900">Properties</h4>
          </div>
          
          <div className="p-4 flex-1 overflow-y-auto space-y-6">
            {selectedField ? (
              <>
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Field ID</label>
                  <input 
                    type="text" 
                    value={selectedField.id} 
                    disabled 
                    className="w-full bg-gray-100 border border-gray-200 rounded px-3 py-2 text-sm text-gray-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Custom Label</label>
                  <input 
                    type="text" 
                    value={selectedField.label} 
                    onChange={(e) => handleFieldUpdate({ label: e.target.value })}
                    className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Width (Columns)</label>
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
                      className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                    />
                    <span className="text-sm font-medium text-gray-700 w-8 text-center">
                      {selectedField.width === 'full' ? 4 : selectedField.width === '1/2' ? 2 : 1}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Grid has 4 columns total.</p>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Move To Section</label>
                  <select className="w-full border border-gray-300 rounded px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                    <option>HEADER</option>
                    <option disabled>BODY (Coming Soon)</option>
                    <option disabled>FOOTER (Coming Soon)</option>
                  </select>
                </div>
              </>
            ) : (
              <div className="text-center py-10 text-gray-400">
                <p>Select a field on the canvas to edit its properties.</p>
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
