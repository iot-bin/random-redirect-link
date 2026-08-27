import { build } from "esbuild";

const includeSdk = process.argv.includes("--self-contained");

await build({
  entryPoints: ["src/index.mjs"],
  bundle: true,
  platform: "node",
  target: "node24",
  format: "esm",
  outfile: "dist/index.mjs",
  external: includeSdk ? [] : ["@aws-sdk/*"],
  ...(includeSdk ? { banner: {
    js: [
      "import { createRequire as __createRequire } from \"node:module\";",
      "const require = __createRequire(import.meta.url);"
    ].join("\n")
  } } : {})
});
