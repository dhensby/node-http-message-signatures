const js = require('@eslint/js');
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
    js.configs.recommended,
    ...tsPlugin.configs['flat/recommended'],
    {
        files: ['src/**/*.ts', 'test/**/*.ts'],
        rules: {
            '@typescript-eslint/no-unused-vars': ['error'],
            'comma-dangle': ['error', 'always-multiline'],
            'indent': ['error', 4, { SwitchCase: 1 }],
            'no-multiple-empty-lines': ['error', {
                max: 1,
                maxBOF: 0,
                maxEOF: 0,
            }],
            'no-param-reassign': ['error', { props: true, ignorePropertyModificationsFor: ['context'] }],
            'prefer-destructuring': ['error'],
            'prefer-arrow-callback': ['error', { allowNamedFunctions: true }],
            'prefer-template': ['error'],
            'quote-props': ['error', 'consistent-as-needed'],
            'quotes': ['error', 'single'],
        },
    },
];
