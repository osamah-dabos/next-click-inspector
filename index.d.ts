import type { NextConfig } from "next";

type ConfigContext = { defaultConfig: NextConfig };
type ConfigInput =
  | NextConfig
  | Promise<NextConfig>
  | ((phase: string, ctx: ConfigContext) => NextConfig | Promise<NextConfig>);

interface InspectorOptions {
  /** Port for the local helper server. Default: a stable port derived from the project path. */
  port?: number;
  /** Set false to turn the inspector off without removing it. */
  enabled?: boolean;
}

declare function withInspector(
  config?: ConfigInput,
  options?: InspectorOptions
): (phase: string, ctx: ConfigContext) => Promise<NextConfig>;

export = withInspector;
