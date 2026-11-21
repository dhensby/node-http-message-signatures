# Changelog

## [1.1.1](https://github.com/dhensby/node-http-message-signatures/compare/v1.1.0...v1.1.1) (2026-11-21)

### Bug Fixes

* **httpbis:** exclude the fragment from [@target-uri](https://github.com/target-uri) ([c395785](https://github.com/dhensby/node-http-message-signatures/commit/c395785b43351f780be193f8ed7ef984d7ccd570))

## [1.1.0](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.10...v1.1.0) (2026-11-17)

### Features

* **cavage:** throw MalformedSignatureError for a malformed Signature header ([0363d3b](https://github.com/dhensby/node-http-message-signatures/commit/0363d3b12112e78e8d07831a7bd5a0c240dc2c3a))

## [1.0.10](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.9...v1.0.10) (2026-11-17)

### Bug Fixes

* **cavage:** reject algorithms that the verifying key does not allow ([278c113](https://github.com/dhensby/node-http-message-signatures/commit/278c11381cfb0c5fc837e9620dc0b04038b74484))
* **httpbis:** add clock tolerance to maxAge instead of subtracting it ([7b5a9d0](https://github.com/dhensby/node-http-message-signatures/commit/7b5a9d0e65168bff5f2c4470c8574b15fabd7230))
* **httpbis:** check maxAge against the Date header when created is missing ([7fdfa0d](https://github.com/dhensby/node-http-message-signatures/commit/7fdfa0d6b2e8f24c2757452a2a7f37c83a915336))

## [1.0.9](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.8...v1.0.9) (2026-11-17)

### Bug Fixes

* **cavage:** check maxAge against the signed created time or Date header ([654459e](https://github.com/dhensby/node-http-message-signatures/commit/654459e2abf5faf6e0bd9281d134caf7aad6acff))
* **cavage:** check required params and fields against the right values ([b8bdc6a](https://github.com/dhensby/node-http-message-signatures/commit/b8bdc6a7ce8d880c473365d89c78aee7b201714b))
* **cavage:** enforce maxAge when verifying signatures ([0dcc198](https://github.com/dhensby/node-http-message-signatures/commit/0dcc198607a37853da72d4e66d3bb95dcde5a4ad))

## [1.0.8](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.7...v1.0.8) (2026-11-16)

### Bug Fixes

* **httpbis:** pass expires to key lookup and verifier as a Date ([63ddc9d](https://github.com/dhensby/node-http-message-signatures/commit/63ddc9d9a80e6ac36f463a22a9ea5b0a105f6f3f))

## [1.0.7](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.6...v1.0.7) (2026-11-16)

### Bug Fixes

* **httpbis:** combine results across signatures in verifyMessage ([8674794](https://github.com/dhensby/node-http-message-signatures/commit/86747942377f99cfe0c6d92c8b13b359d5287612))
* **httpbis:** make verifyMessage outcomes independent of signature order ([06d9ab4](https://github.com/dhensby/node-http-message-signatures/commit/06d9ab42e5d8ed23c32969c4e6602fb7b1819559))

## [1.0.6](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.5...v1.0.6) (2026-06-04)

### Bug Fixes

* inverted cavage expires field check ([3290205](https://github.com/dhensby/node-http-message-signatures/commit/32902052e688cdf241f27e7aa31c41afdedc8ec7))

## [1.0.5](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.4...v1.0.5) (2026-04-15)

### Bug Fixes

* migrate to ESLint flat config for ESLint 10 ([6c51a68](https://github.com/dhensby/node-http-message-signatures/commit/6c51a6816b1312380f0a1105ebdd0f3ebf7f96d8))

## [1.0.4](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.3...v1.0.4) (2024-01-16)


### Bug Fixes

* never sign empty set of fields ([fc9ff1f](https://github.com/dhensby/node-http-message-signatures/commit/fc9ff1fccd05b51bc1591afb50fb42728d12645e))

## [1.0.3](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.2...v1.0.3) (2024-01-16)


### Bug Fixes

* use undecoded `@path`, `@query` and `@query-param` according to the spec ([c086d9f](https://github.com/dhensby/node-http-message-signatures/commit/c086d9f7203bb34b9d33942f6e5f9a90fa1a4d11))

## [1.0.2](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.1...v1.0.2) (2024-01-15)


### Bug Fixes

* using specification algorithm for ECDSA signatures (IEEE-P1363 format) ([a1fb91c](https://github.com/dhensby/node-http-message-signatures/commit/a1fb91c8d590b6c15fc8a86fc2b1fa5f0e2ca834))

## [1.0.1](https://github.com/dhensby/node-http-message-signatures/compare/v1.0.0...v1.0.1) (2023-11-28)


### Bug Fixes

* remove spaces between comma separated values in the cavage signature header ([c2ef06f](https://github.com/dhensby/node-http-message-signatures/commit/c2ef06f075469704f54355ac3ae435cbcb660be5))
