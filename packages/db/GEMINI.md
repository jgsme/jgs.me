# Package: @jigsaw/db

This document provides context for the `@jigsaw/db` package.

## Overview

This package is not a runnable application. Its sole purpose is to define and export the database schema for the entire `jgs.me` monorepo.

### Key Technologies

- **ORM:** [Drizzle ORM](https://orm.drizzle.team/)

### Architecture

- The database schema is defined in `src/schema.ts`.
- This package is imported by other packages (like `web`) that need to interact with the Cloudflare D1 database.
- It centralizes the data model, ensuring consistency across the application.

## Usage

This package is intended to be used as a dependency. There are no development or deployment scripts for it. To make changes to the database schema, edit `src/schema.ts`. Generating migrations based on these changes is handled by the `web` package.
