import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { initBlueprintHubSchema } from "@/features/blueprint-hub/api/schema";
import { BlueprintHubProvider } from "@/features/blueprint-hub/context/BlueprintHubContext";
import { BlueprintHub } from "@/features/blueprint-hub/components/BlueprintHub";
import { NERProvider } from "@/contexts/NERContext";
import { syncEngine, SyncEngineProvider, migrateLocalStorageToCozoDB } from "@/lib/sync";
import { cozoDb } from "@/lib/cozo/db";

const queryClient = new QueryClient();

const App = () => {
  const [ready, setReady] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState("Initializing...");

  useEffect(() => {
    const init = async () => {
      try {
        setLoadingMessage("Initializing database...");
        await syncEngine.initialize();
        console.log("SyncEngine initialized");

        setLoadingMessage("Migrating data...");
        const migrationResult = await migrateLocalStorageToCozoDB(syncEngine);
        if (migrationResult.migrated > 0) {
          console.log(`Migrated ${migrationResult.migrated} items from localStorage`);
        }

        setLoadingMessage("Loading schemas...");
        await initBlueprintHubSchema(cozoDb);
        console.log("Blueprint Hub schema initialized");

        setReady(true);
      } catch (e) {
        console.error("Initialization failed:", e);
        setReady(true);
      }
    };
    init();
  }, []);

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <SyncEngineProvider engine={syncEngine}>
        <BlueprintHubProvider>
          <NERProvider>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <BrowserRouter
                future={{
                  v7_startTransition: true,
                  v7_relativeSplatPath: true,
                }}
              >
                <Routes>
                  <Route path="/" element={<Index />} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </BrowserRouter>
              <BlueprintHub />
            </TooltipProvider>
          </NERProvider>
        </BlueprintHubProvider>
      </SyncEngineProvider>
    </QueryClientProvider>
  );
};

export default App;
