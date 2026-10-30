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
let currentBatchLength = 0;
const MAX_BATCH_BYTES = 100000; // Giới hạn 100KB cho mỗi câu lệnh INSERT (an toàn tuyệt đối trước ngưỡng 1MB)
const MAX_CONTENT_LENGTH = 10000; // 10.000 ký tự / bài kinh (đủ trích xuất từ khóa tìm kiếm)

for (const file of files) {
  const relativePath = file.replace(contentDir, '').replace(/\\/g, '/').replace(/^\//, '').replace('.md', '');
  const url_kinh = '/' + relativePath;
  const title = path.basename(file, '.md').replace(/'/g, "''");
  
  let content = fs.readFileSync(file, 'utf-8');
  // Dọn dẹp ký tự Markdown
  content = content.replace(/[#'"*_\[\]>\-\n\r]/g, ' ').replace(/\s+/g, ' ').replace(/'/g, "''").trim();
  
  if (content.length > MAX_CONTENT_LENGTH) {
    content = content.substring(0, MAX_CONTENT_LENGTH);
  }
  
  const valueStr = `('${url_kinh}', '${title}', '${content}')`;
  
  // Nếu thêm bài này vào làm câu lệnh vượt quá 100KB, ghi câu lệnh cũ và tạo câu lệnh mới
  if (currentBatchLength + valueStr.length > MAX_BATCH_BYTES && currentBatch.length > 0) {
    sql += `INSERT INTO SearchIndex (url_kinh, title, content) VALUES ${currentBatch.join(', ')};\n`;
    currentBatch = [];
    currentBatchLength = 0;
  }
  
  currentBatch.push(valueStr);
  currentBatchLength += valueStr.length;
}

if (currentBatch.length > 0) {
  sql += `INSERT INTO SearchIndex (url_kinh, title, content) VALUES ${currentBatch.join(', ')};\n`;
}

fs.writeFileSync(sqlFile, sql);
console.log(`✅ Đã tạo thành công file seed-search.sql tối ưu dung lượng cho ${files.length} bài kinh!`);
