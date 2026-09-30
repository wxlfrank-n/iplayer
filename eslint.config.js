import fs from "node:fs";
import gts from "gts";

let customConfig = [];

if (fs.existsSync(new URL("./eslint.ignores.js", import.meta.url))) {
  const {default: ignores} = await import("./eslint.ignores.js");
  customConfig = [{ignores}];
}

export default [
  ...customConfig,
  ...gts,

  // React/application TypeScript
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.app.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // Vite/Node TypeScript
  {
    files: ["vite.config.ts"],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.node.json",
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
];