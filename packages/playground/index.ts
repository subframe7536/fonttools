import { generateBasicScript, handleFontBuffer, NameId, processNameUtilScript } from '@subframe7536/fonttools/utils'
import { loadInBrowser } from '@subframe7536/fonttools/web'

import src from './test.ttf'

document.querySelector('button')?.addEventListener('click', async () => {
  const buf = await (await fetch(src)).arrayBuffer()
  const py = await loadInBrowser()
  const data = handleFontBuffer(
    py,
    new Uint8Array(buf),
    generateBasicScript(`
${processNameUtilScript}
set_font_name(font, 'Test', ${NameId.FamilyName})
      `),
  )
  // download
  const url = URL.createObjectURL(new Blob([data]))
  const a = document.createElement('a')
  a.href = url
  a.download = 'output.ttf'
  a.click()
  a.remove()
})
