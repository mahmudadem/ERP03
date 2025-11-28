
/**
 * TableEditor.tsx
 * Component to configure dynamic table columns.
 */
import React, { useState, useEffect } from 'react';
import { TableDefinition } from '../../types/TableDefinition';
import { Button } from '../../../components/ui/Button';
import { FieldType } from '../../types/FieldDefinition';

interface Props {
  definition: TableDefinition;
  onChange: (def: TableDefinition) => void;
}

export const TableEditor: React.FC<Props> = ({ definition, onChange }) => {
  // Local state to manage inputs before propagating? 
  // Actually, for a designer, direct propagation or local state + save is fine.
  // We'll use local state derived from props to avoid jitter, but sync back often.
  
  const [columns, setColumns] = useState(definition.columns || []);
  const [addRowLabel, setAddRowLabel] = useState(definition.addRowLabel || 'Add Item');

  useEffect(() => {
    setColumns(definition.columns || []);
    setAddRowLabel(definition.addRowLabel || 'Add Item');
  }, [definition]);

  const notifyChange = (newCols: any[], newLabel: string) => {
    onChange({
      ...definition,
      columns: newCols,
      addRowLabel: newLabel
    });
  };

  const addColumn = () => {
    const newCol: any = { 
      id: `col_${Date.now()}`, 
      name: `col_${columns.length + 1}`, 
      label: 'New Column', 
      type: 'TEXT', 
      required: false,
      width: '1/4'
    };
    const newCols = [...columns, newCol];
    setColumns(newCols);
    notifyChange(newCols, addRowLabel);
  };

  const updateColumn = (index: number, key: string, val: any) => {
    const newCols = [...columns];
    newCols[index] = { ...newCols[index], [key]: val };
    setColumns(newCols);
    notifyChange(newCols, addRowLabel);
  };

  const removeColumn = (index: number) => {
    const newCols = [...columns];
    newCols.splice(index, 1);
    setColumns(newCols);
    notifyChange(newCols, addRowLabel);
  };

  const handleLabelChange = (val: string) => {
    setAddRowLabel(val);
    notifyChange(columns, val);
  };

  return (
    <div className="bg-white p-6 border rounded shadow-sm max-w-4xl mx-auto">
      <h3 className="font-bold text-lg text-gray-800 mb-6 border-b pb-2">Line Items Configuration</h3>

      <div className="grid grid-cols-2 gap-6 mb-8">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Table ID</label>
          <input 
             className="w-full border rounded px-3 py-2 bg-gray-50 text-gray-500 font-mono text-sm"
             value={definition.id}
             readOnly
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">"Add Row" Button Label</label>
          <input 
            className="w-full border rounded px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={addRowLabel} 
            onChange={e => handleLabelChange(e.target.value)} 
          />
        </div>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-center mb-2">
           <div className="text-xs font-bold text-gray-500 uppercase tracking-wider">Defined Columns</div>
           <span className="text-xs text-gray-400">{columns.length} columns</span>
        </div>
        
        {columns.map((col, idx) => (
          <div key={col.id} className="flex gap-3 items-start bg-gray-50 p-3 rounded border border-gray-200 hover:border-blue-300 transition-colors">
            <div className="flex-1 space-y-2">
               <div className="flex gap-2">
                  <input 
                    className="flex-1 text-sm border rounded px-2 py-1 focus:ring-1 focus:ring-blue-500 outline-none"
                    value={col.label}
                    onChange={e => updateColumn(idx, 'label', e.target.value)}
                    placeholder="Column Header"
                  />
                  <input 
                    className="flex-1 text-sm border rounded px-2 py-1 font-mono text-xs focus:ring-1 focus:ring-blue-500 outline-none"
                    value={col.name}
                    onChange={e => updateColumn(idx, 'name', e.target.value)}
                    placeholder="dataKey"
                  />
               </div>
               <div className="flex gap-2">
                  <select 
                    className="w-1/3 text-xs border rounded px-2 py-1 bg-white"
                    value={col.type}
                    onChange={e => updateColumn(idx, 'type', e.target.value as FieldType)}
                  >
                    <option value="TEXT">Text</option>
                    <option value="NUMBER">Number</option>
                    <option value="SELECT">Select</option>
                    <option value="DATE">Date</option>
                  </select>
                  <select 
                    className="w-1/3 text-xs border rounded px-2 py-1 bg-white"
                    value={col.width || '1/4'}
                    onChange={e => updateColumn(idx, 'width', e.target.value)}
                  >
                    <option value="1/6">Narrow</option>
                    <option value="1/4">Normal</option>
                    <option value="1/2">Wide</option>
                    <option value="full">Full Width</option>
                  </select>
               </div>
            </div>
            
            <button 
              onClick={() => removeColumn(idx)}
              className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-red-50"
              title="Remove Column"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
          </div>
        ))}
        
        <div className="pt-4">
          <Button variant="secondary" size="sm" onClick={addColumn} className="w-full border-dashed border-2">
            + Add New Column
          </Button>
        </div>
      </div>
    </div>
  );
};
