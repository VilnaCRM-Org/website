/**
 * The client-operation half of `make lint-contracts`, extracted from
 * lint-contracts.mjs so it can be exercised directly (issue #348).
 *
 * The CLI is a thin shell around this module: it holds no policy, and the schema
 * path and the source directory are PARAMETERS rather than module constants.
 * That is the whole point of the split — the gate can now be pointed at a
 * throwaway directory carrying a deliberately broken document, which is the only
 * way to demonstrate that it actually goes red. Seeding a defect into the
 * committed artifacts is not an option: `contracts/` is digest-gated (#376), so
 * a test that edited it would be indistinguishable from tampering.
 *
 * Failures are RETURNED, never pushed into a caller-owned array and never
 * printed. A function that reports by side effect can only be observed by
 * scraping stdout.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';

import { buildSchema, parse, validate } from 'graphql';
import ts from 'typescript';

/** Every file under `dir`, recursively. */
export function walk(dir) {
  return readdirSync(dir).flatMap(entry => {
    const full = path.join(dir, entry);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });
}

/** The tag of a `gql`...`` template: the bare identifier `gql`, or a `x.gql` member access. */
function isGqlTag(tag) {
  if (ts.isIdentifier(tag)) {
    return tag.text === 'gql';
  }
  return ts.isPropertyAccessExpression(tag) && tag.name.text === 'gql';
}

/**
 * Extracts every `gql`...`` tagged-template body from `file`.
 *
 * This walks the TypeScript AST rather than scanning the raw source. A regular
 * expression over the text cannot tell an executable tagged template from one
 * sitting inside a line comment, a block comment, or an ordinary string literal,
 * so a commented-out example used to be collected as a client operation and
 * could redden `make lint-contracts` although no real operation changed — the
 * same parser-over-regex rule #447 records for workflow YAML.
 *
 * The body is the RAW text between the backticks, so a template carrying
 * substitutions still reaches the caller with its `${` intact: these are static
 * documents, and an interpolated one is a hard error rather than something to
 * interpolate away.
 */
export function extractGqlDocuments(file) {
  const source = readFileSync(file, 'utf8');
  const sourceFile = ts.createSourceFile(
    file,
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ false,
    file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS
  );
  const documents = [];

  const visit = node => {
    if (ts.isTaggedTemplateExpression(node) && isGqlTag(node.tag)) {
      const template = node.template;
      // getStart/getEnd span the backticks; the body is what sits between them.
      documents.push({
        file,
        body: source.slice(template.getStart(sourceFile) + 1, template.getEnd() - 1),
      });
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(sourceFile, visit);

  return documents;
}

/** Every gql document in every `.ts`/`.tsx` file under `sourceDir`. */
export function collectGqlDocuments(sourceDir) {
  return walk(sourceDir)
    .filter(file => /\.tsx?$/.test(file))
    .flatMap(extractGqlDocuments);
}

/**
 * Validates every client GraphQL operation under `sourceDir` against the schema.
 *
 * Pass either `schemaSdl` (already-read SDL) or `schemaPath` (read from disk).
 * Returns `{ documentCount, failures }`; `failures` is empty exactly when the
 * gate is green. An empty `sourceDir` is a FAILURE, not a pass: a gate that
 * validates nothing reports success forever.
 */
export function checkGraphqlOperations({ schemaPath, schemaSdl, sourceDir }) {
  const failures = [];

  let schema;
  try {
    schema = buildSchema(schemaSdl ?? readFileSync(schemaPath, 'utf8'));
  } catch (error) {
    failures.push(`${schemaPath ?? '<sdl>'}: ${error.message}`);
    return { documentCount: 0, failures };
  }

  let documents;
  try {
    documents = collectGqlDocuments(sourceDir);
  } catch (error) {
    failures.push(`${sourceDir}: ${error.message}`);
    return { documentCount: 0, failures };
  }

  if (documents.length === 0) {
    failures.push(`no gql documents found under ${sourceDir} — the extractor is broken`);
    return { documentCount: 0, failures };
  }

  documents.forEach(({ file, body }) => {
    if (body.includes('${')) {
      failures.push(`${file}: interpolated gql template cannot be validated statically`);
      return;
    }

    let document;
    try {
      document = parse(body);
    } catch (error) {
      failures.push(`${file}: ${error.message}`);
      return;
    }

    validate(schema, document).forEach(error => failures.push(`${file}: ${error.message}`));
  });

  return { documentCount: documents.length, failures };
}
