![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/artmizu/analytics-nuxt/ci.yml?branch=main) ![GitHub Workflow Status](https://img.shields.io/github/actions/workflow/status/artmizu/analytics-nuxt/release.yml?branch=main)

![Cover](https://raw.githubusercontent.com/artmizu/analytics-nuxt/main/.github/cover.jpg) 

# 📊 Nuxt 3 Analytics 
Allows you to better understand what's going on with your application and how to optimize performance and other things in production. **Nuxt 2** users can use [this version](https://github.com/artmizu/analytics-nuxt-2).

## Package support Node <= 17.x, for Node >= 18.x users
Actually package is worked, but requests time coudn't be calculated due to limitation of the [@mswjs/interceptors](https://www.npmjs.com/package/@mswjs/interceptors). When it is updated, I will update this package.

## Features
* Default NodeJS metrics exported through the prometheus middleware
* Custom metrics about pages render time and external request consumption time
* Health check middleware

## Default routes
* `/metrics` - prometheus metrics
* `/health` - health check

## Installation
Install package via a package manager: 
```bash
# using npm
npm install @artmizu/analytics-nuxt

# using yarn
yarn add @artmizu/analytics-nuxt

# using pnpm
pnpm add @artmizu/analytics-nuxt
```

Add it to a modules section of your nuxt config:
```js
export default {
  modules: ['@artmizu/analytics-nuxt']
}
```

## Grafana sample setup
Once the metrics have been collected by Prometheus, you will want to review them. I use Grafana for this purpose, and my metrics setup looks something like this:
![Cover](https://raw.githubusercontent.com/artmizu/analytics-nuxt/main/.github/grafana.jpg)

## Options
You can pass it through module options and the nuxt config property `analytics`.

### verbose
- Type: `boolean`
- Default: `true`
- Description: Additional logs in dev mode, about page rendering time and time of external API requests
