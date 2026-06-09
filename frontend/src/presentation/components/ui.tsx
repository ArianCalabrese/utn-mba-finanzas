import type { InputHTMLAttributes, SelectHTMLAttributes, CSSProperties } from "react";
import { AlertCircle, AlertTriangle } from "lucide-react";
import { HelpButton } from "./HelpModal";
import "./ui.css";

// ─── Field (input) ────────────────────────────────────────────────────────────

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
}

export function Field({ label, error, hint, id, ...props }: FieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <input id={fieldId} className={error ? "error" : ""} {...props} />
      {error && <span className="field-error">{error}</span>}
      {hint && !error && <span className="field-hint">{hint}</span>}
    </div>
  );
}

// ─── SelectField ─────────────────────────────────────────────────────────────

interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  error?: string;
  options: { value: string | number; label: string }[];
}

export function SelectField({
  label,
  error,
  options,
  id,
  ...props
}: SelectFieldProps) {
  const fieldId = id ?? label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div className="field">
      <label htmlFor={fieldId}>{label}</label>
      <select id={fieldId} className={error ? "error" : ""} {...props}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {error && <span className="field-error">{error}</span>}
    </div>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface CardProps {
  title?: string;
  children: React.ReactNode;
  className?: string;
  style?: CSSProperties;
  onHelp?: () => void;
}

export function Card({ title, children, className = "", style, onHelp }: CardProps) {
  return (
    <div className={`card ${className}`} style={style}>
      {title && (
        <div className="card-title" style={onHelp ? { justifyContent: 'space-between' } : undefined}>
          <span>{title}</span>
          {onHelp && <HelpButton onClick={onHelp} />}
        </div>
      )}
      {children}
    </div>
  );
}

// ─── Metric ──────────────────────────────────────────────────────────────────

interface MetricProps {
  label: string;
  value: string;
  sub?: string;
  variant?: "default" | "positive" | "negative" | "accent";
}

export function Metric({ label, value, sub, variant = "default" }: MetricProps) {
  return (
    <div className="metric">
      <span className="metric-label">{label}</span>
      <span className={`metric-value ${variant !== "default" ? variant : ""}`}>
        {value}
      </span>
      {sub && <span className="metric-sub">{sub}</span>}
    </div>
  );
}

// ─── Alert ───────────────────────────────────────────────────────────────────

interface AlertProps {
  message: string;
  variant?: "error" | "warning";
}

export function Alert({ message, variant = "error" }: AlertProps) {
  return (
    <div className={`alert alert-${variant}`}>
      {variant === "error"
        ? <AlertCircle size={15} />
        : <AlertTriangle size={15} />}
      <span>{message}</span>
    </div>
  );
}

// ─── PageHeader ───────────────────────────────────────────────────────────────

interface PageHeaderProps {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  onHelp?: () => void;
}

export function PageHeader({ icon, title, subtitle, onHelp }: PageHeaderProps) {
  return (
    <div className="page-header">
      <div className="page-header-title">
        <span className="page-header-icon">{icon}</span>
        <h1>{title}</h1>
        {onHelp && <HelpButton onClick={onHelp} />}
      </div>
      {subtitle && <p className="page-header-subtitle">{subtitle}</p>}
    </div>
  );
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

interface TabsProps {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}

export function Tabs({ tabs, active, onChange }: TabsProps) {
  return (
    <div className="tabs">
      {tabs.map((t) => (
        <button
          key={t.id}
          className={`tab ${active === t.id ? "active" : ""}`}
          onClick={() => onChange(t.id)}
          type="button"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
