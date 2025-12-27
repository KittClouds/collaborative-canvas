import { useEffect, useState } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
// ✅ ADD THESE IMPORTS
import { Provider as JotaiProvider } from "jotai";
import { jotaiStore, initializeJotaiStore } from "@/lib/store";

import Index from "./pages/Index";
import GraphExplorerPage from "./pages/GraphExplorerPage";
import NotFound from "./pages/NotFound";
import { initializeStorage, getBlueprintStore } from "@/lib/storage/index";
import { BlueprintHubProvider } from "@/features/blueprint-hub/context/BlueprintHubContext";
import { BlueprintHubPanel } from "@/features/blueprint-hub/components/BlueprintHubPanel";
import { NERProvider } from "@/contexts/NERContext";
import { initializeSQLiteAndHydrate } from "@/lib/db";
import { initCozoGraphSchema } from '@/lib/cozo/schema/init';

const queryClient = new QueryClient();

const App = () => {
    const [storageReady, setStorageReady] = useState(false);
    // ✅ ADD JOTAI READY STATE
    const [jotaiReady, setJotaiReady] = useState(false);
    const [initStatus, setInitStatus] = useState("Initializing...");

    useEffect(() => {
        const initStorage = async () => {
            try {
                // Initialize Unified Registry (CozoDB)
                setInitStatus("Initializing knowledge graph...");
                const { entityRegistry, relationshipRegistry } = await import("@/lib/cozo/graph/adapters");
                await entityRegistry.init();
                await relationshipRegistry.init();

                // Initialize Layer 2 Schemas (required for EntityStoreImpl / BlueprintHub)
                await initCozoGraphSchema();

                console.log("Unified Registry and Layer 2 Schemas initialized");

                // Initialize Legacy SQLite (if needed for other components)
                setInitStatus("Initializing legacy storage...");
                const { nodesLoaded, embeddingsLoaded } = await initializeSQLiteAndHydrate();
                console.log(`SQLite initialized: ${nodesLoaded} nodes, ${embeddingsLoaded} embeddings`);

                setInitStatus("Initializing storage service...");
                await initializeStorage();
                console.log("Storage service initialized");

                const blueprintStore = getBlueprintStore();
                await blueprintStore.initialize();
                console.log("Blueprint store initialized");

                // ✅ INITIALIZE JOTAI STORE
                setInitStatus("Initializing Jotai state...");
                await initializeJotaiStore();
                console.log("Jotai store initialized");
                setJotaiReady(true);

                setStorageReady(true);
            } catch (e) {
                console.error("Storage initialization failed:", e);
                setStorageReady(true);
            }
        };
        initStorage();
    }, []);

    // ✅ WAIT FOR BOTH STORAGE AND JOTAI
    if (!storageReady || !jotaiReady) {
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
        // ✅ WRAP WITH JOTAI PROVIDER
        <JotaiProvider store={jotaiStore}>
            <QueryClientProvider client={queryClient}>
                <TooltipProvider>
                    <NERProvider>
                        <BlueprintHubProvider>
                            <Toaster />
                            <Sonner />
                            <BlueprintHubPanel />
                            <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
                                <Routes>
                                    <Route path="/" element={<Index />} />
                                    <Route path="/graph" element={<GraphExplorerPage />} />
                                    <Route path="*" element={<NotFound />} />
                                </Routes>
                            </BrowserRouter>
                        </BlueprintHubProvider>
                    </NERProvider>
                </TooltipProvider>
            </QueryClientProvider>
        </JotaiProvider>
    );
};

export default App;

