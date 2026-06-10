import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import AdminLogin from "@/pages/admin-login";
import { ADMIN_LOGIN_PATH } from "@/lib/constants";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads/index";
import LeadsImport from "@/pages/leads/import";
import AllLeads from "@/pages/leads/all-leads";
import SplitRules from "@/pages/leads/split-rules";
import LeadsQueue from "@/pages/leads/queue";
import Pipeline from "@/pages/pipeline";
import Clients from "@/pages/clients";
import ClientProfile from "@/pages/client-profile";
import Activities from "@/pages/activities";
import Payments from "@/pages/payments";
import Accounting from "@/pages/accounting";
import Team from "@/pages/team";
import Leaderboard from "@/pages/leaderboard";
import Settings from "@/pages/settings";
import AssistantPage from "@/pages/assistant";
import WireframesPage from "@/pages/wireframes/index";
import WireframeDetailPage from "@/pages/wireframes/detail";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

function AuthenticatedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <ProtectedRoute>
      <Component />
    </ProtectedRoute>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/login" />} />
      <Route path="/login" component={Login} />
      <Route path={ADMIN_LOGIN_PATH} component={AdminLogin} />
      <Route path="/dashboard" component={() => <AuthenticatedRoute component={Dashboard} />} />
      <Route path="/leads" component={() => <AuthenticatedRoute component={Leads} />} />
      <Route path="/leads/all" component={() => <AuthenticatedRoute component={AllLeads} />} />
      <Route path="/leads/import" component={() => <AuthenticatedRoute component={LeadsImport} />} />
      <Route path="/leads/split-rules" component={() => <AuthenticatedRoute component={SplitRules} />} />
      <Route path="/leads/queue" component={() => <AuthenticatedRoute component={LeadsQueue} />} />
      <Route path="/pipeline" component={() => <AuthenticatedRoute component={Pipeline} />} />
      <Route path="/clients" component={() => <AuthenticatedRoute component={Clients} />} />
      <Route path="/clients/:id" component={() => <AuthenticatedRoute component={ClientProfile} />} />
      <Route path="/activities" component={() => <AuthenticatedRoute component={Activities} />} />
      <Route path="/payments" component={() => <AuthenticatedRoute component={Payments} />} />
      <Route path="/accounting" component={() => <AuthenticatedRoute component={Accounting} />} />
      <Route path="/team" component={() => <AuthenticatedRoute component={Team} />} />
      <Route path="/assistant" component={() => <AuthenticatedRoute component={AssistantPage} />} />
      <Route path="/wireframes" component={() => <AuthenticatedRoute component={WireframesPage} />} />
      <Route path="/wireframes/:id" component={() => <AuthenticatedRoute component={WireframeDetailPage} />} />
      <Route path="/leaderboard" component={() => <AuthenticatedRoute component={Leaderboard} />} />
      <Route path="/settings" component={() => <AuthenticatedRoute component={Settings} />} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <CurrencyProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </CurrencyProvider>
    </QueryClientProvider>
  );
}

export default App;
