import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { FiAlertTriangle, FiHelpCircle } from 'react-icons/fi';

const ConfirmContext = createContext(() => Promise.resolve(false));

// eslint-disable-next-line react-refresh/only-export-components
export const useConfirm = () => useContext(ConfirmContext);

// Usage: const confirm = useConfirm(); if (await confirm({ title, message, confirmText, danger })) { ... }
export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolver = useRef(null);
  const confirmBtn = useRef(null);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setDialog({ title: 'Are you sure?', confirmText: 'Confirm', cancelText: 'Cancel', danger: false, ...options });
  }), []);

  const close = useCallback((result) => {
    resolver.current?.(result);
    resolver.current = null;
    setDialog(null);
  }, []);

  useEffect(() => {
    if (!dialog) return undefined;
    const onKey = (e) => e.key === 'Escape' && close(false);
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmBtn.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [dialog, close]);

  const Icon = dialog?.danger ? FiAlertTriangle : FiHelpCircle;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {dialog && (
        <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && close(false)}>
          <div className="modal confirm" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-msg">
            <div className={`confirm-icon ${dialog.danger ? 'danger' : ''}`}><Icon /></div>
            <h2 id="confirm-title">{dialog.title}</h2>
            {dialog.message && <p id="confirm-msg" className="muted">{dialog.message}</p>}
            <div className="confirm-actions">
              <button className="btn btn-ghost" onClick={() => close(false)}>{dialog.cancelText}</button>
              <button ref={confirmBtn} className={`btn ${dialog.danger ? 'btn-danger' : ''}`} onClick={() => close(true)}>{dialog.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}
