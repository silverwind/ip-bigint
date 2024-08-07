import {defineConfig} from "vite";
import {nodeLib} from "vite-config-silverwind";

export default defineConfig(nodeLib({
  url: import.meta.url,
  dtsExcludes: ["bench.ts"],
  build: {
    target: "node18",
  },
}));
