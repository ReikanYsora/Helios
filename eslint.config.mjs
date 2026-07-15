// @ts-check

// Mirror of the Home Assistant frontend ESLint config so Helios code lints under the exact same rules it will
// face when pieces are upstreamed into the HA frontend. Two deliberate deviations: the globals are Helios's
// (__HELIOS_VERSION__ instead of HA's __DEV__/__BUILD__/...), and there is no webpack/rspack import resolver
// (Helios builds with Vite; import-x/no-unresolved is off anyway). The HA-only file overrides
// (recorder-worklet, service-worker) are dropped — those files don't exist here.

import unusedImports from "eslint-plugin-unused-imports";
import globals from "globals";
import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintConfigPrettier from "eslint-config-prettier";
import { configs as litConfigs } from "eslint-plugin-lit";
import { configs as wcConfigs } from "eslint-plugin-wc";
import { configs as a11yConfigs } from "eslint-plugin-lit-a11y";
import html from "@html-eslint/eslint-plugin";
import importX from "eslint-plugin-import-x";

export default tseslint.config(
  { ignores: ["dist/**", "node_modules/**", "*.config.*"] },
  js.configs.recommended,
  eslintConfigPrettier,
  litConfigs["flat/all"],
  tseslint.configs.recommended,
  tseslint.configs.strict,
  tseslint.configs.stylistic,
  wcConfigs["flat/recommended"],
  a11yConfigs.recommended,
  importX.flatConfigs.recommended,
  {
    plugins: {
      "unused-imports": unusedImports,
    },

    languageOptions: {
      globals: {
        ...globals.browser,
        __HELIOS_VERSION__: false,
      },

      parser: tseslint.parser,
      ecmaVersion: 2020,
      sourceType: "module",

      parserOptions: {
        ecmaFeatures: {
          modules: true,
        },
      },
    },

    settings: {
      // Helios builds with Vite, not webpack — resolve TS imports so import-x/extensions et al. behave
      // exactly as they do in the HA frontend (which uses the webpack resolver for the same purpose).
      "import-x/resolver": {
        typescript: true,
      },
    },

    rules: {
      "array-callback-return": ["error", { allowImplicit: true }],
      "block-scoped-var": "error",
      "consistent-return": "error",
      curly: ["error", "multi-line"],
      "default-case-last": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "guard-for-in": "error",
      "no-await-in-loop": "error",
      "no-caller": "error",
      "no-constructor-return": "error",
      "no-eval": "error",
      "no-extend-native": "error",
      "no-implied-eval": "error",
      "no-iterator": "error",
      "no-new-func": "error",
      "no-new-wrappers": "error",
      "no-octal-escape": "error",
      "no-promise-executor-return": "error",
      "no-return-assign": ["error", "always"],
      "no-script-url": "error",
      "no-self-compare": "error",
      "no-sequences": "error",
      "no-template-curly-in-string": "error",
      "no-unreachable-loop": "error",

      "no-else-return": ["error", { allowElseIf: false }],
      "no-lonely-if": "error",
      "no-unneeded-ternary": ["error", { defaultAssignment: false }],
      "no-useless-computed-key": "error",
      "no-useless-concat": "error",
      "no-useless-rename": "error",
      "no-useless-return": "error",
      "one-var": ["error", "never"],
      "operator-assignment": ["error", "always"],
      "prefer-arrow-callback": "error",
      "prefer-exponentiation-operator": "error",
      "prefer-object-spread": "error",
      "prefer-regex-literals": ["error", { disallowRedundantWrapping: true }],
      "symbol-description": "error",
      yoda: "error",

      "no-useless-assignment": "error",

      // Project rules
      "no-bitwise": "error",
      "no-console": "error",
      "no-restricted-globals": [2, "event"],
      "no-restricted-syntax": ["error", "LabeledStatement", "WithStatement"],
      "wc/no-self-class": "off",

      // import-x rules
      "import-x/named": "off",
      "import-x/prefer-default-export": "off",
      "import-x/no-default-export": "off",
      "import-x/no-unresolved": "off",
      "import-x/no-cycle": "off",
      "import-x/extensions": [
        "error",
        "ignorePackages",
        {
          ts: "never",
          js: "never",
        },
      ],
      "import-x/no-mutable-exports": "error",
      "import-x/no-amd": "error",
      "import-x/first": "error",
      "import-x/order": [
        "error",
        { groups: [["builtin", "external", "internal"]] },
      ],
      "import-x/newline-after-import": "error",
      "import-x/no-absolute-path": "error",
      "import-x/no-dynamic-require": "error",
      "import-x/no-webpack-loader-syntax": "error",
      "import-x/no-named-default": "error",
      "import-x/no-self-import": "error",
      "import-x/no-useless-path-segments": ["error", { commonjs: true }],
      "import-x/no-import-module-exports": ["error", { exceptions: [] }],
      "import-x/no-relative-packages": "error",

      // TypeScript rules
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/no-non-null-assertion": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-shadow": ["error"],

      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: ["objectLiteralProperty", "objectLiteralMethod"],
          format: null,
        },
        {
          selector: ["variable"],
          format: ["camelCase", "snake_case", "UPPER_CASE"],
          leadingUnderscore: "allow",
          trailingUnderscore: "allow",
        },
        {
          selector: ["variable"],
          modifiers: ["exported"],
          format: ["camelCase", "PascalCase", "UPPER_CASE"],
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
        {
          selector: "method",
          modifiers: ["public"],
          format: ["camelCase"],
          leadingUnderscore: "forbid",
        },
        {
          selector: "method",
          modifiers: ["private"],
          format: ["camelCase"],
          leadingUnderscore: "require",
        },
      ],

      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          args: "all",
          argsIgnorePattern: "^_",
          caughtErrors: "all",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          ignoreRestSiblings: true,
        },
      ],

      "unused-imports/no-unused-imports": "error",
      "lit/attribute-names": "error",
      "lit/attribute-value-entities": "off",
      "lit/no-template-map": "off",
      "lit/no-native-attributes": "error",
      "lit/no-this-assign-in-render": "error",
      "lit-a11y/click-events-have-key-events": ["off"],
      "lit-a11y/no-autofocus": "off",
      "lit-a11y/alt-text": "error",
      "lit-a11y/anchor-is-valid": "error",
      "lit-a11y/role-has-required-aria-attrs": "error",
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-import-type-side-effects": "error",
      "@typescript-eslint/no-dynamic-delete": "off",
      "@typescript-eslint/no-empty-object-type": [
        "error",
        {
          allowInterfaces: "always",
          allowObjectTypes: "always",
        },
      ],
    },
  },
  {
    plugins: {
      html,
    },
    rules: {
      "html/no-invalid-attr-value": "error",
    },
  }
);
