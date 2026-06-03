type Waitable = Promise<unknown> & { catch: jest.Mock };

type MockLogoHandle = {
  asElement: jest.Mock;
  click: jest.Mock;
  evaluate: jest.Mock;
};

type MockPage = {
  goBack: jest.Mock;
  waitForFunction?: jest.Mock;
  waitForNavigation: jest.Mock;
  waitForSelector: jest.Mock;
};

jest.mock('@next/env', () => ({
  __esModule: true,
  default: {
    loadEnvConfig: jest.fn(),
  },
}));

jest.mock('../memory-leak/utils/initializeLocalization.js', () => ({}));

jest.mock('i18next', () => ({
  __esModule: true,
  default: {
    getFixedT: jest.fn().mockReturnValue(jest.fn().mockReturnValue('Vilna logo')),
  },
}));

function createWaitable(): Waitable {
  const promise: Promise<null> = Promise.resolve(null);
  const waitable = promise as Waitable;

  waitable.catch = jest.fn().mockReturnValue(promise);

  return waitable;
}

function createLogoHandle(): MockLogoHandle {
  return {
    asElement: jest.fn(),
    click: jest.fn().mockResolvedValue(undefined),
    evaluate: jest
      .fn()
      .mockImplementation(async (callback: (element: { tagName: string }) => boolean) =>
        callback({ tagName: 'A' })
      ),
  };
}

function createPage(logoHandle: MockLogoHandle): MockPage {
  return {
    goBack: jest.fn().mockResolvedValue(null),
    waitForFunction: jest.fn().mockImplementation(() => createWaitable()),
    waitForNavigation: jest.fn().mockImplementation(() => createWaitable()),
    waitForSelector: jest.fn().mockResolvedValue({
      asElement: () => logoHandle,
    }),
  };
}

describe('logoNavigation memlab scenario', () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_API_BASE_URL = 'http://website-prod:3001';
    process.env.NEXT_PUBLIC_MAIN_LANGUAGE = 'en';
    process.env.NEXT_PUBLIC_FALLBACK_LANGUAGE = 'uk';
  });

  it('starts from the swagger route so the logo navigation has history to unwind', async () => {
    const scenarioModule = await import('../memory-leak/tests/logoNavigation.js');
    const scenario = scenarioModule.default;

    expect(scenario.url()).toBe('http://website-prod:3001/swagger');
  });

  it('clicks the header logo during the action step instead of using browser back', async () => {
    const scenarioModule = await import('../memory-leak/tests/logoNavigation.js');
    const scenario = scenarioModule.default;
    const logoHandle = createLogoHandle();
    const page = createPage(logoHandle);

    await scenario.action(page);

    expect(logoHandle.click).toHaveBeenCalledTimes(1);
    expect(page.goBack).not.toHaveBeenCalled();
  });

  it('waits for the target path with waitForFunction when that API is available', async () => {
    const scenarioModule = await import('../memory-leak/tests/logoNavigation.js');
    const scenario = scenarioModule.default;
    const logoHandle = createLogoHandle();
    const page = createPage(logoHandle);

    await scenario.action(page);

    expect(page.waitForFunction).toHaveBeenCalledWith(expect.any(Function), { timeout: 5000 }, '/');
    expect(page.waitForNavigation).not.toHaveBeenCalled();
  });
});
