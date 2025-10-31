// Utility
const fmt = new Intl.NumberFormat('id-ID');
const toRp = n => `Rp${fmt.format(n)}`;
const store = {
  get() { try { return JSON.parse(localStorage.getItem('rx_products') || 'null'); } catch { return null; } },
  set(data) { localStorage.setItem('rx_products', JSON.stringify(data)); },
};
const balanceStore = {
  get() { return Number(localStorage.getItem('rx_balance') || '0'); },
  add(n) { localStorage.setItem('rx_balance', String(this.get()+n)); },
  min(n) { localStorage.setItem('rx_balance', String(Math.max(0, this.get()-n))); },
  set(n) { localStorage.setItem('rx_balance', String(n)); }
}

// Initial data fallback (will be replaced if admin imports)
const defaults = {
  categories: ['Streaming', 'Game', 'Tools'],
  products: [
    {
      id: 'netflix', name: 'Netflix 1 Bulan', desc: 'Akun Netflix premium', snk: 'Garansi 7 hari',
      price: 30000, profit: 5000, terjual: 0, category: 'Streaming',
      stok: [
        'acc1@mail.com|pass1|Standard|-|-|32000',
        'acc2@mail.com|pass2|Premium|-|-|32000'
      ]
    },
    {
      id: 'spotify', name: 'Spotify Premium', desc: 'Premium individual', snk: 'Garansi 7 hari',
      price: 20000, profit: 4000, terjual: 0, category: 'Streaming',
      stok: [
        'spo1@mail.com|pass1|ID|-|-',
        'spo2@mail.com|pass2|ID|-|-'
      ]
    }
  ]
};

// State
let data = store.get() || defaults;
let feePct = Number(window.AppConfig?.pajak ?? 3);
document.getElementById('feePct').textContent = feePct;
document.getElementById('year').textContent = new Date().getFullYear().toString();
document.getElementById('userBalance').textContent = toRp(balanceStore.get());

// Populate category filter
const catSel = document.getElementById('category');
const setCategories = () => {
  catSel.innerHTML = '<option value="">Semua Kategori</option>' + data.categories.map(c => `<option>${c}</option>`).join('');
};
setCategories();

// Render products
const grid = document.getElementById('productGrid');
const prodCount = () => data.products.filter(p => p.stok.length>0).length;
const render = () => {
  const term = (document.getElementById('search').value || '').toLowerCase();
  const cat = catSel.value;
  const list = data.products.filter(p => (!term || (p.name.toLowerCase().includes(term) || p.id.toLowerCase().includes(term))) && (!cat || p.category===cat));
  document.getElementById('prodCount').textContent = String(prodCount());
  grid.innerHTML = list.map(p => {
    return `<div class="card">
      <h3>${p.name}</h3>
      <div class="muted">${p.desc || '-'}</div>
      <div class="row"><span class="tag">${p.category}</span><span class="pill">Stok: ${p.stok.length}</span><span class="pill">Terjual: ${p.terjual}</span></div>
      <div class="price">${toRp(Number(p.price))}</div>
      <div class="row">
        <input type="number" min="1" value="1" id="qty_${p.id}" aria-label="jumlah">
        <button class="btn" ${p.stok.length===0?'disabled':''} onclick="startBuy('${p.id}')">Beli</button>
      </div>
    </div>`
  }).join('');
};
render();

document.getElementById('search').addEventListener('input', render);
document.getElementById('category').addEventListener('change', render);
document.getElementById('reset').addEventListener('click', () => {
  document.getElementById('search').value='';
  document.getElementById('category').value='';
  render();
});

// Buying flow
const buyDialog = document.getElementById('buyDialog');
const deliverDialog = document.getElementById('deliverDialog');
const checkoutBody = document.getElementById('checkoutBody');
const deliverBody = document.getElementById('deliverBody');

