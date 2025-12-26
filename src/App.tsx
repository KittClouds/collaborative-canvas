import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { initializeStorage, getBlueprintStore } from "@/lib/storage/index";
import { BlueprintHubProvider } from "@/features/blueprint-hub/context/BlueprintHubContext";
import { BlueprintHubPanel } from "@/features/blueprint-hub/components/BlueprintHubPanel";
import { NERProvider } from "@/contexts/NERContext";
import { initializeSQLiteAndHydrate } from "@/lib/db";

const queryClient = new QueryClient();

const App = () => {
  const [storageReady, setStorageReady] = useState(false);
  const [initStatus, setInitStatus] = useState("Initializing...");

  useEffect(() => {
    const initStorage = async () => {
      try {
        setInitStatus("Initializing SQLite persistence...");
        const { nodesLoaded, embeddingsLoaded } = await initializeSQLiteAndHydrate();
        console.log(`SQLite initialized: ${nodesLoaded} nodes, ${embeddingsLoaded} embeddings`);

        setInitStatus("Initializing storage service...");
        await initializeStorage();
        console.log("Storage service initialized");

        const blueprintStore = getBlueprintStore();
        await blueprintStore.initialize();
        console.log("Blueprint store initialized");

        setStorageReady(true);
      } catch (e) {
        console.error("Storage initialization failed:", e);
        setStorageReady(true);
      }
    };
    initStorage();
  }, []);

  if (!storageReady) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">{initStatus}</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <NERProvider>
          <BlueprintHubProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </BlueprintHubProvider>
        </NERProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
