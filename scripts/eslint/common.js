module.exports = {
  parserOptions: {
    ecmaVersion: 9,
    sourceType: 'module',
    ecmaFeatures: {
      modules: true,
      jsx: true,
    },
  },
  extends: [
    'prettier',
  ],
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    'benchmark/',
    'scripts/'
  ],
  plugins: [
    'prettier',
    'jest',
    'es5',
  ],
  rules: {
    'sort-keys': 'off',
    'no-console': ['error', { allow: ['warn', 'error'] }],
    'prefer-arrow/prefer-arrow-functions': 'off',

    'es5/no-for-of': 'off',
    'es5/no-generators': 'off',
    'es5/no-typeof-symbol': 'warn',

    'prettier/prettier': ['error', {
      singleQuote: true,
      arrowParens: 'avoid',
      trailingComma: 'es5',
    }],
  },

  overrides: [
    {
      files: [
        '*.test.ts',
        '*.test.tsx',
        '*.spec.ts',
        '*.spec.tsx',
      ],
      rules: {
        'es5/no-for-of': 'off',
        'es5/no-generators': 'off',
        'es5/no-typeof-symbol': 'off',

        'jest/no-disabled-tests': 'error',
        'jest/no-focused-tests': 'error',
        'jest/no-identical-title': 'warn',
        'jest/consistent-test-it': ['warn', { fn: 'it' }],
      }
    }
  ],

  settings: {
    'import/extensions': [
      '.js',
      '.jsx',
      '.ts',
      '.tsx',
    ],
    'import/resolver': {
      node: {
        extensions: [
          '.js',
          '.jsx',
          '.ts',
          '.tsx',
        ]
      },
    },
  },
};
