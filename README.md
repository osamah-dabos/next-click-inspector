# next-click-inspector

Click any element in your running Next.js app and see the exact file, line and code that rendered it, then open it in your editor. Like the Nuxt DevTools inspector, for Next.js.

Works with the App Router and Pages Router, Turbopack and Webpack, Server and Client Components, and React 19. Nothing is added to your production build.

## Install

One command, inside your Next.js project:

```bash
npx next-click-inspector init
```

This installs the package with your package manager (npm, pnpm, yarn or bun) and wraps your `next.config` for you. Then restart `next dev`.

### Install from GitHub (before it's on npm)

```bash
npm i -D github:osamah-dabos/next-click-inspector && npx next-click-inspector init
```

### Manual setup

```bash
npm i -D next-click-inspector
```

```ts
// next.config.ts
import type { NextConfig } from "next";
import withInspector from "next-click-inspector";

const nextConfig: NextConfig = {};

export default withInspector(nextConfig);
```

CommonJS: `module.exports = withInspector(nextConfig)` with `const withInspector = require("next-click-inspector")`.
Other plugins: `withInspector(withNextIntl(nextConfig))`.

## Use

- Press **Alt+Shift+C** or click the round button in the bottom-right corner.
- Hover to highlight, **click** to see the code, **Shift+click** to open it in your editor.
- In the panel: Open in editor, Select parent, Pick another, Copy path. **Esc** closes.

## Editor

Your running editor is detected automatically (VS Code, Cursor, WebStorm, Zed, Sublime…). To force one:

```bash
LAUNCH_EDITOR=cursor npm run dev
```

For VS Code, make sure the `code` command works in your terminal ("Shell Command: Install 'code' command in PATH").

## Options

```ts
export default withInspector(nextConfig, {
  port: 24680,     // helper server port (default: stable port based on the project path)
  enabled: false,  // turn it off without removing it
});
```

## How it works

- A dev-only loader adds `data-insp="app/page.tsx:12:7"` to every DOM tag in your JSX, and injects the overlay script into the file that renders `<body>`. Insertions are inline, so line numbers never shift.
- The overlay is plain JavaScript inside a Shadow DOM, so it never clashes with your styles or React tree.
- A small helper server on `127.0.0.1` reads code snippets and opens your editor. Every request needs a secret per-project token, so other websites can't read your files, and it refuses paths outside the project.

## Notes

- Opening the app from another device (e.g. your phone over LAN) shows highlights, but code and editor features need the helper on your computer.
- Only DOM tags get attributes, never your components, so component props are untouched.
- Component names appear for Client Components. Server Components still get exact file and line info.
