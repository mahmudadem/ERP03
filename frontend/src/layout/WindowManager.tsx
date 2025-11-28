
import React, { useState } from 'react';
import { WindowFrame } from './WindowFrame';

// Mock Component for demonstration
const MockContent = ({ text }: { text: string }) => (
  <div className="p-4">
    <h2 className="text-xl font-bold mb-4">{text}</h2>
    <p className="text-gray-600">This is running inside a windowed container.</p>
    <div className="mt-4 grid grid-cols-2 gap-4">
       <input className="border p-2 rounded w-full" placeholder="Input A" />
       <input className="border p-2 rounded w-full" placeholder="Input B" />
    </div>
  </div>
);

export const WindowManager: React.FC = () => {
  // Mock State for open windows
  // In a real app, this would be global state (Redux/Zustand) triggered by the Sidebar
  const [windows, setWindows] = useState([
    { id: 'win1', title: 'Dashboard', component: <MockContent text="Dashboard Content" />, z: 1 },
    { id: 'win2', title: 'Voucher Entry #1023', component: <MockContent text="Voucher Entry" />, z: 2 },
  ]);

  const [activeId, setActiveId] = useState('win2');

  const bringToFront = (id: string) => {
    setActiveId(id);
    setWindows(prev => {
      const maxZ = Math.max(...prev.map(w => w.z));
      return prev.map(w => w.id === id ? { ...w, z: maxZ + 1 } : w);
    });
  };

  const closeWindow = (id: string) => {
    setWindows(prev => prev.filter(w => w.id !== id));
  };

  if (windows.length === 0) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400">
        <p className="text-lg">No open windows</p>
        <button 
           onClick={() => setWindows([{ id: 'new', title: 'New Window', component: <MockContent text="New Window" />, z: 1 }])}
           className="mt-4 text-blue-500 hover:underline"
        >
          Open App
        </button>
      </div>
    );
  }

  return (
    <div className="relative w-full h-full bg-slate-100 overflow-hidden">
      {windows.map(win => (
        <WindowFrame
          key={win.id}
          id={win.id}
          title={win.title}
          isActive={win.id === activeId}
          zIndex={win.z}
          onClose={() => closeWindow(win.id)}
          onFocus={() => bringToFront(win.id)}
        >
          {win.component}
        </WindowFrame>
      ))}
    </div>
  );
};
