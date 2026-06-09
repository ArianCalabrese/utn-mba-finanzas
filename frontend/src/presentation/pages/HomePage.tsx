import { Link } from "react-router-dom";
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
import { PageHeader } from "@/presentation/components/ui";
import "@/presentation/components/ui.css";

const MODULES: { to: string; Icon: LucideIcon; title: string; desc: string; color: string }[] = [
  { to: "/interes-simple",    Icon: TrendingUp,   title: "Interés Simple",    desc: "I = P · r · t",             color: "#7c3aed" },
  { to: "/interes-compuesto", Icon: BarChart3,     title: "Interés Compuesto", desc: "VF = VA · (1+i)ⁿ",          color: "#0891b2" },
  { to: "/valor-tiempo",      Icon: Clock,         title: "VA / VF",           desc: "Resuelve cualquier variable", color: "#059669" },
  { to: "/anualidades",       Icon: Repeat,        title: "Anualidades",       desc: "Ordinaria y Anticipada",      color: "#d97706" },
  { to: "/perpetuidades",     Icon: InfinityIcon,  title: "Perpetuidades",     desc: "Constante y Creciente",       color: "#dc2626" },
  { to: "/gradientes",        Icon: Activity,      title: "Gradientes",        desc: "Aritmético y Geométrico",     color: "#7c3aed" },
  { to: "/amortizacion",      Icon: Landmark,      title: "Amortización",      desc: "Francés · Alemán · Americano", color: "#0891b2" },
  { to: "/van-tir",           Icon: Target,        title: "VAN / TIR",         desc: "Evaluación de proyectos",     color: "#059669" },
];

export function HomePage() {
  return (
    <>
      <PageHeader
        icon={<Home size={22} />}
        title="FinCalc Pro"
        subtitle="Suite de calculadoras financieras — selecciona un módulo para comenzar"
      />
      <div className="page-body">
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(210px, 1fr))",
            gap: "var(--sp-4)",
          }}
        >
          {MODULES.map(({ to, Icon, title, desc, color }) => (
            <Link key={to} to={to} style={{ textDecoration: "none" }}>
              <div
                className="card"
                style={{ cursor: "pointer", transition: "box-shadow 0.15s, transform 0.12s" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-md)";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(-2px)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.boxShadow = "var(--shadow-sm)";
                  (e.currentTarget as HTMLDivElement).style.transform = "translateY(0)";
                }}
              >
                <div style={{ color, marginBottom: "var(--sp-3)" }}>
                  <Icon size={26} strokeWidth={1.75} />
                </div>
                <h3 style={{ color, marginBottom: "var(--sp-1)" }}>{title}</h3>
                <p style={{ fontSize: 12.5, color: "var(--text-muted)" }}>{desc}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
}
