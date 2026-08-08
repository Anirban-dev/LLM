import React, { useState } from 'react';
import { MessageSquare, Lock, Mail, User as UserIcon, ShieldCheck, KeyRound, Sparkles } from 'lucide-react';
import { useChatStore } from '../store/useChatStore';

type AuthMode = 'password' | 'otp' | 'google';

export const AuthScreen: React.FC = () => {
  const [authMode, setAuthMode] = useState<AuthMode>('password');
  const [isLogin, setIsLogin] = useState(true);

  // Form Fields
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [avatarSeed, setAvatarSeed] = useState('Alex');

  // OTP State
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [receivedOtp, setReceivedOtp] = useState<string | null>(null);

  // Google State
  const [googleName, setGoogleName] = useState('');

  // Status & Feedback
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [loading, setLoading] = useState(false);

  const { setAuth } = useChatStore();

  const resetFormState = () => {
    setError('');
    setSuccessMsg('');
    setOtpSent(false);
    setOtpCode('');
    setReceivedOtp(null);
  };

  // Handle Standard Password Login / Register
  const handlePasswordAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccessMsg('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed || username || 'Alex')}`;

    const payload = isLogin
      ? { email, password }
      : { username, email, password, avatarUrl };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        setAuth(data.token, data.user);
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (err: any) {
      setError(err.message || 'Server connection error');
    } finally {
      setLoading(false);
    }
  };

  // Handle Request OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      const data = await res.json();

      if (res.ok) {
        setOtpSent(true);
        setReceivedOtp(data.otp);
        setSuccessMsg(`OTP code sent! (Your test OTP code is: ${data.otp})`);
      } else {
        setError(data.message || 'Failed to send OTP code');
      }
    } catch (err: any) {
      setError(err.message || 'Server error sending OTP');
    } finally {
      setLoading(false);
    }
  };

  // Handle Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode || otpCode.trim().length < 4) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, otp: otpCode, username }),
      });

      const data = await res.json();

      if (res.ok) {
        setAuth(data.token, data.user);
      } else {
        setError(data.message || 'OTP verification failed');
      }
    } catch (err: any) {
      setError(err.message || 'Server error verifying OTP');
    } finally {
      setLoading(false);
    }
  };

  // Handle Login with Google
  const handleGoogleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !email.includes('@')) {
      setError('Please enter your Google account email');
      return;
    }

    setError('');
    setSuccessMsg('');
    setLoading(true);

    const name = googleName || email.split('@')[0];
    const avatarUrl = `https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(name)}`;

    try {
      const res = await fetch('/api/auth/google', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name,
          avatarUrl,
          googleId: 'google_' + Date.now(),
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setAuth(data.token, data.user);
      } else {
        setError(data.message || 'Google Sign-In failed');
      }
    } catch (err: any) {
      setError(err.message || 'Server error during Google Sign-In');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#111b21] flex items-center justify-center p-4 bg-[radial-gradient(ellipse_at_top,#00a884_0%,#111b21_70%)]">
      <div className="w-full max-w-md bg-white rounded-2xl p-6 sm:p-8 shadow-2xl relative overflow-hidden border border-gray-100">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-[#00a884]/10 border border-[#00a884]/30 rounded-2xl flex items-center justify-center text-[#00a884] mx-auto mb-3 shadow-sm">
            <MessageSquare className="w-8 h-8 fill-current" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">ChatApp</h1>
          <p className="text-xs text-gray-500 mt-1">Real-Time Chat • WebRTC Voice Calling • Custom Auth</p>
        </div>

        {/* Auth Mode Selectors */}
        <div className="grid grid-cols-3 bg-[#f0f2f5] p-1 rounded-xl mb-6 border border-[#e9edef] gap-1">
          <button
            type="button"
            onClick={() => { setAuthMode('password'); resetFormState(); }}
            className={`py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 ${
              authMode === 'password' ? 'bg-[#00a884] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Password</span>
          </button>

          <button
            type="button"
            onClick={() => { setAuthMode('otp'); resetFormState(); }}
            className={`py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 ${
              authMode === 'otp' ? 'bg-[#00a884] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Email OTP</span>
          </button>

          <button
            type="button"
            onClick={() => { setAuthMode('google'); resetFormState(); }}
            className={`py-2 text-[11px] sm:text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-1 ${
              authMode === 'google' ? 'bg-[#00a884] text-white shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Google</span>
          </button>
        </div>

        {/* Feedback Messages */}
        {error && (
          <div className="mb-4 p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-600 text-xs text-center font-medium">
            {error}
          </div>
        )}

        {successMsg && (
          <div className="mb-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-700 text-xs text-center font-medium">
            {successMsg}
          </div>
        )}

        {/* MODE 1: PASSWORD AUTH */}
        {authMode === 'password' && (
          <div>
            <div className="flex justify-center gap-4 mb-4 text-xs font-medium">
              <button
                type="button"
                onClick={() => { setIsLogin(true); setError(''); }}
                className={`pb-1 border-b-2 transition-colors ${
                  isLogin ? 'border-[#00a884] text-[#00a884] font-bold' : 'border-transparent text-gray-500'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => { setIsLogin(false); setError(''); }}
                className={`pb-1 border-b-2 transition-colors ${
                  !isLogin ? 'border-[#00a884] text-[#00a884] font-bold' : 'border-transparent text-gray-500'
                }`}
              >
                Create Account
              </button>
            </div>

            <form onSubmit={handlePasswordAuth} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Username</label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="e.g. AlexMorgan"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                      required
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                  <input
                    type="email"
                    placeholder="alex@example.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
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
                    className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                    required
                  />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Avatar Seed</label>
                  <div className="flex items-center gap-3">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${encodeURIComponent(avatarSeed || 'Alex')}`}
                      alt="Avatar preview"
                      className="w-10 h-10 rounded-full bg-[#f0f2f5] border border-gray-200 object-cover shrink-0"
                    />
                    <input
                      type="text"
                      placeholder="Avatar seed..."
                      value={avatarSeed}
                      onChange={(e) => setAvatarSeed(e.target.value)}
                      className="flex-1 px-3 py-2 bg-[#f0f2f5] border border-gray-200 rounded-xl text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                    />
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 bg-[#00a884] hover:bg-[#008f70] text-white font-semibold text-sm rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50 mt-2"
              >
                {loading ? 'Authenticating...' : isLogin ? 'Sign In' : 'Register Account'}
              </button>
            </form>
          </div>
        )}

        {/* MODE 2: OTP AUTH */}
        {authMode === 'otp' && (
          <div>
            {!otpSent ? (
              <form onSubmit={handleSendOtp} className="space-y-4">
                <p className="text-xs text-gray-600 mb-2">
                  Enter your email address to receive a 6-digit verification OTP code.
                </p>

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">Email Address</label>
                  <div className="relative">
                    <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                      required
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-[#00a884] hover:bg-[#008f70] text-white font-semibold text-sm rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50"
                >
                  {loading ? 'Sending OTP...' : 'Send OTP Code'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-4">
                <p className="text-xs text-gray-600 mb-2">
                  OTP code sent to <span className="font-semibold text-gray-900">{email}</span>.
                </p>

                {receivedOtp && (
                  <div className="p-3 bg-[#00a884]/10 border border-[#00a884]/30 rounded-xl text-center">
                    <span className="text-xs text-gray-600 block">Your OTP Code:</span>
                    <span className="text-xl font-mono font-bold text-[#00a884] tracking-widest">{receivedOtp}</span>
                  </div>
                )}

                <div>
                  <label className="block text-xs font-semibold text-gray-700 mb-1">6-Digit OTP Code</label>
                  <div className="relative">
                    <ShieldCheck className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                    <input
                      type="text"
                      placeholder="123456"
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value)}
                      className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-lg font-mono tracking-widest text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                      required
                    />
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setOtpSent(false)}
                    className="w-1/3 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 font-semibold text-xs rounded-xl transition-colors"
                  >
                    Back
                  </button>
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-2/3 py-2.5 bg-[#00a884] hover:bg-[#008f70] text-white font-semibold text-sm rounded-xl shadow-md transition-transform active:scale-95 disabled:opacity-50"
                  >
                    {loading ? 'Verifying...' : 'Verify & Sign In'}
                  </button>
                </div>
              </form>
            )}
          </div>
        )}

        {/* MODE 3: GOOGLE AUTH */}
        {authMode === 'google' && (
          <form onSubmit={handleGoogleLogin} className="space-y-4">
            <p className="text-xs text-gray-600 mb-2">
              Sign in seamlessly using your Google Account details.
            </p>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Google Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="email"
                  placeholder="user@gmail.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Full Name (Optional)</label>
              <div className="relative">
                <UserIcon className="w-4 h-4 absolute left-3 top-3 text-gray-400" />
                <input
                  type="text"
                  placeholder="e.g. John Smith"
                  value={googleName}
                  onChange={(e) => setGoogleName(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-[#f0f2f5] border border-gray-200 rounded-xl text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:bg-white focus:ring-1 focus:ring-[#00a884]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-white border border-gray-300 hover:bg-gray-50 text-gray-800 font-semibold text-sm rounded-xl shadow-sm transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50 mt-2"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              <span>{loading ? 'Connecting Google...' : 'Continue with Google'}</span>
            </button>
          </form>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100 text-center">
          <p className="text-[11px] text-gray-400 font-mono">
            MongoDB • JWT Auth • Socket.io WebRTC • Express
          </p>
        </div>
      </div>
    </div>
  );
};
