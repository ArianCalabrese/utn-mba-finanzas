import { PageHeader } from "@/presentation/components/ui";
import { Card } from "@/presentation/components/ui";
import "@/presentation/components/ui.css";

interface PlaceholderPageProps {
  icon: string;
  title: string;
  subtitle: string;
}

export function PlaceholderPage({ icon, title, subtitle }: PlaceholderPageProps) {
  return (
    <>
      <PageHeader icon={icon} title={title} subtitle={subtitle} />
      <div className="page-body">
        <Card>
          <div style={{ textAlign: "center", padding: "var(--sp-12) 0", color: "var(--text-muted)" }}>
            <div style={{ fontSize: 48, marginBottom: "var(--sp-4)" }}>{icon}</div>
            <h2 style={{ color: "var(--text-muted)", fontWeight: 400 }}>
              Próximamente
            </h2>
            <p style={{ marginTop: "var(--sp-2)", fontSize: 13 }}>
              Este módulo se implementará en la siguiente etapa.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
