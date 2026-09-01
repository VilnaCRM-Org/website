import '@testing-library/jest-dom';
// Registers `expect(...).toHaveNoViolations()` for the component-level
// accessibility gate (issue #317). It lives here rather than inside the a11y
// helper so the matcher is available to every client spec that renders UI,
// not only the ones that call `expectNoA11yViolations`.
import 'jest-axe/extend-expect';
import './i18n';
