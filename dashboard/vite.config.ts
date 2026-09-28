import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Keep the verified exports in place; emit them as independent, cacheable assets.
export default defineConfig({
  base: "/dallas-pdv-permit-intelligence/",
  plugins: [react()],
  build: { assetsInlineLimit: 0 },
});
