
import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Gamepad2, MemoryStick, CpuIcon } from "lucide-react";

const Index = () => {
  const navigate = useNavigate();

  const features = [
    {
      title: "Memory Manager",
      description: "Configure and monitor memory addresses for gaming applications",
      icon: MemoryStick,
      path: "/memory-manager",
    },
    {
      title: "Game Manager",
      description: "Set up and manage your game profiles for seamless integration",
      icon: Gamepad2,
      path: "/game-manager",
    },
    {
      title: "Device Manager",
      description: "Configure your hardware devices and connection settings",
      icon: CpuIcon,
      path: "/device-manager",
    },
  ];

  return (
    <div className="container mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight mb-4">Welcome to PLYNK-IO</h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
          The comprehensive platform for managing game memory, profiles, and hardware connectivity
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8 mb-12">
        {features.map((feature) => (
          <div 
            key={feature.path} 
            className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md flex flex-col items-center text-center hover:shadow-lg transition-shadow"
          >
            <div className="mb-4 p-3 bg-blue-100 dark:bg-blue-900 rounded-full">
              <feature.icon className="w-8 h-8 text-blue-600 dark:text-blue-300" />
            </div>
            <h2 className="text-xl font-bold mb-2">{feature.title}</h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6">{feature.description}</p>
            <Button 
              variant="outline" 
              className="mt-auto" 
              onClick={() => navigate(feature.path)}
            >
              Open {feature.title}
            </Button>
          </div>
        ))}
      </div>

      <div className="text-center mt-12">
        <h2 className="text-2xl font-bold mb-4">Getting Started</h2>
        <p className="text-gray-600 dark:text-gray-300 max-w-2xl mx-auto mb-6">
          Configure your first game profile by navigating to the Memory Manager to set up memory addresses,
          then use the Game Manager to create profiles that map to your hardware devices.
        </p>
        <Button onClick={() => navigate("/memory-manager")} className="mr-4">
          Start with Memory Manager
        </Button>
        <Button variant="outline" onClick={() => navigate("/game-manager")}>
          Go to Game Manager
        </Button>
      </div>
    </div>
  );
};

export default Index;
