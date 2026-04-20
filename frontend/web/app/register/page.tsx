'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

export default function RegisterRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page with signup mode
    router.replace('/login?mode=signup');
  }, [router]);

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #4a1d96 50%, #0f172a 100%)' }}>
      <div className="text-center">
        <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
        <p className="text-gray-400">Redirecting to sign up...</p>
      </div>
    </div>
  );
}