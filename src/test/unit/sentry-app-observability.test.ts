import fs from 'node:fs';
import path from 'node:path';

import * as ts from 'typescript';

const REPO_ROOT = path.resolve(__dirname, '..', '..', '..');
const APP_PATH = path.join(REPO_ROOT, 'pages', '_app.tsx');

const SENTRY_MODULE = '@sentry/react';
const INIT_MEMBER = 'init';
const ERROR_BOUNDARY_MEMBER = 'ErrorBoundary';
const DSN_OPTION = 'dsn';
const ENABLED_OPTION = 'enabled';
const TRACES_SAMPLE_RATE_OPTION = 'tracesSampleRate';
const RELEASE_OPTION = 'release';
const ENVIRONMENT_OPTION = 'environment';
const BEFORE_SEND_OPTION = 'beforeSend';
const BEFORE_BREADCRUMB_OPTION = 'beforeBreadcrumb';
const DEFAULT_INTEGRATIONS_OPTION = 'defaultIntegrations';
const PINNED_OPTIONS = [
  DSN_OPTION,
  ENABLED_OPTION,
  TRACES_SAMPLE_RATE_OPTION,
  RELEASE_OPTION,
  ENVIRONMENT_OPTION,
  BEFORE_SEND_OPTION,
  BEFORE_BREADCRUMB_OPTION,
] as const;
const WRAPPED_COMPONENT_TAG = 'Component';
const BEFORE_CAPTURE_PROP = 'beforeCapture';
const ON_ERROR_PROP = 'onError';

interface AppObservabilityContract {
  dsn: string;
  enabledGuard: string;
  tracesSampleRate: string;
  release: string;
  environment: string;
  beforeSend: string;
  beforeBreadcrumb: string;
  componentUsageCount: number;
  componentWrappedCount: number;
  errorBoundaryCount: number;
  hasBeforeCapture: boolean;
  beforeCaptureCallbackName: string | undefined;
  hasOnError: boolean;
}

function sentryNamespaceOf(sourceFile: ts.SourceFile): string {
  for (const statement of sourceFile.statements) {
    const fromSentry =
      ts.isImportDeclaration(statement) &&
      ts.isStringLiteral(statement.moduleSpecifier) &&
      statement.moduleSpecifier.text === SENTRY_MODULE;
    const bindings = fromSentry ? statement.importClause?.namedBindings : undefined;
    if (bindings && ts.isNamespaceImport(bindings)) return bindings.name.text;
  }
  throw new Error(`import * as <namespace> from '${SENTRY_MODULE}' not found`);
}

function isNamespaceCall(
  node: ts.Node,
  namespace: string,
  member: string
): node is ts.CallExpression {
  if (!ts.isCallExpression(node) || !ts.isPropertyAccessExpression(node.expression)) return false;
  const { expression: target, name } = node.expression;
  return ts.isIdentifier(target) && target.text === namespace && name.text === member;
}

function isNamespaceTag(tag: ts.JsxTagNameExpression, namespace: string, member: string): boolean {
  return (
    ts.isPropertyAccessExpression(tag) &&
    ts.isIdentifier(tag.expression) &&
    tag.expression.text === namespace &&
    ts.isIdentifier(tag.name) &&
    tag.name.text === member
  );
}

function collectInitCalls(root: ts.Node, namespace: string): ts.CallExpression[] {
  const calls: ts.CallExpression[] = [];
  const visit = (node: ts.Node): void => {
    if (isNamespaceCall(node, namespace, INIT_MEMBER)) calls.push(node);
    ts.forEachChild(node, visit);
  };
  visit(root);
  return calls;
}

function optionsArgumentOf(call: ts.CallExpression): ts.ObjectLiteralExpression {
  const [argument] = call.arguments;
  if (argument && ts.isObjectLiteralExpression(argument)) return argument;
  throw new Error(`${call.expression.getText()}(…) is not called with an object literal`);
}

