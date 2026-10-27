export async function GET() {
  // Chỉ lấy đường dẫn, không tải nội dung file vào RAM
  const files = import.meta.glob('../content/kinhdien/**/*.md');
  const tree = {};

  Object.keys(files).forEach(file => {
    const urlPath = file.split('/content/kinhdien/')[1].replace('.md', '');
    const pathParts = urlPath.split('/');

    let currentLevel = tree;
    pathParts.forEach((part, index) => {
      if (index === pathParts.length - 1) {
        currentLevel[part] = { isFile: true, url: urlPath };
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
