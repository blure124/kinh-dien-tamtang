import fs from 'node:fs';
import path from 'node:path';

export async function GET() {
  const contentDir = path.join(process.cwd(), 'src/content/kinhdien');

  function getFiles(dir) {
    if (!fs.existsSync(dir)) return [];
    const dirents = fs.readdirSync(dir, { withFileTypes: true });
    const files = dirents.map((dirent) => {
      const res = path.resolve(dir, dirent.name);
      return dirent.isDirectory() ? getFiles(res) : res;
    });
    return Array.prototype.concat(...files);
  }

  const mdFiles = getFiles(contentDir).filter(f => f.endsWith('.md'));
  const tree = {};

  mdFiles.forEach(file => {
    const relativePath = file.replace(contentDir, '').replace(/\\/g, '/').replace(/^\//, '').replace('.md', '');
    const pathParts = relativePath.split('/');

    let currentLevel = tree;
    pathParts.forEach((part, index) => {
      if (index === pathParts.length - 1) {
        currentLevel[part] = { isFile: true, url: relativePath };
      } else {
        if (!currentLevel[part]) currentLevel[part] = { isFile: false, children: {} };
        currentLevel = currentLevel[part].children;
      }
    });
  });

  return new Response(JSON.stringify(tree), {
    headers: { 'Content-Type': 'application/json' }
  });
}
