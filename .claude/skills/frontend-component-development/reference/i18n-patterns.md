# I18n Patterns

User-facing copy is localized with `react-i18next`. Never hardcode display
strings in JSX or validators.

## Translation files

Each feature keeps its translations next to the feature:

```text
src/features/<feature>/i18n/en.json
src/features/<feature>/i18n/uk.json
```

Add the English and Ukrainian keys together, grouped by section/screen, and
follow the key naming of nearby entries.

```json
{
  "contact": {
    "email": {
      "required": "Email is required",
      "invalid": "Enter a valid email"
    },
    "submit": "Send"
  }
}
```

The Ukrainian file mirrors the same shape:

```json
{
  "contact": {
    "email": {
      "required": "Введіть електронну пошту",
      "invalid": "Введіть коректну електронну пошту"
    },
    "submit": "Надіслати"
  }
}
```

## Reading copy

- In components, read with the hook: `const { t } = useTranslation();`.
- In module-scope validators and helpers, importing `t` directly from `i18next`
  is safe — i18next init is synchronous in this repo, so a module-level `t` is
  bound before any call site runs.
- Use `<Trans>` when a string embeds markup such as links or emphasis, keeping
  the surrounding text in the translation file.

## Rules

- Add English and Ukrainian keys in the same change.
- Do not hardcode user-facing strings in JSX, props, or validation messages.
- Keep keys grouped by feature and screen.
- In tests, assert against the localized output of `t(...)`, not hardcoded
  English, so translation-sensitive behavior stays covered (see AGENTS.md).
