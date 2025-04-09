[![SWUbanner](./public/supportUkraine.svg)](https://supportukrainenow.org/)

# Template for modern SSR applications

[![CodeScene Code Health](https://codescene.io/projects/43861/status-badges/code-health)](https://codescene.io/projects/43861)
[![CodeScene System Mastery](https://codescene.io/projects/43861/status-badges/system-mastery)](https://codescene.io/projects/43861)
[![codecov](https://codecov.io/gh/VilnaCRM-Org/frontend-ssr-template/graph/badge.svg?token=MPFDUSMZ2I)](https://codecov.io/gh/VilnaCRM-Org/frontend-ssr-template)

## Possibilities

- Modern JavaScript stack for services: [React](https://react.dev/), [Next.js](https://nextjs.org/)
- A lot of CI checks to ensure the highest code quality that can be
  (Security checks, Code style fixer, static linters, DeepScan, Snyk)
- Configured testing tools: [Playwright](https://playwright.dev/), [Jest](https://jestjs.io/)
- This template is based on [bulletproof-react](https://github.com/alan2207/bulletproof-react/tree/master).
  There may be differences from the original implementation,
  as it has been adapted to fit specific project needs
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

You can clone this repository locally or use GitHub functionality "Use this template"

Install [node.js](https://nodejs.org/en/) 20 version or higher and [pnpm](https://pnpm.io/)

Use pnpm install for installing all dependencies and pnpm run dev for running application

## Usage

We recommend to install
[docker](https://docs.docker.com/engine/install/) and
[docker compose](https://docs.docker.com/compose/install/)
to have the same setup across dev, sandbox and production environments

To see the list of available commands, run the following make command:

```bash
  make help
```

The list of possibilities if project installed locally

Run commands in the dev Docker container:

```bash
  make start - starts the application in dev container
  make build - build the application
  make format - formats the codebase to ensure consistent style across all files.
  make lint-next - static next lint
  make lint-tsc - static TypeScript lint
  make lint-md - Lints all Markdown files (excluding CHANGELOG.md) using markdownlint
  
  
  
pnpm test:e2e - end-to-end testing
pnpm test:e2e:local - open GUI with list of end-to-end test
pnpm test:unit - unit testing
pnpm lighthouse:desktop - lighthouse desktop testing
pnpm lighthouse:mobile - lighthouse mobile tesitng
```

💡 Tip: Tip: To run commands locally without Docker, please prefix each command with CI=1.
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
