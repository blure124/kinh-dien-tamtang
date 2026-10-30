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

let currentBatch = [];
let currentBatchBytes = 0;
// Giới hạn 25KB (25.000 Bytes UTF-8) / câu lệnh INSERT để đảm bảo không bao giờ vượt ngưỡng 100KB của D1
const MAX_BATCH_BYTES = 25000; 
const MAX_CONTENT_CHARS = 3000; // 3.000 ký tự / bài kinh (đủ bao quát toàn bộ từ khóa tìm kiếm)

for (const file of files) {
  const relativePath = file.replace(contentDir, '').replace(/\\/g, '/').replace(/^\//, '').replace('.md', '');
  const url_kinh = '/' + relativePath;
  const title = path.basename(file, '.md').replace(/'/g, "''");
  
  let content = fs.readFileSync(file, 'utf-8');
  // Dọn dẹp cú pháp Markdown
  content = content.replace(/[#'"*_\[\]>\-\n\r]/g, ' ').replace(/\s+/g, ' ').replace(/'/g, "''").trim();
  
  if (content.length > MAX_CONTENT_CHARS) {
    content = content.substring(0, MAX_CONTENT_CHARS);
  }
  
  const valueStr = `('${url_kinh}', '${title}', '${content}')`;
  // Đo chính xác dung lượng Byte UTF-8 của chuỗi tiếng Việt
  const valueBytes = Buffer.byteLength(valueStr, 'utf8');
  
  if (currentBatchBytes + valueBytes > MAX_BATCH_BYTES && currentBatch.length > 0) {
    sql += `INSERT INTO SearchIndex (url_kinh, title, content) VALUES ${currentBatch.join(', ')};\n`;
    currentBatch = [];
    currentBatchBytes = 0;
  }
  
  currentBatch.push(valueStr);
  currentBatchBytes += valueBytes;
}

if (currentBatch.length > 0) {
  sql += `INSERT INTO SearchIndex (url_kinh, title, content) VALUES ${currentBatch.join(', ')};\n`;
}

fs.writeFileSync(sqlFile, sql);
console.log(`✅ Đã tạo thành công file seed-search.sql chuẩn UTF-8 cho ${files.length} bài kinh!`);
