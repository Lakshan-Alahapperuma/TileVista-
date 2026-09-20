'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { CartItem } from '@tilevista/types';
import { CartApi } from '../api/cart.api';
import { useDesignerStore } from '../../../store/designer.store';
import CustomAlertModal from '../../../components/ui/CustomAlertModal';
import { useAuth } from '../../auth/AuthContext';

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  error: string | null;
  addItem: (osposItemId: number, quantity: number) => Promise<{ success: boolean; error?: string }>;
  updateQuantity: (osposItemId: number, quantity: number) => Promise<void>;
  removeItem: (osposItemId: number) => Promise<void>;
  clearCart: () => Promise<void>;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated, token } = useAuth();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const prevAuthRef = useRef<boolean>(isAuthenticated);
  const activeFetchIdRef = useRef<number>(0);

  const getSessionId = useCallback(() => {
    if (typeof window === 'undefined') return '';
    let sessionId = localStorage.getItem('tilevista_cart_session');
    if (!sessionId) {
      sessionId = uuidv4();
      localStorage.setItem('tilevista_cart_session', sessionId);
    }
    return sessionId;
  }, []);

  const fetchCart = useCallback(async () => {
    const fetchId = ++activeFetchIdRef.current;
    setLoading(true);
    try {
      const sessionId = getSessionId();
      if (sessionId) {
        const data = await CartApi.getCart(sessionId);
        if (fetchId === activeFetchIdRef.current) {
          setItems(data);
        }
      }
      if (fetchId === activeFetchIdRef.current) {
        setError(null);
      }
    } catch (err: any) {
      if (fetchId === activeFetchIdRef.current) {
        setError(err.message || 'Failed to load cart');
      }
    } finally {
      if (fetchId === activeFetchIdRef.current) {
        setLoading(false);
      }
    }
  }, [getSessionId]);

  // Refetch cart on mount and when authentication state changes
  useEffect(() => {
    const wasAuthenticated = prevAuthRef.current;
    prevAuthRef.current = isAuthenticated;

    if (wasAuthenticated && !isAuthenticated) {
      // User logged out: invalidate in-flight fetches, reset items, generate new session UUID
      activeFetchIdRef.current++;
      setItems([]);
      const newSessionId = uuidv4();
      if (typeof window !== 'undefined') {
        localStorage.setItem('tilevista_cart_session', newSessionId);
      }
      fetchCart();
    } else {
      fetchCart();
    }
  }, [isAuthenticated, token, fetchCart]);

  const addItem = async (osposItemId: number, quantity: number) => {
    try {
      const sessionId = getSessionId();
      const data = await CartApi.addItem(sessionId, osposItemId, quantity);
      setItems(data);
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message };
    }
  };

  const updateQuantity = async (osposItemId: number, quantity: number) => {
    try {
      const sessionId = getSessionId();
      const data = await CartApi.updateQuantity(sessionId, osposItemId, quantity);
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to update quantity');
      useDesignerStore.getState().showAlert(err.message);
    }
  };

  const removeItem = async (osposItemId: number) => {
    try {
      const sessionId = getSessionId();
      const data = await CartApi.removeItem(sessionId, osposItemId);
      setItems(data);
    } catch (err: any) {
      setError(err.message || 'Failed to remove item');
    }
  };

  const clearCart = async () => {
    try {
      const sessionId = getSessionId();
      await CartApi.clearCart(sessionId);
      setItems([]);
    } catch (err: any) {
      setError(err.message || 'Failed to clear cart');
    }
  };

  return (
    <CartContext.Provider value={{ items, loading, error, addItem, updateQuantity, removeItem, clearCart }}>
      {children}
      <CustomAlertModal />
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};


