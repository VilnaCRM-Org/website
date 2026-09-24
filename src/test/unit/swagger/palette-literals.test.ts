/**
 * @jest-environment node
 *
 * Locale / responsive / a11y — Not applicable: a source-level check that the Swagger skin
 * takes every colour from its palette partial; contrast itself is gated by the axe route scan.
 */
import { cpSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

import * as sass from 'sass';

const STYLES_ROOT: string = path.join(
  process.cwd(),
  'src/features/swagger/components/api-documentation'
);
const COLORS_FILE = 'global/variables/colors/_colors.scss';
const GLOBAL_FILE = 'global/_global.scss';
const METHODS_THEME =
  'operation-block/operation-content/operation-methods-theme/_operation-methods-theme.scss';
const DEPRECATED_METHOD =
  'operation-block/operation-content/operation-methods-theme/deprecated-method/_deprecated-method.scss';

const SCSS_FILES: readonly string[] = readdirSync(STYLES_ROOT, {
  recursive: true,
  encoding: 'utf8',
})
  .filter(file => file.endsWith('.scss') && file !== COLORS_FILE)
  .sort();

type ColourVariables = Map<string, string[]>;
type Probe = { variables: ColourVariables; css: string };
type Palette = ReadonlyArray<readonly [token: string, argb: string]>;

const stagedRoots: string[] = [];

function stringArgument(args: sass.Value[], index: number): string {
  const argument = args[index];
  if (argument === undefined) throw new Error('collect() was called without enough arguments');
  return argument.assertString().text;
}

function compileProbe(root: string, file: string): Probe {
  const variables: ColourVariables = new Map();
  const { css } = sass.compileString(
    `@use 'sass:color';\n@use 'sass:list';\n@use 'sass:map';\n@use 'sass:meta';\n` +
      `@use '${pathToFileURL(path.join(root, file)).href}' as subject;\n` +
      `@function colours($v) {\n  @if meta.type-of($v) == 'color' { @return ($v,); }\n` +
      `  @if meta.type-of($v) == 'map' { $v: map.values($v); }\n  $out: ();\n` +
      `  @if meta.type-of($v) == 'list' { @each $item in $v { $out: list.join($out, colours($item)); } }\n` +
      `  @return $out;\n}\n` +
      `@each $name, $value in meta.module-variables('subject') {\n` +
      `  @each $c in colours($value) { $_: collect($name, color.ie-hex-str($c)); }\n}`,
    {
      style: 'compressed',
      importers: [
        {
          findFileUrl: url =>
            url === '@swagger/global' ? pathToFileURL(path.join(root, GLOBAL_FILE)) : null,
        },
      ],
      functions: {
        'collect($name, $value)': args => {
          const name = stringArgument(args, 0);
          variables.set(name, [...(variables.get(name) ?? []), stringArgument(args, 1)]);
          return sass.sassNull;
        },
      },
    }
  );
  return { variables, css };
}

function paletteOf(root: string): Palette {
  const colours = compileProbe(root, COLORS_FILE).variables;
  return [...colours].map(([token, [argb]]) => [token, argb ?? '']);
}

function rgbaSource(argb: string, red: number = parseInt(argb.slice(3, 5), 16)): string {
  const channel = (offset: number): number => parseInt(argb.slice(offset, offset + 2), 16);
  return `rgba(${red}, ${channel(5)}, ${channel(7)}, ${channel(1) / 255})`;
}

function sentinelPalette(palette: Palette): string {
  return palette
    .map(([token, argb], index) => `$${token}: ${rgbaSource(`#${argb.slice(1, 3)}000102`, index)};`)
    .join('\n');
}

function serialised(argb: string): string {
  const { css } = sass.compileString(`a{b:${rgbaSource(argb)}}`, { style: 'compressed' });
  return css.slice('a{b:'.length, css.indexOf('}'));
}

function stageTree(colours: string, overrides: Readonly<Record<string, string>>): string {
  const root = mkdtempSync(path.join(tmpdir(), 'swagger-palette-'));
  stagedRoots.push(root);
  cpSync(STYLES_ROOT, root, { recursive: true });
  writeFileSync(path.join(root, COLORS_FILE), colours);
  Object.entries(overrides).forEach(([file, source]) =>
    writeFileSync(path.join(root, file), source)
  );
  return root;
}

function unfollowedVariables(file: string, real: Probe, sentinel: Probe): string[] {
  return [...real.variables].flatMap(([name, colours]) => {
    const moved = sentinel.variables.get(name) ?? [];
    const pinned = colours.some((colour, index) => moved[index] === colour);
    return pinned ? [`$${name} in ${file} does not follow the palette`] : [];
  });
}

function hardCodedColours(file: string, sentinel: Probe, palette: Palette): string[] {
  return palette.flatMap(([token, argb]) => {
    const form = serialised(argb).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const found = new RegExp(`(?<![\\w-])${form}(?![\\w-])`).test(sentinel.css);
    return found ? [`${file} hard-codes the colour of $${token}`] : [];
  });
}

function literalColours(
  overrides: Readonly<Record<string, string>> = {},
  files: readonly string[] = SCSS_FILES
): string[] {
  const realRoot = stageTree(readFileSync(path.join(STYLES_ROOT, COLORS_FILE), 'utf8'), overrides);
  const palette = paletteOf(realRoot);
  const sentinelRoot = stageTree(sentinelPalette(palette), overrides);
  return files.flatMap(file => {
    const sentinel = compileProbe(sentinelRoot, file);
    return [
      ...unfollowedVariables(file, compileProbe(realRoot, file), sentinel),
      ...hardCodedColours(file, sentinel, palette),
    ];
  });
}

function committed(file: string): string {
  return readFileSync(path.join(STYLES_ROOT, file), 'utf8');
}

function replaced(file: string, from: string, to: string): Record<string, string> {
  const source = committed(file);
  expect(source).toContain(from);
  return { [file]: source.replace(from, () => to) };
}

afterAll(() => {
  stagedRoots.forEach(root => rmSync(root, { recursive: true, force: true }));
});

describe('swagger SCSS colours come from the palette partial', () => {
  it('finds no colour outside the palette partial that ignores the palette', () => {
    expect(SCSS_FILES.length).toBeGreaterThan(1);
    expect(SCSS_FILES).toEqual(expect.arrayContaining([METHODS_THEME, DEPRECATED_METHOD]));
    expect(literalColours()).toEqual([]);
  });

  it('reports a method colour copied as a literal, and the map that carries it', () => {
    const seeded = replaced(METHODS_THEME, '$getColorTheme: $primary;', '$getColorTheme: #1EAEFF;');

    expect(literalColours(seeded, [METHODS_THEME])).toEqual([
      `$getColorTheme in ${METHODS_THEME} does not follow the palette`,
      `$methodColors in ${METHODS_THEME} does not follow the palette`,
    ]);
  });

  it('reports a colour variable that is not in the palette at all', () => {
    const seeded = replaced(
      DEPRECATED_METHOD,
      '$deprecatedTextColor: $grey300;',
      '$deprecatedTextColor: rgba(0, 0, 0, 0.5);'
    );

    expect(literalColours(seeded, [DEPRECATED_METHOD])).toEqual([
      `$deprecatedTextColor in ${DEPRECATED_METHOD} does not follow the palette`,
    ]);
  });

  it('reports a palette colour written straight into a declaration', () => {
    const seeded = { 'styles.scss': `${committed('styles.scss')}\n.probe { color: #969B9D; }\n` };

    expect(literalColours(seeded, ['styles.scss'])).toEqual([
      'styles.scss hard-codes the colour of $grey300',
    ]);
  });
});
