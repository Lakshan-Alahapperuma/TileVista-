'use client';

import React from 'react';
import { useDesignerStore } from '../../store/designer.store';
import { CheckCircle, AlertTriangle, X } from 'lucide-react';

export const CustomAlertModal: React.FC = () => {
  const alertMessage = useDesignerStore((s) => s.alertMessage);
  const hideAlert = useDesignerStore((s) => s.hideAlert);

  if (!alertMessage) return null;

  const isSuccess =
    alertMessage.toLowerCase().includes('success') ||
    alertMessage.toLowerCase().includes('updated') ||
    alertMessage.toLowerCase().includes('applied') ||
    alertMessage.toLowerCase().includes('added') ||
    alertMessage.toLowerCase().includes('saved');

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
            isSuccess ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-amber-50 text-amber-600 border border-amber-100'
          }`}
        >
          {isSuccess ? <CheckCircle size={28} /> : <AlertTriangle size={28} />}
        </div>

        <h3 className="text-sm font-extrabold text-[#1A1A1A] tracking-wider uppercase">
          {isSuccess ? 'Success Notification' : 'System Notice'}
        </h3>
        
        <p className="text-xs text-gray-600 font-medium mt-2 leading-relaxed max-w-xs">
          {alertMessage}
        </p>

        <button
          onClick={hideAlert}
          className="mt-6 w-full py-3 bg-[#1A1A1A] hover:bg-black text-white text-xs font-bold uppercase tracking-widest rounded-xl transition-all shadow-md active:scale-95"
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default CustomAlertModal;
