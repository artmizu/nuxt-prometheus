# Changelog

## [2.6.0](https://github.com/artmizu/nuxt-prometheus/compare/v2.5.2...v2.6.0) (2025-09-03)


### Features

* Nuxt 4 support, handling metrics measure via Nitro ([fb29d4b](https://github.com/artmizu/nuxt-prometheus/commit/fb29d4b3523c621d2bdea0ddc784157a48d3c981))

## [2.5.2](https://github.com/artmizu/nuxt-prometheus/compare/v2.5.1...v2.5.2) (2025-07-31)


### Bug Fixes

* additional param for disabling requests interception ([c7c3ea4](https://github.com/artmizu/nuxt-prometheus/commit/c7c3ea42a0c8569da2ddfdb8fc662be507ca4511))

## [2.5.1](https://github.com/artmizu/nuxt-prometheus/compare/v2.5.0...v2.5.1) (2025-07-29)


### Bug Fixes

* memory leak ([46fc9fc](https://github.com/artmizu/nuxt-prometheus/commit/46fc9fca5f7b5d0daad0cbd63a9de06002405c32))

## [2.5.0](https://github.com/artmizu/nuxt-prometheus/compare/v2.4.2...v2.5.0) (2025-04-10)


### Features

* Additional metrics collection with Summary type, allows to see more precise data in additional percentiles ([8dd735d](https://github.com/artmizu/nuxt-prometheus/commit/8dd735de1b6f4ba1b8ea9517c4c7ffa56964ed89))

## [2.4.2](https://github.com/artmizu/nuxt-prometheus/compare/v2.4.1...v2.4.2) (2025-04-10)


### Bug Fixes

* fix for «Failed to Patch the 'fetch' Module: Already Patched», also change the strategy how interceptor are applying ([7f651f0](https://github.com/artmizu/nuxt-prometheus/commit/7f651f083203ed7b969f552829df3c96efa8717d))

## [2.4.1](https://github.com/artmizu/nuxt-prometheus/compare/v2.4.0...v2.4.1) (2025-03-10)


### Bug Fixes

* requests time measure & deps update ([6cedcd7](https://github.com/artmizu/nuxt-prometheus/commit/6cedcd7e30ae25032b41a52302c417124ae0bcbb))

## [2.4.0](https://github.com/artmizu/nuxt-prometheus/compare/v2.3.1...v2.4.0) (2024-07-23)


### Features

* Disable requests measuring time by default due to https://github.com/artmizu/nuxt-prometheus/issues/42 ([6fefa56](https://github.com/artmizu/nuxt-prometheus/commit/6fefa56091863bb22ce8a8a2dfa687863d213902))

## [2.3.1](https://github.com/artmizu/nuxt-prometheus/compare/v2.3.0...v2.3.1) (2024-05-13)


### Bug Fixes

* lockfile ([b7a77bc](https://github.com/artmizu/nuxt-prometheus/commit/b7a77bc43a0e2f184e0d34a3d32917a10f920718))

## [2.3.0](https://github.com/artmizu/nuxt-prometheus/compare/v2.2.1...v2.3.0) (2024-05-13)


### Features

* Node 20+ support, nuxt update ([5fbd06c](https://github.com/artmizu/nuxt-prometheus/commit/5fbd06ca998c09ad2779a47112ef03da02c62154))


### Bug Fixes

* release ([e47f8e1](https://github.com/artmizu/nuxt-prometheus/commit/e47f8e153738b53cc0516747724b27d96e94df05))

## [2.2.1](https://github.com/artmizu/nuxt-prometheus/compare/v2.2.0...v2.2.1) (2023-12-13)


### Bug Fixes

* release ([502e1a2](https://github.com/artmizu/nuxt-prometheus/commit/502e1a2a6acca974d0710b1e0ae6c5e7e89ef533))

## [2.2.0](https://github.com/artmizu/nuxt-prometheus/compare/v2.1.5...v2.2.0) (2023-09-05)


### Features

* allow nuxt bridge ([efdbf67](https://github.com/artmizu/nuxt-prometheus/commit/efdbf67c822151869fce62ab05dc6ac25fde54ca))

## [2.1.5](https://github.com/artmizu/nuxt-prometheus/compare/v2.1.4...v2.1.5) (2023-08-25)


### Bug Fixes

* empty route handling ([44fd111](https://github.com/artmizu/nuxt-prometheus/commit/44fd111df9560206a1c4f2dc50ea9ca064193469))

## [2.1.4](https://github.com/artmizu/nuxt-prometheus/compare/v2.1.3...v2.1.4) (2023-08-25)


### Bug Fixes

* dependencies and build config ([35a031c](https://github.com/artmizu/nuxt-prometheus/commit/35a031ccc869b2bcc4a96d3f8de79040f95fb66d))

## [2.1.3](https://github.com/artmizu/nuxt-prometheus/compare/v2.1.2...v2.1.3) (2023-08-14)


### Bug Fixes

* fix prepack command ([d16f10f](https://github.com/artmizu/nuxt-prometheus/commit/d16f10f777671a0a7bbe55743ba2f4bd4e1ea0f9))

## [2.1.2](https://github.com/artmizu/nuxt-prometheus/compare/v2.1.1...v2.1.2) (2023-08-11)


### Bug Fixes

* release ([9568400](https://github.com/artmizu/nuxt-prometheus/commit/956840064945fd98f9075f8bfa4e8a6672fbc700))

## [2.1.1](https://github.com/artmizu/nuxt-prometheus/compare/v2.1.0...v2.1.1) (2023-08-11)


### Bug Fixes

* release ([7c719ba](https://github.com/artmizu/nuxt-prometheus/commit/7c719bab911324421f24861ae6b0f787dd1fc35e))

## [2.1.0](https://github.com/artmizu/nuxt-prometheus/compare/v2.0.0...v2.1.0) (2023-04-03)


### Features

* consola as explicit dependency and exclude nuxt request from the logs ([b22f6b2](https://github.com/artmizu/nuxt-prometheus/commit/b22f6b2e1264298b395fcf5e52602b64aa1c7dd7))


### Bug Fixes

* readme typo ([a3fbaeb](https://github.com/artmizu/nuxt-prometheus/commit/a3fbaeb217ce1579941c9a60699dea3d8b81bb7e))

## [2.0.0](https://github.com/artmizu/nuxt-prometheus/compare/v1.0.3...v2.0.0) (2023-01-28)


### ⚠ BREAKING CHANGES

* changed the module key name in the nuxt config, from 'analytics' to 'prometheus'

### Features

* module customisation options and minor improvements ([73026e7](https://github.com/artmizu/nuxt-prometheus/commit/73026e7f1775aa7b516897ffec4d083fcb6676d3))

## [1.0.3](https://github.com/artmizu/nuxt-prometheus/compare/v1.0.2...v1.0.3) (2023-01-10)


### Bug Fixes

* release ([c8d388e](https://github.com/artmizu/nuxt-prometheus/commit/c8d388e46ed375e1e32432a98f8dbbdf2f24d24e))
