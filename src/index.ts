import type { PyodideInterface } from 'pyodide'
import type { LoadInNodeOption } from './types'
import { loadPyodide } from 'pyodide'

/**
 * Load `fonttools` in `node`
 */
export async function loadInNode(
  options: LoadInNodeOption = {},
): Promise<PyodideInterface> {
  const packages = ['fonttools']
  if (options?.woff2) {
    packages.push('brotli')
  }
  return await loadPyodide({ ...options, packages })
}
