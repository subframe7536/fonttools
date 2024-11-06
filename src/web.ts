import type { PyodideInterface } from 'pyodide'
import type { LoadInWebOption } from './types'
import { loadPyodide } from 'pyodide'

/**
 * Load `fonttools` in `browser`, default index URL is `import.meta.url`
 */
export async function loadInBrowser(
  options?: LoadInWebOption,
): Promise<PyodideInterface> {
  const packages = ['fonttools']
  if (options?.woff2) {
    packages.push('brotli')
  }
  return await loadPyodide({ ...options, packages })
}
