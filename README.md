# vite-plugin-zipbuild

Vite plugin that zips the build output after every build. Cross-platform (Windows, Linux, macOS), zero dependencies — uses only Node.js built-ins.

## Install

```bash
npm install -D vite-plugin-zipbuild

Usage

// vite.config.js
import zipBuildPlugin from 'vite-plugin-zipbuild'

export default {
    plugins: [
        zipBuildPlugin('my-app')
    ]
}

After each build, a zip file is created inside the output directory:

dist/my-app20250814_1430.zip

Options

zipBuildPlugin('my-app', {
    outDir:    'dist', // default: 'dist'
    timestamp: true    // default: true — appends YYYYMMdd_HHmm to filename
})

┌───────────┬─────────┬─────────┬────────────────────────────────────────────┐
│  Option   │  Type   │ Default │                Description                 │
├───────────┼─────────┼─────────┼───────────────────────
│ outDir    │ string  │ 'dist'  │ Build output directory to zip              │
├───────────┼─────────┼─────────┼────────────────────────────────────────────┤
│ timestamp │ boolean │ true    │ Append YYYYMMdd_HHmm timestamp to filename │
└───────────┴─────────┴─────────┴────────────────────────────────────────────┘

Conditional use

If you only want the zip on certain builds, wrap it with a condition:

plugins: [
    process.env.ZIP && zipBuildPlugin('my-app')
].filter(Boolean)

Requirements

- Node.js >= 20
- Vite >= 5