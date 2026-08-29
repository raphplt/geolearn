const expo = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier');

/**
 * Expo's rules for a React Native codebase, with every stylistic rule handed
 * over to Prettier so the two never argue. `pnpm verify` runs both.
 */
module.exports = [
  { ignores: ['android/**', '.expo/**', 'dist/**', 'node_modules/**', 'src/data/*.json'] },
  ...expo,
  prettier,
  {
    rules: {
      'import/no-unresolved': 'off',

      /*
       * Reanimated's whole API is the assignment `shared.value = …`, on purpose
       * and on the UI thread. The React Compiler rule cannot be satisfied here
       * without giving up the library; everything else it checks stays on.
       */
      'react-hooks/immutability': 'off',
    },
  },
];
