import { Routes, Route } from "react-router-dom";
import { AppLayout } from "@/presentation/layouts/AppLayout";
import { HomePage }             from "@/presentation/pages/HomePage";
import { SimpleInterestPage }   from "@/presentation/pages/SimpleInterestPage";
import { CompoundInterestPage } from "@/presentation/pages/CompoundInterestPage";
import { TimeValuePage }        from "@/presentation/pages/TimeValuePage";
import { AnnuityPage }          from "@/presentation/pages/AnnuityPage";
import { PerpetuityPage }       from "@/presentation/pages/PerpetuityPage";
import { GradientPage }         from "@/presentation/pages/GradientPage";
import { AmortizationPage }     from "@/presentation/pages/AmortizationPage";
import { NpvIrrPage }           from "@/presentation/pages/NpvIrrPage";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/"                  element={<HomePage />} />
        <Route path="/interes-simple"    element={<SimpleInterestPage />} />
        <Route path="/interes-compuesto" element={<CompoundInterestPage />} />
        <Route path="/valor-tiempo"      element={<TimeValuePage />} />
        <Route path="/anualidades"       element={<AnnuityPage />} />
        <Route path="/perpetuidades"     element={<PerpetuityPage />} />
        <Route path="/gradientes"        element={<GradientPage />} />
        <Route path="/amortizacion"      element={<AmortizationPage />} />
        <Route path="/van-tir"           element={<NpvIrrPage />} />
      </Routes>
    </AppLayout>
  );
}
