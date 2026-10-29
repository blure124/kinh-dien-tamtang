export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // ==========================================
    // 1. KHU VỰC XỬ LÝ API (BACKEND)
    // ==========================================

    // API: Cỗ Máy Tìm Kiếm Toàn Văn (FTS5)
    if (url.pathname === '/api/search') {
      const query = url.searchParams.get('q');
      
      // Nếu không có từ khóa, trả về mảng rỗng
      if (!query) {
        return new Response(JSON.stringify([]), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
      
      // Loại bỏ ký tự lạ để chống SQL Injection
      const safeQuery = query.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
      
      if (safeQuery.length < 2) {
         return new Response(JSON.stringify([]), { status: 200, headers: { 'Content-Type': 'application/json' } });
      }

      try {
        // Truy vấn D1 bằng FTS5 MATCH và cắt trích đoạn (snippet)
        const { results } = await env.DB.prepare(`
          SELECT url_kinh, title, snippet(SearchIndex, 2, '<mark class="bg-yellow-200 text-gray-900 font-bold px-1 rounded">', '</mark>', '...', 25) as snippet
          FROM SearchIndex
          WHERE SearchIndex MATCH ?
          ORDER BY rank
          LIMIT 30
        `).bind(`"${safeQuery}"*`).all();
        
        return new Response(JSON.stringify(results), { 
          status: 200, 
          headers: { 'Content-Type': 'application/json' } 
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { 
          status: 500, 
          headers: { 'Content-Type': 'application/json' } 
        });
      }
    }

    // (Bạn có thể đặt thêm khối if (url.pathname === '/api/progress') {...} ở đây)
    // (Bạn có thể đặt thêm khối if (url.pathname === '/api/bookmarks') {...} ở đây)


    // ==========================================
    // 2. KHU VỰC TRẢ VỀ WEB TĨNH (FRONTEND)
    // ==========================================
    // Bất kỳ đường dẫn nào không phải API (như /kinh-pham-vong, ảnh, css...), 
    // Cloudflare sẽ tự động tìm và trả về file tĩnh tương ứng.
    return env.ASSETS.fetch(request);
  }
};
