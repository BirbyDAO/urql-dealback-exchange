module.exports = {
  setupFiles: [
    require.resolve('./setup.js'),
  ],
  clearMocks: true,
  transform: {
    '^.+\\.tsx?$': '@sucrase/jest-plugin',
  },
  moduleNameMapper: {},
  watchPlugins: ['jest-watch-yarn-workspaces'],
  testRegex: '(src/.*(\\.|/)(test|spec))\\.tsx?$',
  moduleFileExtensions: ['js', 'jsx', 'ts', 'tsx', 'json'],
  collectCoverageFrom: ['<rootDir>/src/**/*.{ts,tsx}'],
  coveragePathIgnorePatterns: ['<rootDir>/src/test-utils'],
  testPathIgnorePatterns: ['<rootDir>/e2e-tests/*'],
};
