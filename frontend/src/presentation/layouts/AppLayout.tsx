import { NavLink } from "react-router-dom";
import {
  Home,
  TrendingUp,
  BarChart3,
  Clock,
  Repeat,
  Infinity as InfinityIcon,
  Activity,
  Landmark,
  Target,
  type LucideIcon,
} from "lucide-react";
import "./AppLayout.css";

const NAV_ITEMS: { to: string; Icon: LucideIcon; label: string; end?: boolean }[] = [
  { to: "/", Icon: Home, label: "Inicio", end: true },
  { to: "/interes-simple", Icon: TrendingUp, label: "Interés Simple" },
  { to: "/interes-compuesto", Icon: BarChart3, label: "Interés Compuesto" },
  { to: "/valor-tiempo", Icon: Clock, label: "VA / VF" },
  { to: "/anualidades", Icon: Repeat, label: "Anualidades" },
  { to: "/perpetuidades", Icon: InfinityIcon, label: "Perpetuidades" },
  { to: "/gradientes", Icon: Activity, label: "Gradientes" },
  { to: "/amortizacion", Icon: Landmark, label: "Amortización" },
  { to: "/van-tir", Icon: Target, label: "VAN / TIR" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">
            <TrendingUp size={17} />
          </div>
          <span className="sidebar-logo-text">
            Fin<span>Calc</span>
          </span>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Calculadoras</div>
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ to, Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  "sidebar-link" + (isActive ? " active" : "")
                }
              >
                <span className="sidebar-link-icon">
                  <Icon size={15} />
                </span>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
