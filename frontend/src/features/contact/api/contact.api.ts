import { InquiryData } from '../types';
import { API_BASE } from '../constants';

export const submitInquiry = async (data: InquiryData): Promise<void> => {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || API_BASE;
  const response = await fetch(`${apiUrl}/inquiries`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });

  if (!response.ok) {
    throw new Error('Failed to submit inquiry');
  }
};
