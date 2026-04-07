// components/ExportMenu.tsx
'use client';

import { useState } from 'react';
import { Download, FileText, Table, CheckCircle } from 'lucide-react';
import { exportTransactionsToPDF } from '@/lib/utils/pdfExport';
import * as XLSX from 'xlsx';

interface ExportMenuProps {
  data: any[];
  type: 'transactions' | 'budgets' | 'reports';
  dateRange?: string;
}

export function ExportMenu({ data, type, dateRange }: ExportMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportTransactionsToPDF(data, {
        title: `${type.charAt(0).toUpperCase() + type.slice(1)} Report`,
        dateRange: dateRange || 'All Time'
      });
      showSuccessMessage();
    } catch (error) {
      console.error('PDF export failed:', error);
      setExportError('Failed to export PDF');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const handleExportExcel = () => {
    setIsExporting(true);
    try {
      // Prepare data for Excel
      const excelData = data.map(item => {
        if (type === 'transactions') {
          return {
            Date: new Date(item.date).toLocaleDateString(),
            Description: item.description,
            Category: item.category,
            Type: item.type,
            Amount: item.amount
          };
        }
        return item;
      });

      // Create worksheet
      const ws = XLSX.utils.json_to_sheet(excelData);
      
      // Set column widths
      ws['!cols'] = [
        { wch: 12 }, // Date
        { wch: 30 }, // Description
        { wch: 15 }, // Category
        { wch: 10 }, // Type
        { wch: 12 }  // Amount
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, type.charAt(0).toUpperCase() + type.slice(1));

      // Save file
      const fileName = `fintrack-${type}-${new Date().getTime()}.xlsx`;
      XLSX.writeFile(wb, fileName);

      showSuccessMessage();
    } catch (error) {
      console.error('Excel export failed:', error);
      setExportError('Failed to export Excel');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const handleExportCSV = () => {
    setIsExporting(true);
    try {
      // Prepare CSV data
      const csvData = data.map(item => {
        if (type === 'transactions') {
          return {
            Date: new Date(item.date).toLocaleDateString(),
            Description: item.description,
            Category: item.category,
            Type: item.type,
            Amount: item.amount
          };
        }
        return item;
      });

      // Convert to CSV
      const headers = Object.keys(csvData[0]);
      const csvContent = [
        headers.join(','),
        ...csvData.map(row => 
          headers.map(header => {
            const value = row[header];
            // Escape commas and quotes
            return typeof value === 'string' && value.includes(',') 
              ? `"${value}"` 
              : value;
          }).join(',')
        )
      ].join('\n');

      // Download
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `fintrack-${type}-${new Date().getTime()}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showSuccessMessage();
    } catch (error) {
      console.error('CSV export failed:', error);
      setExportError('Failed to export CSV');
    } finally {
      setIsExporting(false);
      setIsOpen(false);
    }
  };

  const showSuccessMessage = () => {
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <>
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          disabled={isExporting}
          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          Export
        </button>

        {isOpen && (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />
            <div className="absolute right-0 mt-2 w-56 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 py-2 z-20">
              <button
                onClick={handleExportPDF}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left disabled:opacity-50"
              >
                <FileText className="w-5 h-5 text-red-500" />
                <div>
                  <div className="font-medium text-sm">Export as PDF</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Formatted report
                  </div>
                </div>
              </button>

              <button
                onClick={handleExportExcel}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left disabled:opacity-50"
              >
                <Table className="w-5 h-5 text-green-500" />
                <div>
                  <div className="font-medium text-sm">Export as Excel</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    .xlsx spreadsheet
                  </div>
                </div>
              </button>

              <button
                onClick={handleExportCSV}
                disabled={isExporting}
                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-700 transition text-left disabled:opacity-50"
              >
                <FileText className="w-5 h-5 text-blue-500" />
                <div>
                  <div className="font-medium text-sm">Export as CSV</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Universal format
                  </div>
                </div>
              </button>
            </div>
          </>
        )}
      </div>

      {/* Success Toast */}
      {showSuccess && (
        <div className="fixed bottom-6 right-6 z-50 animate-slideUp">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 p-4 flex items-center gap-3">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <div>
              <div className="font-medium text-sm">Export Successful!</div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Your file has been downloaded</div>
            </div>
          </div>
        </div>
      )}

      {/* Error Toast */}
      {exportError && (
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-red-200 p-4 flex items-center gap-3">
            <span className="text-red-500 font-bold text-lg">✕</span>
            <div className="flex-1">
              <div className="font-medium text-sm text-red-700">{exportError}</div>
            </div>
            <button onClick={() => setExportError(null)} className="text-gray-400 hover:text-gray-600 ml-2">✕</button>
          </div>
        </div>
      )}
    </>
  );
}