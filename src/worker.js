// Hàm mã hóa PIN một chiều (Không thể dịch ngược)
async function hashPIN(pin) {
  const msgUint8 = new TextEncoder().encode(pin);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // 1. NẾU LÀ YÊU CẦU API -> Xử lý Database
    if (url.pathname.startsWith('/api/')) {
      const headers = { 'Content-Type': 'application/json' };

      try {
        // API 1: Đăng ký tài khoản
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

        // API 2: Đăng nhập
        if (request.method === 'POST' && url.pathname === '/api/login') {
          const { username, pin } = await request.json();
          const pinHash = await hashPIN(pin);

          const user = await env.DB.prepare("SELECT username FROM Users WHERE username = ? AND pin_hash = ?").bind(username, pinHash).first();
          if (!user) {
            return new Response(JSON.stringify({ error: 'Sai tài khoản hoặc mã PIN' }), { status: 401, headers });
          }

          // Cấp Token đơn giản (Hạn 30 ngày) cho Frontend lưu vào LocalStorage
          const token = btoa(JSON.stringify({ username, exp: Date.now() + (86400000 * 30) }));
          return new Response(JSON.stringify({ success: true, token, username }), { status: 200, headers });
        }

        return new Response(JSON.stringify({ error: 'API route not found' }), { status: 404, headers });

      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
      }
    }

    // 2. NẾU LÀ YÊU CẦU ĐỌC KINH -> Trả về HTML tĩnh siêu tốc
    return env.ASSETS.fetch(request);
  }
};
