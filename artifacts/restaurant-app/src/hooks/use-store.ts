import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, MenuItem } from '@workspace/api-client-react';

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes?: string;
}

interface StoreState {
  token: string | null;
  user: User | null;
  cart: CartItem[];
  setAuth: (token: string, user: User) => void;
  logout: () => void;
  addToCart: (menuItem: MenuItem, quantity: number, notes?: string) => void;
  removeFromCart: (itemId: number) => void;
  updateQuantity: (itemId: number, delta: number) => void;
  setItemNotes: (itemId: number, notes: string) => void;
  clearCart: () => void;
}

export const useStore = create<StoreState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      cart: [],
      
      setAuth: (token, user) => set({ token, user }),
      
      logout: () => set({ token: null, user: null }),
      
      addToCart: (menuItem, quantity, notes) => set((state) => {
        const existing = state.cart.find(i => i.menuItem.id === menuItem.id);
        if (existing) {
          return { 
            cart: state.cart.map(i => 
              i.menuItem.id === menuItem.id 
                ? { ...i, quantity: i.quantity + quantity, notes: notes || i.notes } 
                : i
            ) 
          };
        }
        return { cart: [...state.cart, { menuItem, quantity, notes }] };
      }),
      
      removeFromCart: (itemId) => set((state) => ({ 
        cart: state.cart.filter(i => i.menuItem.id !== itemId) 
      })),
      
      updateQuantity: (itemId, delta) => set((state) => ({
        cart: state.cart.map(i => {
          if (i.menuItem.id === itemId) {
            const newQ = Math.max(1, i.quantity + delta);
            return { ...i, quantity: newQ };
          }
          return i;
        })
      })),
      
      setItemNotes: (itemId, notes) => set((state) => ({
        cart: state.cart.map(i => i.menuItem.id === itemId ? { ...i, notes } : i)
      })),

      clearCart: () => set({ cart: [] })
    }),
    { name: 'restaurant-storage' }
  )
);
