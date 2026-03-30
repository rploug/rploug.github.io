import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// For GitHub Pages: set base to "/your-repo-name/"
// For a user/org page (username.github.io): leave as "/"
export default defineConfig({
  plugins: [react()],
  base: "/dino-card-maker/",
});
