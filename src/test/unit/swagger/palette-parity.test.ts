/**
 * @jest-environment node
 *
 * Locale / responsive / a11y — Not applicable: a source-level parity check between two
 * palette declarations; contrast itself is gated by the axe route scan.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import * as sass from 'sass';

import colorTheme from '../../../components/ui-color-theme';

const COLORS_PARTIAL: string = path.join(
  process.cwd(),
  'src/features/swagger/components/api-documentation/global/variables/colors/_colors.scss'
);

const SCSS_ONLY_TOKENS: readonly string[] = [
  'accept',
  'patch',
  'errorBorder',
  'errorBackground',
  'backdropBackgroundWithBlur',
  'backdropBackgroundWithoutBlur',
  'shadowDarkGreyOpacity',
  'selectShadow',
];

const THEME_ALIASES: Readonly<Record<string, string>> = { brandGrey: 'brandGray' };

const PALETTE_URL = 'palette:colors';

type Palette = Map<string, string>;

function stringArgument(args: sass.Value[], index: number, name: string): string {
  const argument = args[index];
  if (argument === undefined) throw new Error(`collect() was called without $${name}`);
  return argument.assertString(name).text;
}

function collectColors(entries: string, source: string = ''): Palette {
  const colors: Palette = new Map();
  sass.compileString(
    `@use 'sass:color';\n@use 'sass:meta';\n${entries}\n` +
      `@each $name, $value in $entries { $_: collect($name, color.ie-hex-str($value)); }`,
    {
      importers: [
        {
          canonicalize: url => (url === PALETTE_URL ? new URL(url) : null),
          load: () => ({ contents: source, syntax: 'scss' }),
        },
      ],
      functions: {
        'collect($name, $value)': args => {
          colors.set(stringArgument(args, 0, 'name'), stringArgument(args, 1, 'value'));
          return sass.sassNull;
        },
      },
    }
  );
  return colors;
}

function scssPalette(source: string): Palette {
  return collectColors(
    `@use '${PALETTE_URL}' as palette;\n$entries: meta.module-variables('palette');`,
    source
  );
}

function themeMain(key: string): string | undefined {
  const entry = (colorTheme.palette as unknown as Record<string, { main?: unknown } | undefined>)[
    key
  ];
  return typeof entry?.main === 'string' ? entry.main : undefined;
}

function themePalette(keys: readonly string[]): Palette {
  const pairs = keys.flatMap(key => {
    const main = themeMain(key);
    return main === undefined ? [] : [`'${key}': ${main}`];
  });
  return collectColors(`$entries: (${pairs.join(', ')});`);
}

function themeKeyFor(token: string): string {
  return THEME_ALIASES[token] ?? token;
}

function scssOnlyProblems(scss: Palette, theme: Palette): string[] {
  return SCSS_ONLY_TOKENS.flatMap(token => {
    if (!scss.has(token)) return [`$${token} is listed as SCSS-only but is not declared`];
    if (theme.has(themeKeyFor(token)))
      return [`$${token} is listed as SCSS-only but the theme declares it`];
    return [];
  });
}

function mappedProblems(scss: Palette, theme: Palette): string[] {
  return [...scss].flatMap(([token, value]) => {
    if (SCSS_ONLY_TOKENS.includes(token)) return [];
    const themeValue = theme.get(themeKeyFor(token));
    if (themeValue === undefined)
      return [`$${token} has no theme counterpart and is not listed as SCSS-only`];
    if (themeValue !== value)
      return [`$${token} is ${value} in SCSS but ${themeValue} in the theme`];
    return [];
  });
}

function paletteDrift(source: string): string[] {
  const scss = scssPalette(source);
  const theme = themePalette([...scss.keys()].map(themeKeyFor));
  return [...scssOnlyProblems(scss, theme), ...mappedProblems(scss, theme)];
}

const committedSource: string = readFileSync(COLORS_PARTIAL, 'utf8');

function withDeclaration(token: string, value: string): string {
  const declaration = new RegExp(`^\\$${token}:.*$`, 'm');
  expect(committedSource).toMatch(declaration);
  return committedSource.replace(declaration, () => `$${token}: ${value};`);
}

describe('swagger SCSS palette parity with the theme palette', () => {
  it('holds every shared token to the theme value', () => {
    expect(paletteDrift(committedSource)).toEqual([]);
  });

  it('compares colours, not spellings', () => {
    expect(scssPalette('$white: #fff;')).toEqual(collectColors("$entries: ('white': #FFFFFF);"));
  });

  it('reports a shared token whose value drifted', () => {
    expect(paletteDrift(withDeclaration('primary', '#1eaefe'))).toEqual([
      '$primary is #FF1EAEFE in SCSS but #FF1EAEFF in the theme',
    ]);
  });

  it('reports drift behind the brandGrey / brandGray alias', () => {
    expect(paletteDrift(withDeclaration('brandGrey', '#e1e7eb'))).toEqual([
      '$brandGrey is #FFE1E7EB in SCSS but #FFE1E7EA in the theme',
    ]);
  });

  it('reports a new SCSS token that is neither mapped nor listed', () => {
    expect(paletteDrift(`${committedSource}\n$tooltipBorder: #123456;\n`)).toEqual([
      '$tooltipBorder has no theme counterpart and is not listed as SCSS-only',
    ]);
  });

  it('reports an SCSS-only entry that is no longer declared', () => {
    const withoutAccept = committedSource.replace(/^\$accept:.*$/m, () => '');

    expect(paletteDrift(withoutAccept)).toEqual([
      '$accept is listed as SCSS-only but is not declared',
    ]);
  });

  it('reports an SCSS-only entry that the theme also declares', () => {
    const scss = scssPalette(committedSource);
    const theme = new Map([...themePalette(['primary']), ['accept', '#FF38B386']]);

    expect(scssOnlyProblems(scss, theme)).toEqual([
      '$accept is listed as SCSS-only but the theme declares it',
    ]);
  });
});
