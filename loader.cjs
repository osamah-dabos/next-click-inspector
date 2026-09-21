// Dev-only loader (works in Webpack and Turbopack).
// 1. Adds data-insp="relative/path.tsx:line:col" to every lowercase JSX tag
//    (<div>, <button>, <svg>…).
// 2. In any file that renders <body> (root layout, pages/_document), injects the
//    overlay script right before </body>, so you never mount anything yourself.
// All insertions are inline, so line numbers in the compiled output never shift.
const fs = require("node:fs");
const path = require("node:path");
const { parse } = require("@babel/parser");

const ATTR = "data-insp";
const OVERLAY = path.join(__dirname, "overlay.js");

function overlayTag(endpoint, token) {
  const js =
    `window.__DEV_INSPECTOR__=${JSON.stringify({ endpoint, token })};\n` +
    fs.readFileSync(OVERLAY, "utf8");
  const safe = js.replace(/<\/script/gi, "<\\/script");
  return `<script data-dev-inspector="" dangerouslySetInnerHTML={{ __html: ${JSON.stringify(safe)} }} />`;
}

function walk(node, visit) {
  if (!node || typeof node.type !== "string") return;
  visit(node);
  for (const key in node) {
    if (key === "loc" || key === "leadingComments" || key === "trailingComments") continue;
    const child = node[key];
    if (Array.isArray(child)) child.forEach((c) => walk(c, visit));
    else if (child && typeof child.type === "string") walk(child, visit);
  }
}

module.exports = function inspectorLoader(source) {
  const file = this.resourcePath;
  if (!file || file.includes("node_modules") || !source.includes("<")) return source;

  const opts = (this.getOptions && this.getOptions()) || {};
  const root = opts.root || this.rootContext || process.cwd();
  const rel = path.relative(root, file).split(path.sep).join("/");

  let ast;
  try {
    ast = parse(source, {
      sourceType: "module",
      errorRecovery: true,
      plugins: [
        "jsx",
        ...(/\.[cm]?tsx?$/.test(file) ? ["typescript"] : []),
        "decorators-legacy",
        "importAttributes",
      ],
    });
  } catch {
    return source; // never break the build because of the inspector
  }

  const inserts = [];
  walk(ast.program, (node) => {
    if (
      node.type === "JSXElement" &&
      node.closingElement &&
      node.openingElement.name.type === "JSXIdentifier" &&
      node.openingElement.name.name === "body"
    ) {
      if (typeof this.addDependency === "function") this.addDependency(OVERLAY);
      inserts.push({ at: node.closingElement.start, text: overlayTag(opts.endpoint, opts.token) });
    }
    if (node.type !== "JSXOpeningElement") return;
    const name = node.name;
    // Only host elements: <div>, <my-element>. Skip <Component>, <motion.div>, <svg:rect>.
    if (name.type !== "JSXIdentifier" || !/^[a-z]/.test(name.name)) return;
    const already = node.attributes.some(
      (a) => a.type === "JSXAttribute" && a.name && a.name.name === ATTR
    );
    if (already) return;
    const { line, column } = node.loc.start;
    inserts.push({ at: name.end, text: ` ${ATTR}="${rel}:${line}:${column + 1}"` });
  });

  if (!inserts.length) return source;
  inserts.sort((a, b) => b.at - a.at);
  let out = source;
  for (const { at, text } of inserts) out = out.slice(0, at) + text + out.slice(at);
  return out;
};
