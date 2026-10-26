/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  moduleNameMapper: { '^@oa/types$': '<rootDir>/../../packages/types/src/index.ts' },
  transform: {
    '^.+\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          ...require('./tsconfig.json').compilerOptions,
          rootDir: undefined,
          noEmit: true,
        },
      },
    ],
  },
};
