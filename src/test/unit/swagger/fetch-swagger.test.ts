import { writeFile } from 'node:fs/promises';

const mockFetch: jest.Mock = jest.fn();
global.fetch = mockFetch;

const mockWriteFile: jest.MockedFunction<typeof writeFile> = jest.fn();
const mockExistsSync: jest.Mock = jest.fn();

jest.mock('dotenv/config', () => ({}), { virtual: true });
jest.mock('node:fs', () => ({
  existsSync: mockExistsSync,
}));
jest.mock('node:fs/promises', () => ({
  writeFile: mockWriteFile,
}));

jest.mock('js-yaml', () => ({
  load: jest.fn(() => ({ swagger: '2.0' })),
}));

interface JsYamlMock {
  load: jest.Mock;
}

const mockExit: jest.SpyInstance = jest.spyOn(process, 'exit').mockImplementation(() => {
  throw new Error('process.exit was called');
});
type SwaggerModule = {
  buildSpecUrl: () => string;
  fetchSwaggerYaml: (url: string) => Promise<string>;
  normalizeSpec: (node: unknown) => unknown;
  assertNoMarkup: (node: unknown, path?: string) => void;
  findMarkup: (value: string) => string | null;
  refreshSwaggerSchema: (url: string, filePath: string) => Promise<boolean>;
  saveSwaggerJson: (yamlText: string, filePath: string) => Promise<void>;
};

