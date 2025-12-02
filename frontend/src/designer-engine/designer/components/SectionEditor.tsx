
import { useState, useEffect } from 'react';
import { SectionDefinition } from '../../types/SectionDefinition';
import { Button } from '../../../components/ui/Button';

interface Props {
  section?: SectionDefinition;
  onSave?: (section: SectionDefinition) => void;
  onCancel?: () => void;
}

export const SectionEditor: React.FC<Props> = ({ section, onSave, onCancel }) => {
  const [title, setTitle] = useState(section?.title || '');
  const [fieldIds, setFieldIds] = useState(section?.fieldIds.join(', ') || '');

  useEffect(() => {
    if (section) {
      setTitle(section.title || '');
      setFieldIds(section.fieldIds.join(', '));
    }
  }, [section]);

  const handleSave = () => {
    if (!onSave) return;
    
    onSave({
      id: section?.id || `sec_${Date.now()}`,
      title,
      fieldIds: fieldIds.split(',').map(s => s.trim()).filter(Boolean),
      collapsed: false
    });
  };

  return (
    <div className="bg-white p-4 border rounded shadow-sm">
      <h3 className="font-bold text-sm text-gray-700 mb-3">
        {section ? 'Edit Section' : 'New Section'}
      </h3>
      
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Section Title</label>
          <input 
            className="w-full border rounded px-2 py-1 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. General Info"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Field IDs (comma separated)</label>
          <input 
            className="w-full border rounded px-2 py-1 text-sm font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            value={fieldIds}
            onChange={e => setFieldIds(e.target.value)}
            placeholder="field1, field2"
            readOnly // For now, we manage IDs via drag drop, but display them here
          />
          <p className="text-[10px] text-gray-400 mt-1">Field IDs are managed by the layout engine.</p>
        </div>

        <div className="flex justify-end gap-2 mt-4">
          {onCancel && <Button variant="ghost" size="sm" onClick={onCancel}>Cancel</Button>}
          <Button variant="primary" size="sm" onClick={handleSave}>Save</Button>
        </div>
      </div>
    </div>
  );
};