function staticPropertyNameOf(prop: ts.ObjectLiteralElementLike): string | undefined {
  const name = ts.isSpreadAssignment(prop) ? undefined : prop.name;
  return name && (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) ? name.text : undefined;
}

// `.find()` alone would stop at the FIRST property named `optionName`, so a later
// spread (`...overrides`) or a duplicate declaration of the same option — either of
// which can silently win at runtime — would never be reached and the gate would keep
// reporting the first, correct-looking value. Scan every property up front instead.
function assertNoOverridableOptions(
  initOptions: ts.ObjectLiteralExpression,
  optionNames: readonly string[]
): void {
  const seenOptionNames = new Set<string>();
  for (const prop of initOptions.properties) {
    if (ts.isSpreadAssignment(prop)) {
      throw new Error(
        `Sentry.init(…) options carry a spread element, "${optionNames.join('"/"')}" ` +
          'is not statically known'
      );
    }
    const name = staticPropertyNameOf(prop);
    if (name === undefined) {
      throw new Error(`${prop.getText()} is not a statically known property`);
    }
    if (optionNames.includes(name)) {
      if (seenOptionNames.has(name)) {
        throw new Error(`Sentry.init(…) declares "${name}" more than once`);
      }
      seenOptionNames.add(name);
    }
  }
}

// The route tag reads `event.request.url`, which only the SDK's default
// HttpContext integration fills in; overriding the defaults drops it silently.
function assertDefaultIntegrationsKept(initOptions: ts.ObjectLiteralExpression): void {
  const override = initOptions.properties.find(
    prop => staticPropertyNameOf(prop) === DEFAULT_INTEGRATIONS_OPTION
  );
  if (override !== undefined) {
    throw new Error(
      `Sentry.init(…) sets "${DEFAULT_INTEGRATIONS_OPTION}", which drops the HttpContext ` +
        'integration the route tag reads'
    );
  }
}

function initializerOf(initOptions: ts.ObjectLiteralExpression, optionName: string): ts.Expression {
  const prop = initOptions.properties.find(
    candidate => staticPropertyNameOf(candidate) === optionName
  );
  if (prop === undefined) {
    throw new Error(`Sentry.init(…) is missing the "${optionName}" option`);
  }
  if (!ts.isPropertyAssignment(prop)) {
    throw new Error(`${prop.getText()} is not a property assignment`);
  }
  return prop.initializer;
}

function booleanGuardOf(initOptions: ts.ObjectLiteralExpression): string {
  const value = initializerOf(initOptions, ENABLED_OPTION);
  const [guard, ...rest] = ts.isCallExpression(value) ? value.arguments : [];
  const isBooleanCall =
    ts.isCallExpression(value) &&
    ts.isIdentifier(value.expression) &&
    value.expression.text === 'Boolean' &&
    guard !== undefined &&
    rest.length === 0;
  if (!isBooleanCall) {
    throw new Error(`${ENABLED_OPTION}: ${value.getText()} is not Boolean(<dsn>)`);
  }
  return guard.getText();
}

function identifierValueOf(initOptions: ts.ObjectLiteralExpression, optionName: string): string {
  const prop = initOptions.properties.find(
    candidate => staticPropertyNameOf(candidate) === optionName
  );
  if (prop === undefined) {
    throw new Error(`Sentry.init(…) is missing the "${optionName}" option`);
  }
  const value = ts.isPropertyAssignment(prop) ? prop.initializer : undefined;
  if (value === undefined || !ts.isIdentifier(value)) {
    throw new Error(`${prop.getText()} is not a bare identifier`);
  }
  return value.text;
}

