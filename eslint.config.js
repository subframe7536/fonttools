import { defineEslintConfig, GLOB_MARKDOWN_CODE } from '@subframe7536/eslint-config'

export default defineEslintConfig({
  ignoreRuleOnFile: {
    files: GLOB_MARKDOWN_CODE,
    rules: ['no-constant-binary-expression'],
  },
})
