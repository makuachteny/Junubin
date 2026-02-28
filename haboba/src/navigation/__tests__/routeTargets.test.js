const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');
const NAVIGATOR_FILE = path.join(ROOT, 'src/navigation/AppNavigator.js');
const SOURCE_DIRS = [path.join(ROOT, 'src')];
const SOURCE_FILES = [path.join(ROOT, 'App.js')];

const ROUTE_NAME_REGEX = /name="([A-Za-z0-9_]+)"/g;
const NAVIGATE_TARGET_REGEX = /navigate\(\s*['"]([A-Za-z0-9_]+)['"]/g;

const walkJsFiles = (dir) => {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walkJsFiles(entryPath));
      continue;
    }
    if (entryPath.endsWith('.js') || entryPath.endsWith('.jsx')) {
      files.push(entryPath);
    }
  }
  return files;
};

const extractByRegex = (content, regex) => {
  const result = [];
  let match = regex.exec(content);
  while (match) {
    result.push(match[1]);
    match = regex.exec(content);
  }
  return result;
};

describe('navigation route targets', () => {
  it('all navigation targets map to registered route names', () => {
    const navigatorContent = fs.readFileSync(NAVIGATOR_FILE, 'utf8');
    const registeredRoutes = new Set(extractByRegex(navigatorContent, ROUTE_NAME_REGEX));

    const filesToScan = [
      ...SOURCE_FILES,
      ...SOURCE_DIRS.flatMap((dir) => walkJsFiles(dir)),
    ];

    const unknownTargets = [];
    filesToScan.forEach((filePath) => {
      const content = fs.readFileSync(filePath, 'utf8');
      const targets = extractByRegex(content, NAVIGATE_TARGET_REGEX);
      targets.forEach((target) => {
        if (!registeredRoutes.has(target)) {
          unknownTargets.push({ target, filePath: path.relative(ROOT, filePath) });
        }
      });
    });

    expect(unknownTargets).toEqual([]);
  });
});
