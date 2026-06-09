import { useToastStore, type Toast } from '@/application/stores/toastStore';
import { CheckCircle, XCircle, Info, X } from 'lucide-react';

const ICONS = {
  success: <CheckCircle size={16} />,
  error:   <XCircle size={16} />,
  info:    <Info size={16} />,
};

const COLORS: Record<Toast['type'], { fg: string; bg: string; border: string }> = {
  success: { fg: 'var(--positive)',  bg: 'var(--positive-subtle)',  border: 'rgba(5,150,105,0.25)' },
  error:   { fg: 'var(--negative)',  bg: 'var(--negative-subtle)',  border: 'rgba(220,38,38,0.25)' },
  info:    { fg: 'var(--accent)',    bg: 'var(--accent-subtle)',    border: 'var(--accent-muted)'  },
};

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = useToastStore(s => s.dismiss);
  const c = COLORS[toast.type];

  return (
    <div
      className="toast-item"
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '10px 14px',
        background: 'var(--bg-surface)',
        border: `1px solid ${c.border}`,
        borderLeft: `3px solid ${c.fg}`,
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        color: 'var(--text-primary)',
        fontSize: 13,
        minWidth: 260,
        maxWidth: 400,
        pointerEvents: 'all',
      }}
    >
      <span style={{ color: c.fg, flexShrink: 0 }}>{ICONS[toast.type]}</span>
      <span style={{ flex: 1, lineHeight: 1.4 }}>{toast.message}</span>
      <button
        onClick={() => dismiss(toast.id)}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-muted)', padding: 2, flexShrink: 0,
          display: 'flex', alignItems: 'center',
        }}
      >
        <X size={13} />
      </button>
    </div>
  );
}

export function Toaster() {
  const toasts = useToastStore(s => s.toasts);
  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24,
      display: 'flex', flexDirection: 'column-reverse', gap: 8,
      zIndex: 9999, pointerEvents: 'none',
    }}>
      {toasts.map(t => <ToastItem key={t.id} toast={t} />)}
    </div>
  );
}
