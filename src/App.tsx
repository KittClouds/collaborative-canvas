import { useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import { cozoDb } from "@/lib/cozo/db";
import { BlueprintHubProvider } from "@/features/blueprint-hub/context/BlueprintHubContext";
import { BlueprintHub } from "@/features/blueprint-hub/components/BlueprintHub";
import { NERProvider } from "@/contexts/NERContext";

const queryClient = new QueryClient();

const App = () => {
  useEffect(() => {
    const initDB = async () => {
      try {
        await cozoDb.init();
        console.log("CozoDB Initialized");
        const res = cozoDb.runQuery('?[] <- [["hello", "cozo"]]');
        console.log("CozoDB Test Query Result:", res);
      } catch (e) {
        console.error("CozoDB Init Failed:", e);
      }
    };
    initDB();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <BlueprintHubProvider>
        <NERProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
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
