# Kakeya

A visual tour of the Kakeya needle problem: turning a needle all the way around in as little room as you like.

The site animates the classical constructions - the deltoid, Perron trees, Pál joins - with needle motion that is computed, not drawn by hand. The needle never leaves the set it sweeps.

## Development

```
pnpm install
pnpm dev
```

`pnpm test` runs the unit suites, `pnpm e2e` the browser tests, `pnpm build` the production build.

## Layout

- `packages/geometry` - the mathematical core: constructions, needle motion, area accounting. Pure TypeScript, no DOM.
- `apps/web` - the site itself.
