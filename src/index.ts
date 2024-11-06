import type { PyodideInterface } from 'pyodide'
import type { LoadInNodeOption } from './types'
import { loadPyodide } from 'pyodide'

/**
 * Load `fonttools` in `node`, default package cache dir is `.`
 */
export async function loadInNode(
  { woff2, packageCacheDir = '.', loadOptions }: LoadInNodeOption = {},
): Promise<PyodideInterface> {
  const py = await loadPyodide({ packageCacheDir })
  await py.loadPackage('fonttools', loadOptions)
  if (woff2) {
    await py.loadPackage('brotli', loadOptions)
  }
  return py
}
