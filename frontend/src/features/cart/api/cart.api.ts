import { CartItem } from '@tilevista/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

const getAuthHeaders = (): HeadersInit => {
  const token = typeof window !== 'undefined' ? (localStorage.getItem('tilevista_admin_token') || sessionStorage.getItem('tilevista_admin_token')) : null;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export const CartApi = {
  getCart: async (sessionId: string): Promise<CartItem[]> => {
    const res = await fetch(`${API_BASE}/cart/${sessionId}`, {
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to fetch cart');
    return res.json();
  },

  addItem: async (sessionId: string, osposItemId: number, quantity: number): Promise<CartItem[]> => {
    const res = await fetch(`${API_BASE}/cart/${sessionId}`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ osposItemId, quantity }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to add item to cart');
    }
    return res.json();
  },

  updateQuantity: async (sessionId: string, osposItemId: number, quantity: number): Promise<CartItem[]> => {
    const res = await fetch(`${API_BASE}/cart/${sessionId}/${osposItemId}`, {
      method: 'PATCH',
      headers: getAuthHeaders(),
      body: JSON.stringify({ quantity }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to update quantity');
    }
    return res.json();
  },

  removeItem: async (sessionId: string, osposItemId: number): Promise<CartItem[]> => {
    const res = await fetch(`${API_BASE}/cart/${sessionId}/${osposItemId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to remove item');
    return res.json();
  },

  clearCart: async (sessionId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/cart/${sessionId}`, {
      method: 'DELETE',
      headers: getAuthHeaders(),
    });
    if (!res.ok) throw new Error('Failed to clear cart');
  }
};