window.startBuy = async function(id) {
  const prod = data.products.find(p => p.id === id);
  if (!prod) return alert('Produk tidak ditemukan');
  const qty = Number(document.getElementById('qty_'+id).value || '1');
  if (isNaN(qty) || qty <= 0) return alert('Jumlah tidak valid');
  if (prod.stok.length < qty) return alert(`Stok tidak cukup! Tersedia: ${prod.stok.length}`);

  // Determine unit price (per-stock override if provided)
  const sample = (prod.stok[0]||'').split('|');
  const unit = (sample.length>=6 && !isNaN(Number(sample[5]))) ? Number(sample[5]) : Number(prod.price);
  const base = unit * qty;
  const adminFee = Math.ceil(base * (feePct/100));
  const total = base + adminFee;
  const balance = balanceStore.get();

  const needTopUp = balance < total;
  const shortage = total - balance;

  // Build summary
  const summary = `
    <div class="row" style="justify-content:space-between">
      <div>
        <div class="muted">Produk</div>
        <div><strong>${prod.name}</strong></div>
      </div>
      <div class="right">
        <div class="muted">Jumlah</div>
        <div><strong>${qty}</strong></div>
      </div>
    </div>
    <hr style="border-color:#223;border-style:solid;border-width:1px 0 0 0;margin:12px 0"/>
    <table class="table">
      <tr><th>Harga Dasar</th><td class="right">${toRp(base)}</td></tr>
      <tr><th>Biaya Admin (${feePct}%)</th><td class="right">${toRp(adminFee)}</td></tr>
      <tr><th>Total</th><td class="right"><strong>${toRp(total)}</strong></td></tr>
      <tr><th>Saldo Anda</th><td class="right">${toRp(balance)}</td></tr>
      ${needTopUp ? `<tr><th>Kekurangan</th><td class="right"><span class="mono">${toRp(shortage)}</span></td></tr>` : ''}
    </table>
    <div class="row" style="justify-content:flex-end;gap:8px;margin-top:10px">
      <button class="btn-ghost btn" onclick="buyDialog.close()">Batal</button>
      ${needTopUp ? `<button class="btn" id="btnPay">Bayar Kekurangan</button>` : `<button class="btn" id="btnPay">Bayar & Proses</button>`}
    </div>
    <div id="payArea"></div>
  `;

  checkoutBody.innerHTML = summary;
  buyDialog.showModal();

  document.getElementById('btnPay').onclick = () => handlePay(prod, qty, base, adminFee, total, needTopUp ? shortage : 0);
};

async function handlePay(prod, qty, base, adminFee, total, shortage) {
  const payArea = document.getElementById('payArea');
  // If enough balance, just process
  if (shortage <= 0) {
    balanceStore.min(total);
    processOrder(prod, qty, base, adminFee, total);
    buyDialog.close();
    return;
  }
  // Create QRIS via API
  const { apikey, username, tokenorkut } = window.AppConfig.api;
  const createUrl = `https://apii.ryuuxiao.biz.id/orderkuota/createpayment?apikey=${encodeURIComponent(apikey)}&username=${encodeURIComponent(username)}&token=${encodeURIComponent(tokenorkut)}&amount=${encodeURIComponent(shortage)}`;
  payArea.innerHTML = `<div class="muted">Membuat QRIS...</div>`;
  try {
    const res = await fetch(createUrl);
    const json = await res.json();
    if (!json?.status) throw new Error('Gagal membuat QRIS');
    const qrUrl = json.result?.imageqris?.url;
    const deadline = Date.now() + (window.AppConfig.paymentWindowMinutes*60*1000);
    const id = cryptoRandom(8);

    payArea.innerHTML = `
      <div class="row" style="align-items:flex-start; gap:16px; margin-top:12px">
        <div class="qr"><img src="${qrUrl}" alt="QRIS" style="max-width:240px; width:100%;height:auto"/></div>
        <div style="flex:1">
          <div><strong>Scan QRIS untuk membayar ${toRp(shortage)}</strong></div>
          <div id="countdown" class="muted"></div>
          <div class="muted" style="margin-top:8px">ID Transaksi: <span class="mono">${id}</span></div>
          <div style="margin-top:8px"><button class="btn btn-danger" id="btnCancel">Batalkan</button></div>
        </div>
      </div>
    `;

    const countdownEl = document.getElementById('countdown');
    const t = setInterval(() => {
      const left = deadline - Date.now();
      if (left <= 0) {
        clearInterval(t); payArea.innerHTML = '<div class="muted">Waktu pembayaran habis.</div>';
        return;
      }
      const m = Math.floor(left/60000), s = Math.floor((left%60000)/1000);
      countdownEl.textContent = `Bayar sebelum ${new Date(deadline).toLocaleTimeString('id-ID', { hour12:false })} WIB (${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')})`;
    }, 1000);

    // Poll mutation every 10s
    let stop = false;
    document.getElementById('btnCancel').onclick = () => { stop = True; clearInterval(t); payArea.innerHTML = '<div class="muted">Transaksi dibatalkan.</div>'; };
    const poll = setInterval(async () => {
      if (stop) { clearInterval(poll); return; }
      if (Date.now() >= deadline) { clearInterval(poll); return; }
      try {
        const mutasiUrl = `https://apii.ryuuxiao.biz.id/orderkuota/mutasiqr?apikey=${encodeURIComponent(apikey)}&username=${encodeURIComponent(username)}&token=${encodeURIComponent(tokenorkut)}`;
        const r = await fetch(mutasiUrl);
        const j = await r.json();
        const list = j?.result || [];
        const found = list.find(x => x.status === 'IN' && Number((x.kredit||'0').replace(/\./g,'')) === shortage);
        if (found) {
          clearInterval(poll); clearInterval(t);
          // Top up user balance
          balanceStore.add(shortage);
          // Deduct total and process
          balanceStore.min(total);
          buyDialog.close();
          processOrder(prod, qty, base, adminFee, total);
        }
      } catch (e) {
        console.warn('Poll error', e);
      }
    }, 10000);
  } catch (e) {
    payArea.innerHTML = `<div class="muted">Error: ${e.message}</div>`;
  }
}

