import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { AlertTriangle, AlertCircle, Info, Trash2, X } from 'lucide-react';
import Button from '../components/common/Button';

const ConfirmContext = createContext(null);

export const ConfirmProvider = ({ children }) => {
  const [dialogState, setDialogState] = useState({
    isOpen: false,
    title: 'Confirm Action',
    message: 'Are you sure you want to continue?',
    confirmText: 'Confirm',
    cancelText: 'Cancel',
    variant: 'danger', // 'danger' | 'warning' | 'info' | 'primary'
  });

  const resolverRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolverRef.current = resolve;

      if (typeof options === 'string') {
        const isDelete = options.toLowerCase().includes('delete') || options.toLowerCase().includes('retire') || options.toLowerCase().includes('exit');
        setDialogState({
          isOpen: true,
          title: isDelete ? 'Confirm Deletion' : 'Confirm Action',
          message: options,
          confirmText: isDelete ? 'Delete' : 'Confirm',
          cancelText: 'Cancel',
          variant: isDelete ? 'danger' : 'warning',
        });
      } else {
        setDialogState({
          isOpen: true,
          title: options.title || 'Confirm Action',
          message: options.message || 'Are you sure you want to continue?',
          confirmText: options.confirmText || 'Confirm',
          cancelText: options.cancelText || 'Cancel',
          variant: options.variant || 'danger',
        });
      }
    });
  }, []);

  const handleClose = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(false);
      resolverRef.current = null;
    }
  }, []);

  const handleConfirm = useCallback(() => {
    setDialogState((prev) => ({ ...prev, isOpen: false }));
    if (resolverRef.current) {
      resolverRef.current(true);
      resolverRef.current = null;
    }
  }, []);

  const getVariantStyles = () => {
    switch (dialogState.variant) {
      case 'danger':
        return {
          bg: '#FEE2E2',
          border: '#FECACA',
          color: '#DC2626',
          icon: <Trash2 size={24} color="#DC2626" />,
          btnVariant: 'danger',
        };
      case 'warning':
        return {
          bg: '#FEF3C7',
          border: '#FDE68A',
          color: '#D97706',
          icon: <AlertTriangle size={24} color="#D97706" />,
          btnVariant: 'warning',
        };
      case 'info':
      default:
        return {
          bg: '#E0F2FE',
          border: '#BAE6FD',
          color: '#0284C7',
          icon: <Info size={24} color="#0284C7" />,
          btnVariant: 'primary',
        };
    }
  };

  const vStyle = getVariantStyles();

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}

      {dialogState.isOpen && (
        <div
          className="modal-backdrop"
          onClick={handleClose}
          role="dialog"
          aria-modal="true"
          style={{
            zIndex: 9999,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '16px',
          }}
        >
          <div
            className="modal-dialog"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '460px',
              width: '100%',
              borderRadius: '16px',
              overflow: 'hidden',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
              border: '1px solid rgba(226, 232, 240, 0.8)',
              backgroundColor: '#ffffff',
              animation: 'slideUp 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <div style={{ padding: '24px 24px 20px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px' }}>
                <div
                  style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '12px',
                    backgroundColor: vStyle.bg,
                    border: `1px solid ${vStyle.border}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {vStyle.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <h3
                      style={{
                        margin: 0,
                        fontSize: '1.15rem',
                        fontWeight: 700,
                        color: '#0f172a',
                        letterSpacing: '-0.01em',
                      }}
                    >
                      {dialogState.title}
                    </h3>
                    <button
                      onClick={handleClose}
                      type="button"
                      aria-label="Close"
                      style={{
                        background: 'transparent',
                        border: 'none',
                        cursor: 'pointer',
                        padding: '4px',
                        borderRadius: '6px',
                        color: '#94a3b8',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <X size={18} />
                    </button>
                  </div>
                  <p
                    style={{
                      margin: 0,
                      fontSize: '0.92rem',
                      lineHeight: '1.5',
                      color: '#475569',
                      wordBreak: 'break-word',
                    }}
                  >
                    {dialogState.message}
                  </p>
                </div>
              </div>
            </div>

            <div
              style={{
                padding: '14px 24px',
                backgroundColor: '#f8fafc',
                borderTop: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'flex-end',
                gap: '10px',
              }}
            >
              <button
                type="button"
                onClick={handleClose}
                className="btn btn-secondary"
                style={{
                  padding: '8px 18px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: 'pointer',
                }}
              >
                {dialogState.cancelText}
              </button>
              <button
                type="button"
                onClick={handleConfirm}
                className={`btn btn-${dialogState.variant === 'danger' ? 'danger' : 'primary'}`}
                style={{
                  padding: '8px 20px',
                  fontSize: '0.9rem',
                  fontWeight: 600,
                  borderRadius: '8px',
                  cursor: 'pointer',
                  boxShadow: dialogState.variant === 'danger'
                    ? '0 4px 12px rgba(220, 38, 38, 0.3)'
                    : '0 4px 12px rgba(37, 99, 235, 0.25)',
                }}
                autoFocus
              >
                {dialogState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
};

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context.confirm;
};

export default ConfirmContext;
