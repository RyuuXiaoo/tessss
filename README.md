RyuuXiao Web Store — FULL (Frontend + Backend)
==============================================

Fitur
-----
- Frontend:
  - Toko (index.html), Admin (admin.html), API Docs (api.html)
  - Checkout + biaya admin
  - Kirim akun (TXT) setelah pembayaran
- Backend (Node.js + Express):
  - /api/products — list produk
  - /api/order — buat order (QRIS createpayment atau langsung paid untuk testing)
  - /api/status — cek status order
  - Admin endpoints: tambah/update produk, tambah/kosongkan stok
  - Polling mutasi QRIS tiap 10 detik — otomatis tandai order paid & kirim stok
  - Data disimpan di `data/products.json` & `data/orders.json`
  - Serve frontend dari `/public`

Konfigurasi
-----------
1) Duplikasi `.env.example` menjadi `.env` lalu sesuaikan:
   - PUBLIC_API_KEY=RyuuXiao
   - ADMIN_KEY=ubah_ke_token_rahasia_admin
   - API_KEY, API_USERNAME, API_TOKENORKUT sesuai kredensial kamu
   - PAJAK (default 3)
2) Install dependencies dan jalankan:
   ```bash
   npm install
   npm run start
   # buka http://localhost:3000
   ```

Alur Order
----------
1) Client memanggil `POST /api/order?apikey=RyuuXiao` body: `{ product_id, qty, pay_now:true }`
2) Server memanggil `createpayment` → balikan URL gambar QR + total + expired.
3) Server melakukan polling `mutasiqr` tiap 10 detik. Jika ada kredit IN == total:
   - tandai `paid=true`
   - ambil stok (pop) sebanyak qty
   - simpan detail akun ke order → `delivered=true`
4) Client bisa cek `GET /api/status?apikey=RyuuXiao&trx_id=...` sampai `delivered=true`.

Admin
-----
- Tambah/update produk: `POST /api/admin/product` header `x-admin-key`
- Tambah stok: `POST /api/admin/stock/add` header `x-admin-key`
- Kosongkan stok: `POST /api/admin/stock/clear` header `x-admin-key`

Catatan
-------
- Ini contoh implementasi production-ready dasar. Pastikan:
  - ADMIN_KEY diset unik dan aman
  - Validasi input & logging seperlunya
  - Pertimbangkan webhook dari provider agar tanpa polling (jika tersedia)
  - Backup file `data/*.json` atau ganti dengan DB (PostgreSQL/Redis)
