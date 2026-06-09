import { useState, useRef, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Briefcase, Eye, LogOut, User, ChevronUp } from 'lucide-react';
import { useAuthStore } from '@/application/stores/authStore';

const MENU_ITEM: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 10,
  padding: '9px 14px', fontSize: 13, textDecoration: 'none',
  whiteSpace: 'nowrap', cursor: 'pointer',
  background: 'none', border: 'none', width: '100%', textAlign: 'left',
  transition: 'background 0.1s',
};

export function UserMenu() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleLogout = async () => {
    setOpen(false);
    await logout();
    navigate('/login');
  };

  if (!user) return null;

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      {/* ── Trigger ── */}
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          display: 'flex', alignItems: 'center', gap: 8,
          width: '100%', background: 'none', border: 'none',
          cursor: 'pointer', padding: '8px 10px',
          borderRadius: 'var(--radius-sm)', color: 'var(--text-secondary)',
          fontSize: 13, transition: 'background 0.12s',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{
          width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
          background: 'var(--accent-subtle)', display: 'flex',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <User size={13} color="var(--accent)" />
        </span>
        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textAlign: 'left' }}>
          {user.username}
        </span>
        <ChevronUp
          size={13} color="var(--text-muted)" style={{ flexShrink: 0, transition: 'transform 0.15s', transform: open ? 'rotate(0deg)' : 'rotate(180deg)' }}
        />
      </button>

      {/* ── Dropdown popup ── */}
      {open && (
        <div style={{
          position: 'absolute',
          bottom: 'calc(100% + 6px)',
          left: 0,
          minWidth: 210,          /* wider than the sidebar footer */
          background: 'var(--bg-card)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius-md)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          zIndex: 200,
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px 0 4px' }}>
            <div style={{
              fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.07em', color: 'var(--text-muted)',
              padding: '0 14px 6px',
            }}>
              Mi espacio
            </div>

            <NavLink
              to="/mercado/mi-portafolio"
              onClick={() => setOpen(false)}
              style={({ isActive }) => ({
                ...MENU_ITEM,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-subtle)' : 'none',
              })}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (!el.style.background.includes('accent')) el.style.background = 'var(--bg-raised)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
            >
              <Briefcase size={14} />
              Mi Portafolio
            </NavLink>

            <NavLink
              to="/mercado/watchlist"
              onClick={() => setOpen(false)}
              style={({ isActive }) => ({
                ...MENU_ITEM,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-subtle)' : 'none',
              })}
              onMouseEnter={e => { const el = e.currentTarget as HTMLElement; if (!el.style.background.includes('accent')) el.style.background = 'var(--bg-raised)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = ''; }}
            >
              <Eye size={14} />
              Lista de Seguimiento
            </NavLink>

            <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />

            <button
              onClick={handleLogout}
              style={{ ...MENU_ITEM, color: 'var(--negative)', fontFamily: 'var(--sans)' }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-raised)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'none')}
            >
              <LogOut size={14} />
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
