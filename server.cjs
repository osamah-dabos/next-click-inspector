// Small local HTTP server that replaces the old API route.
// Serves code snippets and opens files in your editor. Dev only, bound to 127.0.0.1,
// and every request needs a secret token so other websites can't read your files.
const http = require("node:http");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const crypto = require("node:crypto");

const CONTEXT = 12;
const OVERLAY = path.join(__dirname, "overlay.js");

function machineSecret() {
  const file = path.join(os.homedir(), ".next-click-inspector-secret");
  try {
    return fs.readFileSync(file, "utf8").trim();
  } catch {
    const secret = crypto.randomBytes(32).toString("hex");
    try {
      fs.writeFileSync(file, secret, { mode: 0o600 });
    } catch {
      /* read-only home: fall back to a per-run secret */
    }
    return secret;
  }
}

/** Stable per project, so cached builds keep working across restarts. */
function identity(root, preferredPort) {
  const token = crypto.createHmac("sha256", machineSecret()).update(root).digest("hex").slice(0, 32);
  const hash = crypto.createHash("sha1").update(root).digest().readUInt32BE(0);
  const port = preferredPort || 20000 + (hash % 20000);
  return { token, port };
}

function resolveSafe(root, file) {
  const abs = path.resolve(root, String(file || ""));
  if (!abs.startsWith(root + path.sep)) return null;
  if (abs.includes(`${path.sep}node_modules${path.sep}`)) return null;
  return abs;
}

function send(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function start(root, preferredPort) {
  const key = "__nextClickInspector:" + root;
  if (globalThis[key]) return globalThis[key];

  const { token, port } = identity(root, preferredPort);
  const info = { port, token, endpoint: `http://127.0.0.1:${port}` };

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, info.endpoint);
    if (url.searchParams.get("token") !== token) return send(res, 403, { error: "Forbidden" });

    if (req.method === "GET" && url.pathname === "/snippet") {
      const abs = resolveSafe(root, url.searchParams.get("file"));
      if (!abs) return send(res, 403, { error: "Path outside project" });
      const line = Math.max(1, Number(url.searchParams.get("line")) || 1);
      fs.readFile(abs, "utf8", (err, src) => {
        if (err) return send(res, 404, { error: "File not found" });
        const lines = src.split(/\r?\n/);
        const startLine = Math.max(1, line - CONTEXT);
        const end = Math.min(lines.length, line + CONTEXT);
        send(res, 200, { absPath: abs, start: startLine, lines: lines.slice(startLine - 1, end) });
      });
      return;
    }

    // The overlay is served as an external script (not inlined into the layout)
    // because React 19 warns about inline <script> tags rendered by components.
    if (req.method === "GET" && url.pathname === "/overlay.js") {
      fs.readFile(OVERLAY, "utf8", (err, src) => {
        if (err) return send(res, 500, { error: "Overlay missing" });
        res.writeHead(200, {
          "Content-Type": "application/javascript; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
          "Cache-Control": "no-store",
        });
        res.end(`window.__DEV_INSPECTOR__=${JSON.stringify({ endpoint: info.endpoint, token })};\n${src}`);
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/open") {
      const abs = resolveSafe(root, url.searchParams.get("file"));
      if (!abs) return send(res, 403, { error: "Path outside project" });
      const line = Number(url.searchParams.get("line")) || 1;
      const col = Number(url.searchParams.get("col")) || 1;
      let error = null;
      require("launch-editor")(`${abs}:${line}:${col}`, process.env.LAUNCH_EDITOR, (_f, msg) => {
        error = msg || "Could not open editor";
      });
      return error ? send(res, 500, { error }) : send(res, 200, { ok: true });
    }

    send(res, 404, { error: "Not found" });
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.warn(
        `[next-click-inspector] Port ${port} is busy. Set another one: withInspector(config, { port: 12345 })`
      );
    } else console.warn("[next-click-inspector]", err.message);
  });
  server.listen(port, "127.0.0.1");
  server.unref(); // never keeps the process alive on its own

  globalThis[key] = info;
  return info;
}

module.exports = { start, identity };
