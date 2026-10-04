import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AdminAuthProvider } from "@/lib/adminAuth";
import { ClerkProvider } from "@clerk/react";
import { basePath, clerkPubKey, clerkProxyUrl, clerkAppearance, stripBase } from "@/lib/clerk";
import { SignInPage, SignUpPage, WriteGuard } from "@/pages/auth";

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
        <Route path="/companies/new">{() => <WriteGuard><NewCompany /></WriteGuard>}</Route>
        <Route path="/companies/:id" component={CompanyDetail} />
        
        <Route path="/projects" component={ProjectsList} />
        <Route path="/projects/new">{() => <WriteGuard><NewProject /></WriteGuard>}</Route>
        <Route path="/projects/:id" component={ProjectDetail} />
        
        <Route path="/matches" component={MatchesList} />
        
        <Route path="/solutions" component={SolutionsList} />
        <Route path="/solutions/new">{() => <WriteGuard><NewSolution /></WriteGuard>}</Route>
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
  return <WriteGuard><AdminPage /></WriteGuard>;
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      signInFallbackRedirectUrl={basePath || "/"}
      signUpFallbackRedirectUrl={basePath || "/"}
      localization={{
        signIn: { start: { title: "Co-selling Hub 로그인", subtitle: "회원 계정으로 로그인하세요" } },
        signUp: { start: { title: "Co-selling Hub 회원가입", subtitle: "회원 계정을 만드세요" } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
    <QueryClientProvider client={queryClient}>
      <AdminAuthProvider>
        <TooltipProvider>
          <Switch>
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignUpPage} />
            <Route component={Router} />
          </Switch>
          <Toaster />
        </TooltipProvider>
      </AdminAuthProvider>
    </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return <WouterRouter base={basePath}><ClerkProviderWithRoutes /></WouterRouter>;
}

export default App;
