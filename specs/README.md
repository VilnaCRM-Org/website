# Specs

BMAD planning and Ralph implementation artifacts, grouped per spec.

## Layout

Each spec owns one folder with two artifact subfolders:

```text
specs/
└── <spec-name>/
    ├── planning-artifacts/        # PRD, architecture, epics (BMAD phases 1-3)
    └── implementation-artifacts/  # Story files produced during implementation
```

## Current Specs

| Spec                    | Status      |
| ----------------------- | ----------- |
| `dependency-cruiser-ci` | Implemented |

## Conventions

- Planning artifacts are named `<type>-<spec-name>-<date>.md`
  (`type` is `prd`, `architecture`, or `epics`).
- Implementation artifacts are story files named `<epic>-<story>-<slug>.md`.
- The active spec is selected in `_bmad/config.yaml` via the
  `planning_artifacts` and `implementation_artifacts` paths.
- The BMAD tooling (`_bmad/`, `_bmad-output/`, `bmalph/`, `.ralph/`) is
  local-only and git-ignored; only the artifacts under `specs/` are committed.
- Do not scan this folder in lint or suppression checks; documents quote
  directive examples that are not real code.
