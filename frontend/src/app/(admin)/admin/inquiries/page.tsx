'use client';

import React, { useState, useEffect } from 'react';

import { Mail, CheckCircle, Clock, X } from 'lucide-react';

export default function InquiriesAdminPage() {
  const [inquiries, setInquiries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedInquiry, setSelectedInquiry] = useState<any | null>(null);

  const fetchInquiries = async () => {
    try {
      const token = localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/inquiries`, {
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setInquiries(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInquiries();
  }, []);

  const handleMarkReplied = async (id: string) => {
    try {
      const token = localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';
      const res = await fetch(`${apiUrl}/inquiries/${id}/status`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        setInquiries(inquiries.map(i => i.inquiry_id === id ? { ...i, status: 'replied' } : i));
        if (selectedInquiry?.inquiry_id === id) {
          setSelectedInquiry({ ...selectedInquiry, status: 'replied' });
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-[#1A1A1A]">Customer Inquiries</h1>
      </div>

      <div className="bg-white border border-gray-200 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#FDFBF7] text-[#8C7A6B] border-b border-[#D4C5B9]/40 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-semibold">Date</th>
              <th className="px-6 py-4 font-semibold">Customer</th>
              <th className="px-6 py-4 font-semibold">Subject</th>
              <th className="px-6 py-4 font-semibold">Status</th>
              <th className="px-6 py-4 font-semibold text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">Loading inquiries...</td>
              </tr>
            ) : inquiries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-8 text-center text-gray-500">No inquiries found.</td>
              </tr>
            ) : (
              inquiries.map((inq) => (
                <tr key={inq.inquiry_id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500">
                    {new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(inq.created_at))}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-[#1A1A1A]">{inq.name}</div>
                    <div className="text-xs text-gray-500">{inq.email}</div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="truncate max-w-xs">{inq.subject || 'No Subject'}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
                      inq.status === 'replied' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                    }`}>
                      {inq.status === 'replied' ? <CheckCircle size={12} /> : <Clock size={12} />}
                      {inq.status.charAt(0).toUpperCase() + inq.status.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedInquiry(inq)}
                      className="text-xs font-semibold uppercase tracking-wider text-[#1A1A1A] border-b border-[#1A1A1A] hover:text-[#D4C5B9] hover:border-[#D4C5B9] pb-0.5 transition-colors"
                    >
                      View Details
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {selectedInquiry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white max-w-2xl w-full border border-gray-200 shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 bg-[#F9F9F7]">
              <h2 className="text-lg font-semibold text-[#1A1A1A]">Inquiry Details</h2>
              <button
                onClick={() => setSelectedInquiry(null)}
                className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="font-bold text-[#1A1A1A] text-xl">{selectedInquiry.subject || 'No Subject'}</h3>
                  <div className="flex items-center gap-2 mt-2 text-sm text-gray-600">
                    <Mail size={14} />
                    <a href={`mailto:${selectedInquiry.email}`} className="hover:underline">{selectedInquiry.name} ({selectedInquiry.email})</a>
                  </div>
                </div>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  selectedInquiry.status === 'replied' ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                }`}>
                  {selectedInquiry.status}
                </span>
              </div>
              
              <div className="bg-gray-50 p-4 border border-gray-100 text-sm text-gray-800 whitespace-pre-wrap leading-relaxed">
                {selectedInquiry.message}
              </div>
              
              <div className="mt-4 text-xs text-gray-400">
                Submitted on {new Intl.DateTimeFormat('en-US', { month: 'long', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }).format(new Date(selectedInquiry.created_at))}
              </div>
            </div>
            
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
              {selectedInquiry.status === 'pending' && (
                <button
                  onClick={() => handleMarkReplied(selectedInquiry.inquiry_id)}
                  className="bg-[#1A1A1A] text-white px-6 py-2 text-xs font-semibold tracking-widest uppercase hover:bg-emerald-600 transition-colors flex items-center gap-2"
                >
                  <CheckCircle size={14} /> Mark as Replied
                </button>
              )}
              <button
                onClick={() => setSelectedInquiry(null)}
                className="bg-white border border-gray-200 text-gray-700 px-6 py-2 text-xs font-semibold tracking-widest uppercase hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
