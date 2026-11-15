module.exports = [
  {
    files: ['lib/**/*.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs'
    },
    plugins: {
      '@typescript-eslint': {
        rules: {
          'no-explicit-any': {
            create() {
              return {};
            }
          }
        }
      }
    },
    linterOptions: {
      reportUnusedDisableDirectives: 'off'
    },
    rules: {}
  }
];
