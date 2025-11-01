# PyInstaller hook to ensure the `app` package and its data are collected.
# Place this file under src-python/hooks and point hookspath to that directory in the spec.
from PyInstaller.utils.hooks import collect_submodules, collect_data_files

# Collect all submodules under the repo's 'app' package (ensures dynamic imports are included).
hiddenimports = collect_submodules('app') + ['ipaddress']

# Collect non-code data files under the app package as well (if any).
datas = collect_data_files('app', include_py_files=True)