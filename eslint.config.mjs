import tsParser from '@typescript-eslint/parser';

export default [
  {
    ignores: [
      'bin/**',
      'dist/**',
      'coverage/**',
      'node_modules/**',
    ],
  },
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
  },
];
