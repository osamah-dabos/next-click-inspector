const path = require("node:path");
const { start } = require("./server.cjs");

const PHASE_DEV = "phase-development-server";
const loader = path.join(__dirname, "loader.cjs");

function apply(nextConfig, options) {
  const root = process.cwd();
  const { endpoint, token } = start(root, options.port);
  const loaderOptions = { root, endpoint, token };
  const rule = { loaders: [{ loader, options: loaderOptions }] };

  return {
    ...nextConfig,
    turbopack: {
      ...nextConfig.turbopack,
      rules: {
        ...(nextConfig.turbopack && nextConfig.turbopack.rules),
        "*.jsx": rule,
        "*.tsx": rule,
      },
    },
    webpack(config, ctx) {
      if (ctx.dev) {
        config.module.rules.push({
          test: /\.(jsx|tsx)$/,
          exclude: /node_modules/,
          enforce: "pre",
          use: [{ loader, options: { ...loaderOptions, root: ctx.dir } }],
        });
      }
      return typeof nextConfig.webpack === "function" ? nextConfig.webpack(config, ctx) : config;
    },
  };
}

/**
 * Wrap your Next.js config. Only active in `next dev`; production builds get
 * your config back untouched.
 *
 *   export default withInspector(nextConfig)
 */
function withInspector(nextConfig = {}, options = {}) {
  return async function nextConfigWithInspector(phase, ctx) {
    const resolved = typeof nextConfig === "function" ? await nextConfig(phase, ctx) : await nextConfig;
    if (phase !== PHASE_DEV || options.enabled === false) return resolved;
    return apply(resolved || {}, options);
  };
}

module.exports = withInspector;
module.exports.default = withInspector;
module.exports.withInspector = withInspector;
