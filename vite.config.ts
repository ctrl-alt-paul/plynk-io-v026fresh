
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";

export default defineConfig(async ({ mode }) => {
  // Import the componentTagger only in development mode
  let componentTaggerPlugin;
  
  if (mode === "development") {
    try {
      const { componentTagger } = await import("lovable-tagger");
      componentTaggerPlugin = componentTagger();
    } catch (error) {
      //console.error("Failed to import lovable-tagger:", error);
    }
  }

  // Read package.json to inject version
  const packageJson = await import('./package.json');
  const version = packageJson.default.version;
  
  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      // Only include componentTagger in development mode
      mode === "development" && componentTaggerPlugin,
    ].filter(Boolean), // Filter out any falsy values (undefined, null, false)
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
    },
    define: {
      __APP_VERSION__: JSON.stringify(version),
    },
  };
});
