'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { User, ShieldCheck, KeyRound, Loader2, Save, ArrowLeft, CheckCircle, AlertTriangle } from 'lucide-react';
import { useAuth } from '../../../features/auth/AuthContext';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export default function AccountPage() {
  const router = useRouter();
  const { user, token, isAuthenticated, isLoading: authLoading } = useAuth();

  // Profile Form State
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);

  // Security Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push('/login?redirect=/account');
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchProfile = useCallback(async () => {
    if (!isAuthenticated) return;
    setProfileLoading(true);
    try {
      const savedToken = token || localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      const res = await fetch(`${API_BASE}/users/me`, {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setFirstName(data.firstName || '');
      setLastName(data.lastName || '');
      setEmail(data.email || '');
      setPhone(data.phone || '');
    } catch (err: any) {
      setProfileError(err.message || 'Unable to load profile information');
    } finally {
      setProfileLoading(false);
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated, fetchProfile]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setProfileSuccess(null);
    setProfileError(null);
    setProfileSaving(true);

    try {
      const savedToken = token || localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      const res = await fetch(`${API_BASE}/users/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify({
          firstName,
          lastName,
          phone,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Failed to update profile');
      }

      setProfileSuccess('Personal details updated successfully!');
      setTimeout(() => setProfileSuccess(null), 4000);
    } catch (err: any) {
      setProfileError(err.message || 'Error updating profile details.');
    } finally {
      setProfileSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordSuccess(null);
    setPasswordError(null);

    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('New password and confirmation do not match.');
      return;
    }

    setPasswordSaving(true);

    try {
      const savedToken = token || localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      const res = await fetch(`${API_BASE}/users/me/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${savedToken}`,
        },
        body: JSON.stringify({
          currentPassword,
          newPassword,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.message || 'Current password verification failed');
      }

      setPasswordSuccess('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setPasswordSuccess(null), 4000);
    } catch (err: any) {
      setPasswordError(err.message || 'Error updating password. Please check your current password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (authLoading || profileLoading) {
    return (
      <div className="py-20 flex flex-col items-center justify-center text-gray-400 gap-3 font-sans">
        <Loader2 className="animate-spin text-[#D4C5B9]" size={32} />
        <span className="text-xs uppercase font-light tracking-wider">Loading account details...</span>
      </div>
    );
  }

  return (
    <div className="py-10 font-sans max-w-4xl mx-auto px-4 md:px-8 space-y-8">
      {/* Header */}
      <div className="border-b border-gray-200 pb-6">
        <Link
          href="/dashboard"
          className="text-xs font-semibold text-gray-500 hover:text-black uppercase tracking-widest flex items-center gap-1.5 mb-2"
        >
          <ArrowLeft size={12} /> Back to Dashboard
        </Link>
        <h1 className="text-2xl md:text-3xl font-semibold tracking-tight text-[#1A1A1A] flex items-center gap-3">
          <User size={24} className="text-[#8C7A6B]" />
          <span>Customer Account Details</span>
        </h1>
        <p className="text-xs text-gray-500 font-light mt-1">
          Manage your personal contact details, account email, and security password.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card 1: Personal Information */}
        <div className="bg-white border border-gray-200 p-6 md:p-8 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
            <User size={16} className="text-[#8C7A6B]" />
            <h2 className="text-sm font-semibold text-[#1A1A1A] uppercase tracking-wider">
              Personal Information
            </h2>
          </div>

          {profileSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle size={14} className="shrink-0" />
              <span>{profileSuccess}</span>
            </div>
          )}

          {profileError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{profileError}</span>
            </div>
          )}

          <form onSubmit={handleUpdateProfile} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                First Name
              </label>
              <input
                type="text"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full bg-[#F9F9F7] border border-gray-200 px-3.5 py-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Last Name
              </label>
              <input
                type="text"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full bg-[#F9F9F7] border border-gray-200 px-3.5 py-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Email Address (Read Only)
              </label>
              <input
                type="email"
                disabled
                value={email}
                className="w-full bg-gray-100 border border-gray-200 px-3.5 py-2.5 text-gray-500 font-mono cursor-not-allowed"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Phone Number
              </label>
              <input
                type="text"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+94 77 123 4567"
                className="w-full bg-[#F9F9F7] border border-gray-200 px-3.5 py-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9] font-mono"
              />
            </div>

            <button
              type="submit"
              disabled={profileSaving}
              className="w-full mt-2 bg-[#8C7A6B] hover:bg-[#1A1A1A] text-white text-[10px] font-bold uppercase tracking-widest py-3 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {profileSaving ? <Loader2 className="animate-spin" size={14} /> : <Save size={14} />}
              <span>Save Personal Information</span>
            </button>
          </form>
        </div>

        {/* Card 2: Security & Password */}
        <div className="bg-white border border-gray-200 p-6 md:p-8 shadow-sm space-y-6">
          <div className="border-b border-gray-100 pb-3 flex items-center gap-2">
            <KeyRound size={16} className="text-[#8C7A6B]" />
            <h2 className="text-sm font-semibold text-[#1A1A1A] uppercase tracking-wider">
              Security & Password
            </h2>
          </div>

          {passwordSuccess && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center gap-2">
              <CheckCircle size={14} className="shrink-0" />
              <span>{passwordSuccess}</span>
            </div>
          )}

          {passwordError && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertTriangle size={14} className="shrink-0" />
              <span>{passwordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Current Password
              </label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#F9F9F7] border border-gray-200 px-3.5 py-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                New Password
              </label>
              <input
                type="password"
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full bg-[#F9F9F7] border border-gray-200 px-3.5 py-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9]"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-gray-500 uppercase tracking-wider mb-1">
                Confirm New Password
              </label>
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                className="w-full bg-[#F9F9F7] border border-gray-200 px-3.5 py-2.5 text-[#1A1A1A] focus:outline-none focus:border-[#D4C5B9]"
              />
            </div>

            <button
              type="submit"
              disabled={passwordSaving}
              className="w-full mt-2 bg-[#1A1A1A] hover:bg-[#D4C5B9] hover:text-[#1A1A1A] text-white text-[10px] font-bold uppercase tracking-widest py-3 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {passwordSaving ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />}
              <span>Update Password</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
