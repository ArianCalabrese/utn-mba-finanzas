import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { TrendingUp } from 'lucide-react';
import { useAuthStore } from '@/application/stores/authStore';
import { ApiError } from '@/application/api/client';
import './AuthPages.css';

export function RegisterPage() {
  const [form, setForm] = useState({ username: '', email: '', password: '', password2: '' });
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { register, loading } = useAuthStore();
  const navigate = useNavigate();

  const set = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm(prev => ({ ...prev, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await register(form.username, form.email, form.password, form.password2);
      setSuccess(true);
      setTimeout(() => navigate('/login'), 1800);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'An unexpected error occurred.');
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-logo">
          <div className="auth-logo-icon"><TrendingUp size={18} /></div>
          <span>Fin<span>Calc</span> Pro</span>
        </div>
        <h1 className="auth-title">Create account</h1>
        {success ? (
          <p className="auth-success">Account created! Redirecting to login…</p>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <div className="auth-field">
              <label htmlFor="username">Username</label>
              <input id="username" type="text" value={form.username} onChange={set('username')} required autoFocus />
            </div>
            <div className="auth-field">
              <label htmlFor="email">Email</label>
              <input id="email" type="email" value={form.email} onChange={set('email')} required />
            </div>
            <div className="auth-field">
              <label htmlFor="password">Password</label>
              <input id="password" type="password" value={form.password} onChange={set('password')} required autoComplete="new-password" />
            </div>
            <div className="auth-field">
              <label htmlFor="password2">Confirm password</label>
              <input id="password2" type="password" value={form.password2} onChange={set('password2')} required autoComplete="new-password" />
            </div>
            {error && <p className="auth-error">{error}</p>}
            <button type="submit" className="btn btn-primary auth-btn" disabled={loading}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        )}
        <p className="auth-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
