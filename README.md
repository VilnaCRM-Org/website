[![SWUbanner](./public/supportUkraine.svg)](https://supportukrainenow.org/)

# Template for modern SSR applications

[![CodeScene Code Health](https://codescene.io/projects/43861/status-badges/code-health)](https://codescene.io/projects/43861)
[![CodeScene System Mastery](https://codescene.io/projects/43861/status-badges/system-mastery)](https://codescene.io/projects/43861)
[![codecov](https://codecov.io/gh/VilnaCRM-Org/frontend-ssr-template/graph/badge.svg?token=MPFDUSMZ2I)](https://codecov.io/gh/VilnaCRM-Org/frontend-ssr-template)

## Possibilities

- A modern JavaScript-based stack for services: [React](https://react.dev/), [Next.js](https://nextjs.org/).
- Extensive CI checks (including security checks, code style fixing, static linters, DeepScan, and Snyk)
  ensure the highest code quality.
- Configured testing tools: [Playwright](https://playwright.dev/), [Jest](https://jestjs.io/).
- This template is based on [bulletproof-react](https://github.com/alan2207/bulletproof-react/tree/master),
  but has been adapted to meet the specific needs of this project and may differ from the original implementation.
- Much more!

## Why you might need it

Many front-end developers need to create new projects from scratch and spend a lot of time.

We decided to simplify this exhausting process and create a public template for modern
front-end applications. This template is used for all our microservices in VilnaCRM.

## License

This software is distributed under the
[Creative Commons Zero v1.0 Universal](https://creativecommons.org/publicdomain/zero/1.0/deed) license.
Please read [LICENSE](https://github.com/VilnaCRM-Org/frontend-ssr-template/blob/main/LICENSE) for information
on the software availability and distribution.

### Minimal installation

Clone the repository locally or use GitHub’s `Use this template` feature.

Install [Node.js](https://nodejs.org/en/) version 20 or higher.

Use `make install` to install all dependencies and `make start` to run the application.

## Usage

We recommend installing
[docker](https://docs.docker.com/engine/install/) and
[docker compose](https://docs.docker.com/compose/install/)
to have the same setup across dev, sandbox and production environments.

To view all available commands, run `make help`:

```bash
  make help
```

The following commands are available when the project is installed locally.

General
```bash
  make start: starts the application
  make build: builds the application
  make format: formats the codebase to ensure consistent style across all files
  make update: updates node modules according to the current package.json file
  make install: installs node modules according to the current pnpm-lock.yaml file
  make check-node-version: checks if the correct Node.js version is installed
```

Linting & Formatting
```bash
  make lint-next: lints the codebase using Next.js rules
  make lint-tsc: runs static type checking with TypeScript
  make lint-md: lints all markdown files (excluding CHANGELOG.md) using markdownlint
```

Testing
```bash
  make test-unit: runs unit tests locally without using Docker
  make test-unit-all: runs unit tests for both client and server environments
  make test-unit-client: runs unit tests for the client using Jest
  make test-unit-server: runs unit tests for the server using Jest
  make test-memory-leak: runs memory leak tests using Memlab
  make test-e2e: runs end-to-end tests inside the prod container
  make test-e2e-ui: runs end-to-end tests with UI inside the prod container
  make test-visual: runs visual tests inside the prod container
  make test-visual-ui: runs visual tests with UI inside the prod container
```

Lighthouse
```bash
  make lighthouse-desktop: runs Lighthouse audits in desktop mode
  make lighthouse-mobile: runs Lighthouse audits in mobile mode
```

Git
```bash
  make git-hooks-install: installs husky Git hooks locally
```

Storybook
```bash
  make storybook-start: starts Storybook UI
  make storybook-build: builds Storybook UI
```

Load Testing
```bash
  make load-tests: executes load tests using the K6 library
  make build-k6-docker: builds a Docker image for K6
```

Docker
```bash
  make down: stops the Docker hub
  make stop: stops Docker
  make start-prod: builds image and starts the container in production mode
  make ps: logs into the Docker container
  make sh: logs into the Docker container
  make logs: shows all logs
  make new-logs: shows live logs of the dev container
  make wait-for-prod: waits for the prod service to be ready on port 3001
```

Note: The following commands do not require the `CI=1` prefix:
```bash
  make test-e2e: runs end-to-end tests inside the prod container
  make test-visual: runs visual tests inside the prod container
  make test-e2e-ui: runs end-to-end tests with UI inside the prod container
  make test-visual-ui: runs visual tests with UI inside the prod container
  
  make git-hooks-install: installs husky Git hooks locally
```

💡 Tip: To run commands locally without Docker, please prefix each command with CI=1.
Example:

```bash
  CI=1 make start
```

## Routing

This project includes a routing script for managing URLs.
The routing script maps requests to the correct HTML files, ensuring proper navigation.
For detailed information, check the [routing script](scripts/cloudfront_routing.js).

### How It Works

- Mapping: Specific URL paths are mapped to corresponding HTML files.
- Fallback Logic: For undefined routes, the script appends /index.html to handle directory-like paths.
- Error Handling: If an error occurs, the script logs it and returns the original request.

This routing logic is useful for SSR (Server-Side Rendered) applications,
particularly when hosted on platforms like AWS CloudFront.

## Documentation

Start reading at the [GitHub wiki](https://github.com/VilnaCRM-Org/frontend-ssr-template/wiki).
If you're having trouble, head for
[the troubleshooting guide](https://github.com/VilnaCRM-Org/frontend-ssr-template/wiki/Troubleshooting)
as it's frequently updated.

You can generate complete API-level documentation by running `doc` in the top-level
folder, and documentation will appear in the `docs` folder, though you'll need to have
[API-Extractor](https://api-extractor.com/) installed.

If the documentation doesn't cover what you need, search the
[many questions on Stack Overflow](http://stackoverflow.com/questions/tagged/vilnacrm),
and before you ask a question,
[read the troubleshooting guide](https://github.com/VilnaCRM-Org/frontend-ssr-template/wiki/Troubleshooting).

## Tests

[Tests](https://github.com/VilnaCRM-Org/frontend-ssr-template/actions)

If this isn't passing, is there something you can do to help?

## Security

Please disclose any vulnerabilities found responsibly – report security issues to the maintainers privately.

See
[SECURITY](https://github.com/VilnaCRM-Org/frontend-ssr-template/tree/main/SECURITY.md)
and
[Security advisories on GitHub](https://github.com/VilnaCRM-Org/frontend-ssr-template/security).

## Contributing

Please submit bug reports, suggestions, and pull requests to the
[GitHub issue tracker](https://github.com/VilnaCRM-Org/frontend-ssr-template/issues).

We're particularly interested in fixing edge cases, expanding test coverage,
and updating translations.

If you found a mistake in the docs, or want to add something, go ahead and
amend the wiki – anyone can edit it.

## Sponsorship

Development time and resources for this repository are provided by
[VilnaCRM](https://vilnacrm.com/),
the free and opensource CRM system.

Donations are very welcome, whether in beer 🍺, T-shirts 👕, or cold, hard cash 💰.
Sponsorship through GitHub is a simple and convenient way to say "thank you" to
maintainers and contributors – just click the "Sponsor" button
[on the project page](https://github.com/VilnaCRM-Org/frontend-ssr-template).
If your company uses this template, consider taking part in the VilnaCRM's enterprise support program.

## Changelog

See [changelog](CHANGELOG.md).
