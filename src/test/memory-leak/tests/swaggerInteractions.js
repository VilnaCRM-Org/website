import ScenarioBuilder from '../utils/ScenarioBuilder.js';
import safeClick from '../utils/safeClick.js';

const scenarioBuilder = new ScenarioBuilder('swagger');

async function setup(page) {
  await page.setRequestInterception(true);

  page.on('request', request => {
    const url = request.url();
    const method = request.method();

    if (method === 'OPTIONS') {
      return request.respond({
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
      });
    }

    if (url.includes('spec.yaml')) {
      const mockedResponse = {
        name: 'spec.yaml',
        path: '.github/openapi-spec/spec.yaml',
        content:
          'b3BlbmFwaTogMy4xLjAKaW5mbzoKICB0aXRsZTogJ01vY2tlZCBBUEknCiAgZGVzY3JpcHRpb246ICdUaGlzIGlzIGEgbW9ja2VkIEFQSSBmb3IgdGVzdGluZyBwdXJwb3Nlcy4nCiAgdmVyc2lvbjogMS4wLjAKc2VydmVyczoKICAtIHVybDogJ2h0dHBzOi8vbW9ja2VkLmFwaS5jb20nCiAgICBkZXNjcmlwdGlvbjogJ01vY2tlZCBBUEkgc2VydmVyJwpwYXRoczoKICAvYXBpL2hlYWx0aDoKICAgIGdldDoKICAgICAgb3BlcmF0aW9uSWQ6IGFwaV9oZWFsdGhfZ2V0CiAgICAgIHRhZ3M6CiAgICAgICAgLSBIZWFsdGhDaGVjawogICAgICBzdW1tYXJ5OiAnQ2hlY2sgQVBJIGhlYWx0aCBzdGF0dXMuJwogICAgICBkZXNjcmlwdGlvbjogJ1JldHVybnMgdGhlIGhlYWx0aCBzdGF0dXMgaW5kaWNhdG9yIG9mIHRoZSBhcGkuJwogICAgICByZXNwb25zZXM6CiAgICAgICAgJzIwMCc6CiAgICAgICAgICBkZXNjcmlwdGlvbjogJ0FQSSBpcyBoZWFsdGh5LicKICAgICAgICAgIGNvbnRlbnQ6CiAgICAgICAgICAgIGFwcGxpY2F0aW9uL2pzb246CiAgICAgICAgICAgICAgc2NoZW1hOgogICAgICAgICAgICAgICAgdHlwZTogb2JqZWN0CiAgICAgICAgICAgICAgICBwcm9wZXJ0aWVzOgogICAgICAgICAgICAgICAgICBzdGF0dXM6CiAgICAgICAgICAgICAgICAgIHR5cGU6IHN0cmluZwogICAgICAgICAgICAgICAgZXhhbXBsZToKICAgICAgICAgICAgICAgICAgc3RhdHVzOiAnaGVhbHRoeScKICAgICAgICAnNTAwJzoKICAgICAgICAgIGRlc2NyaXB0aW9uOiAnQVBJIGlzIHVuaGVhbHRoeS4nCiAgICAgICAgICBjb250ZW50OgogICAgICAgICAgICBhcHBsaWNhdGlvbi9qc29uOgogICAgICAgICAgICAgIHNjaGVtYToKICAgICAgICAgICAgICAgIHR5cGU6IG9iamVjdAogICAgICAgICAgICAgICAgcHJvcGVydGllczoKICAgICAgICAgICAgICAgICAgZXJyb3I6CiAgICAgICAgICAgICAgICAgICAgdHlwZTogc3RyaW5nCiAgICAgICAgICAgICAgICBleGFtcGxlOgogICAgICAgICAgICAgICAgICAgIGVycm9yOiAnaW50ZXJuYWxfc2VydmVyX2Vycm9yJw==',
        encoding: 'base64',
        size: 12345,
        type: 'file',
        sha: 'mockedsha123456789',
        url: 'https://api.github.com/repos/VilnaCRM-Org/user-service/contents/.github/openapi-spec/spec.yaml',
      };

      return request.respond({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, PATCH, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify(mockedResponse),
      });
    }

    return request.continue();
  });

  await page.goto(scenarioBuilder.url(), { waitUntil: 'networkidle0', timeout: 0 });

  const currentUrl = page.url();
  if (!currentUrl.includes('/swagger')) {
    throw new Error('Page was not redirected to /swagger as expected');
  }
}

async function disposeAll(handles) {
  await Promise.all(handles.filter(Boolean).map(handle => handle.dispose()));
}

async function forEachMatch(root, selector, visit) {
  const handles = await root.$$(selector);
  try {
    for (const handle of handles) {
      await visit(handle);
    }
  } finally {
    await disposeAll(handles);
  }
}

async function withMatch(root, selector, visit) {
  const handle = await root.$(selector);
  if (!handle) return;
  try {
    await visit(handle);
  } finally {
    await handle.dispose();
  }
}

async function waitForSwaggerUi(page) {
  const swaggerRoot = await page.waitForSelector('.swagger-ui');
  await disposeAll([swaggerRoot]);
}

async function selectMockedServer(page) {
  const serverSelects = await page.$$eval('#servers', elements => elements.length);
  if (serverSelects > 0) {
    await page.select('#servers', 'https://mocked.api.com');
  }
}

async function tryOutAndExecute(tryOutButton) {
  await safeClick(tryOutButton, 'button.btn.try-out__btn');

  const parentBlock = await tryOutButton.evaluateHandle(el => el.closest('.opblock'));
  let executeButton = null;
  try {
    executeButton = await parentBlock.waitForSelector('button.btn.execute.opblock-control__btn', {
      visible: true,
    });

    if (executeButton) {
      await safeClick(executeButton, 'button.btn.execute.opblock-control__btn');
    }
  } finally {
    await disposeAll([executeButton, parentBlock]);
  }
}

async function action(page) {
  await waitForSwaggerUi(page);

  await selectMockedServer(page);

  await forEachMatch(page, 'button.opblock-summary-control[aria-expanded="false"]', summaryButton =>
    safeClick(summaryButton, '.opblock-body')
  );

  await forEachMatch(page, 'button.btn.try-out__btn', tryOutAndExecute);

  await forEachMatch(page, '.opblock', async endpoint => {
    await endpoint.hover();

    await withMatch(endpoint, '.copy-to-clipboard button', copyButton =>
      safeClick(copyButton, '.copy-to-clipboard button')
    );
  });

  await page.$$eval('.response-col_status, .response-col_description', cells =>
    cells.map(cell => cell.textContent.trim())
  );
}

async function back(page) {
  await waitForSwaggerUi(page);

  await selectMockedServer(page);

  await forEachMatch(page, 'button[aria-expanded="true"]', expandedButton =>
    safeClick(expandedButton, 'button[aria-expanded="true"]')
  );

  await forEachMatch(page, '.opblock', async block => {
    await withMatch(block, '.opblock-summary-control', summaryButton =>
      safeClick(summaryButton, '.opblock-summary-control')
    );

    await withMatch(block, '.copy-to-clipboard button', copyButton =>
      safeClick(copyButton, '.copy-to-clipboard button')
    );

    await withMatch(block, '.response-col_status', async responseStatus => {
      const status = await responseStatus.evaluate(el => el.textContent);
      expect(status).toBe('200');
    });
  });
}

export default scenarioBuilder.createScenario({ setup, action, back });
