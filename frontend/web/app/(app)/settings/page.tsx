import { Suspense } from 'react';
import SettingsContent from './SettingsContent';

export const dynamic = 'force-dynamic';

export default function SettingsPage() {
  return (
    <Suspense 
      fallback={
        <div className="min-h-screen bg-gray-50 p-6">
          <div className="max-w-6xl mx-auto">
            <div className="bg-white rounded-lg shadow-sm mb-6 h-16 animate-pulse" />
            <div className="bg-white rounded-lg shadow-sm h-[60vh] animate-pulse" />
          </div>
        </div>
      }
    >
      <SettingsContent />
    </Suspense>
  );
}