function processOrder(prod, qty, base, adminFee, total) {
  // Pull accounts
  const items = [];
  for (let i=0;i<qty;i++) {
    const line = prod.stok.shift();
    const [email, pass, profil='-', pin='-', fa='-', harga='-'] = (line||'').split('|');
    items.push({ email, pass, profil, pin, fa });
  }
  prod.terjual += qty;
  store.set(data);
  render();
  document.getElementById('userBalance').textContent = toRp(balanceStore.get());

  // Build delivery text
  const ref = cryptoRandom(8).toUpperCase();
  const now = new Date();
  const tanggal = now.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });
  const jam = now.toLocaleTimeString('id-ID', { hour12:false });
  const receipt = [
    '───「 ACCOUNT DETAIL 」───',
    'Silakan simpan detail berikut.',
    '',
    '╭────「 TRANSAKSI DETAIL 」────',
    `┊・ 🧾 Reff ID: ${ref}`,
    `┊・ 📦 Produk: ${prod.name}`,
    `┊・ 🏷️ Harga Dasar: ${toRp(base)}`,
    `┊・ 📈 Biaya Admin (${feePct}%): ${toRp(adminFee)}`,
    `┊・ 🛍️ Jumlah: ${qty}`,
    `┊・ 💰 Total Bayar: ${toRp(total)}`,
    `┊・ 📅 Tanggal: ${tanggal}`,
    `┊・ ⏰ Jam: ${jam} WIB`,
    '╰───────────────',
    '',
    '───「 SNK PRODUK 」───',
    (prod.snk || '-'),
    '',
    '───「 DATA AKUN 」───'
  ].join('\n');
  const akun = items.map(x => `• Email: ${x.email}\n• Password: ${x.pass}\n• Profil: ${x.profil}\n• Pin: ${x.pin}\n• 2FA: ${x.fa}\n`).join('\n');
  const txt = receipt + '\n' + akun;
  const blob = new Blob([txt], { type:'text/plain' });
  const url = URL.createObjectURL(blob);

  deliverBody.innerHTML = `
    <div class="muted">Pembelian berhasil. Unduh file TXT berisi akun di bawah ini.</div>
    <div style="margin:12px 0">
      <a class="btn" href="${url}" download="TRX-${ref}.txt">Unduh TRX-${ref}.txt</a>
    </div>
    <pre class="mono" style="white-space:pre-wrap; background:#0f1a3b; border:1px solid #243059; padding:12px; border-radius:12px; max-height:260px; overflow:auto">${txt.replace(/</g,'&lt;')}</pre>
  `;
  deliverDialog.showModal();
}

function cryptoRandom(len) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out='';
  for (let i=0;i<len;i++) out += alphabet[Math.floor(Math.random()*alphabet.length)];
  return out;
}
