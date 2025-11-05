import { FlatCompat } from '@eslint/eslintrc';
import { dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
    baseDirectory: __dirname,
});

const eslintConfig = [
    ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
    // Ignore directories that are either excluded by tsconfig or are build/artifact folders
    {
        // Ignore tailwind config (JS/TS), node_modules, scripts, and common build folders
        ignores: ['tailwind.config.*', 'node_modules/**', '.next/**', 'out/**', 'dist/**', 'build/**'],
    },
    // Allow @ts-ignore comments for legitimate cases (e.g., Bun-specific APIs)
    {
        rules: {
            '@typescript-eslint/ban-ts-comment': [
                'error',
                {
                    'ts-ignore': 'allow-with-description',
                    minimumDescriptionLength: 10,
                },
            ],
        },
    },
];

export default eslintConfig;
