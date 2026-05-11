import { useEffect } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ConfirmProvider } from "@/hooks/use-confirm";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import { useStore } from "@/hooks/use-store";
import GuestMenuPage from "@/pages/guest/MenuPage";
import StaffLoginPage from "@/pages/staff/LoginPage";
import StaffDashboard from "@/pages/staff/StaffDashboard";
import LandingPage from "@/pages/public/LandingPage";
import BrowseMenuPage from "@/pages/public/BrowseMenuPage";
import ReservationsPage from "@/pages/public/ReservationsPage";
import ReviewsPage from "@/pages/public/ReviewsPage";
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
      <Route path="/" component={LandingPage} />
      <Route path="/browse" component={BrowseMenuPage} />
      <Route path="/reservations" component={ReservationsPage} />
      <Route path="/reviews" component={ReviewsPage} />
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
        <ConfirmProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <AppContent />
          </WouterRouter>
          <Toaster />
        </ConfirmProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
