// scripts/build-search.js
const fs = require('fs');
const path = require('path');

const contentDir = path.join(process.cwd(), 'src/content/kinhdien');
const sqlFile = path.join(process.cwd(), 'seed-search.sql');

function getFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const dirents = fs.readdirSync(dir, { withFileTypes: true });
  const files = dirents.map((dirent) => {
    const res = path.resolve(dir, dirent.name);
    return dirent.isDirectory() ? getFiles(res) : res;
  });
  return Array.prototype.concat(...files);
}

const files = getFiles(contentDir).filter(f => f.endsWith('.md'));

let sql = "DROP TABLE IF EXISTS SearchIndex;\n";
sql += "CREATE VIRTUAL TABLE SearchIndex USING fts5(url_kinh UNINDEXED, title, content);\n";

let values = [];
for (const file of files) {
  // Lấy đường dẫn tương đối chuẩn hóa
  const relativePath = file.replace(contentDir, '').replace(/\\/g, '/').replace(/^\//, '').replace('.md', '');
  const url_kinh = '/' + relativePath;
  const title = path.basename(file, '.md').replace(/'/g, "''");
  
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/[#'"*_\[\]>\-\n]/g, ' ').replace(/\s+/g, ' ').replace(/'/g, "''").trim();
  
  values.push(`('${url_kinh}', '${title}', '${content}')`);
  
  if (values.length === 20) {
    sql += `INSERT INTO SearchIndex (url_kinh, title, content) VALUES ${values.join(', ')};\n`;
    values = [];
  }
}

if (values.length > 0) {
  sql += `INSERT INTO SearchIndex (url_kinh, title, content) VALUES ${values.join(', ')};\n`;
}

fs.writeFileSync(sqlFile, sql);
console.log(`✅ Đã tạo thành công file seed-search.sql chứa ${files.length} bài kinh!`);
