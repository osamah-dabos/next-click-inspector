#!/usr/bin/env node
// npx next-click-inspector init
// Installs the package (if needed) and wraps your next.config with withInspector.
const fs = require("node:fs");
const path = require("node:path");
const { execSync } = require("node:child_process");

const PKG = "next-click-inspector";
const cwd = process.cwd();
const log = (m) => console.log(`\x1b[36m[${PKG}]\x1b[0m ${m}`);
const fail = (m) => {
  console.error(`\x1b[31m[${PKG}]\x1b[0m ${m}`);
  process.exit(1);
};

function packageManager() {
  const has = (f) => fs.existsSync(path.join(cwd, f));
  if (has("pnpm-lock.yaml")) return "pnpm add -D";
  if (has("yarn.lock")) return "yarn add -D";
  if (has("bun.lock") || has("bun.lockb")) return "bun add -d";
  return "npm install -D";
}

function isInstalled() {
  try {
    const pj = JSON.parse(fs.readFileSync(path.join(cwd, "package.json"), "utf8"));
    return Boolean((pj.devDependencies || {})[PKG] || (pj.dependencies || {})[PKG]);
  } catch {
    return false;
  }
}

function findConfig() {
  for (const name of ["next.config.ts", "next.config.mts", "next.config.mjs", "next.config.js", "next.config.cjs"]) {
    const file = path.join(cwd, name);
    if (fs.existsSync(file)) return file;
  }
  return null;
}

function patchConfig(file) {
  const src = fs.readFileSync(file, "utf8");
  const name = path.basename(file);

  if (src.includes(PKG)) return log(`${name} is already set up.`);
  if (src.includes("dev-inspector/with-inspector")) {
    fail(
      `${name} still uses the old copied dev-inspector folder. Remove that import and the withInspector call, then run init again.`
    );
  }

  const { parse } = require(
    require.resolve("@babel/parser", { paths: [__dirname, path.join(cwd, "node_modules", PKG)] })
  );
  const ast = parse(src, { sourceType: "module", plugins: ["typescript"], errorRecovery: true });
  const body = ast.program.body;

  const isCjs =
    name.endsWith(".cjs") ||
    (name.endsWith(".js") && !body.some((n) => n.type.startsWith("Export") || n.type === "ImportDeclaration"));

  let target = null;
  if (isCjs) {
    for (const n of body) {
      const e = n.type === "ExpressionStatement" && n.expression;
      if (
        e &&
        e.type === "AssignmentExpression" &&
        e.left.type === "MemberExpression" &&
        e.left.object.name === "module" &&
        e.left.property.name === "exports"
      )
        target = e.right;
    }
  } else {
    const d = body.find((n) => n.type === "ExportDefaultDeclaration");
    target = d && d.declaration;
  }
  if (!target) {
    fail(
      `Couldn't find the config export in ${name}. Add it by hand:\n\n` +
        (isCjs
          ? `  const withInspector = require("${PKG}");\n  module.exports = withInspector(nextConfig);\n`
          : `  import withInspector from "${PKG}";\n  export default withInspector(nextConfig);\n`)
    );
  }

  let out = src.slice(0, target.start) + "withInspector(" + src.slice(target.start, target.end) + ")" + src.slice(target.end);

  const importLine = isCjs
    ? `const withInspector = require("${PKG}");\n`
    : `import withInspector from "${PKG}";\n`;
  const imports = body.filter((n) => n.type === "ImportDeclaration");
  const at = imports.length ? imports[imports.length - 1].end : 0;
  out = at ? out.slice(0, at) + "\n" + importLine.trimEnd() + out.slice(at) : importLine + out;

  fs.writeFileSync(file, out);
  log(`Wrapped the config in ${name}.`);
}

function createConfig() {
  const ts = fs.existsSync(path.join(cwd, "tsconfig.json"));
  const name = ts ? "next.config.ts" : "next.config.mjs";
  const content = ts
    ? `import type { NextConfig } from "next";\nimport withInspector from "${PKG}";\n\nconst nextConfig: NextConfig = {};\n\nexport default withInspector(nextConfig);\n`
    : `import withInspector from "${PKG}";\n\n/** @type {import('next').NextConfig} */\nconst nextConfig = {};\n\nexport default withInspector(nextConfig);\n`;
  fs.writeFileSync(path.join(cwd, name), content);
  log(`Created ${name}.`);
}

function init() {
  if (!fs.existsSync(path.join(cwd, "package.json"))) fail("Run this inside your Next.js project folder.");

  if (!isInstalled()) {
    const cmd = `${packageManager()} ${process.env.NCI_SPEC || PKG}`;
    log(`Installing: ${cmd}`);
    execSync(cmd, { cwd, stdio: "inherit" });
  }

  const file = findConfig();
  if (file) patchConfig(file);
  else createConfig();

  log("Done. Restart `next dev`, then press Alt+Shift+C (or the round button, bottom-right).");
}

const cmd = process.argv[2];
if (cmd === "init") init();
else {
  console.log(`Usage: npx ${PKG} init\n\nInstalls ${PKG} and wraps your next.config with it.`);
  process.exit(cmd ? 1 : 0);
}
