import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

type ColumnDef = { header: string; key: string; width?: number; isNumber?: boolean };

export async function exportToExcel(rows: any[], columns: ColumnDef[], filename: string, title?: string, subtitle?: string) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet('Report');

  if (title) {
    sheet.mergeCells('A1', String.fromCharCode(64 + columns.length) + '1');
    sheet.getCell('A1').value = title;
    sheet.getCell('A1').font = { bold: true, size: 14 };
  }
  if (subtitle) {
    sheet.mergeCells('A2', String.fromCharCode(64 + columns.length) + '2');
    sheet.getCell('A2').value = subtitle;
    sheet.getCell('A2').font = { size: 11 };
  }

  const headerRowIndex = subtitle ? 3 : 2;
  sheet.columns = columns.map((c) => ({ header: c.header, key: c.key, width: c.width || 18 }));
  sheet.getRow(headerRowIndex).font = { bold: true };

  rows.forEach((r) => {
    const row = sheet.addRow(r);
    columns.forEach((c, idx) => {
      const cell = row.getCell(idx + 1);
      if (c.isNumber) cell.numFmt = '#,##0.00';
    });
  });

  const buf = await workbook.xlsx.writeBuffer();
  saveAs(new Blob([buf]), `${filename}.xlsx`);
}

export async function exportElementToPDF(elementId: string, filename: string, options?: { scale?: number }) {
  const element = document.getElementById(elementId);
  if (!element) return;
  const canvas = await html2canvas(element, { scale: options?.scale || 2 });
  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pageWidth;
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
  let position = 0;

  if (pdfHeight < pageHeight) {
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  } else {
    let heightLeft = pdfHeight;
    while (heightLeft > 0) {
      pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, pdfHeight);
      heightLeft -= pageHeight;
      if (heightLeft > 0) {
        position = 0;
        pdf.addPage();
      }
    }
  }
  pdf.save(`${filename}.pdf`);
}
