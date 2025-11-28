
import React from 'react';
import { FormDefinition } from '../../types/FormDefinition';
import { DynamicFieldRenderer } from '../../components/DynamicFieldRenderer';

interface Props {
  definition: FormDefinition;
  selectedFieldId: string | null;
  onSelectField: (id: string) => void;
  onDropField: (type: string, index?: number) => void;
}

export const DesignerCanvas: React.FC<Props> = ({ 
  definition, 
  selectedFieldId, 
  onSelectField, 
  onDropField 
}) => {
  
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('field_type');
    if (type) {
      onDropField(type);
    }
  };

  return (
    <div 
      className="flex-1 bg-gray-100 p-8 overflow-auto flex flex-col items-center"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <div className="bg-white shadow-lg min-h-[800px] w-full max-w-4xl rounded-lg border border-gray-200 flex flex-col relative">
        {/* Header Mockup */}
        <div className="h-16 border-b flex items-center px-8 bg-gray-50 rounded-t-lg">
           <h1 className="text-xl font-bold text-gray-800">{definition.name}</h1>
           <span className="ml-3 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded font-mono">
             {definition.module}
           </span>
        </div>

        {/* Form Body */}
        <div className="p-8 flex-1">
          {definition.sections.length === 0 || definition.fields.length === 0 ? (
            <div className="h-64 border-2 border-dashed border-gray-300 rounded-lg flex flex-col items-center justify-center text-gray-400 bg-gray-50">
              <span className="text-4xl mb-2">📥</span>
              <p>Drag fields from the toolbox and drop them here</p>
            </div>
          ) : (
            <div className="space-y-8">
              {definition.sections.map(section => {
                 // Get fields for this section
                 const sectionFields = section.fieldIds
                   .map(id => definition.fields.find(f => f.id === id))
                   .filter(f => !!f); // type guard

                 if (sectionFields.length === 0) return null;

                 return (
                   <div key={section.id} className="border border-gray-200 rounded p-4 relative group/section">
                      <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4 border-b pb-2">
                        {section.title}
                      </h3>
                      <div className="grid grid-cols-4 gap-6">
                        {sectionFields.map((field) => {
                            // Ensure field is not undefined
                            if (!field) return null;

                            let colSpan = 'col-span-4';
                            if (field.width === '1/2') colSpan = 'col-span-2';
                            if (field.width === '1/3') colSpan = 'col-span-1'; // Simplified grid
                            if (field.width === '1/4') colSpan = 'col-span-1';

                            const isSelected = field.id === selectedFieldId;

                            return (
                              <div 
                                key={field.id} 
                                className={`${colSpan} relative group cursor-pointer`}
                                onClick={(e) => { e.stopPropagation(); onSelectField(field.id); }}
                              >
                                {/* Selection Ring */}
                                <div className={`
                                  absolute -inset-2 rounded border-2 pointer-events-none transition-all
                                  ${isSelected ? 'border-blue-500 bg-blue-50/20 z-10' : 'border-transparent group-hover:border-gray-200'}
                                `} />
                                
                                <div className="relative z-0 pointer-events-none">
                                    <DynamicFieldRenderer 
                                      field={field} 
                                      value="" 
                                      onChange={() => {}} 
                                    />
                                </div>
                              </div>
                            );
                        })}
                      </div>
                   </div>
                 );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
