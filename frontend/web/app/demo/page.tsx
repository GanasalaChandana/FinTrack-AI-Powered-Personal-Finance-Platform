// app/demo/page.tsx
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getToken } from '@/lib/api';
import { showToast } from '@/lib/toast';
import { ConfirmationModal } from '@/components/ConfirmationModal';
import { CSVImportModal } from '@/components/CSVImportModal';
import {
  CardSkeleton,
  TableSkeleton,
  DashboardSkeleton,
  ChartSkeleton,
  ListSkeleton,
  FormSkeleton
} from '@/components/Skeleton';
import { 
  CheckCircle, 
  AlertCircle, 
  Upload, 
  Trash2, 
  Eye,
  Download 
} from 'lucide-react';

export default function ComponentDemoPage() {
  const router = useRouter();
  const [showCSVImport, setShowCSVImport] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showClearAllModal, setShowClearAllModal] = useState(false);
  const [loadingState, setLoadingState] = useState<string | null>(null);

  // Require authentication
  useEffect(() => {
    if (!getToken()) {
      router.replace('/login');
    }
  }, [router]);

  // Simulate loading states
  const simulateLoading = (type: string, duration = 3000) => {
    setLoadingState(type);
    setTimeout(() => setLoadingState(null), duration);
  };

  // CSV Import handler
  const handleCSVImport = async (data: any[], _clearFirst = false) => {
    await new Promise(resolve => setTimeout(resolve, 2000));
    showToast.success(`Successfully imported ${data.length} records`);
  };

  // Sample CSV data
  const sampleCSVData = [
    { date: '2024-01-01', description: 'Grocery Shopping', amount: 125.50, category: 'Food' },
    { date: '2024-01-02', description: 'Gas Station', amount: 45.00, category: 'Transport' },
    { date: '2024-01-03', description: 'Netflix Subscription', amount: 15.99, category: 'Entertainment' }
  ];

  // Delete handler
  const handleDelete = () => {
    setShowDeleteModal(false);
    showToast.success('Transaction deleted successfully');
  };

  // Export handler
  const handleExport = () => {
    setShowExportModal(false);
    showToast.success('Data exported successfully');
  };

  // View handler
  const handleView = () => {
    setShowViewModal(false);
    showToast.info('Opening details...');
  };

  // Clear all handler
  const handleClearAll = () => {
    setShowClearAllModal(false);
    showToast.success('All data cleared successfully');
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            FinTrack Component Demo
          </h1>
          <p className="text-gray-600">
            Interactive showcase of all available components
          </p>
        </div>

        {/* Toast Notifications Demo */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Toast Notifications</h2>
          <p className="text-gray-600 mb-4">
            Click the buttons below to trigger different toast notifications
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => showToast.success('Operation completed successfully!')}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Success Toast
            </button>
            <button
              onClick={() => showToast.error('An error occurred while processing your request')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
            >
              Error Toast
            </button>
            <button
              onClick={() => showToast.info('Please review your information before proceeding')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Info Toast
            </button>
            <button
              onClick={() => {
                const id = showToast.loading('Processing your request...');
                setTimeout(() => {
                  showToast.dismiss(id);
                  showToast.success('Processing complete!');
                }, 2000);
              }}
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
            >
              Loading Toast
            </button>
          </div>
        </div>

        {/* Confirmation Modal Demo */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Confirmation Modals</h2>
          <p className="text-gray-600 mb-4">
            Different modal variants for various actions
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition flex items-center gap-2"
            >
              <Trash2 className="w-4 h-4" />
              Delete Action (Danger)
            </button>
            <button
              onClick={() => setShowExportModal(true)}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition flex items-center gap-2"
            >
              <Download className="w-4 h-4" />
              Export (Warning)
            </button>
            <button
              onClick={() => setShowViewModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
            >
              <Eye className="w-4 h-4" />
              View (Info)
            </button>
          </div>
        </div>

        {/* CSV Import Demo */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">CSV Import</h2>
          <p className="text-gray-600 mb-4">
            Import financial transactions from CSV files
          </p>
          <button
            onClick={() => setShowCSVImport(true)}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-medium"
          >
            <Upload className="w-5 h-5" />
            Open CSV Import Modal
          </button>
        </div>

        {/* Skeleton Loaders Demo */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Skeleton Loaders</h2>
          <p className="text-gray-600 mb-4">
            Loading states for different components
          </p>
          
          <div className="flex flex-wrap gap-3 mb-6">
            <button
              onClick={() => simulateLoading('dashboard')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Dashboard Loading
            </button>
            <button
              onClick={() => simulateLoading('table')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Table Loading
            </button>
            <button
              onClick={() => simulateLoading('cards')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Cards Loading
            </button>
            <button
              onClick={() => simulateLoading('chart')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Chart Loading
            </button>
            <button
              onClick={() => simulateLoading('list')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              List Loading
            </button>
            <button
              onClick={() => simulateLoading('form')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              Form Loading
            </button>
          </div>

          {/* Display different skeletons based on loading state */}
          <div className="border border-gray-200 rounded-lg p-6 bg-gray-50">
            {loadingState === 'dashboard' && <DashboardSkeleton cards={4} />}
            {loadingState === 'table' && <TableSkeleton rows={8} columns={5} />}
            {loadingState === 'cards' && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <CardSkeleton showImage lines={2} />
                <CardSkeleton showImage lines={3} />
                <CardSkeleton lines={2} />
              </div>
            )}
            {loadingState === 'chart' && <ChartSkeleton />}
            {loadingState === 'list' && <ListSkeleton items={6} showAvatar />}
            {loadingState === 'form' && <FormSkeleton fields={6} />}
            {!loadingState && (
              <div className="text-center py-12 text-gray-500">
                Click a button above to see skeleton loaders
              </div>
            )}
          </div>
        </div>

        {/* Real-world Example */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Real-world Example</h2>
          <p className="text-gray-600 mb-4">
            Combined usage of multiple components
          </p>
          <div className="space-y-4">
            <button
              onClick={() => {
                showToast.info('Loading transactions...');
                simulateLoading('table', 2000);
                setTimeout(() => {
                  showToast.success('Transactions loaded successfully');
                }, 2000);
              }}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition font-medium"
            >
              Load Transactions (with Toast + Skeleton)
            </button>
            
            <button
              onClick={() => setShowClearAllModal(true)}
              className="w-full px-4 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
            >
              Clear All Data (Confirmation + Toast)
            </button>
          </div>
        </div>

        {/* Error Handling Example */}
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Error Handling</h2>
          <p className="text-gray-600 mb-4">
            Error boundary is active throughout the app
          </p>
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-medium mb-1">Protected by Error Boundary</p>
              <p>Any JavaScript errors in components will be caught and displayed gracefully.</p>
            </div>
          </div>
        </div>
      </div>

      {/* Modals */}
      <ConfirmationModal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        onConfirm={handleDelete}
        title="Delete Transaction"
        message="Are you sure you want to delete this transaction? This action cannot be undone."
        confirmText="Delete"
        variant="danger"
      />

      <ConfirmationModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onConfirm={handleExport}
        title="Export Data"
        message="This will export all your financial data. Continue?"
        confirmText="Export"
        variant="warning"
      />

      <ConfirmationModal
        isOpen={showViewModal}
        onClose={() => setShowViewModal(false)}
        onConfirm={handleView}
        title="View Details"
        message="You are about to view detailed transaction information."
        confirmText="View"
        variant="info"
      />

      <ConfirmationModal
        isOpen={showClearAllModal}
        onClose={() => setShowClearAllModal(false)}
        onConfirm={handleClearAll}
        title="Clear All Data"
        message="This will permanently delete all your transactions. Are you sure?"
        confirmText="Delete All"
        variant="danger"
      />

      <CSVImportModal
        isOpen={showCSVImport}
        onClose={() => setShowCSVImport(false)}
        onImport={handleCSVImport}
        requiredHeaders={['date', 'description', 'amount', 'category']}
        title="Import Transactions"
        description="Upload your transaction history in CSV format"
        sampleData={sampleCSVData}
        maxFileSize={10}
      />
    </div>
  );
}