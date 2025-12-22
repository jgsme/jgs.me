# Package: og

This document provides context for the `og` package.

## Overview

This package is a Cloudflare Worker (`w-og`) that dynamically generates Open Graph (OG) images for articles and pages. It creates images from React components on the fly.

### Key Technologies

*   **Runtime:** [Cloudflare Workers](https://workers.cloudflare.com/)
*   **Image Generation:**
    *   [Satori](https://github.com/vercel/satori): Converts HTML/CSS (from JSX) into an SVG.
    *   [@resvg/resvg-wasm](https://github.com/RazrFalcon/resvg-js): Converts the generated SVG into a PNG image using WebAssembly.
*   **Request Handling:** [Hono](https://hono.dev/)
*   **Frontend:** [React](https://react.dev/) (for defining image templates with JSX)

### Architecture

*   The worker's entry point is `src/index.tsx`. It defines the Hono application that receives requests for OG images.
*   It uses React with JSX to define the visual template for the images.
*   When a request is received, it likely fetches data from the D1 Database (`DB` binding), renders a React component with that data, converts it to a PNG using Satori and Resvg, and returns the image.
*   The generated images may be cached in the Cloudflare R2 bucket (`OG` binding) to improve performance and reduce redundant generation.

## Building and Running

### Prerequisites

*   [pnpm](https://pnpm.io/installation)
*   [Cloudflare Wrangler](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
*   Dependencies installed via `pnpm install` in the root directory.

### Development

To run this worker locally for development:

```bash
# Run from the root of the monorepo
pnpm dev:og
```

This starts a local Wrangler server.

### Deployment

To deploy the worker to Cloudflare:

```bash
# Run from the root of the monorepo
pnpm deploy:og
```
