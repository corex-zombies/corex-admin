import { StrictMode, useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { ReportForm } from './components/ReportForm'
import { ErrorBoundary } from './components/ErrorBoundary'
import { IS_NUI, closeNui, onNuiMessage } from './lib/nui'
import { ItemsCatalogProvider } from './components/ItemsCatalogProvider'

type Mode = 'admin' | 'report';

export function Shell() {
  // Dev (browser): start as 'admin' immediately. NUI: wait for a message.
  const [mode, setMode] = useState<Mode | null>(IS_NUI ? null : 'admin');

  useEffect(() => {
    if (!IS_NUI) return;
    const off = onNuiMessage<{ open: boolean; mode?: Mode }>('visibility', ({ open, mode: m }) => {
      setMode(open ? (m ?? 'admin') : null);
    });
    return off;
  }, []);

  if (mode === null) return null;
  if (mode === 'report') return <ReportForm />;
  // Mount the catalog with the visible admin session, not the hidden NUI page.
  // Inventory restarts and newly registered add-on items must be visible on reopen.
  return <ItemsCatalogProvider><App /></ItemsCatalogProvider>;
}

const root = document.getElementById('root')!

if (!IS_NUI) {
  root.classList.add('nui-open');
} else {
  // Toggle visibility class so we can keep #root hidden by default in CSS.
  onNuiMessage<{ open: boolean }>('visibility', ({ open }) => {
    if (open) root.classList.add('nui-open');
    else root.classList.remove('nui-open');
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeNui();
  });
  window.addEventListener('corex-admin:close', () => closeNui());
}

createRoot(root).render(
  <StrictMode>
    <ErrorBoundary>
      <Shell />
    </ErrorBoundary>
  </StrictMode>,
)
