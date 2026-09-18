'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from './AuthContext';
import { UserPlus, LogIn, ShieldAlert, KeyRound, CheckCircle2, ArrowLeft } from 'lucide-react';

export const AuthFeature: React.FC = () => {
  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [isRegister, setIsRegister] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handlePostAuthRedirect = () => {
    let role = '';
    const savedUser = localStorage.getItem('tilevista_admin_user');
    if (savedUser) {
      try {
        const userObj = JSON.parse(savedUser);
        role = (userObj.role || '').toUpperCase();
      } catch {
        role = '';
      }
    }

    const isAdmin = role === 'ADMIN' || role === 'ADMINISTRATOR';

    if (isAdmin) {
      // ADMIN: Only honor explicit admin subroutes (e.g. /admin/orders). Otherwise default to /admin/dashboard.
      if (redirectParam && redirectParam.startsWith('/admin')) {
        router.push(redirectParam);
      } else {
        router.push('/admin/dashboard');
      }
      return;
    }

    // CUSTOMER: Honor valid customer redirect parameters (e.g. /checkout, /account, /notifications).
    if (redirectParam && !redirectParam.startsWith('/admin')) {
      router.push(redirectParam);
      return;
    }

    // CUSTOMER default destination: /dashboard
    router.push('/dashboard');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsSubmitting(true);

    try {
      if (isForgotPassword) {
        // Forgot Password API Call
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
        const res = await fetch(`${apiUrl}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        if (res.ok) {
          const data = await res.json();
          setSuccessMessage(
            data.message || 'If an account exists with that email, a password reset link has been sent to your inbox.',
          );
        } else {
          setError('Failed to send reset link. Please check your email address.');
        }
      } else if (isRegister) {
        // Customer Registration
        const success = await register({
          email,
          pass: password,
          firstName: firstName || undefined,
          lastName: lastName || undefined,
          phone: phone || undefined,
        });

        if (success) {
          handlePostAuthRedirect();
        } else {
          setError('Registration failed. Email might already be registered.');
        }
      } else {
        // Login
        const success = await login(email, password);
        if (success) {
          handlePostAuthRedirect();
        } else {
          setError('Invalid login credentials.');
        }
      }
    } catch (err) {
      setError('An unexpected error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-104px)] bg-brandLight flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md p-8 border border-gray-200 bg-white shadow-sm">
        {/* Header brand details */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-wide">
            {isForgotPassword
              ? 'Reset Password'
              : isRegister
              ? 'Create Showroom Profile'
              : 'Log In'}
          </h2>
          <p className="text-xs text-gray-500 font-light mt-2 leading-relaxed">
            {isForgotPassword
              ? 'Enter your registered email address below and we will send you a link to reset your password.'
              : isRegister
              ? 'Register to unlock custom 3D canvas saving, checklists summaries, and POS order history logs.'
              : 'Sign in to access your synchronized designs, check order references status, and manage dashboard details.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-6 text-xs flex gap-2.5 items-start font-light">
            <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {successMessage && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-4 mb-6 text-xs flex gap-2.5 items-start font-light">
            <CheckCircle2 size={18} className="flex-shrink-0 mt-0.5 text-emerald-600" />
            <div>
              <p className="font-medium text-emerald-900 mb-1">Check Your Email</p>
              <p className="leading-relaxed">{successMessage}</p>
            </div>
          </div>
        )}

        {(!isForgotPassword || !successMessage) && (
          <form onSubmit={handleSubmit} className="space-y-5">
            {isRegister && !isForgotPassword && (
              <>
                {/* First Name & Last Name in row */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">First Name</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
                      placeholder="John"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Last Name</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
                      placeholder="Doe"
                    />
                  </div>
                </div>

                {/* Phone input */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Phone Number</label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
                    placeholder="0771234567"
                  />
                </div>
              </>
            )}

            {/* Email input */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Email Address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
                placeholder="e.g. name@example.com"
              />
            </div>

            {/* Password input (hidden during forgot password) */}
            {!isForgotPassword && (
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">
                    Security Password
                  </label>
                  {!isRegister && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsForgotPassword(true);
                        setError(null);
                        setSuccessMessage(null);
                      }}
                      className="text-[10px] text-gray-500 hover:text-[#1A1A1A] underline transition-colors"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
                  placeholder="••••••••"
                />
              </div>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-bold text-xs tracking-widest uppercase py-3.5 transition-all duration-300 mt-2 flex items-center justify-center gap-2.5"
            >
              {isSubmitting ? (
                <span>Processing...</span>
              ) : isForgotPassword ? (
                <>
                  <KeyRound size={15} />
                  <span>Send Reset Link</span>
                </>
              ) : isRegister ? (
                <>
                  <UserPlus size={15} />
                  <span>Register Account</span>
                </>
              ) : (
                <>
                  <LogIn size={15} />
                  <span>Access Account</span>
                </>
              )}
            </button>
          </form>
        )}

        {/* Back to Sign In / Mode toggle */}
        <div className="mt-6 text-center text-xs border-t border-gray-100 pt-5">
          {isForgotPassword ? (
            <button
              onClick={() => {
                setIsForgotPassword(false);
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-gray-500 hover:text-[#1A1A1A] inline-flex items-center gap-1.5 transition-colors"
            >
              <ArrowLeft size={14} />
              <span>Back to Sign In</span>
            </button>
          ) : (
            <button
              onClick={() => {
                setIsRegister(!isRegister);
                setError(null);
                setSuccessMessage(null);
              }}
              className="text-gray-400 hover:text-[#1A1A1A] transition-colors"
            >
              {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default AuthFeature;
