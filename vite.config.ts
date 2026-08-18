import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  base: process.env.VITE_BASE_PATH || "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        hub: fileURLToPath(new URL("./index.html", import.meta.url)),
        nba: fileURLToPath(new URL("./nba/index.html", import.meta.url)),
        movies: fileURLToPath(new URL("./movies/index.html", import.meta.url)),
      },
    },
  },
});
