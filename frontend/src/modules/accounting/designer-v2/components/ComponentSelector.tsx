/**
 * ComponentSelector.tsx
 * 
 * UI component to select field component type from library.
 * Shows component categories and allows selection.
 */

import React, { useState } from 'react';
import { 
  FieldComponentType, 
  ComponentMetadata, 
  COMPONENT_LIBRARY,
  getAvailableComponents 
} from '../types/FieldComponents';

interface Props {
  fieldType: string;
  currentComponent?: FieldComponentType;
  onSelect: (componentType: FieldComponentType) => void;
  onClose: () => void;
}

export const ComponentSelector: React.FC<Props> = ({
  fieldType,
  currentComponent,
  onSelect,
  onClose
}) => {
  const [selectedCategory, setSelectedCategory] = useState<'Basic' | 'Advanced' | 'Specialized' | 'All'>('All');
  
  // Get available components for this field type
  const availableComponentTypes = getAvailableComponents(fieldType);
  
  // Filter component library
  const availableComponents = COMPONENT_LIBRARY.filter(comp => 
    availableComponentTypes.includes(comp.type)
  );
  
  // Filter by category
  const filteredComponents = selectedCategory === 'All' 
    ? availableComponents
    : availableComponents.filter(c => c.category === selectedCategory);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-black bg-opacity-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-4 rounded-t-xl">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-bold text-white">Select Component Type</h3>
              <p className="text-sm text-white/80 mt-1">Choose how this field should appear</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Category Tabs */}
        <div className="border-b border-gray-200 px-6 pt-4">
          <div className="flex gap-2">
            {['All', 'Basic', 'Advanced', 'Specialized'].map(category => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category as any)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  selectedCategory === category
                    ? 'bg-white text-indigo-600 border-t-2 border-x-2 border-indigo-600 -mb-px'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        {/* Component Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          {filteredComponents.length > 0 ? (
            <div className="grid grid-cols-2 gap-4">
              {filteredComponents.map(component => {
                const isSelected = component.type === currentComponent;
                
                return (
                  <button
                    key={component.type}
                    onClick={() => onSelect(component.type)}
                    className={`
                      p-4 rounded-lg border-2 text-left transition-all duration-200
                      ${isSelected
                        ? 'border-indigo-600 bg-indigo-50 shadow-md'
                        : 'border-gray-200 hover:border-indigo-400 hover:shadow-sm'
                      }
                    `}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className="text-3xl flex-shrink-0">
                        {component.icon}
                      </div>
                      
                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-bold text-gray-900 truncate">
                            {component.label}
                          </h4>
                          {isSelected && (
                            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>
                        <p className="text-xs text-gray-600 line-clamp-2">
                          {component.description}
                        </p>
                        <div className="mt-2">
                          <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-600">
                            {component.category}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
              </svg>
              <p className="text-gray-600">No components available in this category</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-gray-50 px-6 py-4 rounded-b-xl border-t border-gray-200 flex justify-between items-center">
          <div className="text-sm text-gray-600">
            {filteredComponents.length} component{filteredComponents.length !== 1 ? 's' : ''} available
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-100 font-medium transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
