'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useDesignerStore } from '../../store/designer.store';
import { CheckCircle, AlertTriangle, LogIn, X } from 'lucide-react';

export const CustomAlertModal: React.FC = () => {
  const router = useRouter();
  const alertMessage = useDesignerStore((s) => s.alertMessage);
  const hideAlert = useDesignerStore((s) => s.hideAlert);

  if (!alertMessage) return null;

  const isLoginPrompt =
    alertMessage.toLowerCase().includes('log in') ||
    alertMessage.toLowerCase().includes('login');

  const isSuccess =
    !isLoginPrompt &&
    (alertMessage.toLowerCase().includes('success') ||
      alertMessage.toLowerCase().includes('updated') ||
      alertMessage.toLowerCase().includes('applied') ||
      alertMessage.toLowerCase().includes('added') ||
      alertMessage.toLowerCase().includes('saved'));

  const handleLoginRedirect = () => {
    hideAlert();
    const currentUrl = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/designer';
    router.push(`/login?redirect=${encodeURIComponent(currentUrl)}`);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[9999] flex items-center justify-center p-4 animate-in fade-in duration-200 font-sans">
      <div className="bg-white rounded-2xl p-6 shadow-2xl max-w-sm w-full mx-4 border border-gray-100 flex flex-col items-center text-center animate-in zoom-in-95 duration-200 relative">
        <button
          onClick={hideAlert}
          className="absolute top-4 right-4 p-1 text-gray-400 hover:text-black rounded-lg transition-colors"
          title="Close"
        >
          <X size={16} />
        </button>

        <div
          className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 shadow-sm ${
            isSuccess
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-100'
              : isLoginPrompt
              ? 'bg-blue-50 text-blue-600 border border-blue-100'
              : 'bg-amber-50 text-amber-600 border border-amber-100'
          }`}
        >
          {isSuccess ? (
            <CheckCircle size={28} />
          ) : isLoginPrompt ? (
            <LogIn size={28} />
          ) : (
            <AlertTriangle size={28} />
          )}
        </div>

        <h3 className="text-sm font-extrabold text-[#1A1A1A] tracking-wider uppercase">
          {isSuccess
            ? 'Success Notification'
            : isLoginPrompt
            ? 'Login Required'
            : 'System Notice'}
        </h3>
        
        <p className="text-xs text-gray-600 font-medium mt-2 leading-relaxed max-w-xs">
          {alertMessage}
        </p>

        {isLoginPrompt ? (
          <div className="mt-6 w-full flex flex-col gap-2">
            <button
              onClick={handleLoginRedirect}
              className="w-full py-3 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95 flex items-center justify-center gap-2"
            >
              <LogIn size={14} />
              Log In Now
            </button>
            <button
              onClick={hideAlert}
              className="w-full py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-semibold uppercase tracking-wider rounded-xl transition-all"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={hideAlert}
            className="mt-6 w-full py-3 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
          >
            OK
          </button>
        )}
      </div>
    </div>
  );
};

export default CustomAlertModal;
