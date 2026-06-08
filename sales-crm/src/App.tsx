import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import Leads from "@/pages/leads/index";
import LeadsImport from "@/pages/leads/import";
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

const queryClient = new QueryClient();

function Router() {
  return (
    <Switch>
      <Route path="/" component={() => <Redirect to="/login" />} />
      <Route path="/login" component={Login} />
      <Route path="/dashboard" component={Dashboard} />
      
      <Route path="/leads" component={Leads} />
      <Route path="/leads/import" component={LeadsImport} />
      <Route path="/leads/split-rules" component={SplitRules} />
      <Route path="/leads/queue" component={LeadsQueue} />
      
      <Route path="/pipeline" component={Pipeline} />
      
      <Route path="/clients" component={Clients} />
      <Route path="/clients/:id" component={ClientProfile} />
      
      <Route path="/activities" component={Activities} />
      <Route path="/payments" component={Payments} />
      <Route path="/accounting" component={Accounting} />
      <Route path="/team" component={Team} />
      <Route path="/leaderboard" component={Leaderboard} />
      <Route path="/settings" component={Settings} />

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
