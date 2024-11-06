import type { PyodideInterface } from 'pyodide'
import type { LoadInWebOption } from './types'
import { loadPyodide } from 'pyodide'

/**
 * Load `fonttools` in `browser`, default index URL is `import.meta.url`
 */
export async function loadInBrowser(
  { indexURL, woff2, loadOptions }: LoadInWebOption = {},
): Promise<PyodideInterface> {
  const py = await loadPyodide({ indexURL })
  await py.loadPackage('fonttools', loadOptions)
  if (woff2) {
    await py.loadPackage('brotli', loadOptions)
  }
  return py
}
