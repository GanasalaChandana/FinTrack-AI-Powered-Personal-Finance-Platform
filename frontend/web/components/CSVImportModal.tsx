// components/CSVImportModal.tsx
'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Upload, FileText, AlertCircle, Download, CheckCircle } from 'lucide-react';
import { showToast } from '@/lib/toast';

export interface CSVRow {
  [key: string]: string | number;
}

export interface CSVImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImport: (data: CSVRow[]) => Promise<void>;
  requiredHeaders?: string[];
  title?: string;
  description?: string;
  maxFileSize?: number; // in MB
  sampleData?: CSVRow[];
}

interface ParsedCSV {
  headers: string[];
  data: CSVRow[];
}

export const CSVImportModal: React.FC<CSVImportModalProps> = ({
  isOpen,
  onClose,
  onImport,
  requiredHeaders = [],
  title = 'Import CSV Data',
  description = 'Upload a CSV file to import your data',
  maxFileSize = 10,
  sampleData
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedCSV | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [step, setStep] = useState<'upload' | 'preview'>('upload');

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      setStep('upload');
      setFile(null);
      setPreview(null);
      setError(null);
    } else {
      document.body.style.overflow = 'unset';
    }

    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  const parseCSV = (text: string): ParsedCSV => {
    const lines = text.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('CSV file is empty');
    }

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));

    const data: CSVRow[] = [];
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));

      if (values.length !== headers.length) {
        console.warn(`Row ${i} has ${values.length} columns, expected ${headers.length}`);
        continue;
      }

      const row: CSVRow = {};
      headers.forEach((header, index) => {
        const value = values[index] || '';
        row[header] = isNaN(Number(value)) ? value : Number(value);
      });
      data.push(row);
    }

    return { headers, data };
  };

  const validateHeaders = (headers: string[]): string | null => {
    if (requiredHeaders.length === 0) return null;

    const missingHeaders = requiredHeaders.filter(
      required => !headers.some(h => h.toLowerCase() === required.toLowerCase())
    );

    if (missingHeaders.length > 0) {
      return `Missing required columns: ${missingHeaders.join(', ')}`;
    }

    return null;
  };

  const handleFile = async (selectedFile: File) => {
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.csv')) {
      setError('Please upload a CSV file');
      showToast.error('Invalid file type. Please upload a CSV file.');
      return;
    }

    const fileSizeMB = selectedFile.size / (1024 * 1024);
    if (fileSizeMB > maxFileSize) {
      setError(`File size exceeds ${maxFileSize}MB limit`);
      showToast.error(`File too large. Maximum size is ${maxFileSize}MB.`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const text = await selectedFile.text();
      const parsed = parseCSV(text);

      const headerError = validateHeaders(parsed.headers);
      if (headerError) {
        throw new Error(headerError);
      }

      setFile(selectedFile);
      setPreview(parsed);
      setStep('preview');
      showToast.success(`File loaded successfully: ${parsed.data.length} rows`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to parse CSV file';
      setError(errorMessage);
      showToast.error(`Error: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  };

  const handleImport = async () => {
    if (!preview) return;

    setIsLoading(true);
    const loadingToast = showToast.loading('Importing data...');

    try {
      await onImport(preview.data);
      showToast.dismiss(loadingToast);
      showToast.success('Data imported successfully!');
      onClose();
    } catch (err) {
      showToast.dismiss(loadingToast);
      const errorMessage = err instanceof Error ? err.message : 'Import failed';
      showToast.error(`Import failed: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setError(null);
    setStep('upload');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const downloadSample = () => {
    if (!sampleData || sampleData.length === 0) return;

    const headers = Object.keys(sampleData[0]);
    const csvContent = [
      headers.join(','),
      ...sampleData.map(row =>
        headers.map(header => {
          const value = row[header];
          return typeof value === 'string' && value.includes(',')
            ? `"${value}"`
            : value;
        }).join(',')
      )
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'sample.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
      onClick={(e) => e.target === e.currentTarget && !isLoading && onClose()}
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col border border-gray-200 dark:border-gray-700">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-100 dark:bg-blue-900/30 p-2 rounded-lg">
                <Upload className="w-6 h-6 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">{title}</h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">{description}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 transition"
              disabled={isLoading}
            >
              <X className="w-6 h-6" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {step === 'upload' ? (
            <div className="space-y-4">
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-lg p-12 text-center transition ${
                  dragActive
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                    : 'border-gray-300 dark:border-gray-600 hover:border-gray-400 dark:hover:border-gray-500'
                }`}
              >
                <FileText className="w-16 h-16 mx-auto text-gray-400 dark:text-gray-500 mb-4" />
                <p className="text-lg font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Drag and drop your CSV file here
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">or</p>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50 font-medium"
                >
                  {isLoading ? 'Processing...' : 'Browse Files'}
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={(e) => e.target.files && handleFile(e.target.files[0])}
                  className="hidden"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-4">
                  Maximum file size: {maxFileSize}MB
                </p>
              </div>

              {requiredHeaders.length > 0 && (
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-lg p-4">
                  <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-2">Required Columns:</h4>
                  <div className="flex flex-wrap gap-2">
                    {requiredHeaders.map((header, i) => (
                      <span
                        key={i}
                        className="px-3 py-1 bg-white dark:bg-gray-700 border border-blue-200 dark:border-blue-700 rounded-full text-sm text-blue-700 dark:text-blue-300"
                      >
                        {header}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {sampleData && (
                <button
                  onClick={downloadSample}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition flex items-center justify-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  Download Sample CSV
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex items-center justify-between border border-gray-200 dark:border-gray-600">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 text-green-500" />
                  <div>
                    <p className="font-medium text-gray-700 dark:text-gray-200">{file?.name}</p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {preview?.data.length} rows · {preview?.headers.length} columns
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleReset}
                  disabled={isLoading}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium disabled:opacity-50"
                >
                  Choose Different File
                </button>
              </div>

              <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                <div className="overflow-x-auto max-h-96">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700/80 sticky top-0">
                      <tr>
                        {preview?.headers.map((header, i) => (
                          <th
                            key={i}
                            className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {preview?.data.slice(0, 10).map((row, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                          {preview.headers.map((header, j) => (
                            <td
                              key={j}
                              className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300 whitespace-nowrap"
                            >
                              {row[header]?.toString() || '-'}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                Showing first 10 rows of {preview?.data.length}
              </p>
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/50 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        {step === 'preview' && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 flex gap-3 bg-white dark:bg-gray-800">
            <button
              onClick={handleReset}
              disabled={isLoading}
              className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition font-medium disabled:opacity-50"
            >
              Back
            </button>
            <button
              onClick={handleImport}
              disabled={isLoading}
              className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium disabled:opacity-50"
            >
              {isLoading ? 'Importing...' : `Import ${preview?.data.length} Rows`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
