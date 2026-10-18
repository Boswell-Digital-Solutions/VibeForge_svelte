import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import path from "path";

export default defineConfig({
  plugins: [svelte({ hot: !process.env.VITEST })],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: [path.resolve(__dirname, "./src/tests/setup.ts")],
    include: ["src/**/*.{test,spec}.{js,ts}", "tools/**/*.{test,spec}.{js,ts}"],
    exclude: ["**/node_modules/**", "**/llm_old/**", "tools/stateforge/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      exclude: [
        "node_modules/",
        "src/tests/",
        "**/*.d.ts",
        "**/*.config.*",
        "**/mockData",
        "dist/",
      ],
    },
  },
  resolve: {
    alias: {
      $lib: path.resolve("./src/lib"),
      "$app/environment": path.resolve("./src/tests/mocks/app-environment.ts"),
    },
  },
});
