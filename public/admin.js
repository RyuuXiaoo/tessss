
const cfg=window.AppConfig||{security:{adminUser:'admin',adminPass:'ryuu'}};
const store={get(){try{return JSON.parse(localStorage.getItem('rx_products')||'null')}catch{return null}},set(v){localStorage.setItem('rx_products',JSON.stringify(v))}};
const balance={set(n){localStorage.setItem('rx_balance',String(n))}};
let data=store.get()||{categories:['Streaming','Game','Tools','Voucher'],products:[]};

// theme toggle
const root=document.documentElement;const saved=localStorage.getItem('theme');if(saved)root.setAttribute('data-theme',saved);
document.getElementById('themeToggle').onclick=()=>{const cur=root.getAttribute('data-theme')==='light'?'dark':'light';root.setAttribute('data-theme',cur);localStorage.setItem('theme',cur)};

// login
const gate=document.getElementById('gate');const adminArea=document.getElementById('adminArea');
document.getElementById('loginBtn').onclick=()=>{const u=document.getElementById('u').value.trim(),p=document.getElementById('p').value.trim();if(u===cfg.security.adminUser&&p===cfg.security.adminPass){gate.style.display='none';adminArea.style.display='block';render()}else alert('Username/Password salah')};

// saldo
document.getElementById('setBalance').onclick=()=>{const n=Number(document.getElementById('balanceInput').value||'0');balance.set(n);toast('Saldo di-set ke Rp '+n.toLocaleString('id-ID'))};

// save/update product
document.getElementById('saveProduct').onclick=()=>{
  const p={id:id.value.trim(),name:name.value.trim(),price:Number(price.value||'0'),profit:Number(profit.value||'0'),category:category.value.trim(),desc:desc.value.trim(),snk:snk.value.trim(),terjual:0,stok:[]};
  if(!p.id||!p.name){alert('ID & nama wajib');return}
  const ex=(data.products||[]).find(x=>x.id===p.id);
  if(ex){ex.name=p.name;ex.price=p.price;ex.profit=p.profit;ex.category=p.category;ex.desc=p.desc;ex.snk=p.snk}
  else{data.products.push(p);if(p.category&&!data.categories.includes(p.category))data.categories.push(p.category)}
  store.set(data);render();toast('Produk disimpan');
};

// add stock
document.getElementById('addStock').onclick=()=>{
  const pid=document.getElementById('sid').value.trim();
  const item=(data.products||[]).find(x=>x.id===pid); if(!item){alert('Produk tidak ditemukan');return}
  const lines=(document.getElementById('stockArea').value||'').split('\n').map(s=>s.trim()).filter(Boolean);
  const over=Number(document.getElementById('sprice').value||'0');
  const mapped=lines.map(l=>{const a=l.split('|');while(a.length<6)a.push('');if(over>0)a[5]=String(over);return a.join('|')});
  item.stok.push(...mapped); store.set(data); render(); toast('Tambah stok: '+mapped.length);
};

// render table
function render(filter=''){
  const tb=document.querySelector('#prodTable tbody');
  const rows=(data.products||[]).filter(p=>!filter||p.name.toLowerCase().includes(filter)||p.id.toLowerCase().includes(filter)||(p.category||'').toLowerCase().includes(filter));
  tb.innerHTML=rows.map(p=>`<tr>
    <td>${p.id}</td><td>${p.name}</td><td>${p.price}</td><td>${p.category||'-'}</td>
    <td>${p.stok.length}</td><td>${p.terjual||0}</td>
    <td class="row">
      <button class="btn-ghost" data-act="edit" data-id="${p.id}">✏️ Edit</button>
      <button class="btn-ghost" data-act="clear" data-id="${p.id}">🧹 Hapus Stok</button>
      <button class="btn-ghost" data-act="del" data-id="${p.id}">🗑️ Hapus</button>
    </td>
  </tr>`).join('');
  tb.querySelectorAll('button').forEach(b=>b.onclick=()=>{
    const id=b.getAttribute('data-id'); const act=b.getAttribute('data-act');
    const p=(data.products||[]).find(x=>x.id===id); if(!p) return;
    if(act==='edit'){
      document.getElementById('id').value=p.id;
      document.getElementById('name').value=p.name;
      document.getElementById('price').value=p.price;
      document.getElementById('profit').value=p.profit||0;
      document.getElementById('category').value=p.category||'';
      document.getElementById('desc').value=p.desc||'';
      document.getElementById('snk').value=p.snk||'';
      toast('Data dimuat ke form. Ubah lalu klik Simpan/Update.');
      window.scrollTo({top:0,behavior:'smooth'});
    }
    if(act==='clear'){
      if(confirm('Kosongkan stok untuk '+id+'?')){ p.stok=[]; store.set(data); render(filter); toast('Stok dikosongkan'); }
    }
    if(act==='del'){
      if(confirm('Hapus produk '+id+'?')){ data.products=data.products.filter(x=>x.id!==id); store.set(data); render(filter); toast('Produk dihapus'); }
    }
  });
}

// search
document.getElementById('searchProd').addEventListener('input',e=>render((e.target.value||'').toLowerCase()));

// backup
document.getElementById('btnBackup').onclick=()=>{
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a'); a.href=url; a.download='rx-products-backup.json'; a.click();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Backup JSON diunduh');
};

// restore
document.getElementById('restoreFile').addEventListener('change', async (e)=>{
  const file=e.target.files?.[0]; if(!file) return;
  try{
    const text=await file.text();
    const json=JSON.parse(text);
    if(!json||!Array.isArray(json.products)) throw new Error('Format tidak valid');
    data=json; store.set(data); render(); toast('Restore berhasil');
  }catch(err){ alert('Restore gagal: '+err.message); }
  e.target.value='';
});

// helpers
function toast(msg){const t=document.getElementById('toast')||(()=>{const n=document.createElement('div');n.id='toast';document.body.appendChild(n);return n})();const el=document.createElement('div');el.className='toast';el.textContent=msg;t.appendChild(el);setTimeout(()=>{el.style.opacity='.0'},2200);setTimeout(()=>{t.removeChild(el)},2600)}
