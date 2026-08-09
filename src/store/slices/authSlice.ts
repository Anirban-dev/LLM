import { StateCreator } from 'zustand';
import { User } from '../../types';

export interface AuthSlice {
  user: User | null;
  token: string | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const createAuthSlice: StateCreator<AuthSlice> = (set) => ({
  user: localStorage.getItem('chat_user')
    ? JSON.parse(localStorage.getItem('chat_user')!)
    : null,
  token: localStorage.getItem('chat_token'),

  setAuth: (token, user) => {
    localStorage.setItem('chat_token', token);
    localStorage.setItem('chat_user', JSON.stringify(user));
    set({ token, user });
  },

  logout: () => {
    localStorage.removeItem('chat_token');
    localStorage.removeItem('chat_user');
    set({ token: null, user: null });
  },
});
