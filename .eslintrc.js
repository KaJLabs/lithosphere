// @ts-check
/** @type {import('eslint').Linter.Config} */
module.exports = {
  root: true,
  env: {
    browser: true,
    node: true,
    es2022: true,
  },
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: "latest",
    sourceType: "module",
    ecmaFeatures: {
      jsx: true,
    },
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:import/recommended",
    "plugin:import/typescript",
    "prettier",
  ],
  settings: {
    "import/resolver": {
      typescript: {
        alwaysTryTypes: true,
        project: ['tsconfig.json', 'packages/*/tsconfig.json', 'templates/*/tsconfig.json', 'apps/*/tsconfig.json'],
      },
      node: {
        extensions: ['.js', '.jsx', '.ts', '.tsx'],
      },
    },
  },
  rules: {
    // TypeScript
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-non-null-assertion": "warn",

    // Import
    "import/order": [
      "error",
      {
        groups: [
          "builtin",
          "external",
          "internal",
          ["parent", "sibling"],
          "index",
          "type",
        ],
        "newlines-between": "always",
        alphabetize: {
          order: "asc",
          caseInsensitive: true,
        },
      },
    ],
    "import/no-duplicates": "error",
    "import/no-unresolved": "error",

    // General
    "no-console": ["warn", { allow: ["warn", "error"] }],
    "prefer-const": "error",
    "no-var": "error",
    eqeqeq: ["error", "always"],
  },
  overrides: [
    // React/Next.js files
    {
      files: ["**/*.tsx", "**/pages/**/*.ts", "**/app/**/*.ts"],
      extends: ["plugin:react/recommended", "plugin:react-hooks/recommended"],
      settings: {
        react: {
          version: "detect",
        },
      },
      rules: {
        "react/react-in-jsx-scope": "off",
        "react/prop-types": "off",
      },
    },
    // Test files
    {
      files: ["**/*.test.ts", "**/*.spec.ts", "**/test/**"],
      env: {
        jest: true,
        mocha: true,
      },
      rules: {
        "@typescript-eslint/no-explicit-any": "off",
        "no-console": "off",
      },
    },
    // Solidity/Hardhat scripts
    {
      files: ["contracts/**/*.ts", "**/hardhat.config.ts"],
      rules: {
        "no-console": "off",
        "@typescript-eslint/no-require-imports": "off",
      },
    },
    // Config files
    {
      files: ["*.config.js", "*.config.ts", ".eslintrc.js"],
      rules: {
        "@typescript-eslint/no-require-imports": "off",
      },
    },
    // CLI tools
    {
      files: ["**/create-litho-app/**/*.ts"],
      rules: {
        "no-console": "off",
        "import/no-named-as-default-member": "off",
      },
    },
    // Service entry points
    {
      files: ["**/service-template/src/server.ts", "**/apps/*/src/server.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
  ignorePatterns: [
    "node_modules/",
    "dist/",
    ".next/",
    "out/",
    "artifacts/",
    "cache/",
    "typechain-types/",
    "coverage/",
    ".turbo/",
    "*.min.js",
  ],
};
