import type { loadPyodide, PyodideInterface } from 'pyodide'

export type BasePackageOption = {
  /**
   * Load brotli to build `woff2` format
   */
  woff2?: boolean
  /**
   * Options to pass to `pyodide.loadPackage`
   */
  loadOptions?: Parameters<PyodideInterface['loadPackage']>[1]
}
export type LoadInNodeOption = BasePackageOption & Pick<Exclude<Parameters<typeof loadPyodide>[0], undefined>, 'packageCacheDir'>

export type LoadInWebOption = BasePackageOption & Pick<Exclude<Parameters<typeof loadPyodide>[0], undefined>, 'indexURL'>
