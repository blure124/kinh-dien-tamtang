// src/pages/menu.json.js
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

  // Đệ quy sắp xếp thư mục và tập tin theo thứ tự số tự nhiên (Natural Sort: an1 -> an2 -> ... -> an10)
  function sortTree(obj) {
    const sorted = {};
    const keys = Object.keys(obj).sort((a, b) => 
      a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' })
    );

    for (const key of keys) {
      if (obj[key].isFile) {
        sorted[key] = obj[key];
      } else {
        sorted[key] = {
          isFile: false,
          children: sortTree(obj[key].children)
        };
      }
    }
    return sorted;
  }

  const sortedTree = sortTree(tree);

  return new Response(JSON.stringify(sortedTree), {
    headers: { 'Content-Type': 'application/json' }
  });
}
