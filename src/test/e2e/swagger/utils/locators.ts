interface Locators {
  parametersSection: string;
  requestBodySection: string;
  jsonEditor: string;
  responseBody: string;
  curl: string;
  copyButton: string;
  downloadButton: string;
  requestUrl: string;
  responseError: string;
  responseStatus: string;
  validationErrors: string;
  idSelect: string;
  contentTypeSelect: string;
}

export const locators: Readonly<Locators> = {
  parametersSection: '.parameters-container',
  requestBodySection: '.opblock-section-request-body',
  jsonEditor: '.body-param__text',
  responseBody: '.response-col_description .microlight',
  curl: '.curl.microlight',
  copyButton: 'div.curl-command .copy-to-clipboard button',
  downloadButton: '.response-col_description .highlight-code button.download-contents',
  requestUrl: '.request-url .microlight',
  contentTypeSelect: 'select[aria-label="Request content type"]',

  responseError: '.responses-table.live-responses-table .response .response-col_description',
  responseStatus: '.responses-table.live-responses-table .response .response-col_status',
  validationErrors: '.validation-errors.errors-wrapper li',

  idSelect: 'tr[data-param-name="id"] select',
};
