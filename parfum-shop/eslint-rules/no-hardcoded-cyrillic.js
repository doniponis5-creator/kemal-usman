/**
 * Custom ESLint rule: forbid Cyrillic literals in JSX text and string-literal
 * JSX attributes. Forces every visible text to go through i18n.
 *
 * Wire it into eslint.config.js:
 *
 *   import noHardcoded from './eslint-rules/no-hardcoded-cyrillic.js';
 *   ...
 *   rules: {
 *     'kemal/no-hardcoded-cyrillic': 'warn',  // 'error' once migration done
 *   },
 *   plugins: { kemal: { rules: { 'no-hardcoded-cyrillic': noHardcoded } } },
 */

const CYRILLIC = /[А-Яа-яЁёЇїІіЄєҒғҚқҢңӨөҮү]/;

export default {
  meta: {
    type: 'problem',
    docs: { description: 'Forbid Cyrillic string literals in JSX — use i18n keys instead.' },
    schema: [],
    messages: {
      hardcoded: 'Hardcoded Cyrillic literal "{{text}}" — use t(\'…\') instead.',
    },
  },
  create(context) {
    return {
      JSXText(node) {
        const text = node.value.trim();
        if (text && CYRILLIC.test(text)) {
          context.report({ node, messageId: 'hardcoded', data: { text: text.slice(0, 30) } });
        }
      },
      Literal(node) {
        if (typeof node.value !== 'string') return;
        const parent = node.parent;
        // Only flag JSX attribute strings: <Foo placeholder="…">
        if (parent?.type !== 'JSXAttribute' && parent?.type !== 'JSXExpressionContainer') return;
        if (CYRILLIC.test(node.value)) {
          context.report({ node, messageId: 'hardcoded', data: { text: node.value.slice(0, 30) } });
        }
      },
    };
  },
};
