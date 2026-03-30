import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { lazy, Suspense, useEffect } from "react";
import type { ReactNode } from "react";
import { initializeEventSubscribers } from "@/lib/event-bus";
import BrandingSync from "@/components/BrandingSync";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import EmailTest from "./pages/EmailTest";
import ResetPassword from "./pages/ResetPassword";
import ClaimAction from "./pages/ClaimAction";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const DashboardView = lazy(() => import("@/components/views/DashboardView"));
const SubmitClaimView = lazy(() => import("@/components/views/SubmitClaimView"));
const ClaimHistoryView = lazy(() => import("@/components/views/ClaimHistoryView"));
const TransactionsView = lazy(() => import("@/components/views/TransactionsView"));
const UserBalanceView = lazy(() => import("@/components/views/UserBalanceView"));
const ApprovalView = lazy(() => import("@/components/views/ApprovalView"));
const PaymentVoucherView = lazy(() => import("@/components/views/PaymentVoucherView"));
const UserManagementView = lazy(() => import("@/components/views/UserManagementView"));
const SettingsView = lazy(() => import("@/components/views/SettingsView"));
const AuditLogView = lazy(() => import("@/components/views/AuditLogView"));
const UserProfileView = lazy(() => import("@/components/views/UserProfileView"));

function RouteLoader() {
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
}

function withSuspense(element: ReactNode) {
  return <Suspense fallback={<RouteLoader />}>{element}</Suspense>;
}

const App = () => {
  useEffect(() => {
    // Initialize event subscribers for approval workflows
    initializeEventSubscribers();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <BrandingSync />
          <Toaster />
          <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />}>
              <Route index element={withSuspense(<DashboardView />)} />
              <Route path="dashboard" element={<Navigate to="/" replace />} />
              <Route path="submit" element={withSuspense(<SubmitClaimView />)} />
              <Route path="history" element={withSuspense(<ClaimHistoryView />)} />
              <Route path="transactions" element={withSuspense(<TransactionsView />)} />
              <Route path="balances" element={withSuspense(<UserBalanceView />)} />
              <Route path="manager-approval" element={withSuspense(<ApprovalView type="manager" />)} />
              <Route path="admin-approval" element={withSuspense(<ApprovalView type="admin" />)} />
              <Route path="voucher" element={withSuspense(<PaymentVoucherView />)} />
              <Route path="users" element={withSuspense(<UserManagementView />)} />
              <Route path="settings" element={withSuspense(<SettingsView />)} />
              <Route path="audit" element={withSuspense(<AuditLogView />)} />
              <Route path="profile" element={withSuspense(<UserProfileView />)} />
            </Route>
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/test/email" element={<EmailTest />} />
            <Route path="/claim-action" element={<ClaimAction />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
  );
};

export default App;