// The scrubbers must be the shared modules, not a same-named local identity function:
// resolve the identifier to the named import that binds it and report
// `<module>#<exported name>`, so the pinned value names what actually runs.
function importedBindingOf(sourceFile: ts.SourceFile, localName: string): string {
  for (const statement of sourceFile.statements) {
    const clause = ts.isImportDeclaration(statement) ? statement.importClause : undefined;
    const bindings = clause?.isTypeOnly ? undefined : clause?.namedBindings;
    const element =
      bindings && ts.isNamedImports(bindings)
        ? bindings.elements.find(candidate => candidate.name.text === localName)
        : undefined;
    if (element && ts.isImportDeclaration(statement) && !element.isTypeOnly) {
      const specifier = statement.moduleSpecifier;
      const moduleName = ts.isStringLiteral(specifier) ? specifier.text : specifier.getText();
      return `${moduleName}#${(element.propertyName ?? element.name).text}`;
    }
  }
  throw new Error(`"${localName}" is not bound by a named import`);
}

function resolverCallOf(
  sourceFile: ts.SourceFile,
  initOptions: ts.ObjectLiteralExpression,
  optionName: string
): string {
  const value = initializerOf(initOptions, optionName);
  if (!ts.isCallExpression(value) || !ts.isIdentifier(value.expression)) {
    throw new Error(`${optionName}: ${value.getText()} is not a call to an imported resolver`);
  }
  const args = value.arguments.map(argument => argument.getText()).join(', ');
  return `${importedBindingOf(sourceFile, value.expression.text)}(${args})`;
}

function jsxTagNameOf(node: ts.JsxElement | ts.JsxSelfClosingElement): ts.JsxTagNameExpression {
  return ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName;
}

function jsxAttributesOf(node: ts.JsxElement | ts.JsxSelfClosingElement): ts.JsxAttributes {
  return ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
}

function hasJsxAttribute(attributes: ts.JsxAttributes, name: string): boolean {
  return attributes.properties.some(
    property => ts.isJsxAttribute(property) && property.name.getText() === name
  );
}

// `beforeCapture={undefined}` (or `={null}`/`={false}`) satisfies a presence-only check
// while wiring up no crash tagging at all, so the initializer must actually resolve to a
// callback: an inline function, or a bare identifier other than the `undefined` global.
function beforeCaptureExpressionOf(attributes: ts.JsxAttributes): ts.Expression | undefined {
  const attribute = attributes.properties.find(
    (property): property is ts.JsxAttribute =>
      ts.isJsxAttribute(property) && property.name.getText() === BEFORE_CAPTURE_PROP
  );
  const initializer = attribute?.initializer;
  if (
    initializer !== undefined &&
    ts.isJsxExpression(initializer) &&
    initializer.expression !== undefined
  ) {
    return initializer.expression;
  }
  return undefined;
}

function isRealCallbackExpression(expression: ts.Expression): boolean {
  if (ts.isArrowFunction(expression) || ts.isFunctionExpression(expression)) return true;
  return ts.isIdentifier(expression) && expression.text !== 'undefined';
}

interface ComponentAndBoundaryUsage {
  componentUsageCount: number;
  componentWrappedCount: number;
  errorBoundaryCount: number;
  hasBeforeCapture: boolean;
  beforeCaptureCallbackName: string | undefined;
  hasOnError: boolean;
}

function analyzeComponentAndBoundaryUsage(
  sourceFile: ts.SourceFile,
  namespace: string
): ComponentAndBoundaryUsage {
  let componentUsageCount = 0;
  let componentWrappedCount = 0;
  let errorBoundaryCount = 0;
  let hasBeforeCapture = false;
  let beforeCaptureCallbackName: string | undefined;
  let hasOnError = false;

  const visit = (node: ts.Node, insideBoundary: boolean): void => {
    let nextInsideBoundary = insideBoundary;
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const tag = jsxTagNameOf(node);
      if (isNamespaceTag(tag, namespace, ERROR_BOUNDARY_MEMBER)) {
        nextInsideBoundary = true;
        errorBoundaryCount += 1;
        const attributes = jsxAttributesOf(node);
        const beforeCaptureExpression = beforeCaptureExpressionOf(attributes);
        if (
          beforeCaptureExpression !== undefined &&
          isRealCallbackExpression(beforeCaptureExpression)
        ) {
          hasBeforeCapture = true;
          beforeCaptureCallbackName = ts.isIdentifier(beforeCaptureExpression)
            ? beforeCaptureExpression.text
            : undefined;
        }
        if (hasJsxAttribute(attributes, ON_ERROR_PROP)) hasOnError = true;
      } else if (ts.isIdentifier(tag) && tag.text === WRAPPED_COMPONENT_TAG) {
        componentUsageCount += 1;
        if (insideBoundary) componentWrappedCount += 1;
      }
    }
    ts.forEachChild(node, child => visit(child, nextInsideBoundary));
  };

  visit(sourceFile, false);
  return {
    componentUsageCount,
    componentWrappedCount,
    errorBoundaryCount,
    hasBeforeCapture,
    beforeCaptureCallbackName,
    hasOnError,
  };
}

