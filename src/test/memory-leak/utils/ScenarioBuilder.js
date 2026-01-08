import { scenario } from '@memlab/core';
import { loadEnvConfig } from '@next/env';

loadEnvConfig(process.cwd());

class ScenarioBuilder {
  constructor(path) {
    this.path = path;
    this.url = () => {
      const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL;
      return this.path ? `${baseUrl}/${this.path}` : baseUrl;
    };
    this.beforeInitialPageLoad = async page => {
      await page.setExtraHTTPHeaders({
        [`aws-cf-cd-${process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_NAME}`]:
          process.env.NEXT_PUBLIC_CONTINUOUS_DEPLOYMENT_HEADER_VALUE,
      });
    };
  }

  createScenario(scenarioOptions) {
    return scenario({
      url: this.url,
      beforeInitialPageLoad: this.beforeInitialPageLoad,
      ...scenarioOptions,
    });
  }
}

export default ScenarioBuilder;
