
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Suspense } from "react";
import { MainNav } from "./components/MainNav";
import { LoadingSpinner } from "./components/LoadingSpinner";
import MemoryManager from "./renderer/pages/MemoryManager";
import DeviceManager from "./renderer/pages/DeviceManager";
import GameManager from "./renderer/pages/GameManager";
import Dashboard from "./renderer/pages/Dashboard";
import MessageProfileBuilder from "./renderer/pages/MessageProfileBuilder";
import Log from "./renderer/pages/Log";
import NotFound from "./pages/NotFound";
import { useForceRepaint } from "./hooks/useForceRepaint";
import { ProfileNavigationProvider } from "./hooks/useProfileNavigation";
import WLEDProfiles from "./renderer/pages/WLEDProfiles";
import { DevToolsLogListener } from "./components/DevToolsLogListener";
import { LogProvider } from "./contexts/LogContext";
import { MonitorControlsProvider } from "./contexts/MonitorControlsContext";
import { MessageAttachmentProvider } from "./contexts/MessageAttachmentContext";

function App() {
  useForceRepaint();

  return (
    <BrowserRouter>
      <TooltipProvider delayDuration={300}>
        <LogProvider>
          <MonitorControlsProvider>
            <MessageAttachmentProvider>
              <ProfileNavigationProvider>
                <Suspense fallback={<LoadingSpinner />}>
                  <DevToolsLogListener />
                  
                  <div className="h-screen flex flex-col">
                    <MainNav />
                    <main className="flex-1 overflow-y-auto">
                      <Routes>
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/memory-manager" element={<MemoryManager />} />
                        <Route path="/device-manager" element={<DeviceManager />} />
                        <Route path="/messages" element={<MessageProfileBuilder />} />
                        <Route path="/wled-profiles" element={<WLEDProfiles />} />
                        <Route path="/game-manager" element={<GameManager />} />
                        <Route path="/log" element={<Log />} />
                        <Route path="/" element={<Dashboard />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </main>
                  </div>
                  <Toaster />
                  <Sonner />
                </Suspense>
              </ProfileNavigationProvider>
            </MessageAttachmentProvider>
          </MonitorControlsProvider>
        </LogProvider>
      </TooltipProvider>
    </BrowserRouter>
  );
}

export default App;
