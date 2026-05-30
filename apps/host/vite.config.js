import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import federation from "@originjs/vite-plugin-federation";

export default defineConfig({
  plugins: [
    react(),
    federation({
      name: "nexasphereHost",
      remotes: {
        adminDashboard: "http://localhost:5001/assets/remoteEntry.js",
      },
      shared: {
        react: {
          singleton: true,
          requiredVersion: "^18.2.0",
        },
        "react-dom": {
          singleton: true,
          requiredVersion: "^18.2.0",
        },
        "react-router-dom": {
          singleton: true,
          requiredVersion: "^6.22.0",
        },
      },
    }),
  ],
  server: {
    port: 5000,
  },
  preview: {
    port: 5000,
  },
  build: {
    target: "esnext",
  },
});
