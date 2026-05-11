import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { signInWithGoogle, logout } from '../firebase';
import { LogIn, LogOut, Sun, Moon, Trophy, WifiOff } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [isOffline, setIsOffline] = useState(!navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-white/80 dark:bg-black/80 backdrop-blur-md border-gray-200 dark:border-gray-800 transition-colors duration-300">
      <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="text-amber-500 w-6 h-6" />
          <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
            PANINI 2026
          </span>
          {isOffline && (
            <div className="flex items-center gap-1 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-widest ml-2">
              <WifiOff className="w-3 h-3" />
              <span>Desconectado</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={toggleTheme}
            className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
            title={theme === 'dark' ? 'Modo Claro' : 'Modo Oscuro'}
            id="theme-toggle"
          >
            {theme === 'dark' ? <Sun className="w-5 h-5 text-yellow-400" /> : <Moon className="w-5 h-5 text-gray-600" />}
          </button>

          {user ? (
            <div className="flex items-center gap-3">
               <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-medium text-gray-900 dark:text-gray-100">{user.displayName}</span>
                <span className="text-[10px] text-gray-500 uppercase">Mi Album</span>
              </div>
              <img 
                src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}`} 
                className="w-8 h-8 rounded-full border border-gray-200 dark:border-gray-700" 
                alt="Profile" 
              />
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                title="Cerrar Sesión"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          ) : (
            <button
              onClick={signInWithGoogle}
              className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium transition-all shadow-md active:scale-95"
            >
              <LogIn className="w-4 h-4" />
              <span>Ingresar</span>
            </button>
          )}
        </div>
      </div>
    </nav>
  );
};
