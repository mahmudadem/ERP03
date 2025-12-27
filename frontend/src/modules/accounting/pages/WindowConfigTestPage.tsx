import React, { useState } from 'react';
import { Settings, Eye } from 'lucide-react';
import { WindowConfigDesigner } from '../../../components/windows/WindowConfigDesigner';
import { ConfigurableWindow } from '../../../components/windows/ConfigurableWindow';
import { WindowConfig, DEFAULT_CONFIGS } from '../../../types/WindowConfig';

export const WindowConfigTestPage: React.FC = () => {
  const [showDesigner, setShowDesigner] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [currentConfig, setCurrentConfig] = useState<WindowConfig>(DEFAULT_CONFIGS.voucher);
  const [selectedTemplate, setSelectedTemplate] = useState<'voucher' | 'invoice' | 'report'>('voucher');

  // Sample data for testing widgets
  const sampleData = {
    'voucher.totalDebit': 5000,
    'voucher.totalCredit': 5000,
    'invoice.subtotal': 1200,
    'invoice.total': 1380,
    'document.status': 'draft',
    'document.lineCount': 5,
  };

  const handleSaveConfig = (config: WindowConfig) => {
    setCurrentConfig(config);
    setShowDesigner(false);
    // Don't auto-show preview, let user click "Test Preview"
  };

  const loadTemplate = (template: 'voucher' | 'invoice' | 'report') => {
    setSelectedTemplate(template);
    setCurrentConfig(DEFAULT_CONFIGS[template]);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Settings className="text-indigo-600" />
            Window Configuration System - Test Page
          </h1>
          <p className="text-gray-600 mt-2">
            Test the configurable window system with drag-drop designer
          </p>
        </div>

        {/* Controls */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Controls</h2>
          
          <div className="grid grid-cols-3 gap-6">
            {/* Load Template */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Load Template
              </label>
              <div className="flex gap-2">
                <button
                  onClick={() => loadTemplate('voucher')}
                  className={`px-4 py-2 rounded border ${
                    selectedTemplate === 'voucher'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Voucher
                </button>
                <button
                  onClick={() => loadTemplate('invoice')}
                  className={`px-4 py-2 rounded border ${
                    selectedTemplate === 'invoice'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Invoice
                </button>
                <button
                  onClick={() => loadTemplate('report')}
                  className={`px-4 py-2 rounded border ${
                    selectedTemplate === 'report'
                      ? 'bg-indigo-600 text-white border-indigo-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  Report
                </button>
              </div>
            </div>

            {/* Designer / Preview Controls */}
            <div className="flex gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customize
                </label>
                <button
                  onClick={() => setShowDesigner(true)}
                  className="px-6 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 flex items-center gap-2"
                >
                  <Settings size={18} />
                  Open Designer
                </button>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Validation
                </label>
                <button
                  onClick={() => setShowPreview(true)}
                  disabled={showPreview}
                  className="px-6 py-2 bg-green-600 text-white rounded hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  <Eye size={18} />
                  Test Preview
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Current Configuration Info */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Current Configuration</h2>
          
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-gray-600">Window Type:</span>
              <span className="ml-2 font-medium text-gray-900">{currentConfig.windowType}</span>
            </div>
            <div>
              <span className="text-gray-600">Title:</span>
              <span className="ml-2 font-medium text-gray-900">{currentConfig.header.title}</span>
            </div>
            <div>
              <span className="text-gray-600">Body Component:</span>
              <span className="ml-2 font-medium text-gray-900">{currentConfig.body.component}</span>
            </div>
            <div>
              <span className="text-gray-600">Header Components:</span>
              <span className="ml-2 font-medium text-gray-900">{currentConfig.header.components?.length || 0}</span>
            </div>
            <div>
              <span className="text-gray-600">Footer Components:</span>
              <span className="ml-2 font-medium text-gray-900">{currentConfig.footer.components?.length || 0}</span>
            </div>
            <div>
              <span className="text-gray-600">Show Controls:</span>
              <span className="ml-2 font-medium text-gray-900">{currentConfig.header.showControls ? 'Yes' : 'No'}</span>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <h3 className="font-bold text-blue-900 mb-2">How to Use:</h3>
          <ol className="list-decimal list-inside space-y-1 text-blue-800 text-sm">
            <li>Click "Load Template" to see pre-configured window layouts</li>
            <li>Click "Open Designer" to customize the configuration</li>
            <li>Drag components from the library to the grid canvas (header or footer)</li>
            <li>Click on a component to select it and use resize controls</li>
            <li>Click the trash icon to remove components</li>
            <li>Click "Save Config" to apply changes</li>
            <li>Click <strong>"Test Preview"</strong> to see the window in action!</li>
          </ol>
        </div>

        {/* Live Preview Area */}
        <div className="bg-gray-100 rounded-lg p-8 min-h-[500px] relative overflow-hidden border-2 border-dashed border-gray-300 flex items-center justify-center">
          {!showPreview ? (
            <div className="text-center">
              <div className="bg-white p-6 rounded-full shadow-sm inline-block mb-4">
                <Eye size={48} className="text-gray-300" />
              </div>
              <p className="text-gray-500 font-medium">Click "Test Preview" to launch the configurable window</p>
            </div>
          ) : (
            <ConfigurableWindow
              config={currentConfig}
              data={sampleData}
              onClose={() => setShowPreview(false)}
              onMinimize={() => console.log('Minimize')}
              onMaximize={() => console.log('Maximize')}
            >
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-gray-900">
                  Sample {currentConfig.windowType} Content
                </h3>
                <div className="p-4 bg-blue-50 border border-blue-100 rounded text-blue-800">
                  This is a test preview of your window configuration. 
                  You can now drag this window by the header and close it using the X button.
                </div>
              </div>
            </ConfigurableWindow>
          )}
        </div>
      </div>

      {/* Designer Modal */}
      {showDesigner && (
        <WindowConfigDesigner
          initialConfig={currentConfig}
          onSave={handleSaveConfig}
          onCancel={() => setShowDesigner(false)}
        />
      )}
    </div>
  );
};