describe('swagger utils', () => {
  const version: string = 'v2.6.0';
  const expectedUrl: string = `https://raw.githubusercontent.com/VilnaCRM-Org/user-service/${version}/.github/openapi-spec/spec.yaml`;

  let buildSpecUrl: () => string;
  let fetchSwaggerYaml: (url: string) => Promise<string>;
  let normalizeSpec: (node: unknown) => unknown;
  let assertNoMarkup: (node: unknown, path?: string) => void;
  let findMarkup: (value: string) => string | null;
  let refreshSwaggerSchema: (url: string, filePath: string) => Promise<boolean>;
  let saveSwaggerJson: (yamlText: string, filePath: string) => Promise<void>;

  beforeAll(async () => {
    process.env.USER_SERVICE_VERSION = version;

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('swagger: "2.0"'),
    });

    const swaggerModule: SwaggerModule = await import('../../../../scripts/fetchSwaggerSchema.mjs');
    buildSpecUrl = swaggerModule.buildSpecUrl;
    fetchSwaggerYaml = swaggerModule.fetchSwaggerYaml;
    normalizeSpec = swaggerModule.normalizeSpec;
    assertNoMarkup = swaggerModule.assertNoMarkup;
    findMarkup = swaggerModule.findMarkup;
    refreshSwaggerSchema = swaggerModule.refreshSwaggerSchema;
    saveSwaggerJson = swaggerModule.saveSwaggerJson;
  });

  beforeEach(() => {
    mockFetch.mockClear();
    mockWriteFile.mockClear();
    mockExistsSync.mockClear();
    mockExistsSync.mockReturnValue(false);

    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('swagger: "2.0"'),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  afterAll(() => {
    delete process.env.USER_SERVICE_VERSION;
    mockExit.mockRestore();
  });

  test('buildSpecUrl returns correct URL', () => {
    const url: string = buildSpecUrl();
    expect(url).toBe(expectedUrl);
  });

  test('buildSpecUrl throws a clear error when USER_SERVICE_VERSION is unset', () => {
    delete process.env.USER_SERVICE_VERSION;
    try {
      expect(() => buildSpecUrl()).toThrow('USER_SERVICE_VERSION is not set');
    } finally {
      process.env.USER_SERVICE_VERSION = version;
    }
  });

  test('fetchSwaggerYaml returns text when response is ok', async () => {
    const mockText: string = 'swagger: "2.0"';
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(mockText),
    });

    const result: string = await fetchSwaggerYaml(expectedUrl);
    expect(result).toBe(mockText);
    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
  });

  test('fetchSwaggerYaml throws if response not ok', async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 404,
      statusText: 'Not Found',
    });

    await expect(fetchSwaggerYaml(expectedUrl)).rejects.toThrow(
      'Failed to fetch swagger schema. HTTP status: 404 Not Found'
    );
  });

  test('saveSwaggerJson writes parsed YAML to JSON file', async () => {
    const yamlText: string = 'swagger: "2.0"';
    const outputPath: string = './public/swagger-schema.json';

    await saveSwaggerJson(yamlText, outputPath);

    const jsYaml: JsYamlMock = jest.requireMock('js-yaml');
    expect(jsYaml.load).toHaveBeenCalledWith(yamlText);
    expect(mockWriteFile).toHaveBeenCalledWith(
      outputPath,
      `${JSON.stringify({ swagger: '2.0' }, null, 2)}\n`
    );
  });

  test('refreshSwaggerSchema writes the fetched document and reports success', async () => {
    await expect(
      refreshSwaggerSchema(expectedUrl, './contracts/user-service/openapi.json')
    ).resolves.toBe(true);

    expect(mockFetch).toHaveBeenCalledWith(expectedUrl);
    expect(mockWriteFile).toHaveBeenCalledWith(
      './contracts/user-service/openapi.json',
      `${JSON.stringify({ swagger: '2.0' }, null, 2)}\n`
    );
  });

  test('refreshSwaggerSchema rethrows fetch failures even when a local schema exists', async () => {
    mockExistsSync.mockReturnValue(true);
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(refreshSwaggerSchema(expectedUrl, './public/swagger-schema.json')).rejects.toThrow(
      'fetch failed'
    );

    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  test('refreshSwaggerSchema rethrows fetch failures when no local schema exists', async () => {
    mockExistsSync.mockReturnValue(false);
    mockFetch.mockRejectedValueOnce(new TypeError('fetch failed'));

    await expect(refreshSwaggerSchema(expectedUrl, './public/swagger-schema.json')).rejects.toThrow(
      'fetch failed'
    );
  });

  test('fetchSwaggerYaml throws if url is missing or invalid', async () => {
    // @ts-expect-error testing runtime type check
    await expect(fetchSwaggerYaml(undefined)).rejects.toThrow(
      'URL parameter is required and must be a string'
    );
    // @ts-expect-error testing runtime type check
    await expect(fetchSwaggerYaml(123)).rejects.toThrow(
      'URL parameter is required and must be a string'
    );
  });

  test('saveSwaggerJson throws if yamlText is missing or not a string', async () => {
    // @ts-expect-error testing runtime type check
    await expect(saveSwaggerJson(undefined, './swagger.json')).rejects.toThrow(
      'yamlText parameter is required and must be a string'
    );
    // @ts-expect-error testing runtime type check
    await expect(saveSwaggerJson(123, './swagger.json')).rejects.toThrow(
      'yamlText parameter is required and must be a string'
    );
  });

  test('normalizeSpec strips maxLength:null and format:null at every depth', () => {
    expect(
      normalizeSpec({
        type: 'string',
        maxLength: null,
        format: null,
        nested: { minLength: 1, format: null },
      })
    ).toEqual({ type: 'string', nested: { minLength: 1 } });
  });

  test('normalizeSpec preserves valid null-valued OpenAPI 3.1 metadata', () => {
    // default/example/const may legitimately be null in OpenAPI 3.1, and null is a
    // valid enum member. Only the invalid maxLength/format nulls are dropped.
    expect(
      normalizeSpec({
        default: null,
        example: null,
        const: null,
        enum: [null, 'a'],
        format: null,
      })
    ).toEqual({ default: null, example: null, const: null, enum: [null, 'a'] });
  });

  test('normalizeSpec recurses through arrays and keeps null elements', () => {
    expect(normalizeSpec([{ type: 'string', maxLength: null }, { type: 'integer' }, null])).toEqual(
      [{ type: 'string' }, { type: 'integer' }, null]
    );
  });

  test('normalizeSpec preserves falsy values and unrelated null keys', () => {
    expect(normalizeSpec({ zero: 0, empty: '', no: false, description: null })).toEqual({
      zero: 0,
      empty: '',
      no: false,
      description: null,
    });
  });

  test('normalizeSpec returns primitives unchanged', () => {
    expect(normalizeSpec('text')).toBe('text');
    expect(normalizeSpec(42)).toBe(42);
    expect(normalizeSpec(null)).toBeNull();
  });

  // #376 F1: the prose fields swagger-ui renders as markdown are the sink an
  // upstream compromise would use. The vendored document must be provably free of
  // markup, and the guard must never mangle legitimate spec prose.
  describe('assertNoMarkup', () => {
    test.each([
      ['description', { description: 'See <script>alert(1)</script>' }],
      ['title', { title: 'User <img src=x onerror=alert(1)>' }],
      [
        'nested description',
        { paths: { '/users': { get: { description: '<a href="#">x</a>' } } } },
      ],
      ['description inside an array', { servers: [{ description: '<b>prod</b>' }] }],
      ['externalDocs description', { externalDocs: { description: '<i>docs</i>' } }],
      ['summary', { summary: '<span>Create a user</span>' }],
      ['html comment', { description: 'ok <!-- injected' }],
      ['self-closing tag', { description: 'line<br/>break' }],
      ['an obsolete element', { description: 'legacy <acronym title="x">CRM</acronym>' }],
      ['a legacy nobr', { description: 'keep <nobr>together</nobr>' }],
    ])('rejects markup in a %s', (_label, doc) => {
      expect(() => assertNoMarkup(doc)).toThrow(/HTML markup/);
    });

    // The tag matcher is a module-level /g regex. `matchAll` clones it rather than
    // advancing `lastIndex`, but that is exactly the kind of thing that breaks
    // silently on the second document, so it is pinned here.
    test('gives the same answer however many times it is called', () => {
      const value: string = 'x <script>a</script> y';

      expect(findMarkup(value)).toBe('<script>');
      expect(findMarkup(value)).toBe('<script>');
      expect(findMarkup('a'.repeat(200))).toBeNull();
      expect(findMarkup('<i>y</i>')).toBe('<i>');
    });

    test('findMarkup returns null for prose with no element', () => {
      expect(findMarkup('Returns Array<User> when maxLength < 10')).toBeNull();
    });

    test('names the path of the offending field', () => {
      expect(() => assertNoMarkup({ paths: { '/users': { get: { title: '<b>x</b>' } } } })).toThrow(
        '$.paths./users.get.title'
      );
    });

    test.each([
      ['a comparison', 'maxLength < 10 and format > 0'],
      ['a placeholder in angle brackets', 'Pass <your token> in the Authorization header'],
      ['a bare less-than', 'value < limit'],
      ['a generic-looking type', 'Returns Array<User> ordered by id'],
      ['an email in angle brackets', 'Contact <support@vilnacrm.com>'],
    ])('accepts %s in prose', (_label, description) => {
      expect(() => assertNoMarkup({ description })).not.toThrow();
    });

    // There are deliberately NO payload carve-outs. OpenAPI reuses the same key
    // names for different things depending on the parent — `default` is a schema
    // keyword in a Schema Object but a RESPONSE KEY in a Responses Object, and
    // `example`/`value`/`summary` are keywords in some positions but user-chosen
    // names in `properties`, `$defs` and every `components.*` map. Three attempts
    // at carving out "payload" positions each closed one bypass and opened
    // another, so every string is now checked and there is nothing to bypass.
    test.each([
      [
        'a response keyed default',
        { paths: { '/u': { get: { responses: { default: { description: '<b>x</b>' } } } } } },
      ],
      [
        'a component named example',
        { components: { schemas: { example: { title: '<b>x</b>' } } } },
      ],
      [
        'a component named default',
        { components: { responses: { default: { description: '<i>x</i>' } } } },
      ],
      [
        'a property named value',
        { schema: { properties: { value: { description: '<b>x</b>' } } } },
      ],
      ['a property named example', { schema: { properties: { example: { title: '<i>x</i>' } } } }],
      ['an Example Object description', { examples: { ok: { description: '<b>bold</b>' } } }],
      ['an Example Object summary', { examples: { ok: { summary: '<script>x</script>' } } }],
      ['a schema example payload', { example: { description: 'Renders a <div> wrapper' } }],
      ['a 3.1 schema examples array', { schema: { examples: [{ description: '<b>p</b>' }] } }],
      ['a patternProperties entry', { patternProperties: { '^x': { description: '<b>x</b>' } } }],
      ['a $defs entry', { $defs: { A: { title: '<i>x</i>' } } }],
      ['a bare string inside an array', { tags: ['<script>x</script>'] }],
    ])('flags markup in %s', (_label, doc) => {
      expect(() => assertNoMarkup(doc)).toThrow(/HTML markup/);
    });

    // Keys are rendered too — a path name and a schema property name both appear
    // in the swagger UI — so "every string" has to include them.
    test.each([
      ['a path name', { paths: { '/users<img src=x onerror=alert(1)>': { get: {} } } }],
      ['a property name', { properties: { '<script>alert(1)</script>': { type: 'string' } } }],
      ['a component name', { components: { schemas: { '<iframe src=//x>': {} } } }],
    ])('flags markup in %s', (_label, doc) => {
      expect(() => assertNoMarkup(doc)).toThrow(/HTML markup in the key/);
    });

    test.each([
      ['a media type', { content: { 'application/json': { schema: {} } } }],
      ['a path template', { paths: { '/api/users/{id}': { get: {} } } }],
      ['a status code', { responses: { '200': { description: 'ok' } } }],
      ['a vendor extension', { 'x-vilna-internal': { note: 'fine' } }],
    ])('leaves an ordinary key alone: %s', (_label, doc) => {
      expect(() => assertNoMarkup(doc)).not.toThrow();
    });

    // A Markdown code fence or inline span escapes its contents, so markup written
    // inside one is displayed as text. `<code>` matters here in particular — it is
    // this service's OAuth parameter name.
    test.each([
      ['an inline code span', 'Send the `<code>` parameter'],
      ['a backticked generic', 'Returns `Array<Object>` ordered by id'],
      ['a fenced block', 'Example:\n\n```html\n<div>x</div>\n```'],
      ['a tilde fence', 'Example:\n\n~~~\n<script>x</script>\n~~~'],
      ['a double-backtick span', 'Use ``<b>`` for bold'],
    ])('accepts markup inside %s', (_label, description) => {
      expect(() => assertNoMarkup({ description })).not.toThrow();
    });

    // Markup is not the only way in: swagger-ui renders these fields as Markdown,
    // and `![](https://attacker.example/beacon.png)` loads a cross-origin request
    // from every visitor with no angle bracket and no interaction. Markdown LINKS
    // stay allowed — legitimate in a spec, they need a click, and they appear in
    // the reviewed `make update-contracts` diff.
    test.each([
      ['a bare image beacon', 'Users API.\n\n![](https://attacker.example/beacon.png)'],
      ['an image with alt text', '![diagram](https://attacker.example/x.png)'],
      ['a relative image', '![](./diagram.png)'],
    ])('rejects %s', (_label, description) => {
      expect(() => assertNoMarkup({ description })).toThrow(/HTML markup/);
    });

    test.each([
      ['a docs link', '[Get your API key](https://vilnacrm.com/login)'],
      ['a bare url', 'See https://docs.vilnacrm.com for details'],
      ['backticked image syntax', 'Write `![](url)` to embed an image'],
    ])('accepts %s', (_label, description) => {
      expect(() => assertNoMarkup({ description })).not.toThrow();
    });

    // An unclosed backtick is not a code span to a Markdown renderer either, so
    // it must not be usable to hide markup from the scan.
    test.each([
      ['an unclosed inline span', 'oops ` <script>x</script>'],
      ['an unclosed fence', 'Example:\n\n```html\n<script>x</script>'],
      ['markup outside a closed span', '`ok` and then <script>x</script>'],
    ])('still flags markup with %s', (_label, description) => {
      expect(() => assertNoMarkup({ description })).toThrow(/HTML markup/);
    });

    test.each([
      // Assembled rather than written inline: `no-script-url` rightly bans the
      // literal, and the point of the case is the scheme, not the payload.
      ['a javascript: url', `${['java', 'script'].join('')}:alert(1)`],
      ['a data: url', 'data:text/html;base64,PHNjcmlwdD4='],
      ['a file: url', 'file:///etc/passwd'],
      ['a protocol-relative url', '//attacker.example/docs'],
      ['a bare host', 'attacker.example'],
    ])('rejects %s in externalDocs', (_label, url) => {
      expect(() => assertNoMarkup({ externalDocs: { url } })).toThrow('non-http(s)');
    });

    // swagger-ui renders all of these as clickable anchors, so a guard that only
    // covered externalDocs left three doors open to the same sink.
    test.each([
      ['info.termsOfService', { info: { termsOfService: 'file:///etc/passwd' } }],
      ['info.contact.url', { info: { contact: { url: 'file:///etc/passwd' } } }],
      ['info.license.url', { info: { license: { url: 'file:///etc/passwd' } } }],
      ['a nested externalDocs', { paths: { '/u': { externalDocs: { url: 'file:///x' } } } }],
    ])('rejects a non-http(s) %s', (_label, doc) => {
      expect(() => assertNoMarkup(doc)).toThrow('non-http(s)');
    });

    test.each([
      ['info.termsOfService', { info: { termsOfService: 'https://vilnacrm.com/terms' } }],
      ['info.contact.url', { info: { contact: { url: 'https://vilnacrm.com' } } }],
      ['info.license.url', { info: { license: { url: 'http://spdx.org/licenses/MIT' } } }],
    ])('accepts an http(s) %s', (_label, doc) => {
      expect(() => assertNoMarkup(doc)).not.toThrow();
    });

    // Only strings are inspected: a non-string `url` is invalid OpenAPI that
    // spectral already reports, and it cannot be an href sink.
    test('walks past a non-string link field instead of rejecting it', () => {
      expect(() => assertNoMarkup({ externalDocs: { url: { $ref: '#/x' } } })).not.toThrow();
      expect(() => assertNoMarkup({ info: { termsOfService: 42 } })).not.toThrow();
    });

    // `servers[].url` is rewritten wholesale by patchSwaggerServer.mjs, is not
    // rendered as a link, and a relative server URL is legal OpenAPI.
    test.each([
      ['a container hostname', 'mockoon:8080'],
      ['a relative path', '/api/v1'],
      ['an empty string', ''],
    ])('leaves servers[].url alone when it is %s', (_label, url) => {
      expect(() => assertNoMarkup({ servers: [{ url }] })).not.toThrow();
    });

    // The link check is positional, so a bare `url` key elsewhere — a sample
    // payload, a vendor extension, a schema property that happens to be named
    // `url` — keeps its relative URI without tripping the scheme rule.
    test.each([
      ['termsOfService', { properties: { termsOfService: { type: 'string' } } }],
      ['contact', { properties: { contact: { properties: { url: { type: 'string' } } } } }],
      ['license', { properties: { license: { type: 'string', pattern: 'MIT' } } }],
      ['a relative url in a sample payload', { example: { url: '/api/users/a1b2' } }],
      ['a relative url in a vendor extension', { 'x-links': { url: '/errors/500' } }],
      ['a urn in an example', { examples: { a: { value: { url: 'urn:vilna:user:1' } } } }],
    ])('does not link-check %s', (_label, doc) => {
      expect(() => assertNoMarkup(doc)).not.toThrow();
    });

    test('accepts an https externalDocs url', () => {
      expect(() =>
        assertNoMarkup({ externalDocs: { url: 'https://docs.vilnacrm.com' } })
      ).not.toThrow();
    });

    test.each([
      ['primitives', 'text'],
      ['null', null],
      ['numbers', 42],
    ])('walks past %s without throwing', (_label, node) => {
      expect(() => assertNoMarkup(node)).not.toThrow();
    });

    test('accepts the committed contract as it stands today', () => {
      // Guards the guard: if this ever fails, the vendored spec gained markup and
      // the `make update-contracts` diff needs a human read, not a looser regex.
      const committed: unknown = JSON.parse(
        jest
          .requireActual<typeof import('node:fs')>('node:fs')
          .readFileSync('contracts/user-service/openapi.json', 'utf8')
      );

      expect(() => assertNoMarkup(committed)).not.toThrow();
    });
  });

  test('saveSwaggerJson refuses to vendor a document carrying markup', async () => {
    const jsYaml: JsYamlMock = jest.requireMock('js-yaml');
    jsYaml.load.mockReturnValueOnce({ info: { description: '<script>alert(1)</script>' } });

    await expect(saveSwaggerJson('info: {}', './public/swagger-schema.json')).rejects.toThrow(
      /HTML markup/
    );
    expect(mockWriteFile).not.toHaveBeenCalled();
  });

  test('saveSwaggerJson throws if filePath is missing or not a string', async () => {
    // @ts-expect-error testing runtime type check
    await expect(saveSwaggerJson('yamlText', undefined)).rejects.toThrow(
      'filePath parameter is required and must be a string'
    );
    // @ts-expect-error testing runtime type check
    await expect(saveSwaggerJson('yamlText', 123)).rejects.toThrow(
      'filePath parameter is required and must be a string'
    );
  });
});
