import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** Patrones de import prohibidos según la capa (Clean Architecture). */
const layer = (name) => [`@/${name}`, `@/${name}/**`, `**/${name}/**`];

const restrictImports = (patterns, message) => [
  'error',
  { patterns: [{ group: patterns, message }] },
];

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'coverage', 'node_modules'] },

  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      ...tseslint.configs.strictTypeChecked,
      ...tseslint.configs.stylisticTypeChecked,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { 'react-hooks': reactHooks, 'react-refresh': reactRefresh },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      '@typescript-eslint/restrict-template-expressions': ['error', { allowNumber: true }],
    },
  },

  // domain: TS puro, sin frameworks, sin I/O, sin aleatoriedad ni reloj implícitos.
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictImports(
        [
          'react',
          'react-*',
          'zustand',
          'zustand/*',
          'dexie',
          '@mediapipe/*',
          ...layer('application'),
          ...layer('infrastructure'),
          ...layer('presentation'),
          ...layer('app'),
        ],
        'El dominio no depende de frameworks ni de otras capas.',
      ),
      'no-restricted-globals': [
        'error',
        'window',
        'document',
        'navigator',
        'localStorage',
        'sessionStorage',
        'performance',
        'indexedDB',
      ],
      'no-restricted-properties': [
        'error',
        { object: 'Math', property: 'random', message: 'Inyectá un Rng.' },
        { object: 'Date', property: 'now', message: 'Inyectá un Clock.' },
      ],
    },
  },

  {
    files: ['src/application/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictImports(
        [
          'react',
          'react-*',
          'dexie',
          '@mediapipe/*',
          ...layer('infrastructure'),
          ...layer('presentation'),
          ...layer('app'),
        ],
        'application solo depende de domain.',
      ),
    },
  },

  {
    files: ['src/infrastructure/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(
        [...layer('presentation'), ...layer('app')],
        'infrastructure implementa ports; no conoce la UI.',
      ),
    },
  },

  // Lógica de gestos: TS puro y testeable sin cámara; el tiempo llega con cada frame.
  {
    files: ['src/infrastructure/vision/gesture/**/*.ts'],
    rules: {
      'no-restricted-imports': restrictImports(
        ['@mediapipe/*', ...layer('presentation'), ...layer('app')],
        'La lógica de gestos no depende de MediaPipe: recibe HandFrame.',
      ),
      'no-restricted-globals': ['error', 'window', 'document', 'navigator', 'performance'],
      'no-restricted-properties': [
        'error',
        { object: 'Date', property: 'now', message: 'Usá el t del frame.' },
      ],
    },
  },

  {
    files: ['src/presentation/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': restrictImports(
        [...layer('infrastructure'), 'dexie', '@mediapipe/*'],
        'presentation recibe las implementaciones desde el composition root (app/).',
      ),
    },
  },

  {
    files: ['*.config.{js,ts}'],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
  },

  prettier,
);
