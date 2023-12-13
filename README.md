![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/artmizu/nuxt-prometheus/release.yml?branch=main)

![Cover](https://raw.githubusercontent.com/artmizu/nuxt-prometheus/main/.github/cover.jpg)

# 📊 Prometheus integration for Nuxt 3
Allows you to better understand what's going on with your application and how to optimize performance and other things in production. **Nuxt 2** users can use [this version](https://github.com/artmizu/analytics-nuxt-2).

## Package support Node <= 17.x, for Node >= 18.x users
Actually package is worked, but requests time coudn't be calculated due to limitation of the [@mswjs/interceptors](https://github.com/mswjs/interceptors/pull/283). When it is updated, I will update this package.

## Features
* Default NodeJS metrics exported through the prometheus middleware
* Custom metrics about pages render time and external request consumption time
* Health check middleware

## Default routes that you can customise via the module options
* `/metrics` - prometheus metrics
* `/health` - health check

## Installation
Install package via a package manager:
```bash
# using npm
npm install @artmizu/nuxt-prometheus

# using yarn
yarn add @artmizu/nuxt-prometheus

# using pnpm
pnpm add @artmizu/nuxt-prometheus
```

Add it to a modules section of your nuxt config:
```js
export default {
  modules: ['@artmizu/nuxt-prometheus']
}
```

## Grafana sample setup
Once the metrics have been collected by Prometheus, you will want to review them. I use Grafana for this purpose, and my metrics setup looks something like this:
![Cover](https://raw.githubusercontent.com/artmizu/nuxt-prometheus/main/.github/grafana.jpg)

## Options
You can pass it through module options and the nuxt config property `prometheus`.

### verbose
- Type: `boolean`
- Default: `true`
- Description: Additional logs in the dev mode, about page rendering time and time of external API requests

### healthCheck
- Type: `boolean`
- Default: `true`
- Description: To turn on and off the healthcheck route

### healthCheckPath
- Type: `string`
- Default: `/health`
- Description: Healthcheck url path

### prometheusPath
- Type: `string`
- Default: `/metrics`
- Description: Prometheus exporter url path
