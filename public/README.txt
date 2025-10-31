RyuuXiao Web Store (Static Demo)
=================================

⚠️ Catatan Penting
------------------
- Ini adalah DEMO *static frontend* (HTML/CSS/JS) tanpa server backend.
- Stok dan transaksi disimpan di `localStorage` browser—tidak ada database server.
- Admin page dilindungi password (client-side) untuk kebutuhan demo.
- Integrasi pembayaran QRIS menggunakan endpoint publik yang Anda berikan:
    - createpayment
    - mutasiqr
  Klien men-generate QR dan melakukan polling mutasi hingga pembayaran masuk.

Kredensial
----------
Admin
  - User : admin
  - Pw   : ryuu

Konfigurasi API (config.js)
---------------------------
  window.AppConfig = {
    pajak: 3,
    api: {
      apikey: 'RyuuXiao',
      username: 'adjie22',
      tokenorkut: '1451589:fsoScMnGEp6kjIQav2L7l0ZWgd1NXVer'
    },
    security: { adminUser: 'admin', adminPass: 'ryuu' },
    paymentWindowMinutes: 30
  };

File Penting
------------
- index.html    : Halaman toko untuk customer
- admin.html    : Panel admin (password: admin/ryuu)
- styles.css    : Styling sederhana
- config.js     : Konfigurasi (fee, kredensial API)
- app.js        : Logika toko (checkout, QRIS, pengiriman produk, stok)
- admin.js      : Logika admin (crud produk, tambah/clear stok, export/import JSON)
- products.json : (opsional) contoh data jika Anda ingin memulai dari file

Alur Beli (Front-end Only)
--------------------------
1. User klik Beli → hitung total + biaya admin.
2. Jika saldo simulasi kurang:
   - Aplikasi memanggil `createpayment` untuk membuat QRIS.
   - Menampilkan QR dan countdown 30 menit.
   - Polling `mutasiqr` tiap 10 detik mencari IN dengan jumlah exact.
   - Jika ketemu → saldo ditambah otomatis sebesar kekurangan.
3. Potong total dari saldo → ambil stok sesuai jumlah → tampilkan & unduh file TXT.
4. Stok otomatis berkurang & terjual bertambah.
5. Semua data persistent di browser (localStorage).

Keamanan & Produksi
-------------------
- Untuk produksi, sebaiknya pakai backend (Node/Express) + database (PostgreSQL/Redis) agar:
  * Password admin tidak di-embed di client
  * Stok & transaksi disimpan aman
  * Webhook/payment callback — tanpa polling
  * Rate limiting & auth beneran
- Di demo ini, siapa pun yang punya file bisa mengakses API key (karena client-side). Gunakan hanya untuk keperluan testing.

Cara Pakai
----------
1. Extract ZIP, buka `index.html` untuk toko, `admin.html` untuk panel admin.
2. Tambah produk & stok via admin (format: email|password|profil|-|2fa|hargaOptional).
3. Uji checkout dan pembayaran (simulasi membutuhkan akses ke endpoint API).

Selesai. Selamat mencoba!
