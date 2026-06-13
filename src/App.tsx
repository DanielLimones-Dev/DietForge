import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/Layout";
import { Dashboard } from "@/components/Dashboard";
import { ClientList } from "@/components/ClientList";
import { ClientForm } from "@/components/ClientForm";
import { ClientDetail } from "@/components/ClientDetail";
import { MealPlanner } from "@/components/MealPlanner";
import { FoodDB } from "@/components/FoodDB";
import { CalculatorPage } from "@/components/CalculatorPage";
import { Reports } from "@/components/Reports";
import { CoachDashboard } from "@/components/CoachDashboard";
import { WeekPlanView } from "@/components/WeekPlanView";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import { SubscriptionGate } from "@/components/SubscriptionGate";
import { ToastProvider } from "@/components/Toast";
import { useEffect } from "react";
import { db } from "@/lib/db";

export default function App() {
  useEffect(() => {
    db.init().then(() => db.seedFoods());
  }, []);

  return (
    <BrowserRouter>
      <ToastProvider>
      <SubscriptionProvider>
        <Routes>
          <Route element={<SubscriptionGate />}>
            <Route element={<Layout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/coach" element={<CoachDashboard />} />
              <Route path="/clients" element={<ClientList />} />
              <Route path="/clients/new" element={<ClientForm />} />
              <Route path="/clients/:id" element={<ClientDetail />} />
              <Route path="/clients/:id/edit" element={<ClientForm />} />
              <Route path="/clients/:clientId/plan/week" element={<WeekPlanView />} />
              <Route path="/plans/:id" element={<MealPlanner />} />
              <Route path="/foods" element={<FoodDB />} />
              <Route path="/calculator" element={<CalculatorPage />} />
              <Route path="/reports" element={<Reports />} />
            </Route>
          </Route>
        </Routes>
      </SubscriptionProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}
