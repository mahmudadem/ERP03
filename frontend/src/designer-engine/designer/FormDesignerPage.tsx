
import { useState } from 'react';
import { FieldListPanel } from './components/FieldListPanel';
import { FieldPropertiesPanel } from './components/FieldPropertiesPanel';
import { SectionEditor } from './components/SectionEditor';
import { DesignerCanvas } from './components/DesignerCanvas';
import { FormDefinition } from '../types/FormDefinition';
import { FieldDefinition, FieldType } from '../types/FieldDefinition';
import { SectionDefinition } from '../types/SectionDefinition';
import { Button } from '../../components/ui/Button';
import { errorHandler } from '../../services/errorHandler';

// Initial State with a default section to ensure fields render
const INITIAL_FORM: FormDefinition = {
  id: 'new_form',
  name: 'Untitled Form',
  module: 'CORE',
  version: 1,
  fields: [],
  sections: [
    { id: 'sec_default', title: 'General Information', fieldIds: [] }
  ],
  rules: []
};

export const FormDesignerPage: React.FC = () => {
  const [definition, setDefinition] = useState<FormDefinition>(INITIAL_FORM);
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  
  // For MVP, we simple add to the first section. 
  // Future: Allow selecting active section.
  const activeSectionId = definition.sections[0]?.id;

  const selectedField = definition.fields.find(f => f.id === selectedFieldId) || null;

  const handleDropField = (type: string) => {
    const newField: FieldDefinition = {
      id: `fld_${Date.now()}`,
      name: `field_${definition.fields.length + 1}`,
      label: `New ${type}`,
      type: type as FieldType,
      width: 'full',
      required: false,
      readOnly: false,
    };

    setDefinition(prev => {
      // 1. Add to fields list
      const updatedFields = [...prev.fields, newField];
      
      // 2. Add reference to the active section
      const updatedSections = prev.sections.map(sec => {
        if (sec.id === activeSectionId) {
          return { ...sec, fieldIds: [...sec.fieldIds, newField.id] };
        }
        return sec;
      });

      return {
        ...prev,
        fields: updatedFields,
        sections: updatedSections
      };
    });
    
    setSelectedFieldId(newField.id);
  };

  const handleUpdateField = (updates: Partial<FieldDefinition>) => {
    if (!selectedFieldId) return;
    setDefinition(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.id === selectedFieldId ? { ...f, ...updates } : f)
    }));
  };

  const handleDeleteField = () => {
    if (!selectedFieldId) return;
    setDefinition(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.id !== selectedFieldId),
      // Remove reference from sections
      sections: prev.sections.map(sec => ({
        ...sec,
        fieldIds: sec.fieldIds.filter(id => id !== selectedFieldId)
      }))
    }));
    setSelectedFieldId(null);
  };

  const handleUpdateSection = (sectionId: string, updates: Partial<SectionDefinition>) => {
    setDefinition(prev => ({
      ...prev,
      sections: prev.sections.map(s => s.id === sectionId ? { ...s, ...updates } : s)
    }));
  };

  const handleSave = () => {
    console.log('Saved Form Definition:', definition);
    errorHandler.showSuccess('Form Definition saved to console. (Valid JSON generated)');
  };

  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">
      {/* Designer Toolbar */}
      <div className="h-14 bg-white border-b flex items-center justify-between px-4 z-10">
        <div className="flex items-center gap-4">
           <input 
             className="font-bold text-gray-800 bg-transparent border-b border-transparent hover:border-gray-300 focus:border-blue-500 focus:outline-none px-1"
             value={definition.name}
             onChange={e => setDefinition({...definition, name: e.target.value})}
           />
           <span className="text-xs text-gray-400">({definition.fields.length} fields)</span>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="sm">Preview</Button>
          <Button variant="primary" size="sm" onClick={handleSave}>Save Design</Button>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left: Toolbox */}
        <div className="w-64 bg-white border-r border-gray-200 overflow-y-auto z-10 shadow-sm">
          <FieldListPanel />
        </div>

        {/* Center: Canvas */}
        <DesignerCanvas 
          definition={definition} 
          selectedFieldId={selectedFieldId}
          onSelectField={setSelectedFieldId}
          onDropField={handleDropField}
        />

        {/* Right: Properties */}
        <div className="w-80 bg-white border-l border-gray-200 overflow-y-auto z-10 shadow-sm flex flex-col">
          {/* Field Properties */}
          <div className="flex-1 border-b border-gray-200">
             <FieldPropertiesPanel 
               field={selectedField} 
               onChange={handleUpdateField}
               onDelete={handleDeleteField}
             />
          </div>
          
          {/* Section Properties (Simplified Editor) */}
          <div className="h-1/3 bg-gray-50 p-4 overflow-y-auto">
             <h4 className="font-bold text-xs uppercase text-gray-500 mb-2">Active Section</h4>
             {definition.sections.map(sec => (
               <div key={sec.id} className="mb-2">
                 <input 
                   className="w-full text-sm border rounded px-2 py-1"
                   value={sec.title}
                   onChange={(e) => handleUpdateSection(sec.id, { title: e.target.value })}
                 />
               </div>
             ))}
          </div>
        </div>
      </div>
    </div>
  );
};
