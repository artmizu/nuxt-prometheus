# Grafana dashboard

![Nuxt Prometheus dashboard](./dashboard.png)

A dashboard for the metrics exported by `@artmizu/nuxt-prometheus`. It covers page timings, the request and render split, the slowest routes, and the default Node.js metrics.

## Panels

| Panel | Query |
| --- | --- |
| Requests per second | `sum(rate(<prefix>page_total_time_histogram_count[$__rate_interval]))` |
| Total time p95 | `histogram_quantile(0.95, sum by (le) (rate(<prefix>page_total_time_histogram_bucket[$__rate_interval])))` |
| Requests per second by route | `sum by (path) (rate(<prefix>page_total_time_histogram_count[$__rate_interval]))` |
| Total time p95 by route | `histogram_quantile(0.95, sum by (le, path) (rate(<prefix>page_total_time_histogram_bucket[$__rate_interval])))` |
| Total time percentiles | `histogram_quantile(0.50, 0.90, 0.99, ...)` on the total time buckets |
| Request and render time | `rate(..._histogram_sum) / rate(..._histogram_count)` for the request and render histograms |
| Slowest routes | `topk(10, <prefix>page_total_time)` |
| Event loop lag | `<prefix>nodejs_eventloop_lag_p99_seconds` |
| Process CPU | `rate(<prefix>process_cpu_seconds_total[$__rate_interval])` |
| Memory | heap used, heap total, resident memory |

`<prefix>` is the `prometheus.prefix` option, empty by default. Set it in the `Metric prefix` field at the top of the dashboard.

## Import into an existing Grafana

1. Open Dashboards, then New, then Import.
2. Upload `dashboard.json`.
3. Select your Prometheus data source.
4. Set the `Metric prefix` field to your configured prefix, or leave it empty.

## Run the example stack

`docker-compose.yml` starts Prometheus and Grafana with the dashboard already provisioned. It expects a Nuxt app on port 3000 with this module enabled.

```bash
# terminal 1: your app
pnpm dev

# terminal 2: Prometheus and Grafana
cd examples/grafana
docker compose up -d
```

Open http://localhost:3001. Prometheus is on http://localhost:9090.

`prometheus.yml` scrapes `host.docker.internal:3000`. Change the host and port if your app runs elsewhere.

If you use the Nuxt dev server, Vite rejects unknown `Host` headers with a 403, so scraping `host.docker.internal` fails. Either use your machine IP in `prometheus.yml` (`ipconfig getifaddr en0` on macOS), or add the host to `vite.server.allowedHosts` in `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
  vite: {
    server: {
      allowedHosts: ['host.docker.internal'],
    },
  },
})
```

A production build (`nuxt build`, then `node .output/server/index.mjs`) has no host allowlist, so `host.docker.internal` works there.

To stop the stack:

```bash
docker compose down
```
