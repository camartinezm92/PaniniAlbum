import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import './index.css';
import { AuthProvider } from './contexts/AuthContext';
import { AlbumProvider } from './contexts/AlbumContext';
import { ThemeProvider } from './contexts/ThemeContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AuthProvider>
        <AlbumProvider>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </AlbumProvider>
      </AuthProvider>
    </ThemeProvider>
  </StrictMode>,
);
