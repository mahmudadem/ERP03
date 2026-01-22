import React, { useRef } from 'react';
import { Printer, Download, Image as ImageIcon, X, FileText } from 'lucide-react';
import { VoucherDetailDTO } from '../../../api/accountingApi';
import { formatCompanyDate, formatCompanyTime } from '../../../utils/dateUtils';
import { useCompanySettings } from '../../../hooks/useCompanySettings';
import { useCompanyAccess } from '../../../context/CompanyAccessContext';
import { useAccounts } from '../../../context/AccountsContext';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { cn } from '../../../lib/utils';

interface Props {
  voucher: VoucherDetailDTO;
  onClose: () => void;
  voucherType?: any;
}

export const VoucherPrintView: React.FC<Props> = ({ voucher, onClose, voucherType }) => {
  const { settings } = useCompanySettings();
  const { company } = useCompanyAccess();
  const { getAccountById, getAccountByCode } = useAccounts();
  const printRef = useRef<HTMLDivElement>(null);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'approved': return 'success';
      case 'pending': return 'warning';
      case 'draft': return 'default';
      case 'cancelled': return 'error';
      case 'locked': return 'info';
      default: return 'default';
    }
  };

  const handleDownloadPDF = async () => {
    if (!printRef.current) return;
    
    // Using any to bypass potential type mismatch in older @types
    const canvas = await (html2canvas as any)(printRef.current, {
      scale: 2,
      useCORS: true,
      logging: false,
    });
    
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });
    
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
    pdf.save(`Voucher_${voucher.voucherNo || voucher.id}.pdf`);
  };

  const handleDownloadImage = async () => {
    if (!printRef.current) return;
    
    const canvas = await (html2canvas as any)(printRef.current, {
      scale: 2, // Higher quality
      useCORS: true,
      logging: false,
    });
    
    const link = document.createElement('a');
    link.download = `Voucher_${voucher.voucherNo || voucher.id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-slate-100 animate-in fade-in duration-300">
      {/* Header Actions */}
      <div className="flex items-center justify-between px-6 py-4 bg-white border-b border-slate-200 shadow-sm sticky top-0 z-10 no-print">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900">Official View</h2>
            <p className="text-xs text-slate-500">{voucher.voucherNo || voucher.id}</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="secondary" onClick={handlePrint} className="flex items-center gap-2">
            <Printer className="w-4 h-4" />
            Print
          </Button>
          <Button variant="secondary" onClick={handleDownloadPDF} className="flex items-center gap-2 text-indigo-600">
            <Download className="w-4 h-4" />
            PDF
          </Button>
          <Button variant="secondary" onClick={handleDownloadImage} className="flex items-center gap-2">
            <ImageIcon className="w-4 h-4" />
            Image
          </Button>
          <div className="w-[1px] h-6 bg-slate-200 mx-2" />
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-8 flex justify-center pb-24 bg-slate-100">
        {/* Printable Paper */}
        <div 
          ref={printRef}
          className="bg-white w-full max-w-[850px] shadow-2xl p-16 min-h-[1100px] flex flex-col relative print:shadow-none print:p-0"
        >
          {/* Header Section */}
          <div className="flex justify-between items-start mb-2 relative">
             <div>
                <h1 className="text-4xl font-black text-slate-900 tracking-tight uppercase mb-4">
                  {voucherType?.name || (voucher.type === 'JOURNAL_ENTRY' ? 'JOURNAL VOUCHER' : voucher.type.replace('_', ' ') + ' VOUCHER')}
                  {voucher.status === 'draft' && ' - DRAFT'}
                </h1>
                <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-slate-600">
                   {/* 1. Standard Critical Fields (Built-in) */}
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-slate-900 w-24 text-sm">No:</span>
                     <span className="text-sm">{voucher.voucherNo || voucher.id}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-slate-900 w-24 text-sm">Date:</span>
                     <span className="text-sm">{formatCompanyDate(voucher.date, settings)}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-slate-900 w-24 text-sm">Created At:</span>
                     <span className="text-sm">
                       {voucher.createdAt 
                         ? `${formatCompanyDate(voucher.createdAt, settings)} ${formatCompanyTime(voucher.createdAt, settings)}`
                         : 'N/A'}
                     </span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-slate-900 w-24 text-sm">Print Time:</span>
                     <span className="text-sm">
                       {formatCompanyDate(new Date(), settings)} {formatCompanyTime(new Date(), settings)}
                     </span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-slate-900 w-24 text-sm">Currency:</span>
                     <span className={cn("text-sm", !company?.baseCurrency && "text-slate-400 italic")}>
                       {company?.baseCurrency || 'None Specified'}
                     </span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="font-bold text-slate-900 w-24 text-sm">Fiscal Year:</span>
                     <span className={cn("text-sm", !company?.fiscalYearStart && "text-slate-400 italic")}>
                       {company?.fiscalYearStart ? `FY ${new Date(company.fiscalYearStart).getFullYear()}` : 'Unset'}
                     </span>
                   </div>

                   {/* 2. Dynamic Definition Fields (from the Designer) */}
                   {voucherType?.headerFields?.filter((f: any) => !['date', 'currency', 'exchangeRate'].includes(f.id)).map((field: any) => {
                     // Get value from voucher data (core or metadata)
                     const value = (voucher as any)[field.id] || (voucher.metadata && voucher.metadata[field.id]);
                     const displayValue = value || (
                       <span className="text-slate-300 italic text-[10px]">Not Entered</span>
                     );

                     return (
                       <div key={field.id} className="flex items-center gap-2">
                         <span className="font-bold text-slate-900 w-24 text-sm whitespace-nowrap overflow-hidden text-ellipsis">
                           {field.label || field.id}:
                         </span>
                         <span className="text-sm">{displayValue}</span>
                       </div>
                     );
                   })}
                </div>
             </div>

             <div className="flex flex-col items-end">
                {/* Status Badge - Floating Style */}
                <div className="mb-2">
                  <span className={`px-3 py-1 text-[10px] font-bold rounded uppercase tracking-wider ${
                    voucher.status === 'approved' ? 'bg-green-100 text-green-700' :
                    voucher.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {voucher.status}
                  </span>
                </div>
                
                {/* Logo Area */}
                <div className="w-16 h-16 bg-white border border-slate-200 rounded-lg flex items-center justify-center shadow-sm mb-1 overflow-hidden p-1">
                  {company?.logoUrl ? (
                    <img src={company.logoUrl} alt="Logo" className="max-w-full max-h-full object-contain" />
                  ) : (
                    <div className="w-full h-full bg-slate-900 text-white flex items-center justify-center font-bold text-3xl rounded-md">
                      {company?.name?.substring(0, 1) || 'C'}
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
                   {company?.name || 'Voucher System'}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                   Official Document
                </div>
             </div>
          </div>

          {/* Thick Divider */}
          <div className="h-1 bg-slate-900 w-full mb-12"></div>

          {/* Body Section */}
          <div className="flex-1">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-[#1a2130] text-white">
                  {/* Ledger Header - Render based on definition if available, otherwise fallback */}
                  {(!voucherType?.tableColumns || voucherType.tableColumns.length === 0) ? (
                    <>
                      <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest border border-slate-900">Account</th>
                      <th className="px-5 py-3 text-left text-[11px] font-bold uppercase tracking-widest border border-slate-900">Description</th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-widest border border-slate-900 w-36">Debit</th>
                      <th className="px-5 py-3 text-right text-[11px] font-bold uppercase tracking-widest border border-slate-900 w-36">Credit</th>
                    </>
                  ) : (
                    voucherType.tableColumns.map((col: any) => (
                      <th 
                        key={col.id || col.fieldId} 
                        className={`px-5 py-3 text-[11px] font-bold uppercase tracking-widest border border-slate-900 ${
                          ['debit', 'credit', 'amount', 'total'].includes((col.id || col.fieldId || '').toLowerCase()) ? 'text-right' : 'text-left'
                        }`}
                        style={col.width ? { width: col.width } : {}}
                      >
                        {col.labelOverride || col.label || col.id || col.fieldId}
                      </th>
                    ))
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {voucher.lines && voucher.lines.length > 0 ? (
                  voucher.lines.map((line: any, idx: number) => {
                    const columns = voucherType?.tableColumns || [
                      { id: 'account', fieldId: 'account' },
                      { id: 'description', fieldId: 'description' },
                      { id: 'debit', fieldId: 'debit' },
                      { id: 'credit', fieldId: 'credit' }
                    ];

                    return (
                      <tr key={idx} className="print:break-inside-avoid h-12">
                        {columns.map((col: any) => {
                          const colId = col.id || col.fieldId;
                          let displayValue: any = '-';

                          if (colId === 'account') {
                            const account = getAccountById(line.accountId) || getAccountByCode(line.accountId);
                            displayValue = account ? `${account.code} - ${account.name}` : (line.accountCode || line.accountId || '-');
                          } else if (colId === 'debit') {
                            const val = line.side === 'Debit' ? Math.abs(Number(line.amount) || 0) : 0;
                            displayValue = val > 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-';
                          } else if (colId === 'credit') {
                            const val = line.side === 'Credit' ? Math.abs(Number(line.amount) || 0) : 0;
                            displayValue = val > 0 ? val.toLocaleString(undefined, { minimumFractionDigits: 2 }) : '-';
                          } else if (colId === 'description') {
                            displayValue = line.notes || line.description || '-';
                          } else {
                            displayValue = line[colId] || (line.metadata && line.metadata[colId]) || '-';
                          }

                          const isNumeric = ['debit', 'credit', 'amount', 'total'].includes(colId.toLowerCase());
                          
                          return (
                            <td 
                              key={colId} 
                              className={`px-5 py-3 text-sm border border-slate-200 ${isNumeric ? 'text-right font-medium' : 'text-slate-900 font-bold'} ${colId === 'description' ? 'italic text-slate-500 font-normal' : ''}`}
                            >
                              {displayValue}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td 
                      colSpan={voucherType?.tableColumns?.length || 4} 
                      className="px-5 py-12 text-center text-slate-400 italic"
                    >
                      No lines available
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50/50 font-bold border-t border-slate-300">
                  {(!voucherType?.tableColumns || voucherType.tableColumns.length === 0) ? (
                    <>
                      <td colSpan={2} className="px-5 py-4 text-right text-[11px] uppercase tracking-widest text-slate-700 border border-slate-200">
                        Total
                      </td>
                      <td className="px-5 py-4 text-right text-sm border border-slate-200 whitespace-nowrap font-bold text-slate-900">
                        {voucher.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] ml-1 text-slate-500 font-normal">{voucher.currency}</span>
                      </td>
                      <td className="px-5 py-4 text-right text-sm border border-slate-200 whitespace-nowrap font-bold text-slate-900">
                        {voucher.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] ml-1 text-slate-500 font-normal">{voucher.currency}</span>
                      </td>
                    </>
                  ) : (
                    voucherType.tableColumns.map((col: any, idx: number) => {
                      const colId = (col.id || col.fieldId || '').toLowerCase();
                      const isLastTwo = idx >= voucherType.tableColumns.length - 2;
                      const isDebit = colId === 'debit';
                      const isCredit = colId === 'credit';

                      if (isDebit) {
                        return (
                          <td key={colId} className="px-5 py-4 text-right text-sm border border-slate-200 whitespace-nowrap font-bold text-slate-900">
                            {voucher.totalDebit.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] ml-1 text-slate-500 font-normal">{voucher.currency}</span>
                          </td>
                        );
                      }
                      if (isCredit) {
                        return (
                          <td key={colId} className="px-5 py-4 text-right text-sm border border-slate-200 whitespace-nowrap font-bold text-slate-900">
                            {voucher.totalCredit.toLocaleString(undefined, { minimumFractionDigits: 2 })} <span className="text-[10px] ml-1 text-slate-500 font-normal">{voucher.currency}</span>
                          </td>
                        );
                      }
                      
                      // For the cell before totals, put the "Total" label
                      const nextCol = voucherType.tableColumns[idx + 1];
                      const nextColId = (nextCol?.id || nextCol?.fieldId || '').toLowerCase();
                      if (nextColId === 'debit') {
                        return (
                          <td key={colId} className="px-5 py-4 text-right text-[11px] uppercase tracking-widest text-slate-700 border border-slate-200">
                            Total
                          </td>
                        );
                      }

                      return <td key={colId} className="border border-slate-200"></td>;
                    })
                  )}
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Footer Section - Signatures */}
          <div className="mt-20 grid grid-cols-3 gap-12">
            <div className="text-center">
              <div className="border-b border-slate-900 h-10 mb-2"></div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Prepared By</p>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-900 h-10 mb-2"></div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Reviewed By</p>
            </div>
            <div className="text-center">
              <div className="border-b border-slate-900 h-10 mb-2"></div>
              <p className="text-[10px] font-black text-slate-900 uppercase tracking-widest">Approved By</p>
            </div>
          </div>
          
          <div className="mt-auto pt-12 text-center">
             <div className="text-[9px] text-slate-400 uppercase tracking-[0.3em] font-medium opacity-50">
               Generated by ERP System • {new Date().toLocaleDateString()} • {new Date().toLocaleTimeString()}
             </div>
          </div>
        </div>
      </div>
      
      {/* CSS for print */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          body {
            background-color: white !important;
            margin: 0;
            padding: 0;
          }
          .fixed {
            position: relative !important;
          }
          .flex-1 {
            overflow: visible !important;
          }
          .bg-slate-100 {
            background-color: white !important;
          }
          .p-8 {
            padding: 0 !important;
          }
          .pb-24 {
             padding-bottom: 0 !important;
          }
        }
      `}</style>
    </div>
  );
};
