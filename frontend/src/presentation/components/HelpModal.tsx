import { useEffect } from "react";
import { X } from "lucide-react";
import "./HelpModal.css";

// ─── Modal ─────────────────────────────────────────────────────────────────

interface HelpModalProps {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}

export function HelpModal({ title, children, onClose }: HelpModalProps) {
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Cerrar">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ─── Trigger button ────────────────────────────────────────────────────────

export function HelpButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      className="help-btn"
      onClick={onClick}
      aria-label="Ver ayuda"
      title="Ayuda: cómo funciona esta calculadora"
    >
      ?
    </button>
  );
}

// ─── Content building blocks ───────────────────────────────────────────────

export function HelpSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="help-section">
      <h3>{title}</h3>
      {children}
    </div>
  );
}

export function HelpFormula({ children }: { children: React.ReactNode }) {
  return <div className="help-formula">{children}</div>;
}

export function HelpExample({ children }: { children: React.ReactNode }) {
  return <div className="help-example">{children}</div>;
}

export function HelpWarning({ children }: { children: React.ReactNode }) {
  return <div className="help-warning">{children}</div>;
}

export function InterestBadge({ type }: { type: "simple" | "compound" }) {
  return (
    <span className={`help-badge ${type === "compound" ? "compound" : "simple"}`}>
      Interés {type === "compound" ? "compuesto" : "simple"}
    </span>
  );
}
