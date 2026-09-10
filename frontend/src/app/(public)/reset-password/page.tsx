'use client';

import React, { useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { KeyRound, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const token = searchParams.get('token');

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Missing or invalid password reset token. Please request a new reset link.');
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match. Please enter matching passwords.');
      return;
    }

    setIsSubmitting(true);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.message || 'Failed to reset password. Link may have expired.');
      } else {
        setSuccess(true);
      }
    } catch (err) {
      setError('An unexpected network error occurred. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="text-center py-6">
        <div className="bg-amber-50 border border-amber-200 text-amber-800 p-4 text-xs mb-6 flex gap-2.5 items-start font-light text-left">
          <ShieldAlert size={18} className="flex-shrink-0 mt-0.5 text-amber-600" />
          <span>Invalid or missing reset token. Please return to the login page and request a new password reset link.</span>
        </div>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 bg-[#1A1A1A] text-white text-xs font-bold uppercase tracking-widest px-6 py-3 hover:bg-[#D4C5B9] hover:text-[#1A1A1A] transition-all"
        >
          <span>Return to Login</span>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center py-4">
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 p-5 text-xs mb-6 flex gap-3 items-start font-light text-left">
          <CheckCircle2 size={20} className="flex-shrink-0 text-emerald-600 mt-0.5" />
          <div>
            <h4 className="font-semibold text-emerald-900 mb-1 text-sm">Password Reset Successful!</h4>
            <p className="leading-relaxed">Your account password has been updated successfully. You can now log in using your new password.</p>
          </div>
        </div>
        <button
          onClick={() => router.push('/login')}
          className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-bold text-xs tracking-widest uppercase py-3.5 transition-all duration-300 flex items-center justify-center gap-2.5"
        >
          <span>Proceed to Login</span>
          <ArrowRight size={15} />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 p-4 text-xs flex gap-2.5 items-start font-light">
          <ShieldAlert size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">New Security Password</label>
        <input
          type="password"
          required
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
          placeholder="At least 6 characters"
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-[9px] font-bold tracking-widest text-gray-500 uppercase">Confirm New Password</label>
        <input
          type="password"
          required
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full bg-[#F9F9F7] border border-gray-200 px-4 py-3.5 text-xs text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-light transition-colors"
          placeholder="Re-enter new password"
        />
      </div>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white font-bold text-xs tracking-widest uppercase py-3.5 transition-all duration-300 mt-2 flex items-center justify-center gap-2.5"
      >
        {isSubmitting ? (
          <span>Updating Password...</span>
        ) : (
          <>
            <KeyRound size={15} />
            <span>Reset Password</span>
          </>
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-[calc(100vh-104px)] bg-brandLight flex flex-col items-center justify-center p-6 font-sans">
      <div className="w-full max-w-md p-8 border border-gray-200 bg-white shadow-sm">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-semibold text-[#1A1A1A] tracking-wide">
            Set New Password
          </h2>
          <p className="text-xs text-gray-500 font-light mt-2 leading-relaxed">
            Please enter your new security password below to complete the account recovery process.
          </p>
        </div>

        <Suspense fallback={<div className="text-center text-xs text-gray-500 py-8">Loading password reset form...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}
