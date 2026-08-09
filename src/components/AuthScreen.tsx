import React, { useState } from 'react';
import { MessageSquare, Lock, Mail, User as UserIcon, ShieldCheck } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

export const AuthScreen: React.FC = () => {
  const [isLogin, setIsLogin] = useState(true);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');

  // Sign-Up OTP Modal State (5-min memory cache)
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [testOtp, setTestOtp] = useState<string | null>(null);

  // Status Feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAuth } = useChatStore();

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();
      if (res.ok) {
        setAuth(data.token, data.user);
      } else {
        setError(data.message || 'Invalid email or password');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleSignUpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, email, password }),
      });

      const data = await res.json();
      if (res.ok && data.requireOtp) {
        setTestOtp(data.otp || null);
        setSuccessMsg(data.message || 'OTP verification code generated (valid for 5 mins)');
        setShowOtpModal(true);
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch (err: any) {
      setError(err.message || 'Connection error');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit verification code');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-signup-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode }),
      });

      const data = await res.json();
      if (res.ok) {
        setAuth(data.token, data.user);
      } else {
        setError(data.message || 'Invalid or expired OTP code');
      }
    } catch (err: any) {
      setError(err.message || 'OTP verification error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);

    const testEmail = email && email.includes('@') ? email : 'user@gmail.com';
    const testName = username || testEmail.split('@')[0];

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testEmail,
          name: testName,
          avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(testName)}`,
        }),
      });

      const data = await res.json();
      if (res.ok) {
        setAuth(data.token, data.user);
      } else {
        setError(data.message || 'Google Sign-In failed');
      }
    } catch (err: any) {
      setError(err.message || 'Google authentication error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#111b21] flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,#00a884_0%,#111b21_70%)]">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-gray-100">
        {/* Logo & Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 bg-[#00a884]/10 border border-[#00a884]/30 rounded-2xl flex items-center justify-center text-[#00a884] mx-auto mb-3 shadow-sm">
            <MessageSquare className="w-7 h-7 fill-current" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ChatApp</h1>
          <p className="text-xs text-gray-500 mt-1">Real-Time Chat & Voice Platform</p>
        </div>

        {/* Tab Switcher: Sign In vs Sign Up */}
        <div className="flex bg-[#f0f2f5] p-1 rounded-xl mb-6 border border-[#e9edef]">
          <button
            type="button"
            onClick={() => { setIsLogin(true); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              isLogin ? 'bg-[#00a884] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => { setIsLogin(false); setError(''); setSuccessMsg(''); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-colors ${
              !isLogin ? 'bg-[#00a884] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Sign Up
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {/* SIGN IN FORM */}
        {isLogin ? (
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#00a884] hover:bg-[#008f70] text-white font-semibold text-sm rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Signing In...' : 'Sign In'}
            </button>
          </form>
        ) : (
          /* SIGN UP FORM */
          <form onSubmit={handleSignUpSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Username</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="e.g. AlexMorgan"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                  required
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[#00a884] hover:bg-[#008f70] text-white font-semibold text-sm rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50"
            >
              {loading ? 'Creating Account...' : 'Create Account'}
            </button>
          </form>
        )}

        {/* DIVIDER & GOOGLE OAUTH BUTTON */}
        <div className="relative my-5">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
          <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-gray-400 font-medium">Or</span></div>
        </div>

        <button
          type="button"
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full py-2.5 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold text-xs rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
          </svg>
          <span>Continue with Google</span>
        </button>

        {/* 5-MINUTE OTP VERIFICATION MODAL */}
        {showOtpModal && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-gray-100">
              <div className="w-12 h-12 bg-[#00a884]/10 rounded-full flex items-center justify-center text-[#00a884] mx-auto mb-3">
                <ShieldCheck className="w-6 h-6" />
              </div>

              <h2 className="text-lg font-bold text-gray-900 text-center mb-1">Enter OTP Code</h2>
              <p className="text-xs text-gray-500 text-center mb-4">
                We sent a 6-digit code to <span className="font-semibold text-gray-800">{email}</span>. Code expires in 5 minutes.
              </p>

              {testOtp && (
                <div className="p-3 bg-[#00a884]/10 border border-[#00a884]/30 rounded-xl text-center mb-4">
                  <span className="text-xs text-gray-600 block">Test Verification Code:</span>
                  <span className="text-xl font-mono font-bold text-[#00a884] tracking-widest">{testOtp}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  className="w-full py-3 px-4 bg-[#f0f2f5] border border-gray-200 rounded-xl text-center text-xl font-mono tracking-widest text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#00a884]"
                  required
                />

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowOtpModal(false)}
                    className="flex-1 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold rounded-xl"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="flex-1 py-2.5 bg-[#00a884] hover:bg-[#008f70] text-white text-xs font-semibold rounded-xl shadow-md disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
