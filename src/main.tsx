import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { AlertTriangle, Key, ExternalLink } from 'lucide-react';
import App from './App.tsx';
import './index.css';

const PUBLISHABLE_KEY = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

// Check if the key is valid (not just a placeholder)
const isValidKey = PUBLISHABLE_KEY && PUBLISHABLE_KEY.startsWith('pk_') && PUBLISHABLE_KEY !== 'pk_test_...';

const ConfigError = () => (
  <div className="min-h-screen bg-[#09090b] flex items-center justify-center p-6 text-zinc-300 antialiased">
    <div className="max-w-md w-full bg-zinc-900/50 border border-zinc-800 rounded-3xl p-10 text-center space-y-6 shadow-2xl backdrop-blur-xl">
      <div className="w-16 h-16 bg-amber-500/10 rounded-2xl flex items-center justify-center mx-auto border border-amber-500/20">
        <AlertTriangle className="w-8 h-8 text-amber-500" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-white tracking-tight">Configuration Needed</h1>
        <p className="text-zinc-500 text-sm leading-relaxed">
          Your Clerk Publishable Key is either missing or invalid. Authentication is required to run this application.
        </p>
      </div>
      
      <div className="bg-black/40 rounded-2xl p-4 border border-zinc-800 text-left space-y-3">
        <div className="flex items-start gap-3">
          <Key className="w-4 h-4 text-indigo-400 mt-0.5" />
          <div className="space-y-1">
            <p className="text-xs font-bold text-zinc-400 uppercase tracking-widest">How to fix:</p>
            <p className="text-[13px] text-zinc-500">
              Update <code className="text-indigo-400 bg-indigo-400/10 px-1 rounded">VITE_CLERK_PUBLISHABLE_KEY</code> in your <code className="text-zinc-300 font-mono">.env.local</code> file.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <a 
          href="https://dashboard.clerk.com/last-active?path=api-keys" 
          target="_blank" 
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white py-3 rounded-xl font-bold transition-all shadow-lg shadow-indigo-900/20"
        >
          <ExternalLink className="w-4 h-4" />
          Get Clerk Keys
        </a>
        <button 
          onClick={() => window.location.reload()}
          className="text-zinc-500 hover:text-zinc-300 text-xs font-medium py-2"
        >
          I've updated the file, reload page
        </button>
      </div>
    </div>
  </div>
);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isValidKey ? (
      <ClerkProvider publishableKey={PUBLISHABLE_KEY}>
        <App />
      </ClerkProvider>
    ) : (
      <ConfigError />
    )}
  </StrictMode>,
);
