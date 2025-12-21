# VOUCHER TYPE SELECTION STEP - TO BE ADDED

## Location: 
After "Chart of Accounts" step (line ~411) and before "Review & Confirm" step in the `steps` array.

## Step Object to Insert:

```tsx
{
  title: 'Voucher Types',
  icon: FileCheck,
  content: (() => {
    const toggleVoucherType = (voucherId: string) => {
      setSetupData(prev => {
        const current = prev.selectedVoucherTypes || [];
        const isSelected = current.includes(voucherId);
        
        return {
          ...prev,
          selectedVoucherTypes: isSelected
            ? current.filter(id => id !== voucherId)
            : [...current, voucherId]
        };
      });
    };

    const selectAll = () => {
      setSetupData(prev => ({
        ...prev,
        selectedVoucherTypes: systemVoucherTypes.map(vt => vt.id)
      }));
    };

    const selectNone = () => {
      setSetupData(prev => ({
        ...prev,
        selectedVoucherTypes: []
      }));
    };

    return (
      <div className="py-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-2 text-center">
          Select Voucher Types
        </h2>
        <p className="text-gray-600 mb-6 text-center">
          Choose which voucher types to include in your accounting setup
        </p>

        {/* Selection Controls */}
        <div className="flex justify-between items-center mb-6 max-w-4xl mx-auto">
          <p className="text-sm text-gray-600">
            {setupData.selectedVoucherTypes?.length || 0} of {systemVoucherTypes.length} selected
          </p>
          <div className="flex gap-2">
            <button
              onClick={selectAll}
              className="px-3 py-1.5 text-sm text-primary-600 hover:bg-primary-50 rounded transition"
            >
              Select All
            </button>
            <button
              onClick={selectNone}
              className="px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-50 rounded transition"
            >
              Clear All
            </button>
          </div>
        </div>

        {/* Voucher Types Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto">
          {isLoadingData ? (
            <div className="col-span-2 flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary-600" />
              <span className="ml-3 text-gray-600">Loading voucher types...</span>
            </div>
          ) : systemVoucherTypes.length === 0 ? (
            <div className="col-span-2 text-center py-12">
              <FileCheck className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No voucher types available</p>
              <p className="text-sm text-gray-500 mt-1">
                Contact your system administrator to configure voucher types
              </p>
            </div>
          ) : (
            systemVoucherTypes.map((voucherType) => {
              const isSelected = setupData.selectedVoucherTypes?.includes(voucherType.id);
              
              return (
                <button
                  key={voucherType.id}
                  onClick={() => toggleVoucherType(voucherType.id)}
                  className={`p-5 rounded-lg border-2 transition-all text-left hover:border-primary-500 ${
                    isSelected
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 bg-white'
                  }`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-lg font-bold text-gray-900">{voucherType.name}</h3>
                        {voucherType.isRecommended && (
                          <span className="inline-flex items-center px-2 py-0.5 bg-blue-100 text-blue-700 text-xs font-medium rounded">
                            Recommended
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mb-2">
                        Prefix: <span className="font-mono font-semibold">{voucherType.prefix}</span>
                      </p>
                      {voucherType.description && (
                        <p className="text-sm text-gray-500">{voucherType.description}</p>
                      )}
                    </div>
                    {isSelected && (
                      <CheckCircle className="w-6 h-6 text-primary-600 flex-shrink-0 ml-2" />
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg max-w-4xl mx-auto">
          <div className="flex">
            <FileCheck className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>Tip:</strong> You can add more voucher types later from the Voucher Designer, 
                or clone the default ones to customize them.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  })(),
},
```

## Also Update Review Step:

Add voucher types to the review/confirm step around line 511 (after COA Template section):

```tsx
{/* Voucher Types */}
<div className="bg-white border border-gray-200 rounded-lg p-6">
  <div className="flex items-start">
    <FileCheck className="w-6 h-6 text-primary-600 mr-3 flex-shrink-0 mt-1" />
    <div className="flex-1">
      <h3 className="text-lg font-semibold text-gray-900 mb-2">Selected Voucher Types</h3>
      {setupData.selectedVoucherTypes && setupData.selectedVoucherTypes.length > 0 ? (
        <div className="space-y-2">
          {setupData.selectedVoucherTypes.map(id => {
            const vt = systemVoucherTypes.find(v => v.id === id);
            return vt ? (
              <div key={id} className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-primary-600" />
                <span className="font-medium">{vt.name}</span>
                <span className="text-sm text-gray-500">({vt.prefix})</span>
              </div>
            ) : null;
          })}
          <p className="text-sm text-gray-600 mt-3">
            Total: {setupData.selectedVoucherTypes.length} voucher type(s)
          </p>
        </div>
      ) : (
        <p className="text-sm text-gray-600">No voucher types selected</p>
      )}
    </div>
  </div>
</div>
```

## IMPLEMENTATION STATUS:

✅ Backend - Updated to accept selectedVoucherTypes  
✅ Service - Created loadSystemVoucherTypes()  
✅ Interface - Added selectedVoucherTypes to AccountingSetupData  
✅ State - Added systemVoucherTypes state  
✅ Loading - Fetches voucher types on mount  
✅ Auto-selection - Selects recommended (or all) by default  

⏳ REMAINING:
- Add the step object to the steps array (insert at index 4, before Review)
- Update Review step to show selected vouchers
- Test the complete flow

The step should be inserted between Chart of Accounts and Review & Confirm!
