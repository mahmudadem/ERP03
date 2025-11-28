import React, { useState } from 'react';

export const DesignerEngine: React.FC = () => {
  const [elements, setElements] = useState<number[]>([]);

  const addElement = () => {
    setElements([...elements, Date.now()]);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] border border-gray-300 rounded bg-white overflow-hidden">
      {/* Toolbox */}
      <div className="w-48 bg-gray-50 border-r border-gray-200 p-4">
        <h3 className="font-bold mb-4 text-sm uppercase text-gray-500">Toolbox</h3>
        <button 
          onClick={addElement}
          className="w-full bg-white border border-gray-300 p-2 mb-2 rounded shadow-sm hover:shadow text-sm"
        >
          Add Rectangle
        </button>
        <button className="w-full bg-white border border-gray-300 p-2 mb-2 rounded shadow-sm hover:shadow text-sm">
          Add Text
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1 bg-gray-100 relative overflow-auto p-8">
        <div className="w-full h-full bg-white shadow-lg min-h-[500px] relative">
          <div className="absolute top-2 left-2 text-gray-300 text-xs">Canvas Area</div>
          {elements.map((el, idx) => (
             <div 
               key={el} 
               className="absolute w-24 h-24 bg-accent/20 border-2 border-accent flex items-center justify-center rounded"
               style={{ top: 50 + (idx * 20), left: 50 + (idx * 20) }}
             >
               Item {idx + 1}
             </div>
          ))}
        </div>
      </div>

      {/* Properties */}
      <div className="w-64 bg-gray-50 border-l border-gray-200 p-4">
        <h3 className="font-bold mb-4 text-sm uppercase text-gray-500">Properties</h3>
        <p className="text-xs text-gray-500 italic">Select an element to view properties.</p>
      </div>
    </div>
  );
};

export default DesignerEngine;