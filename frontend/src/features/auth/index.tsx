'use client';

import React, { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from './AuthContext';
import { UserPlus, LogIn, ShieldAlert } from 'lucide-react';

export const AuthFeature: React.FC = () => {
  const { login, register } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectParam = searchParams.get('redirect');

  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
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
    setIsSubmitting(true);

    try {
      if (isRegister) {
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
          {/* <span className="inline-flex items-center gap-1 text-[8.5px] font-bold tracking-widest px-3 py-1.5 bg-[#D4C5B9]/15 border border-[#D4C5B9]/30 text-[#1A1A1A] uppercase mb-3">
            {isRegister ? 'New Account Registration' : 'Customer Access Portal'}
          </span> */}
          <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-wide">
            {isRegister ? 'Create Showroom Profile' : 'Log In'}
          </h2>
          <p className="text-xs text-gray-500 font-light mt-2 leading-relaxed">
            {isRegister
              ? 'Register to unlock custom 3D canvas saving, checklists summaries, and POS order history logs.'
              : 'Sign in to access your synchronized designs, check order references status, and manage dashboard details.'
            }
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 mb-6 text-xs flex gap-2.5 items-start font-light">
            <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {isRegister && (
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

          {/* Password input */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Security Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-bold text-xs tracking-widest uppercase py-3.5 transition-all duration-300 mt-2 flex items-center justify-center gap-2.5"
          >
            {isSubmitting ? (
              <span>Processing...</span>
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

        {/* Mode toggle */}
        <div className="mt-6 text-center text-xs border-t border-gray-100 pt-5">
          <button
            onClick={() => {
              setIsRegister(!isRegister);
              setError(null);
            }}
            className="text-gray-400 hover:text-[#1A1A1A] transition-colors"
          >
            {isRegister ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
          </button>
        </div>

      </div>
    </div>
  );
};
export default AuthFeature;
