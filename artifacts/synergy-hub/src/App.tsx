import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AdminAuthProvider, useAdminAuth } from "@/lib/adminAuth";
import { useEffect } from "react";

import { Layout } from "@/components/layout";
import Dashboard from "./pages/dashboard";

import CompaniesList from "./pages/companies";
import CompanyDetail from "./pages/companies/[id]";
import NewCompany from "./pages/companies/new";

import ProjectsList from "./pages/projects";
import ProjectDetail from "./pages/projects/[id]";
import NewProject from "./pages/projects/new";

import MatchesList from "./pages/matches";

import SolutionsList from "./pages/solutions";
import SolutionDetail from "./pages/solutions/[id]";
import NewSolution from "./pages/solutions/new";

import TalentPool from "./pages/talent";

import NewsPage from "./pages/news";

import AdminPage from "./pages/admin";

import ClientCompaniesPage from "./pages/client-companies";

import OffersPage from "./pages/offers";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: false,
    },
  },
});

function Router() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={Dashboard} />
        
        <Route path="/companies" component={CompaniesList} />
        <Route path="/companies/new" component={NewCompany} />
        <Route path="/companies/:id" component={CompanyDetail} />
        
        <Route path="/projects" component={ProjectsList} />
        <Route path="/projects/new" component={NewProject} />
        <Route path="/projects/:id" component={ProjectDetail} />
        
        <Route path="/matches" component={MatchesList} />
        
        <Route path="/solutions" component={SolutionsList} />
        <Route path="/solutions/new" component={NewSolution} />
        <Route path="/solutions/:id" component={SolutionDetail} />
        
        <Route path="/talent" component={TalentPool} />

        <Route path="/news" component={NewsPage} />

        <Route path="/client-companies" component={ClientCompaniesPage} />

        <Route path="/offers" component={OffersPage} />

        <Route path="/admin" component={AdminGuard} />

        <Route component={NotFound} />
      </Switch>
    </Layout>
  );
}

function AdminGuard() {
  const { isAdmin } = useAdminAuth();
  const [, navigate] = useLocation();
  useEffect(() => {
    if (!isAdmin) navigate("/");
  }, [isAdmin, navigate]);
  if (!isAdmin) return null;
  return <AdminPage />;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <TooltipProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
          <Toaster />
        </TooltipProvider>
      </AdminAuthProvider>
    </QueryClientProvider>
  );
}

export default App;
