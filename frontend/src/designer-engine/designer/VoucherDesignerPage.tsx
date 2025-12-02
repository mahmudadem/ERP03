
import { useState } from 'react';
import { VoucherTypeDefinition } from '../types/VoucherTypeDefinition';
import { FieldDefinition, FieldType } from '../types/FieldDefinition';
import { SectionDefinition } from '../types/SectionDefinition';
import { FieldListPanel } from './components/FieldListPanel';
import { FieldPropertiesPanel } from './components/FieldPropertiesPanel';
import { DesignerCanvas } from './components/DesignerCanvas';
import { TableEditor } from './components/TableEditor';
import { Button } from '../../components/ui/Button';
import { Tabs } from '../../components/ui/Tabs';

// Initial Mock Definition
const INITIAL_VOUCHER_DEF: VoucherTypeDefinition = {
  id: 'vch_new',
  name: 'New Voucher Type',
  code: 'NVT',
  module: 'ACCOUNTING',
  header: {
    id: 'form_vch_new',
    name: 'Voucher Header',
    module: 'ACCOUNTING',
    version: 1,
    fields: [],
    sections: [{ id: 'sec_1', title: 'Basic Info', fieldIds: [] }],
    rules: []
  },
  lines: {
    id: 'tbl_vch_new',
    name: 'items',
    addRowLabel: 'Add Line',
    columns: [
       { id: 'col_1', name: 'description', label: 'Description', type: 'TEXT', required: true, width: '1/2' },
       { id: 'col_2', name: 'amount', label: 'Amount', type: 'NUMBER', required: true, width: '1/4' }
    ]
  },
  summaryFields: []
};

export const VoucherDesignerPage: React.FC = () => {
  const [definition, setDefinition] = useState<VoucherTypeDefinition>(INITIAL_VOUCHER_DEF);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);

  // --- HEADER DESIGN LOGIC (Duplicated from FormDesigner for independence) ---
  const activeSectionId = definition.header.sections[0]?.id;
  const selectedField = definition.header.fields.find(f => f.id === selectedFieldId) || null;

  const handleDropField = (type: string) => {
    const newField: FieldDefinition = {
      id: `fld_${Date.now()}`,
      name: `field_${definition.header.fields.length + 1}`,
      label: `New ${type}`,
      type: type as FieldType,
      width: 'full',
      required: false,
      readOnly: false,
    };

    setDefinition(prev => {
      const updatedFields = [...prev.header.fields, newField];
      const updatedSections = prev.header.sections.map(sec => {
        if (sec.id === activeSectionId) {
          return { ...sec, fieldIds: [...sec.fieldIds, newField.id] };
        }
        return sec;
      });
      return {
        ...prev,
        header: { ...prev.header, fields: updatedFields, sections: updatedSections }
      };
    });
    setSelectedFieldId(newField.id);
  };

  const handleUpdateField = (updates: Partial<FieldDefinition>) => {
    if (!selectedFieldId) return;
    setDefinition(prev => ({
      ...prev,
      header: {
        ...prev.header,
        fields: prev.header.fields.map(f => f.id === selectedFieldId ? { ...f, ...updates } : f)
      }
    }));
  };

  const handleDeleteField = () => {
    if (!selectedFieldId) return;
    setDefinition(prev => ({
      ...prev,
      header: {
        ...prev.header,
        fields: prev.header.fields.filter(f => f.id !== selectedFieldId),
        sections: prev.header.sections.map(sec => ({
          ...sec,
          fieldIds: sec.fieldIds.filter(id => id !== selectedFieldId)
        }))
      }
    }));
    setSelectedFieldId(null);
  };

  const handleSave = () => {
    console.log('Saved Voucher Type Definition:', definition);
    alert('Voucher Definition saved to console.');
  };

  // --- RENDER ---
  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Top Bar */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4 z-10 shrink-0">
        <div className="flex items-center gap-4">
           <span className="bg-blue-100 text-blue-700 text-xs px-2 py-1 rounded font-bold">VOUCHER DESIGNER</span>
           <input 
             className="font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1"
             value={definition.name}
             onChange={e => setDefinition({...definition, name: e.target.value})}
           />
        </div>
        <div className="flex gap-2">
          <Button variant="primary" size="sm" onClick={handleSave}>Save Definition</Button>
        </div>
      </div>

      {/* Tabs & Content */}
      <div className="flex-1 overflow-hidden flex flex-col">
        <Tabs 
           className="bg-white border-b px-4 pt-2"
           tabs={[
             {
               id: 'header',
               label: 'Header Form',
               content: (
                 <div className="flex h-[calc(100vh-120px)] overflow-hidden">
                    {/* Left: Toolbox */}
                    <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto z-10 shadow-sm shrink-0">
                      <FieldListPanel />
                    </div>

                    {/* Center: Canvas */}
                    <DesignerCanvas 
                      definition={definition.header} 
                      selectedFieldId={selectedFieldId}
                      onSelectField={setSelectedFieldId}
                      onDropField={handleDropField}
                    />

                    {/* Right: Properties */}
                    <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto z-10 shadow-sm shrink-0">
                      <FieldPropertiesPanel 
                        field={selectedField} 
                        onChange={handleUpdateField}
                        onDelete={handleDeleteField}
                      />
                    </div>
                 </div>
               )
             },
             {
               id: 'lines',
               label: 'Line Items Table',
               content: (
                 <div className="p-8 h-[calc(100vh-120px)] overflow-y-auto bg-gray-50">
                    <TableEditor 
                      definition={definition.lines} 
                      onChange={(newLinesDef) => setDefinition(prev => ({ ...prev, lines: newLinesDef }))} 
                    />
                 </div>
               )
             }
           ]}
        />
      </div>
    </div>
  );
};
