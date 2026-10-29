// public/_worker.js

// Hàm mã hóa PIN một chiều (SHA-256)
async function hashPIN(pin) {
  const msgUint8 = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // =========================================================
    // 1. KHU VỰC XỬ LÝ API (BACKEND)
    // =========================================================
    if (url.pathname.startsWith('/api/')) {
      const headers = { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      };

      try {
        // -----------------------------------------------------
        // API 1: Tra Cứu Kinh Tạng Toàn Văn (FTS5)
        // -----------------------------------------------------
        if (url.pathname === '/api/search') {
          const query = url.searchParams.get('q');
          if (!query) return new Response(JSON.stringify([]), { status: 200, headers });
          
          const safeQuery = query.replace(/[^\p{L}\p{N}\s]/gu, '').trim();
          if (safeQuery.length < 2) return new Response(JSON.stringify([]), { status: 200, headers });

          const { results } = await env.DB.prepare(`
            SELECT url_kinh, title, snippet(SearchIndex, 2, '<mark class="bg-yellow-200 text-gray-900 font-bold px-1 rounded">', '</mark>', '...', 25) as snippet
            FROM SearchIndex
            WHERE SearchIndex MATCH ?
            ORDER BY rank
            LIMIT 30
          `).bind(`"${safeQuery}"*`).all();
          
          return new Response(JSON.stringify(results), { status: 200, headers });
        }

        // -----------------------------------------------------
        // API 2: Đăng Ký Tài Khoản
        // -----------------------------------------------------
        if (request.method === 'POST' && url.pathname === '/api/register') {
          const { username, pin } = await request.json();
          if (!username || !pin || pin.length !== 6) {
            return new Response(JSON.stringify({ error: 'Username và mã PIN 6 số là bắt buộc' }), { status: 400, headers });
          }

          const existing = await env.DB.prepare("SELECT username FROM Users WHERE username = ?").bind(username).first();
          if (existing) {
            return new Response(JSON.stringify({ error: 'Tài khoản đã tồn tại' }), { status: 400, headers });
          }

          const pinHash = await hashPIN(pin);
          await env.DB.prepare("INSERT INTO Users (username, pin_hash) VALUES (?, ?)").bind(username, pinHash).run();
          return new Response(JSON.stringify({ success: true, message: 'Đăng ký thành công' }), { status: 200, headers });
        }

        // -----------------------------------------------------
        // API 3: Đăng Nhập
        // -----------------------------------------------------
        if (request.method === 'POST' && url.pathname === '/api/login') {
          const { username, pin } = await request.json();
          const pinHash = await hashPIN(pin);

          const user = await env.DB.prepare("SELECT username FROM Users WHERE username = ? AND pin_hash = ?").bind(username, pinHash).first();
          if (!user) {
            return new Response(JSON.stringify({ error: 'Sai tài khoản hoặc mã PIN' }), { status: 401, headers });
          }

          const token = btoa(JSON.stringify({ username, exp: Date.now() + (86400000 * 30) }));
          return new Response(JSON.stringify({ success: true, token, username }), { status: 200, headers });
        }

        // -----------------------------------------------------
        // API 4: Quản Lý Ghi Chú & Tủ Sách (Bookmarks)
        // -----------------------------------------------------
        if (url.pathname === '/api/bookmarks') {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ error: 'Chưa đăng nhập' }), { status: 401, headers });
          
          const tokenStr = authHeader.replace('Bearer ', '');
          let username = '';
          try {
            const tokenData = JSON.parse(atob(tokenStr));
            if (tokenData.exp < Date.now()) throw new Error('Token hết hạn');
            username = tokenData.username;
          } catch(e) {
            return new Response(JSON.stringify({ error: 'Token không hợp lệ' }), { status: 401, headers });
          }

          // [POST] Lưu ghi chú mới
          if (request.method === 'POST') {
            const { url_kinh, selected_text, note_content } = await request.json();
            await env.DB.prepare(
              "INSERT INTO Bookmarks (username, url_kinh, paragraph_id, start_offset, end_offset, selected_text, note_content) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).bind(username, url_kinh, "global", 0, 0, selected_text, note_content || '').run();
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
          }

          // [GET] Tải danh sách ghi chú
          if (request.method === 'GET') {
            const urlKinh = url.searchParams.get('url');
            if (urlKinh) {
              const { results } = await env.DB.prepare(
                "SELECT id, selected_text, note_content FROM Bookmarks WHERE username = ? AND url_kinh = ?"
              ).bind(username, urlKinh).all();
              return new Response(JSON.stringify(results), { status: 200, headers });
            } else {
              const { results } = await env.DB.prepare(
                "SELECT id, url_kinh, selected_text, note_content, updated_at FROM Bookmarks WHERE username = ? ORDER BY updated_at DESC"
              ).bind(username).all();
              return new Response(JSON.stringify(results), { status: 200, headers });
            }
          }

          // [DELETE] Xóa Ghi chú hoặc Tiến trình theo ID
          if (request.method === 'DELETE') {
            const { id } = await request.json();
            await env.DB.prepare("DELETE FROM Bookmarks WHERE id = ? AND username = ?").bind(id, username).run();
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
          }
        }

        // -----------------------------------------------------
        // API 5: Lưu & Tải Tiến Trình Đọc (Progress)
        // -----------------------------------------------------
        if (url.pathname === '/api/progress') {
          const authHeader = request.headers.get('Authorization');
          if (!authHeader) return new Response(JSON.stringify({ error: 'Chưa đăng nhập' }), { status: 401, headers });
          
          const tokenStr = authHeader.replace('Bearer ', '');
          let username = '';
          try {
            const tokenData = JSON.parse(atob(tokenStr));
            username = tokenData.username;
          } catch(e) {
            return new Response(JSON.stringify({ error: 'Token không hợp lệ' }), { status: 401, headers });
          }

          // [POST] Lưu tọa độ VÀ đoạn chữ đang đọc dở
          if (request.method === 'POST') {
            const { url_kinh, scroll_y, text_snippet } = await request.json();
            await env.DB.prepare("DELETE FROM Bookmarks WHERE username = ? AND url_kinh = ? AND selected_text = '[PROGRESS]'").bind(username, url_kinh).run();
            
            const noteData = JSON.stringify({ y: scroll_y, text: text_snippet || '' });
            
            await env.DB.prepare(
              "INSERT INTO Bookmarks (username, url_kinh, paragraph_id, start_offset, end_offset, selected_text, note_content) VALUES (?, ?, 'PROGRESS', 0, 0, '[PROGRESS]', ?)"
            ).bind(username, url_kinh, noteData).run();
            return new Response(JSON.stringify({ success: true }), { status: 200, headers });
          }

          // [GET] Tải dữ liệu tiến trình
          if (request.method === 'GET') {
            const urlKinh = url.searchParams.get('url');
            if (urlKinh) {
               const record = await env.DB.prepare("SELECT note_content FROM Bookmarks WHERE username = ? AND url_kinh = ? AND selected_text = '[PROGRESS]'").bind(username, urlKinh).first();
               return new Response(JSON.stringify({ data: record ? record.note_content : null }), { status: 200, headers });
            }
          }
        }

        // Trả về 404 nếu không khớp API nào
        return new Response(JSON.stringify({ error: 'API route not found' }), { status: 404, headers });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
      }
    }

    // =========================================================
    // 2. KHU VỰC TRẢ VỀ WEB TĨNH (FRONTEND)
    // =========================================================
    return env.ASSETS.fetch(request);
  }
};
