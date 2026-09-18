import { CartItem } from '@tilevista/types';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export const CartApi = {
  getCart: async (sessionId: string): Promise<CartItem[]> => {
    const res = await fetch(`${API_BASE}/cart/${sessionId}`);
    if (!res.ok) throw new Error('Failed to fetch cart');
    return res.json();
  },

  addItem: async (sessionId: string, osposItemId: number, quantity: number): Promise<CartItem[]> => {
    const res = await fetch(`${API_BASE}/cart/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
    });
    if (!res.ok) throw new Error('Failed to remove item');
    return res.json();
  },

  clearCart: async (sessionId: string): Promise<void> => {
    const res = await fetch(`${API_BASE}/cart/${sessionId}`, {
      method: 'DELETE',
    });
    if (!res.ok) throw new Error('Failed to clear cart');
  }
};
