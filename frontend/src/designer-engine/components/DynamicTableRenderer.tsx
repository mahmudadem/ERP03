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
}

export const DynamicTableRenderer: React.FC<Props> = ({ definition, rows, onChange, customComponents }) => {
  
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
       
       <div className="mt-2">
         <Button variant="secondary" size="sm" onClick={addRow}>
           + {definition.addRowLabel || 'Add Row'}
         </Button>
       </div>
    </div>
  );
};