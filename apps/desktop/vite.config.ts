import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: true,
    // @ts-expect-error vite 5.4+ option
    allowedHosts: true,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
});