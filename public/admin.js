const cfg = window.AppConfig;
const store = {
  get() { try { return JSON.parse(localStorage.getItem('rx_products') || 'null'); } catch { return null; } },
  set(data) { localStorage.setItem('rx_products', JSON.stringify(data)); }
};
const balanceStore = {
  get() { return Number(localStorage.getItem('rx_balance') || '0'); },
  set(n) { localStorage.setItem('rx_balance', String(n)); }
}

const defaults = {
  categories: ['Streaming', 'Game', 'Tools'],
  products: []
};
let data = store.get() || defaults;

const gate = document.getElementById('gate');
const adminArea = document.getElementById('adminArea');
document.getElementById('year').textContent = new Date().getFullYear().toString();

document.getElementById('loginBtn').onclick = () => {
  const u = document.getElementById('u').value;
  const p = document.getElementById('p').value;
  if (u === cfg.security.adminUser && p === cfg.security.adminPass) {
    gate.style.display = 'none';
    adminArea.style.display = 'block';
    renderTable();
    renderKPI();
  } else {
    alert('Username/Password salah');
  }
};

function renderKPI() {
  const total = data.products.length;
  const stok = data.products.reduce((a,b)=>a+b.stok.length,0);
  const sold = data.products.reduce((a,b)=>a+b.terjual,0);
  document.getElementById('k_total').textContent = String(total);
  document.getElementById('k_stok').textContent = String(stok);
  document.getElementById('k_sold').textContent = String(sold);
}

function renderTable() {
  const tb = document.querySelector('#prodTable tbody');
  tb.innerHTML = data.products.map(p => `
    <tr>
      <td class="mono">${p.id}</td>
      <td>${p.name}</td>
      <td class="right">Rp${new Intl.NumberFormat('id-ID').format(Number(p.price))}</td>
      <td>${p.category||'-'}</td>
      <td class="right">${p.stok.length}</td>
      <td class="right">${p.terjual}</td>
      <td>
        <button class="btn-ghost btn" onclick="fillForm('${p.id}')">Edit</button>
        <button class="btn-danger btn" onclick="delProd('${p.id}')">Hapus</button>
      </td>
    </tr>
  `).join('');
}

window.fillForm = (id) => {
  const p = data.products.find(x=>x.id===id);
  if (!p) return;
  document.getElementById('id').value = p.id;
  document.getElementById('name').value = p.name;
  document.getElementById('price').value = p.price;
  document.getElementById('profit').value = p.profit||0;
  document.getElementById('category').value = p.category||'';
  document.getElementById('desc').value = p.desc||'';
  document.getElementById('snk').value = p.snk||'';
};

window.delProd = (id) => {
  if (!confirm('Hapus produk '+id+' ?')) return;
  data.products = data.products.filter(p => p.id !== id);
  store.set(data); renderTable(); renderKPI();
};

document.getElementById('saveProduct').onclick = () => {
  const p = {
    id: document.getElementById('id').value.trim(),
    name: document.getElementById('name').value.trim(),
    price: Number(document.getElementById('price').value || '0'),
    profit: Number(document.getElementById('profit').value || '0'),
    category: document.getElementById('category').value.trim(),
    desc: document.getElementById('desc').value.trim(),
    snk: document.getElementById('snk').value.trim(),
    terjual: 0, stok: []
  };
  if (!p.id || !p.name) return alert('ID dan Nama wajib');
  const exist = data.products.find(x=>x.id===p.id);
  if (exist) {
    // Update keep existing stok & terjual
    exist.name = p.name; exist.price = p.price; exist.profit = p.profit;
    exist.category = p.category; exist.desc = p.desc; exist.snk = p.snk;
  } else {
    data.products.push(p);
    if (!data.categories.includes(p.category)) data.categories.push(p.category);
  }
  store.set(data); renderTable(); renderKPI(); alert('Tersimpan');
};

// Export/Import
document.getElementById('exportBtn').onclick = () => {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type:'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = 'products.json'; a.click();
};
document.getElementById('fileImport').onchange = async (e) => {
  const file = e.target.files[0]; if (!file) return;
  const text = await file.text();
  try {
    const j = JSON.parse(text);
    if (!j.products) throw new Error('format salah');
    data = j; store.set(data); renderTable(); renderKPI(); alert('Import sukses');
  } catch (e) {
    alert('Gagal import: '+e.message);
  }
};

// Stock
document.getElementById('addStock').onclick = () => {
  const id = document.getElementById('sid').value.trim();
  const p = data.products.find(x=>x.id===id);
  if (!p) return alert('Produk tidak ditemukan');
  const lines = (document.getElementById('stockArea').value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const priceOverride = Number(document.getElementById('sprice').value || '0');
  const newLines = lines.map(l => {
    const arr = l.split('|');
    while (arr.length < 6) arr.push('');
    if (priceOverride>0) arr[5] = String(priceOverride);
    return arr.join('|');
  });
  p.stok.push(*newLines);
  store.set(data); renderTable(); renderKPI(); alert('Stok ditambahkan: '+newLines.length);
};
document.getElementById('clearStock').onclick = () => {
  const id = document.getElementById('sid').value.trim();
  const p = data.products.find(x=>x.id===id);
  if (!p) return alert('Produk tidak ditemukan');
  if (!confirm('Kosongkan semua stok untuk '+id+'?')) return;
  p.stok = []; store.set(data); renderTable(); renderKPI();
};

// Balance simulation
document.getElementById('setBalance').onclick = () => {
  const n = Number(document.getElementById('balanceInput').value || '0');
  balanceStore.set(n); alert('Saldo diset');
};
document.getElementById('add50k').onclick = () => {
  balanceStore.set(balanceStore.get()+50000); alert('Saldo +50.000');
};
