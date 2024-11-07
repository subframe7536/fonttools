// import { generateBasicScript, handleFontBuffer } from '../src/utils'
// import { loadInBrowser } from '../src/web'
import { generateBasicScript, handleFontBuffer, NameId, processNameUtilScript } from '../dist/utils'
import { loadInBrowser } from '../dist/web'
import src from './test.ttf'

document.querySelector('button')?.addEventListener('click', async () => {
  const buf = await (await fetch(src)).arrayBuffer()
  const py = await loadInBrowser()
  const data = await handleFontBuffer(
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
