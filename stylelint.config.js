/**
 * Stylelint for the web app's SCSS (component styles). Formatting is Prettier's job; these rules
 * enforce the design system (docs/12-design-system.md): colors only through theme tokens, BEM class
 * names, shallow nesting. Tailwind lives in `apps/web/src/index.css` and is not linted here.
 *
 * @type {import('stylelint').Config}
 */
export default {
  extends: ['stylelint-config-standard-scss'],
  rules: {
    // Colors come from the @theme tokens (`var(--color-*)`, `color-mix()` for alpha), never literals.
    'color-no-hex': true,
    'color-named': 'never',
    'function-disallowed-list': ['rgb', 'rgba', 'hsl', 'hsla'],
    // BEM: block, block__element, block--modifier (kebab-case parts).
    'selector-class-pattern': [
      '^[a-z][a-z0-9]*(-[a-z0-9]+)*(__[a-z0-9]+(-[a-z0-9]+)*)?(--[a-z0-9]+(-[a-z0-9]+)*)?$',
      { message: 'Use BEM kebab-case class names (block__element--modifier)' },
    ],
    'selector-max-id': 0,
    'declaration-no-important': true,
    'max-nesting-depth': [3, { ignore: ['pseudo-classes'] }],
    'scss/at-mixin-pattern': '^[a-z][a-z0-9-]*$',
    'scss/dollar-variable-pattern': '^[a-z][a-z0-9-]*$',
    'scss/percent-placeholder-pattern': '^[a-z][a-z0-9-]*$',
    // `@use` modules only (no deprecated `@import`).
    'at-rule-disallowed-list': ['import'],
    'no-descending-specificity': null,
  },
};
