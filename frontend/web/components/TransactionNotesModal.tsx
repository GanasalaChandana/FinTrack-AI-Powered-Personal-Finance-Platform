// components/TransactionNotesModal.tsx
'use client';

import { useState } from 'react';
import { X, Save, FileText, Tag, Clock } from 'lucide-react';

interface Transaction {
  id: string;
  description: string;
  amount: number;
  category: string;
  date: string;
  notes?: string;
  tags?: string[];
}

interface TransactionNotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: Transaction | null;
  onSave: (id: string, notes: string, tags: string[]) => Promise<void>;
}

export function TransactionNotesModal({
  isOpen,
  onClose,
  transaction,
  onSave,
}: TransactionNotesModalProps) {
  const [notes, setNotes] = useState(transaction?.notes || '');
  const [tags, setTags] = useState<string[]>(transaction?.tags || []);
  const [tagInput, setTagInput] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  if (!isOpen || !transaction) return null;

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(transaction.id, notes, tags);
      onClose();
    } catch (error) {
      console.error('Failed to save notes:', error);
      setSaveError('Failed to save notes. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = () => {
    const tag = tagInput.trim();
    if (tag && !tags.includes(tag)) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setTags(tags.filter((t) => t !== tagToRemove));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Transaction Notes
            </h2>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
              {transaction.description} - ${transaction.amount.toFixed(2)}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Transaction Details */}
          <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
            <div className="flex-1">
              <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400 mb-1">
                <Clock className="w-4 h-4" />
                {new Date(transaction.date).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 text-xs rounded">
                  {transaction.category}
                </span>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div>
            <label className="text-sm font-medium mb-2 flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Notes
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this transaction..."
              rows={6}
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {notes.length} characters
            </p>
          </div>

          {/* Tags Section */}
          <div>
            <label className="block text-sm font-medium mb-2 flex items-center gap-2">
              <Tag className="w-4 h-4" />
              Tags
            </label>
            
            {/* Tag Input */}
            <div className="flex gap-2 mb-3">
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a tag..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-900 focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <button
                onClick={handleAddTag}
                disabled={!tagInput.trim()}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add
              </button>
            </div>

            {/* Tags Display */}
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full text-sm"
                  >
                    #{tag}
                    <button
                      onClick={() => handleRemoveTag(tag)}
                      className="hover:bg-blue-200 dark:hover:bg-blue-800/50 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500 dark:text-gray-400 italic">
                No tags yet. Add tags to organize and filter transactions.
              </p>
            )}
          </div>

          {/* Quick Tags Suggestions */}
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Quick add:</p>
            <div className="flex flex-wrap gap-2">
              {['business', 'personal', 'recurring', 'tax-deductible', 'reimbursable'].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    if (!tags.includes(suggestion)) {
                      setTags([...tags, suggestion]);
                    }
                  }}
                  disabled={tags.includes(suggestion)}
                  className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Error */}
        {saveError && (
          <div className="mx-6 mb-2 px-4 py-2.5 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center justify-between">
            {saveError}
            <button onClick={() => setSaveError(null)} className="text-red-400 hover:text-red-600 ml-3 font-bold">✕</button>
          </div>
        )}

        {/* Footer */}
        <div className="flex gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 rounded-lg font-medium transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Saving...' : 'Save Notes'}
          </button>
          <button
            onClick={onClose}
            disabled={isSaving}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}