
import { MemoryStick, CpuIcon, Gamepad2, Activity, FileText, MessageSquare, Info, Github } from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import {
  NavigationMenu,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { AboutDialog } from "@/components/AboutDialog";
import { useState } from "react";
import { useMessageAttachment } from "@/contexts/MessageAttachmentContext";
import { useGitHubAuth } from "@/state/githubAuthStore";
import { cn } from "@/lib/utils";

export function MainNav() {
  const [showAbout, setShowAbout] = useState(false);
  const { isGameProfileActive } = useMessageAttachment();
  const location = useLocation();
  const { status, connectGitHub, disconnect, viewSubmissions, user, isLoading } = useGitHubAuth();

  // Handle external links
  const handleExternalLink = (url: string) => {
    if (window.electron?.openExternal) {
      window.electron.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Check if a route is currently active
  const isActiveRoute = (href: string) => {
    const currentPath = location.pathname;
    
    // Handle root route - both "/" and "/dashboard" should highlight Dashboard
    if (href === "/dashboard") {
      return currentPath === "/" || currentPath === "/dashboard";
    }
    
    return currentPath === href;
  };

  // Dynamic icon path based on game profile state
  const iconPath = isGameProfileActive ? "/icon2.png" : "/icon.png";

  // GitHub icon color based on connection status
  const getGitHubIconColor = () => {
    if (isLoading) return "text-blue-400";
    switch (status) {
      case 'connected': return "text-green-500";
      case 'invalid': return "text-red-500";
      default: return "text-gray-400";
    }
  };

  const routes = [
    {
      title: "Dashboard",
      href: "/dashboard",
      icon: Activity,
    },
    {
      title: "Game Manager",
      href: "/game-manager",
      icon: Gamepad2,
    },
    {
      title: "Memory Manager",
      href: "/memory-manager",
      icon: MemoryStick,
    },
    {
      title: "Message Manager",
      href: "/messages",
      icon: MessageSquare,
    },
    {
      title: "Device Manager",
      href: "/device-manager",
      icon: CpuIcon,
    },
    {
      title: "WLED Profiles",
      href: "/wled-profiles",
      icon: MemoryStick,
    },
    {
      title: "Log",
      href: "/log",
      icon: FileText,
    },
  ];

  return (
    <div className="border-b">
      <div className="flex h-16 items-center px-4">
        <div className="mr-2 flex items-center">
          <AboutDialog
            trigger={
              <img 
                src={iconPath}
                alt="PLYNK-IO" 
                className="h-10 w-10 hover:drop-shadow-lg transition-all duration-200 cursor-pointer hover:scale-110"
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))'
                }}
              />
            }
          />
        </div>
        <NavigationMenu className="flex-1">
          <NavigationMenuList>
            {routes.map((route) => {
              const isActive = isActiveRoute(route.href);
              return (
                <NavigationMenuItem key={route.href}>
                  <NavigationMenuLink asChild>
                    <Link 
                      to={route.href}
                      className={cn(
                        "group inline-flex h-10 w-max items-center justify-center rounded-md px-4 py-2 text-sm font-medium transition-colors focus:outline-none focus:ring-0 disabled:pointer-events-none disabled:opacity-50",
                        isActive 
                          ? "bg-gradient-to-r from-blue-400 to-blue-500 text-white hover:from-blue-500 hover:to-blue-600" 
                          : navigationMenuTriggerStyle()
                      )}
                    >
                      <route.icon className="mr-2 h-4 w-4" />
                      {route.title}
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              );
            })}
          </NavigationMenuList>
        </NavigationMenu>
        
        <div className="ml-auto flex items-center space-x-2">
          <img 
            src="/beer.png" 
            alt="Buy me a beer" 
            className="h-10 w-10 hover:drop-shadow-lg transition-all duration-200 cursor-pointer hover:scale-110 object-contain"
            style={{
              filter: 'drop-shadow(0 0 8px rgba(251, 146, 60, 0.3))'
            }}
            onClick={() => handleExternalLink('https://buymeacoffee.com/ctrl_alt_paul')}
          />
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Github 
                className={cn(
                  "h-10 w-10 p-2 hover:drop-shadow-lg transition-all duration-200 cursor-pointer hover:scale-110",
                  getGitHubIconColor()
                )}
                style={{
                  filter: 'drop-shadow(0 0 8px rgba(59, 130, 246, 0.3))'
                }}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 bg-white dark:bg-gray-800 border shadow-lg">
              {status === 'disconnected' || status === 'invalid' ? (
                <DropdownMenuItem 
                  onClick={connectGitHub}
                  disabled={isLoading}
                  className="cursor-pointer"
                >
                  <Github className="mr-2 h-4 w-4" />
                  {isLoading ? 'Connecting...' : 'Connect GitHub'}
                </DropdownMenuItem>
              ) : (
                <>
                  <DropdownMenuItem 
                    onClick={viewSubmissions}
                    className="cursor-pointer"
                  >
                    <Github className="mr-2 h-4 w-4" />
                    View My Repositories
                  </DropdownMenuItem>
                  <DropdownMenuItem 
                    onClick={disconnect}
                    className="cursor-pointer text-red-600 dark:text-red-400"
                  >
                    Disconnect GitHub
                  </DropdownMenuItem>
                  {user && (
                    <div className="px-2 py-1 text-xs text-gray-500 border-t">
                      Connected as {user.login}
                    </div>
                  )}
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          
          <Button
            onClick={() => setShowAbout(true)}
            className="bg-gradient-to-r from-blue-400 to-blue-500 hover:from-blue-500 hover:to-blue-600 text-white font-medium shadow-lg hover:shadow-xl transition-all duration-200 hover:scale-105"
            style={{
              filter: 'drop-shadow(0 0 4px rgba(59, 130, 246, 0.3))'
            }}
          >
            <Info className="h-4 w-4 mr-2" />
            About
          </Button>
        </div>
      </div>
      
      <AboutDialog
        trigger={<div />}
        open={showAbout}
        onOpenChange={setShowAbout}
      />
    </div>
  );
}
