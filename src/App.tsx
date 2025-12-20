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
import { BlueprintHub } from "@/features/blueprint-hub/components/BlueprintHub";
import { NERProvider } from "@/contexts/NERContext";
import { initializeGraph } from "@/lib/graph";

const queryClient = new QueryClient();

const App = () => {
  const [storageReady, setStorageReady] = useState(false);

  useEffect(() => {
    const initStorage = async () => {
      try {
        initializeGraph();
        console.log("UnifiedGraph initialized");

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
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
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
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
            <BlueprintHub />
          </TooltipProvider>
        </NERProvider>
      </BlueprintHubProvider>
    </QueryClientProvider>
  );
};

export default App;
