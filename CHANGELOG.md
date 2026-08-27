# [1.7.0](https://github.com/VilnaCRM-Org/website/compare/v0.3.0...v1.7.0) (2026-08-27)


### Bug Fixes

* **#382:** harden the sign-up credential path (+[#378](https://github.com/VilnaCRM-Org/website/issues/378) transport, error leak, telemetry) ([#421](https://github.com/VilnaCRM-Org/website/issues/421)) ([06d1e3f](https://github.com/VilnaCRM-Org/website/commit/06d1e3fdcfb670b5780e56fd87e3c1c730604fae)), closes [#382](https://github.com/VilnaCRM-Org/website/issues/382)
* **#409:** make the weekly link check report only real dead links ([#430](https://github.com/VilnaCRM-Org/website/issues/430)) ([d21fb04](https://github.com/VilnaCRM-Org/website/commit/d21fb045552cb4d52884090f36e0eb125c89fd6c)), closes [#409](https://github.com/VilnaCRM-Org/website/issues/409)
* stabilize swagger network failure assertions ([#291](https://github.com/VilnaCRM-Org/website/issues/291)) ([0db70c1](https://github.com/VilnaCRM-Org/website/commit/0db70c10de1662464d88e8f7241087fe531fd6ef))
* stabilize swagger network failure assertions in CI ([#288](https://github.com/VilnaCRM-Org/website/issues/288)) ([0683cc7](https://github.com/VilnaCRM-Org/website/commit/0683cc72d2ed22ff70f530f740f7e2faa006718e))


### Features

* **#224:** enforce code complexity with rust-code-analysis CI gate ([#315](https://github.com/VilnaCRM-Org/website/issues/315)) ([ec1207f](https://github.com/VilnaCRM-Org/website/commit/ec1207f4480ae911171d67911acf61e16bf9f89a)), closes [#224](https://github.com/VilnaCRM-Org/website/issues/224)
* **#225:** enforce architecture boundaries with dependency-cruiser ([#313](https://github.com/VilnaCRM-Org/website/issues/313)) ([f449505](https://github.com/VilnaCRM-Org/website/commit/f44950510a7b8d21741205748747b4c7b6b15373)), closes [#225](https://github.com/VilnaCRM-Org/website/issues/225)
* **#328:** typed, validated config layer (implements [#212](https://github.com/VilnaCRM-Org/website/issues/212)) ([#342](https://github.com/VilnaCRM-Org/website/issues/342)) ([3e5540e](https://github.com/VilnaCRM-Org/website/commit/3e5540eabe0f8f504f2b2f68e66a08ce31175a02)), closes [#328](https://github.com/VilnaCRM-Org/website/issues/328)
* **#330:** unify Node and user-service pins, gate contracts, declare browserslist ([#389](https://github.com/VilnaCRM-Org/website/issues/389)) ([02ac2a7](https://github.com/VilnaCRM-Org/website/commit/02ac2a713fa75dcfb85622b3bdfca6df4f5dcbf0)), closes [#330](https://github.com/VilnaCRM-Org/website/issues/330)
* **#334:** TypeScript strictness, repo hygiene, pre-push/Storybook coverage (enterprise readiness) ([#408](https://github.com/VilnaCRM-Org/website/issues/408)) ([6db7813](https://github.com/VilnaCRM-Org/website/commit/6db78135a91beb10ea269209effd3a4617fec69c)), closes [#334](https://github.com/VilnaCRM-Org/website/issues/334)
* **#377:** enforce edge security headers on every production response ([#411](https://github.com/VilnaCRM-Org/website/issues/411)) ([4218374](https://github.com/VilnaCRM-Org/website/commit/42183745e6aac5f26675579c7a75815c087f7c49)), closes [#377](https://github.com/VilnaCRM-Org/website/issues/377)
* **deps:** bump dependencies within current major ranges ([#300](https://github.com/VilnaCRM-Org/website/issues/300)) ([092bdee](https://github.com/VilnaCRM-Org/website/commit/092bdeef9c77d74785e7d0f01aa526784ec4eb1c))


### Performance Improvements

* **#332:** Lighthouse gate + field web-vitals + font/image payload budgets ([#388](https://github.com/VilnaCRM-Org/website/issues/388)) ([41e0e7a](https://github.com/VilnaCRM-Org/website/commit/41e0e7a0e8c41e7cf721379e30b470eb305549d3)), closes [#332](https://github.com/VilnaCRM-Org/website/issues/332)



# [0.3.0](https://github.com/VilnaCRM-Org/website/compare/v0.2.13...v0.3.0) (2026-01-20)


### Features

* **deps:** bump the all-deps group across 1 directory with 70 updates ([#269](https://github.com/VilnaCRM-Org/website/issues/269)) ([895dd26](https://github.com/VilnaCRM-Org/website/commit/895dd26aef1ce1a00364334b8121294dea1dec9d))



## [0.2.13](https://github.com/VilnaCRM-Org/website/compare/v0.2.12...v0.2.13) (2025-12-17)


### Bug Fixes

* add home navigation via navbar logo ([#265](https://github.com/VilnaCRM-Org/website/issues/265)) ([40dd08a](https://github.com/VilnaCRM-Org/website/commit/40dd08a01d41b678b20f42b5e8854710f5dac145))



## [0.2.12](https://github.com/VilnaCRM-Org/website/compare/v0.2.11...v0.2.12) (2025-10-18)


### Bug Fixes

* **#253:** add public ecr usage into the dockerfiles ([#254](https://github.com/VilnaCRM-Org/website/issues/254)) ([259c1eb](https://github.com/VilnaCRM-Org/website/commit/259c1eba2a037f1f9e9a56997d058036a4837997)), closes [#253](https://github.com/VilnaCRM-Org/website/issues/253)



## [0.2.11](https://github.com/VilnaCRM-Org/website/compare/v0.2.10...v0.2.11) (2025-10-16)


### Bug Fixes

* **#251:** add public ecr usage to resolve 429 error in the Apollo.Dockerfile ([#252](https://github.com/VilnaCRM-Org/website/issues/252)) ([0319963](https://github.com/VilnaCRM-Org/website/commit/03199634edaee9132aead84e3d94305ff4ccb9aa))



