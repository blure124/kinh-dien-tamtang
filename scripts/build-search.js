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
sql += "CREATE VIRTUAL TABLE SearchIndex USING fts5(url_kinh UNINDEXED, title, content);\n\n";

// Bắt đầu khối Transaction đầu tiên
sql += "BEGIN TRANSACTION;\n";

let count = 0;
for (const file of files) {
  const relativePath = file.replace(contentDir, '').replace(/\\/g, '/').replace(/^\//, '').replace('.md', '');
  const url_kinh = '/' + relativePath;
  const title = path.basename(file, '.md').replace(/'/g, "''");
  
  let content = fs.readFileSync(file, 'utf-8');
  content = content.replace(/[#'"*_\[\]>\-\n]/g, ' ').replace(/\s+/g, ' ').replace(/'/g, "''").trim();
  
  // Cắt bớt văn bản nếu quá 50.000 ký tự để giữ file SQL siêu nhẹ
  if (content.length > 50000) {
    content = content.substring(0, 50000);
  }
  
  sql += `INSERT INTO SearchIndex (url_kinh, title, content) VALUES ('${url_kinh}', '${title}', '${content}');\n`;
  count++;

  // Cứ 300 bài kinh thì COMMIT 1 lần và mở TRANSACTION mới để D1 xử lý siêu nhanh
  if (count % 300 === 0) {
    sql += "COMMIT;\nBEGIN TRANSACTION;\n";
  }
}

sql += "\nCOMMIT;\n";

fs.writeFileSync(sqlFile, sql);
console.log(`✅ Đã tạo thành công file seed-search.sql tối ưu Transaction cho ${files.length} bài kinh!`);
