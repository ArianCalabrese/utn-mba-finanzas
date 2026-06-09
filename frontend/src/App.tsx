import { Routes, Route, Navigate } from "react-router-dom";
import { AppLayout } from "@/presentation/layouts/AppLayout";
import { ProtectedRoute } from "@/presentation/components/ProtectedRoute";

import { LoginPage }            from "@/presentation/pages/LoginPage";
import { RegisterPage }         from "@/presentation/pages/RegisterPage";
import { HomePage }             from "@/presentation/pages/HomePage";
import { SimpleInterestPage }   from "@/presentation/pages/SimpleInterestPage";
import { CompoundInterestPage } from "@/presentation/pages/CompoundInterestPage";
import { TimeValuePage }        from "@/presentation/pages/TimeValuePage";
import { AnnuityPage }          from "@/presentation/pages/AnnuityPage";
import { PerpetuityPage }       from "@/presentation/pages/PerpetuityPage";
import { GradientPage }         from "@/presentation/pages/GradientPage";
import { AmortizationPage }     from "@/presentation/pages/AmortizationPage";
import { NpvIrrPage }           from "@/presentation/pages/NpvIrrPage";
import { MarketQuotePage }      from "@/presentation/pages/MarketQuotePage";
import { TechnicalPage }        from "@/presentation/pages/TechnicalPage";
import { FundamentalPage }      from "@/presentation/pages/FundamentalPage";
import { PortfolioPage }        from "@/presentation/pages/PortfolioPage";
import { BondsApiPage }         from "@/presentation/pages/BondsApiPage";
import { MacroPage }            from "@/presentation/pages/MacroPage";
import { AlertsPage }           from "@/presentation/pages/AlertsPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login"    element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Routes>
                <Route path="/"                      element={<HomePage />} />
                <Route path="/interes-simple"         element={<SimpleInterestPage />} />
                <Route path="/interes-compuesto"      element={<CompoundInterestPage />} />
                <Route path="/valor-tiempo"           element={<TimeValuePage />} />
                <Route path="/anualidades"            element={<AnnuityPage />} />
                <Route path="/perpetuidades"          element={<PerpetuityPage />} />
                <Route path="/gradientes"             element={<GradientPage />} />
                <Route path="/amortizacion"           element={<AmortizationPage />} />
                <Route path="/van-tir"                element={<NpvIrrPage />} />
                <Route path="/mercado/cotizacion"     element={<MarketQuotePage />} />
                <Route path="/mercado/tecnico"        element={<TechnicalPage />} />
                <Route path="/mercado/fundamental"    element={<FundamentalPage />} />
                <Route path="/mercado/portafolio"     element={<PortfolioPage />} />
                <Route path="/mercado/bonos"          element={<BondsApiPage />} />
                <Route path="/mercado/macro"          element={<MacroPage />} />
                <Route path="/mercado/alertas"        element={<AlertsPage />} />
                <Route path="*"                      element={<Navigate to="/" replace />} />
              </Routes>
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
