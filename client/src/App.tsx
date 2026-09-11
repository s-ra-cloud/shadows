import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import NotFound from "@/pages/not-found";
import LandingPage from "@/pages/landing";
import TeamPage from "@/pages/team";
import PartnersPage from "@/pages/partners";
import NewsPage from "@/pages/news";
import ResearchPage from "@/pages/research";
import GraphPage from "@/pages/graph";
import AdminPage from "@/pages/admin";
import DatabasePage from "@/pages/database";
import AboutPage from "@/pages/about";
import SourcesPage from "@/pages/sources";
import ReadPage from "@/pages/read";
import DailyHunterPage from "@/pages/daily-hunter";

function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      {children}
      <Footer />
    </>
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/">
        <PublicLayout><LandingPage /></PublicLayout>
      </Route>
      <Route path="/team">
        <PublicLayout><TeamPage /></PublicLayout>
      </Route>
      <Route path="/partners">
        <PublicLayout><PartnersPage /></PublicLayout>
      </Route>
      <Route path="/news">
        <PublicLayout><NewsPage /></PublicLayout>
      </Route>
      <Route path="/about">
        <PublicLayout><AboutPage /></PublicLayout>
      </Route>
      <Route path="/research">
        <PublicLayout><ResearchPage /></PublicLayout>
      </Route>
      <Route path="/graph">
        <GraphPage />
      </Route>
      <Route path="/read/:id">
        <ReadPage />
      </Route>
      <Route path="/sources">
        <PublicLayout><SourcesPage /></PublicLayout>
      </Route>
      <Route path="/database">
        <PublicLayout><DatabasePage /></PublicLayout>
      </Route>
      <Route path="/admin">
        <AdminPage />
      </Route>
      <Route path="/daily-hunter">
        <DailyHunterPage />
      </Route>
      <Route>
        <PublicLayout><NotFound /></PublicLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
