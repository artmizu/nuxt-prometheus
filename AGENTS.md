## Build And Verification

- After changing files under `src/`, rebuild before validating behavior.
- Run `pnpm prepack` before test verification when changes need fresh `dist` output.
- Use `pnpm run dev:prepare` after `src` changes when you need the playground or browser verification to reflect them.

## Metrics Verification

- Do not verify route metrics via client-side navigation when the goal is to confirm server-side request metrics.
- For browser verification of metrics, request each page directly from the server using URL navigation such as `/a`, `/b`, `/c`, then open `/metrics`.
