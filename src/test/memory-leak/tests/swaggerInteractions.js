const ScenarioBuilder = require('../utils/ScenarioBuilder');
const { error } = require('../../../../scripts/logger');

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
async function action(page) {
  await page.waitForSelector('.swagger-ui');

  const hasServers = await page.$('#servers');
  if (hasServers) {
    await page.select('#servers', 'https://mocked.api.com');
  }

  const buttons = await page.$$('button.opblock-summary-control[aria-expanded="false"]');

  for (const button of buttons) {
    const isConnected = await button.evaluate(el => el.isConnected);
    const isVisible = await button.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden'
      );
    });

    if (isConnected && isVisible) {
      try {
        await button.click();
        await page.waitForSelector('.opblock-body', { visible: true });
      } catch (err) {
        error('Failed to click button:', await button.evaluate(el => el.outerHTML), err);
      }
    }
  }

  const tryOutButtons = await page.$$('button.btn.try-out__btn');
  for (const button of tryOutButtons) {
    const isConnected = await button.evaluate(el => el.isConnected);
    const isVisible = await button.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden'
      );
    });

    if (isConnected && isVisible) {
      await button.click();
    }

    const parentBlock = await button.evaluateHandle(el => el.closest('.opblock'));
    const idAttribute = await parentBlock.evaluate(el => el.id);
    const allow404 = idAttribute === 'operations-OAuth-get_api_oauth_authorize';

    const executeButton = await parentBlock.waitForSelector(
      'button.btn.execute.opblock-control__btn',
      { visible: true }
    );

    if (executeButton) {
      const isButtonConnected = await executeButton.evaluate(el => el.isConnected);
      const isButtonVisible = await executeButton.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return (
          rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden'
        );
      });

      if (isButtonConnected && isButtonVisible) {
        await executeButton.click();

        await page.waitForResponse(response => {
          const status = response.status();
          return (status >= 200 && status < 300) || (allow404 && status === 404);
        });
      }
    }
    await parentBlock.dispose();
  }

  const endpoints = await page.$$('.opblock');
  for (const endpoint of endpoints) {
    await endpoint.hover();

    const copyButton = await endpoint.$('.copy-to-clipboard button');

    if (copyButton) {
      const isConnected = await copyButton.evaluate(el => el.isConnected);
      const isVisible = await copyButton.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return (
          rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden'
        );
      });

      if (isConnected && isVisible) {
        await copyButton.click();
      }
    }
  }
  const responseStatusElements = await page.$$('.response-col_status');
  const statuses = [];
  for (const statusElement of responseStatusElements) {
    const status = await statusElement.evaluate(el => el.textContent.trim());
    statuses.push(status);
  }
  const responseTexts = await page.$$('.response-col_description');
  const descriptions = [];
  for (const textElement of responseTexts) {
    const description = await textElement.evaluate(el => el.textContent.trim());
    descriptions.push(description);
  }
}

async function back(page) {
  await page.waitForSelector('.swagger-ui');

  const hasServers = await page.$('#servers');
  if (hasServers) {
    await page.select('#servers', 'https://mocked.api.com');
  }

  const expandedButtons = await page.$$('button[aria-expanded="true"]');
  for (const button of expandedButtons) {
    const isConnected = await button.evaluate(el => el.isConnected);
    const isVisible = await button.evaluate(el => {
      const rect = el.getBoundingClientRect();
      return (
        rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden'
      );
    });

    if (isConnected && isVisible) {
      await button.click();
    }
  }

  const operationBlocks = await page.$$('.opblock');

  for (const block of operationBlocks) {
    const summaryButton = await block.$('.opblock-summary-control');
    if (summaryButton) {
      const isConnected = await summaryButton.evaluate(el => el.isConnected);
      const isVisible = await summaryButton.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return (
          rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden'
        );
      });

      if (isConnected && isVisible) {
        await summaryButton.click();
      }
    }

    const copyButton = await block.$('.copy-to-clipboard button');
    if (copyButton) {
      const isConnected = await copyButton.evaluate(el => el.isConnected);
      const isVisible = await copyButton.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return (
          rect.width > 0 && rect.height > 0 && window.getComputedStyle(el).visibility !== 'hidden'
        );
      });

      if (isConnected && isVisible) {
        await copyButton.click();
      }
    }

    const responseStatus = await block.$('.response-col_status');
    if (responseStatus) {
      const status = await page.evaluate(el => el.textContent, responseStatus);
      expect(status).toBe('200');
    }
  }
}

module.exports = scenarioBuilder.createScenario({ setup, action, back });