function readAppObservabilityContract(source: string): AppObservabilityContract {
  const sourceFile = ts.createSourceFile(
    '_app.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const namespace = sentryNamespaceOf(sourceFile);
  const inits = collectInitCalls(sourceFile, namespace);
  const init = inits.length === 1 ? inits[0] : undefined;
  if (!init) {
    throw new Error(
      `expected exactly one ${namespace}.${INIT_MEMBER}({ … }) call, found ${inits.length}`
    );
  }
  const initOptions = optionsArgumentOf(init);
  assertNoOverridableOptions(initOptions, PINNED_OPTIONS);
  assertDefaultIntegrationsKept(initOptions);
  const dsn = initializerOf(initOptions, DSN_OPTION).getText();
  const enabledGuard = booleanGuardOf(initOptions);
  const tracesSampleRate = resolverCallOf(sourceFile, initOptions, TRACES_SAMPLE_RATE_OPTION);
  const release = identifierValueOf(initOptions, RELEASE_OPTION);
  const environment = identifierValueOf(initOptions, ENVIRONMENT_OPTION);
  const beforeSend = importedBindingOf(
    sourceFile,
    identifierValueOf(initOptions, BEFORE_SEND_OPTION)
  );
  const beforeBreadcrumb = importedBindingOf(
    sourceFile,
    identifierValueOf(initOptions, BEFORE_BREADCRUMB_OPTION)
  );
  const {
    componentUsageCount,
    componentWrappedCount,
    errorBoundaryCount,
    hasBeforeCapture,
    beforeCaptureCallbackName,
    hasOnError,
  } = analyzeComponentAndBoundaryUsage(sourceFile, namespace);
  if (errorBoundaryCount !== 1) {
    throw new Error(
      `expected exactly one <${namespace}.${ERROR_BOUNDARY_MEMBER}> element, ` +
        `found ${errorBoundaryCount}`
    );
  }

  return {
    dsn,
    enabledGuard,
    tracesSampleRate,
    release,
    environment,
    beforeSend,
    beforeBreadcrumb,
    componentUsageCount,
    componentWrappedCount,
    errorBoundaryCount,
    hasBeforeCapture,
    beforeCaptureCallbackName,
    hasOnError,
  };
}

const readFile = (filePath: string): string => fs.readFileSync(filePath, 'utf-8');

describe('Sentry release/environment/error-boundary contract in pages/_app.tsx', () => {
  it('pins release/environment to the app-version config, wraps Component in the boundary', () => {
    const contract = readAppObservabilityContract(readFile(APP_PATH));

    expect(contract.release).toBe('APP_VERSION');
    expect(contract.environment).toBe('APP_ENVIRONMENT');
    expect(contract.componentUsageCount).toBeGreaterThan(0);
    expect(contract.componentWrappedCount).toBe(contract.componentUsageCount);
  });

  it('enables the SDK only when the DSN it is initialised with is non-empty', () => {
    const contract = readAppObservabilityContract(readFile(APP_PATH));

    expect(contract.dsn).toBe('env.NEXT_PUBLIC_SENTRY_DSN');
    expect(contract.enabledGuard).toBe(contract.dsn);
  });

  it('reads tracesSampleRate from the environment through the shared resolver', () => {
    const contract = readAppObservabilityContract(readFile(APP_PATH));

    expect(contract.tracesSampleRate).toBe(
      '@/lib/telemetry/traces-sample-rate#resolveTracesSampleRate' +
        '(env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE, APP_ENVIRONMENT)'
    );
  });

  it('scrubs every event and breadcrumb through the shared telemetry scrubbers', () => {
    const contract = readAppObservabilityContract(readFile(APP_PATH));

    expect(contract.beforeSend).toBe('@/lib/telemetry/scrub-event#scrubEvent');
    expect(contract.beforeBreadcrumb).toBe('@/lib/telemetry/scrub-breadcrumb#scrubBreadcrumb');
  });

  it('tags the boundary capture via beforeCapture, not a re-capturing onError', () => {
    // componentDidCatch calls captureReactException unconditionally, so an
    // onError sink would double-report every crash.
    const contract = readAppObservabilityContract(readFile(APP_PATH));

    expect(contract.errorBoundaryCount).toBe(1);
    expect(contract.hasBeforeCapture).toBe(true);
    expect(contract.beforeCaptureCallbackName).toBe('tagRenderCrash');
    expect(contract.hasOnError).toBe(false);
  });
});

describe('Sentry release/environment/error-boundary contract helpers', () => {
  const SENTRY_IMPORT = `import * as Sentry from '${SENTRY_MODULE}';`;
  const RESOLVER_IMPORT =
    "import { resolveTracesSampleRate } from '@/lib/telemetry/traces-sample-rate';";
  const SCRUBBER_IMPORTS = [
    "import { scrubEvent } from '@/lib/telemetry/scrub-event';",
    "import { scrubBreadcrumb } from '@/lib/telemetry/scrub-breadcrumb';",
  ].join('\n');
  const gatingOptions =
    'dsn: env.DSN, enabled: Boolean(env.DSN), ' +
    'tracesSampleRate: resolveTracesSampleRate(env.RATE, APP_ENVIRONMENT)';
  const buildInit = (
    extraOptions: string,
    imports = SCRUBBER_IMPORTS,
    gating = gatingOptions
  ): string =>
    `${SENTRY_IMPORT}\n${RESOLVER_IMPORT}\n${imports}\n` +
    `Sentry.init({ ${gating}, sendDefaultPii: false, ${extraOptions} });`;
  const scrubberOptions = 'beforeSend: scrubEvent, beforeBreadcrumb: scrubBreadcrumb';
  const identityOptions = 'release: APP_VERSION, environment: APP_ENVIRONMENT';
  const validOptions = `${identityOptions}, ${scrubberOptions}`;

  const buildTree = (initSource: string, jsx: string): string =>
    [initSource, `function MyApp() { return (${jsx}); }`].join('\n');

  const wrappedComponent = `
    <Layout>
      <Sentry.ErrorBoundary
        fallback={({ resetError }) => <ErrorFallback onRetry={resetError} />}
        beforeCapture={(scope) => { scope.setTags({ feature: 'app', action: 'render-crash' }); }}
      >
        <Component />
      </Sentry.ErrorBoundary>
    </Layout>
  `;

  describe('positive', () => {
    it('reads release/environment identifiers and a wrapped Component', () => {
      const source = buildTree(buildInit(validOptions), wrappedComponent);
      expect(readAppObservabilityContract(source)).toEqual({
        dsn: 'env.DSN',
        enabledGuard: 'env.DSN',
        tracesSampleRate:
          '@/lib/telemetry/traces-sample-rate#resolveTracesSampleRate(env.RATE, APP_ENVIRONMENT)',
        release: 'APP_VERSION',
        environment: 'APP_ENVIRONMENT',
        beforeSend: '@/lib/telemetry/scrub-event#scrubEvent',
        beforeBreadcrumb: '@/lib/telemetry/scrub-breadcrumb#scrubBreadcrumb',
        componentUsageCount: 1,
        componentWrappedCount: 1,
        errorBoundaryCount: 1,
        hasBeforeCapture: true,
        beforeCaptureCallbackName: undefined,
        hasOnError: false,
      });
    });

    it('follows a renamed namespace import instead of the identifier "Sentry"', () => {
      const source = [
        `import * as Monitoring from '${SENTRY_MODULE}';`,
        RESOLVER_IMPORT,
        SCRUBBER_IMPORTS,
        `Monitoring.init({ ${gatingOptions}, ${validOptions} });`,
        'function MyApp() { return (',
        '  <Monitoring.ErrorBoundary beforeCapture={tagRenderCrash}>',
        '    <Component />',
        '  </Monitoring.ErrorBoundary>',
        '); }',
      ].join('\n');
      expect(readAppObservabilityContract(source).componentWrappedCount).toBe(1);
    });
  });

  describe('negative — the contract is present but wrong', () => {
    it('reports a scrubber imported from a look-alike module and an aliased import', () => {
      const source = buildTree(
        buildInit(
          validOptions,
          [
            "import { passThrough as scrubEvent } from 'sentry-scrub-lookalike';",
            "import { scrubBreadcrumb } from '@/lib/telemetry/scrub-breadcrumb';",
          ].join('\n')
        ),
        wrappedComponent
      );
      expect(readAppObservabilityContract(source).beforeSend).toBe(
        'sentry-scrub-lookalike#passThrough'
      );
    });

    it('reports an enabled flag that gates on something other than the DSN', () => {
      const gating =
        'dsn: env.DSN, enabled: Boolean(env.OTHER), ' +
        'tracesSampleRate: resolveTracesSampleRate(env.RATE, APP_ENVIRONMENT)';
      const contract = readAppObservabilityContract(
        buildTree(buildInit(validOptions, SCRUBBER_IMPORTS, gating), wrappedComponent)
      );
      expect(contract.enabledGuard).toBe('env.OTHER');
      expect(contract.enabledGuard).not.toBe(contract.dsn);
    });

    it('reports a sample-rate resolver imported from a look-alike module', () => {
      const gating =
        'dsn: env.DSN, enabled: Boolean(env.DSN), ' +
        'tracesSampleRate: pickRate(env.RATE, APP_ENVIRONMENT)';
      const imports = `${SCRUBBER_IMPORTS}\nimport { pickRate } from 'rate-lookalike';`;
      const contract = readAppObservabilityContract(
        buildTree(buildInit(validOptions, imports, gating), wrappedComponent)
      );
      expect(contract.tracesSampleRate).toBe('rate-lookalike#pickRate(env.RATE, APP_ENVIRONMENT)');
    });

    it('reports a Component rendered outside the boundary as unwrapped', () => {
      const source = buildTree(
        buildInit(validOptions),
        '<Layout><Sentry.ErrorBoundary><Notification /></Sentry.ErrorBoundary>' +
          '<Component /></Layout>'
      );
      const contract = readAppObservabilityContract(source);
      expect(contract.componentUsageCount).toBe(1);
      expect(contract.componentWrappedCount).toBe(0);
    });

    it('reports onError on a boundary that re-captures (the double-event regression)', () => {
      const source = buildTree(
        buildInit(validOptions),
        `<Layout>
          <Sentry.ErrorBoundary
            fallback={({ resetError }) => <ErrorFallback onRetry={resetError} />}
            onError={reportRenderCrash}
          >
            <Component />
          </Sentry.ErrorBoundary>
        </Layout>`
      );
      const contract = readAppObservabilityContract(source);
      expect(contract.hasOnError).toBe(true);
    });

    it('reports beforeCapture absent when the boundary has no tagging callback', () => {
      const source = buildTree(
        buildInit(validOptions),
        '<Layout><Sentry.ErrorBoundary><Component /></Sentry.ErrorBoundary></Layout>'
      );
      const contract = readAppObservabilityContract(source);
      expect(contract.hasBeforeCapture).toBe(false);
    });

    it('reports beforeCapture absent when its value is the undefined identifier', () => {
      const source = buildTree(
        buildInit(validOptions),
        '<Layout><Sentry.ErrorBoundary beforeCapture={undefined}>' +
          '<Component /></Sentry.ErrorBoundary></Layout>'
      );
      const contract = readAppObservabilityContract(source);
      expect(contract.hasBeforeCapture).toBe(false);
      expect(contract.beforeCaptureCallbackName).toBeUndefined();
    });
  });

  describe('boundary — no page component rendered at all', () => {
    it('reports zero usages rather than throwing', () => {
      const source = buildTree(
        buildInit(validOptions),
        '<Layout><Sentry.ErrorBoundary /></Layout>'
      );
      const contract = readAppObservabilityContract(source);
      expect(contract.componentUsageCount).toBe(0);
      expect(contract.componentWrappedCount).toBe(0);
    });
  });

  describe('fail-closed — the contract cannot be read statically', () => {
    it('throws when release is missing', () => {
      const source = buildTree(
        buildInit(`environment: APP_ENVIRONMENT, ${scrubberOptions}`),
        wrappedComponent
      );
      expect(() => readAppObservabilityContract(source)).toThrow(/missing the "release" option/);
    });

    it('throws when environment is missing', () => {
      const source = buildTree(
        buildInit(`release: APP_VERSION, ${scrubberOptions}`),
        wrappedComponent
      );
      expect(() => readAppObservabilityContract(source)).toThrow(
        /missing the "environment" option/
      );
    });

    it('throws when release is a string literal instead of the imported identifier', () => {
      const source = buildTree(
        buildInit(`release: 'v1.0.0', environment: APP_ENVIRONMENT, ${scrubberOptions}`),
        wrappedComponent
      );
      expect(() => readAppObservabilityContract(source)).toThrow(/is not a bare identifier/);
    });

    it('throws on a computed option key, which could hide release or environment', () => {
      const source = buildTree(buildInit(`[key]: APP_VERSION, ${validOptions}`), wrappedComponent);
      expect(() => readAppObservabilityContract(source)).toThrow(/not a statically known property/);
    });

    it('throws when a later spread could override release or environment at runtime', () => {
      const source = buildTree(buildInit(`${validOptions}, ...overrides`), wrappedComponent);
      expect(() => readAppObservabilityContract(source)).toThrow(/spread element/);
    });

    it('throws when release or environment is declared more than once', () => {
      const source = buildTree(
        buildInit(`${validOptions}, release: SOME_OTHER_VERSION`),
        wrappedComponent
      );
      expect(() => readAppObservabilityContract(source)).toThrow(
        /declares "release" more than once/
      );
    });

    it('throws when beforeSend is removed from Sentry.init', () => {
      const source = buildTree(
        buildInit(`${identityOptions}, beforeBreadcrumb: scrubBreadcrumb`),
        wrappedComponent
      );
      expect(() => readAppObservabilityContract(source)).toThrow(/missing the "beforeSend" option/);
    });

    it('throws when beforeBreadcrumb is removed from Sentry.init', () => {
      const source = buildTree(
        buildInit(`${identityOptions}, beforeSend: scrubEvent`),
        wrappedComponent
      );
      expect(() => readAppObservabilityContract(source)).toThrow(
        /missing the "beforeBreadcrumb" option/
      );
    });

    it('throws when beforeSend is an inline callback the gate cannot trace', () => {
      const source = buildTree(
        buildInit(
          `${identityOptions}, beforeSend: event => event, beforeBreadcrumb: scrubBreadcrumb`
        ),
        wrappedComponent
      );
      expect(() => readAppObservabilityContract(source)).toThrow(/is not a bare identifier/);
    });

    it('throws when beforeSend names a local function instead of an import', () => {
      const source = buildTree(
        buildInit(validOptions, "import { scrubBreadcrumb } from '@/lib/telemetry/x';"),
        wrappedComponent
      );
      expect(() => readAppObservabilityContract(source)).toThrow(
        /"scrubEvent" is not bound by a named import/
      );
    });

    it('throws when the only binding of the scrubber is a type-only import', () => {
      const source = buildTree(
        buildInit(
          validOptions,
          [
            "import type { scrubEvent } from '@/lib/telemetry/scrub-event';",
            "import { scrubBreadcrumb } from '@/lib/telemetry/scrub-breadcrumb';",
          ].join('\n')
        ),
        wrappedComponent
      );
      expect(() => readAppObservabilityContract(source)).toThrow(/not bound by a named import/);
    });

    it('throws when beforeSend is declared twice, since the later one wins', () => {
      const source = buildTree(
        buildInit(`${validOptions}, beforeSend: passThrough`),
        wrappedComponent
      );
      expect(() => readAppObservabilityContract(source)).toThrow(
        /declares "beforeSend" more than once/
      );
    });

    it.each([
      ['a hardcoded enabled flag', 'enabled: true', /is not Boolean\(<dsn>\)/],
      ['an enabled flag with two arguments', 'enabled: Boolean(env.DSN, 1)', /not Boolean/],
      ['a hardcoded sample rate', 'tracesSampleRate: 0.1', /is not a call to an imported/],
      ['an inline sample-rate ternary', 'tracesSampleRate: prod ? 0.1 : 1', /is not a call/],
      ['a shorthand sample rate', 'tracesSampleRate', /is not a property assignment/],
    ])('throws on %s', (_label: string, override: string, expected: RegExp) => {
      const [name] = override.split(':') as [string];
      const gating = [
        'dsn: env.DSN',
        'enabled: Boolean(env.DSN)',
        'tracesSampleRate: resolveTracesSampleRate(env.RATE, APP_ENVIRONMENT)',
      ]
        .map(option => (option.startsWith(`${name}:`) ? override : option))
        .join(', ');
      const source = buildTree(buildInit(validOptions, SCRUBBER_IMPORTS, gating), wrappedComponent);
      expect(() => readAppObservabilityContract(source)).toThrow(expected);
    });

    it.each(['dsn', 'enabled', 'tracesSampleRate'])(
      'throws when %s is missing from Sentry.init',
      (option: string) => {
        const gating = gatingOptions
          .split(/, (?=\w+:)/)
          .filter(entry => !entry.startsWith(`${option}:`))
          .join(', ');
        const source = buildTree(
          buildInit(validOptions, SCRUBBER_IMPORTS, gating),
          wrappedComponent
        );
        expect(() => readAppObservabilityContract(source)).toThrow(
          new RegExp(`missing the "${option}" option`)
        );
      }
    );

    it.each([
      ['enabled', 'enabled: false'],
      ['tracesSampleRate', 'tracesSampleRate: 1'],
    ])('throws when %s is declared twice, since the later one wins', (option, duplicate) => {
      const source = buildTree(buildInit(`${validOptions}, ${duplicate}`), wrappedComponent);
      expect(() => readAppObservabilityContract(source)).toThrow(
        new RegExp(`declares "${option}" more than once`)
      );
    });

    it.each(['defaultIntegrations: false', 'defaultIntegrations: []', "'defaultIntegrations': []"])(
      'throws on %s, which drops the HttpContext integration the route tag reads',
      (override: string) => {
        const source = buildTree(buildInit(`${validOptions}, ${override}`), wrappedComponent);
        expect(() => readAppObservabilityContract(source)).toThrow(
          /sets "defaultIntegrations", which drops the HttpContext integration/
        );
      }
    );

    it('throws when Sentry.init is never called', () => {
      expect(() => readAppObservabilityContract(SENTRY_IMPORT)).toThrow(/exactly one Sentry\.init/);
    });

    it('throws when the @sentry/react namespace import is absent', () => {
      expect(() => readAppObservabilityContract('const x = 1;')).toThrow(/@sentry\/react/);
    });
  });
});
