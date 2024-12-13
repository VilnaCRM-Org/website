const ScenarioBuilder = require('../utils/ScenarioBuilder');

const scenarioBuilder = new ScenarioBuilder('swagger');

async function setup(page) {
  page.on('request', request => {
    if (request.url().includes('spec.yaml')) {
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

      request.respond({
        status: 200,
        contentType: 'application/json',
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
          'Access-Control-Allow-Headers': '*',
        },
        body: JSON.stringify(mockedResponse),
      });
    }
  });
}

async function action(page) {
  await page.click('button.opblock-summary-control[aria-expanded="false"]');

  await page.waitForSelector('button.btn.try-out__btn', { visible: true });
  await page.click('button.btn.try-out__btn');

  await page.waitForSelector('button.btn.execute.opblock-control__btn', { visible: true });
  await page.click('button.btn.execute.opblock-control__btn');

  await page.waitForSelector('.swagger-ui');

  await page.select('#servers', 'https://mocked.api.com');

  const operationButtons = await page.$$('.opblock-summary');
  for (const button of operationButtons) {
    await button.click();
    await page.waitForTimeout(500);
  }

  const executeButtons = await page.$$('.opblock-control');
  for (const button of executeButtons) {
    await button.click();
    await page.waitForTimeout(1000);
  }

  const curlButtons = await page.$$('.copy-to-clipboard');
  for (const button of curlButtons) {
    await button.click();
    await page.waitForTimeout(500);
  }

  const responseStatusElements = await page.$$('.response-col_status');
  for (const statusElement of responseStatusElements) {
    await statusElement.evaluate(el => el.textContent);
  }

  const responseTexts = await page.$$('.response-col_description');
  for (const textElement of responseTexts) {
    await textElement.evaluate(el => el.textContent);
  }
}

async function back(page) {
  await page.waitForSelector('.swagger-ui');

  await page.select('#servers', 'https://mocked.api.com');
  await page.click('button[aria-expanded="true"]');

  await page.click('.opblock-summary-control');

  await page.click('.copy-to-clipboard button');

  await page.waitForSelector('.responses-table');
  await page.$eval('.response-col_status', el => el.textContent);
}

module.exports = scenarioBuilder.createScenario({ setup, action, back });
