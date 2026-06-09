import { NavLink, useNavigate } from "react-router-dom";
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
  Search,
  LineChart,
  BookOpen,
  PieChart,
  Wallet,
  Globe,
  Bell,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { useAuthStore } from "@/application/stores/authStore";
import "./AppLayout.css";

const CALC_NAV: { to: string; Icon: LucideIcon; label: string; end?: boolean }[] = [
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

const MARKET_NAV: { to: string; Icon: LucideIcon; label: string }[] = [
  { to: "/mercado/cotizacion", Icon: Search, label: "Cotización" },
  { to: "/mercado/tecnico", Icon: LineChart, label: "Análisis Técnico" },
  { to: "/mercado/fundamental", Icon: BookOpen, label: "Análisis Fundamental" },
  { to: "/mercado/portafolio", Icon: PieChart, label: "Portafolio" },
  { to: "/mercado/bonos", Icon: Wallet, label: "Bonos" },
  { to: "/mercado/macro", Icon: Globe, label: "Régimen Macro" },
  { to: "/mercado/alertas", Icon: Bell, label: "Alertas DCA" },
];

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

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
            {CALC_NAV.map(({ to, Icon, label, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
              >
                <span className="sidebar-link-icon"><Icon size={15} /></span>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-section">
          <div className="sidebar-section-label">Mercado</div>
          <nav className="sidebar-nav">
            {MARKET_NAV.map(({ to, Icon, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => "sidebar-link" + (isActive ? " active" : "")}
              >
                <span className="sidebar-link-icon"><Icon size={15} /></span>
                {label}
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="sidebar-footer">
          {user && (
            <>
              <span className="sidebar-user">{user.username}</span>
              <button className="sidebar-logout" onClick={handleLogout} title="Cerrar sesión">
                <LogOut size={14} />
                Salir
              </button>
            </>
          )}
        </div>
      </aside>

      <main className="main-content">{children}</main>
    </div>
  );
}
