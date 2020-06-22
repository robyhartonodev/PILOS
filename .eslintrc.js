module.exports = {
  env: {
    browser: true,
    es6: true,
    jquery: true
  },
  extends: [
    'plugin:vue/essential',
    'standard'
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly'
  },
  parserOptions: {
    ecmaVersion: 11,
    sourceType: 'module'
  },
  plugins: [
    'vue',
    '@intlify/vue-i18n'
  ],
  rules: {
    '@intlify/vue-i18n/no-html-messages': 'error',
    '@intlify/vue-i18n/no-raw-text': 'error',
    '@intlify/vue-i18n/no-v-html': 'error'
  },
  settings: {
  }
}
