import { readdir, stat } from 'fs/promises';
import { dirname, basename, join, resolve } from 'path';
import os from 'os';

export async function getDirectorySuggestions(partial) {
  let expanded = partial.replace(/^~/, os.homedir());
  expanded = resolve(expanded);

  let searchDir;
  let prefix;

  try {
    const s = await stat(expanded);
    if (s.isDirectory()) {
      searchDir = expanded;
      prefix = '';
    } else {
      searchDir = dirname(expanded);
      prefix = basename(expanded).toLowerCase();
    }
  } catch {
    searchDir = dirname(expanded);
    prefix = basename(expanded).toLowerCase();
  }

  try {
    const entries = await readdir(searchDir, { withFileTypes: true });
    const dirs = entries
      .filter(e => e.isDirectory() && !e.name.startsWith('.'))
      .filter(e => prefix === '' || e.name.toLowerCase().startsWith(prefix))
      .map(e => join(searchDir, e.name))
      .sort()
      .slice(0, 20);

    return dirs;
  } catch {
    return [];
  }
}
