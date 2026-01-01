/**
 * DynamicTableRenderer.tsx
 * Renders an editable table for line items.
 */
import React from 'react';
import { TableDefinition } from '../types/TableDefinition';
import { DynamicFieldRenderer } from './DynamicFieldRenderer';
import { Button } from '../../components/ui/Button';

interface Props {
  definition: TableDefinition;
  rows: any[];
  onChange: (newRows: any[]) => void;
  customComponents?: Record<string, React.ComponentType<any>>;
  tableStyle?: 'web' | 'classic';
  readOnly?: boolean;
}

export const DynamicTableRenderer: React.FC<Props> = ({ definition, rows, onChange, customComponents, tableStyle = 'web', readOnly }) => {
  const isClassic = tableStyle === 'classic';
  
  const handleRowChange = (index: number, fieldName: string, value: any) => {
    const updatedRows = [...rows];
    updatedRows[index] = { ...updatedRows[index], [fieldName]: value };
    onChange(updatedRows);
  };

  const addRow = () => {
    // Create empty row based on columns
    const newRow: any = { id: Date.now().toString() }; 
    definition.columns.forEach(col => {
      newRow[col.name] = col.defaultValue || null;
    });
    onChange([...rows, newRow]);
  };

  const removeRow = (index: number) => {
    const updatedRows = [...rows];
    updatedRows.splice(index, 1);
    onChange(updatedRows);
  };

  if (isClassic) {
    return (
      <div className="mt-4 border border-gray-300 rounded overflow-hidden shadow-sm bg-white">
        <table className="w-full text-sm min-w-[600px] border-collapse">
          <thead>
            <tr className="bg-[#f8fafc] border-b border-gray-300">
              <th className="p-2 text-center w-10 text-[11px] font-bold text-slate-600 border-r border-gray-300">#</th>
              {definition.columns.map(col => (
                <th 
                  key={col.id} 
                  className="p-2 text-start text-[11px] font-bold text-slate-600 uppercase tracking-tight border-r border-gray-300"
                  style={col.width ? { width: col.width } : undefined}
                >
                  {col.label}
                </th>
              ))}
              <th className="p-2 w-10 border-gray-300"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.map((row, index) => (
              <tr key={row.id || index} className="hover:bg-indigo-50/30 transition-colors border-b border-gray-200">
                <td className="p-2 text-slate-400 text-[11px] font-medium text-center border-r border-gray-200 bg-slate-50/50">
                  {index + 1}
                </td>
                {definition.columns.map(col => (
                  <td key={col.id} className="p-0 border-r border-gray-200" style={col.width ? { width: col.width } : undefined}>
                    <div className="p-0.5">
                      <DynamicFieldRenderer
                        field={{ ...col, label: '' }} 
                        value={row[col.name]}
                        onChange={(val) => handleRowChange(index, col.name, val)}
                        customComponents={customComponents}
                        noBorder={true}
                        readOnly={readOnly}
                      />
                    </div>
                  </td>
                ))}
                <td className="p-1 text-center w-10">
                  {!readOnly && (
                    <button 
                      onClick={() => removeRow(index)}
                      className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded transition-all"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button 
          onClick={addRow} 
          disabled={readOnly}
          className={`w-full py-2 text-center text-[11px] font-bold text-indigo-600 bg-slate-50 border-t border-gray-200 transition-colors uppercase tracking-widest ${readOnly ? 'opacity-50 cursor-not-allowed' : 'hover:bg-indigo-50'}`}
        >
          + Add Line
        </button>
      </div>
    );
  }

  // Default Web Style
  return (
    <div className="mt-6 mb-6">
       <div className="overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
         <table className="min-w-full divide-y divide-gray-200 bg-white">
           <thead className="bg-gray-50">
             <tr>
               <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">#</th>
               {definition.columns.map(col => (
                 <th key={col.id} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" style={col.width ? { width: col.width } : undefined}>
                   {col.label}
                 </th>
               ))}
               <th className="px-4 py-3 w-16"></th>
             </tr>
           </thead>
           <tbody className="divide-y divide-gray-200">
             {rows.map((row, index) => (
               <tr key={row.id || index} className="hover:bg-gray-50">
                 <td className="px-4 py-3 text-sm text-gray-400 font-mono">
                   {index + 1}
                 </td>
                 {definition.columns.map(col => (
                   <td key={col.id} className="px-4 py-2" style={col.width ? { width: col.width } : undefined}>
                     <DynamicFieldRenderer
                       field={{ ...col, label: '' }} // Hide label in table cell
                       value={row[col.name]}
                       onChange={(val) => handleRowChange(index, col.name, val)}
                       customComponents={customComponents}
                     />
                   </td>
                 ))}
                 <td className="px-4 py-2 text-right">
                   <button 
                     onClick={() => removeRow(index)}
                     className="text-red-400 hover:text-red-600 font-bold px-2"
                     title={definition.removeRowLabel || 'Remove'}
                   >
                     ×
                   </button>
                 </td>
               </tr>
             ))}
             {rows.length === 0 && (
                <tr>
                  <td colSpan={definition.columns.length + 2} className="px-6 py-8 text-center text-gray-500 text-sm">
                    No items added yet.
                  </td>
                </tr>
             )}
           </tbody>
         </table>
       </div>
       
       {!readOnly && (
         <div className="mt-2">
           <Button variant="secondary" size="sm" onClick={addRow}>
             + {definition.addRowLabel || 'Add Row'}
           </Button>
         </div>
       )}
    </div>
  );
};
