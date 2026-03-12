import { check } from 'k6';

export default class Utils {
  constructor() {
    const { protocol, host, port, params } = this.getConfig();

    this.baseUrl = `${protocol}://${host}:${port}`;
    this.params = params;
  }

  getConfig() {
    return this.loadConfigFile('config.json') || this.loadConfigFile('config.json.dist');
  }

  loadConfigFile(filename) {
    try {
      return JSON.parse(open(filename));
    } catch (error) {
      return error ? null : null;
    }
  }

  getBaseUrl() {
    return this.baseUrl;
  }

  getParams() {
    return this.params;
  }

  shouldExecuteScenario(variable) {
    return __ENV[variable];
  }

  checkResponse(response, checkName, checkFunction) {
    check(response, {
      [checkName]: res => checkFunction(res),
    });
  }
}
