'use client';

import { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import type { GoogleCredentialResponse } from '@/types/google';
import { setToken, setUser } from '@/lib/api';
import { 
  Eye, 
  EyeOff, 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  CheckCircle, 
  AlertCircle,
  Loader2,
  DollarSign,
  Shield,
  Zap,
  Server
} from 'lucide-react';

// Helper function to wake up the backend
const wakeUpBackend = async (apiUrl: string): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);
    const response = await fetch(`${apiUrl}/actuator/health`, {
      method: 'GET',
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return response.ok;
  } catch {
    return false;
  }
};

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialMode = searchParams?.get('mode') === 'signup' ? 'signup' : 'signin';
  
  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [wakingUp, setWakingUp] = useState(false);
  const isSubmitting = useRef(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const [googleLoaded, setGoogleLoaded] = useState(false);
  const googleInitialized = useRef(false);
  const lastGoogleCallTime = useRef(0);
  const backendAwake = useRef(false);

  // Load Google OAuth Script
  useEffect(() => {
    const loadGoogleScript = () => {
      if (document.getElementById('google-oauth-script')) {
        setGoogleLoaded(true);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-oauth-script';
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        setGoogleLoaded(true);
      };
      script.onerror = () => {
        setError('Failed to load Google Sign-In. Please refresh the page.');
      };
      document.body.appendChild(script);
    };

    loadGoogleScript();
  }, []);

  // Initialize Google Sign-In
  useEffect(() => {
    if (!googleLoaded || !window.google || googleInitialized.current) return;

    const GOOGLE_CLIENT_ID = '833541687094-vheiq46pf2507ogunobbidu4ke23286d.apps.googleusercontent.com';

    try {
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleSignIn,
        auto_select: false,
        cancel_on_tap_outside: false,
        itp_support: true,
      });

      if (googleButtonRef.current) {
        window.google.accounts.id.renderButton(
          googleButtonRef.current,
          {
            theme: 'outline',
            size: 'large',
            text: mode === 'signin' ? 'signin_with' : 'signup_with',
            shape: 'rectangular',
            width: 320,
            logo_alignment: 'left',
          }
        );
      }
      
      googleInitialized.current = true;
    } catch {
      setError('Google Sign-In initialization failed. Please try manual login.');
    }
  }, [googleLoaded, mode]);

  const ensureBackendAwake = async (apiUrl: string): Promise<boolean> => {
    if (backendAwake.current) {
      return true;
    }

    setWakingUp(true);
    setError('Waking up server... This may take 30-60 seconds on first request.');
    
    const isAwake = await wakeUpBackend(apiUrl);
    
    setWakingUp(false);
    backendAwake.current = isAwake;
    
    if (!isAwake) {
      setError('Server is taking longer than expected. Please wait a moment and try again.');
    } else {
      setError('');
    }
    
    return isAwake;
  };

  const handleGoogleSignIn = async (response: GoogleCredentialResponse, retryCount = 0): Promise<void> => {
    const now = Date.now();
    if (now - lastGoogleCallTime.current < 2000) return;
    lastGoogleCallTime.current = now;

    if (loading || isSubmitting.current) return;
    
    setLoading(true);
    isSubmitting.current = true;
    setError('');

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      
      const isAwake = await ensureBackendAwake(API_URL);
      if (!isAwake && retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        setLoading(false);
        isSubmitting.current = false;
        return handleGoogleSignIn(response, retryCount + 1);
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const res = await fetch(`${API_URL}/api/auth/google`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
        signal: controller.signal,
        body: JSON.stringify({
          credential: response.credential,
        }),
      });

      clearTimeout(timeoutId);

      if (res.status === 429 && retryCount < 3) {
        const waitTime = Math.pow(2, retryCount) * 2000;
        setError(`Server is busy. Retrying in ${waitTime/1000} seconds...`);
        
        setLoading(false);
        isSubmitting.current = false;
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return handleGoogleSignIn(response, retryCount + 1);
      }

      if (res.status === 429) {
        throw new Error('Server is busy. Please wait a few minutes and try again.');
      }

      if (!res.ok) {
        let errorMessage = 'Google sign-in failed';
        
        try {
          const errorData = await res.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `Server error (${res.status}). Please try again.`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await res.json();

      if (data.token) {
        setToken(data.token);
        if (data.user?.id) localStorage.setItem('userId', data.user.id.toString());
        if (data.user) setUser(data.user);
        setSuccess(true);
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        throw new Error('No authentication token received');
      }

    } catch (err) {
      if (err instanceof Error) {
        setError(err.name === 'AbortError'
          ? 'Request timeout. The server might be starting up. Please wait 30 seconds and try again.'
          : err.message);
      } else {
        setError('Google sign-in failed. Please try again.');
      }
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    
    if (error) setError('');
  };

  const validateForm = () => {
    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields');
      return false;
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    if (mode === 'signup') {
      if (!formData.name || formData.name.trim().length < 2) {
        setError('Please enter your full name');
        return false;
      }

      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        return false;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
    }

    return true;
  };

  const handleSubmit = async (retryCount = 0) => {
    if (loading || isSubmitting.current) return;

    setError('');

    if (!validateForm()) return;
    
    setLoading(true);
    isSubmitting.current = true;

    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      
      const isAwake = await ensureBackendAwake(API_URL);
      if (!isAwake && retryCount === 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
        setLoading(false);
        isSubmitting.current = false;
        return handleSubmit(retryCount + 1);
      }
      
      const endpoint = mode === 'signin' ? '/api/auth/login' : '/api/auth/register';
      
      const requestBody = mode === 'signin' 
        ? {
            email: formData.email.toLowerCase().trim(),
            password: formData.password,
          }
        : {
            firstName: formData.name.trim().split(' ')[0],
            lastName: formData.name.trim().split(' ').slice(1).join(' ') || formData.name.trim().split(' ')[0],
            email: formData.email.toLowerCase().trim(),
            password: formData.password,
            username: formData.email.split('@')[0],
          };

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000);

      const response = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        credentials: 'include',
        mode: 'cors',
        signal: controller.signal,
        body: JSON.stringify(requestBody),
      });

      clearTimeout(timeoutId);

      if (response.status === 429 && retryCount < 3) {
        const waitTime = Math.pow(2, retryCount) * 2000;
        setError(`Server is busy. Retrying in ${waitTime/1000} seconds...`);
        
        setLoading(false);
        isSubmitting.current = false;
        
        await new Promise(resolve => setTimeout(resolve, waitTime));
        return handleSubmit(retryCount + 1);
      }

      if (response.status === 429) {
        throw new Error('Too many attempts. Please wait 2-3 minutes and try again.');
      }

      if (!response.ok) {
        let errorMessage = mode === 'signin' ? 'Login failed' : 'Registration failed';
        
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          errorMessage = `Server error (${response.status})`;
        }
        
        throw new Error(errorMessage);
      }

      const data = await response.json();

      if (data.token) {
        setToken(data.token);
        if (data.user?.id) localStorage.setItem('userId', data.user.id.toString());
        if (data.user) setUser(data.user);
        setSuccess(true);
        setTimeout(() => router.push('/dashboard'), 1000);
      } else {
        throw new Error('No authentication token received');
      }

    } catch (err) {
      if (err instanceof Error) {
        setError(err.name === 'AbortError'
          ? 'Request timeout. The server might be starting up. Please wait 30 seconds and try again.'
          : err.message);
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setLoading(false);
      isSubmitting.current = false;
    }
  };

  const switchMode = (newMode: 'signin' | 'signup') => {
    setMode(newMode);
    setError('');
    setFormData({
      name: '',
      email: '',
      password: '',
      confirmPassword: ''
    });
    googleInitialized.current = false;
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !loading) {
      handleSubmit();
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #4a1d96 50%, #0f172a 100%)' }}>
        <div className="max-w-md w-full bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-500/20 p-8 text-center">
          <div className="w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12 text-green-400" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-3">
            {mode === 'signin' ? 'Welcome back!' : 'Account created!'}
          </h2>
          <p className="text-gray-300 mb-6">
            {mode === 'signin' 
              ? 'Login successful. Redirecting to your dashboard...' 
              : 'Your account has been created successfully.'}
          </p>
          <div className="flex items-center justify-center gap-3 text-purple-400">
            <Loader2 className="w-6 h-6 animate-spin" />
            <span className="font-semibold">Loading your account</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #4a1d96 50%, #0f172a 100%)' }}>
      <div className="max-w-md w-full">
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 mb-6">
            <DollarSign className="w-10 h-10 text-purple-400" />
            <span className="text-3xl font-bold" style={{ background: 'linear-gradient(to right, #c084fc, #f472b6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>
              FinTrack
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-gray-400">
            {mode === 'signin' 
              ? 'Sign in to continue to your dashboard' 
              : 'Start managing your finances smarter'}
          </p>
        </div>

        <div className="bg-slate-800/50 backdrop-blur-xl rounded-2xl shadow-2xl border border-purple-500/20 p-8">
          <div className="flex gap-2 mb-6 bg-slate-900/50 p-1 rounded-xl">
            <button
              onClick={() => switchMode('signin')}
              className="flex-1 py-3 px-4 rounded-lg font-semibold transition-all"
              style={mode === 'signin'
                ? { background: 'linear-gradient(to right, #a855f7, #ec4899)', color: '#fff', boxShadow: '0 4px 14px rgba(168,85,247,0.4)' }
                : { color: '#9ca3af' }}
            >
              Sign In
            </button>
            <button
              onClick={() => switchMode('signup')}
              className="flex-1 py-3 px-4 rounded-lg font-semibold transition-all"
              style={mode === 'signup'
                ? { background: 'linear-gradient(to right, #a855f7, #ec4899)', color: '#fff', boxShadow: '0 4px 14px rgba(168,85,247,0.4)' }
                : { color: '#9ca3af' }}
            >
              Sign Up
            </button>
          </div>

          <div className="mb-6">
            <div 
              ref={googleButtonRef} 
              className="w-full flex justify-center"
              style={{ minHeight: '40px' }}
            />
            {!googleLoaded && (
              <div className="flex items-center justify-center gap-2 py-3 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading Google Sign-In...</span>
              </div>
            )}
          </div>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-purple-500/20"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-slate-800/50 text-gray-400">Or continue with email</span>
            </div>
          </div>

          {wakingUp && (
            <div className="mb-6 bg-blue-500/10 border border-blue-500/50 rounded-xl p-4 flex items-start gap-3">
              <Server className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5 animate-pulse" />
              <div>
                <p className="text-blue-300 text-sm font-medium mb-1">Starting Server</p>
                <p className="text-blue-200/80 text-xs">Free tier servers sleep after inactivity. First request takes 30-60 seconds. Please be patient!</p>
              </div>
            </div>
          )}

          {error && error.includes('Waking') && (
            <div className="mb-6 bg-yellow-500/10 border border-yellow-500/50 rounded-xl p-4 flex items-start gap-3">
              <Loader2 className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5 animate-spin" />
              <div>
                <p className="text-yellow-300 text-sm font-medium mb-1">Server Waking Up</p>
                <p className="text-yellow-200/80 text-xs">{error}</p>
              </div>
            </div>
          )}

          {error && !error.includes('Waking') && (
            <div className="mb-6 bg-red-500/10 border border-red-500/50 rounded-xl p-4 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm font-medium">{error}</p>
            </div>
          )}

          <div className="space-y-5" onKeyPress={handleKeyPress}>
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    name="name"
                    value={formData.name}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-purple-500/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-white placeholder-gray-500"
                    placeholder="John Doe"
                    disabled={loading || wakingUp}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="w-full pl-11 pr-4 py-3 bg-slate-900/50 border border-purple-500/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-white placeholder-gray-500"
                  placeholder="you@example.com"
                  disabled={loading || wakingUp}
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  className="w-full pl-11 pr-12 py-3 bg-slate-900/50 border border-purple-500/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-white placeholder-gray-500"
                  placeholder="••••••••"
                  disabled={loading || wakingUp}
                  autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                  disabled={loading || wakingUp}
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              {mode === 'signup' && (
                <p className="text-xs text-gray-500 mt-1">Must be at least 6 characters</p>
              )}
            </div>

            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-semibold text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleInputChange}
                    className="w-full pl-11 pr-12 py-3 bg-slate-900/50 border border-purple-500/20 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none transition text-white placeholder-gray-500"
                    placeholder="••••••••"
                    disabled={loading || wakingUp}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300 transition"
                    disabled={loading || wakingUp}
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            {mode === 'signin' && (
              <div className="flex items-center justify-between text-sm">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 text-purple-500 bg-slate-900 border-purple-500/20 rounded focus:ring-purple-500 cursor-pointer"
                  />
                  <span className="text-gray-400">Remember me</span>
                </label>
                <button
                  type="button"
                  className="text-purple-400 hover:text-purple-300 font-medium"
                >
                  Forgot password?
                </button>
              </div>
            )}

            <button
              onClick={() => handleSubmit()}
              disabled={loading || wakingUp}
              className="w-full text-white py-3.5 rounded-xl font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-6"
              style={{ background: 'linear-gradient(to right, #a855f7, #ec4899)' }}
            >
              {(loading || wakingUp) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {wakingUp ? 'Starting server...' : mode === 'signin' ? 'Signing in...' : 'Creating account...'}
                </>
              ) : (
                <>
                  {mode === 'signin' ? 'Sign In' : 'Create Account'}
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>

          {mode === 'signup' && (
            <p className="text-xs text-gray-500 text-center mt-4">
              By signing up, you agree to our Terms of Service and Privacy Policy
            </p>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-6 text-gray-500 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-purple-400" />
            <span>Secure</span>
          </div>
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <span>Fast Setup</span>
          </div>
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// Wrap the component in Suspense boundary
export default function AuthPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0f172a 0%, #4a1d96 50%, #0f172a 100%)' }}>
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-purple-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    }>
      <AuthPageContent />
    </Suspense>
  );
}