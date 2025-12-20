module.exports = {
  root: true,
  extends: ['../../.eslintrc.js'],
  parserOptions: {
    project: './tsconfig.json',
    tsconfigRootDir: __dirname,
  },
  rules: {
    // Allow console for server-side logging
    'no-console': 'off',
    // Ignore import style warnings for express
    'import/no-named-as-default-member': 'off',
  },
};
