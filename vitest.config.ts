import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    globals: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
      // "server-only" يرمي خارج بيئة React Server؛ في الاختبارات نستبدله بوحدة فارغة.
      "server-only": path.resolve(__dirname, "./tests/stubs/server-only.ts"),
    },
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
  },
});