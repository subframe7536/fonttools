import { readFileSync, writeFileSync } from 'node:fs'

// import { loadInNode } from './src'
// import { generateBasicScript, handleFontBuffer, processNameUtilScript } from './src/utils'
import { loadInNode } from './dist'
import { generateBasicScript, handleFontBuffer, NameId, processNameUtilScript } from './dist/utils'

const buf = new Uint8Array(readFileSync('./playground/test.ttf'))

loadInNode({ packageCacheDir: './cache', woff2: true })
  .then(async py => (await handleFontBuffer(py, buf, generateBasicScript(`
${processNameUtilScript}
set_font_name(font, 'Test', ${NameId.FamilyName})
`)), py))
  .then(py => handleFontBuffer(py, buf, (input, output) => `from fontTools.ttLib.woff2 import compress
compress('${input}', '${output}')
`))
  .then(data => writeFileSync('output.woff2', data))
