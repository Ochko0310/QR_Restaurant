import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useStore } from "@/hooks/use-store";
import GuestMenuPage from "@/pages/guest/MenuPage";
import StaffLoginPage from "@/pages/staff/LoginPage";
import StaffDashboard from "@/pages/staff/StaffDashboard";
import NotFound from "@/pages/not-found";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

function AppContent() {
  const token = useStore((s) => s.token);
  const user = useStore((s) => s.user);

  useEffect(() => {
    setAuthTokenGetter(() => token);
  }, [token]);

  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/menu" />} />
      <Route path="/menu" component={GuestMenuPage} />
      <Route path="/demo" component={GuestMenuPage} />
      <Route path="/staff/login" component={StaffLoginPage} />
      <Route path="/staff">
        {token && user ? <StaffDashboard /> : <Redirect to="/staff/login" />}
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <AppContent />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
