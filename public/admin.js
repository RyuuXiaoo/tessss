const cfg=window.AppConfig.security;
document.getElementById('loginBtn').onclick=()=>{
  const u=document.getElementById('u').value,p=document.getElementById('p').value;
  if(u===cfg.adminUser&&p===cfg.adminPass){gate.style.display='none';adminArea.style.display='block';load()}
  else alert('Salah password');
};
async function load(){
  const r=await fetch('/api/products');const j=await r.json();
  const tb=document.querySelector('#prodTable tbody');
  tb.innerHTML=j.data.products.map(p=>`<tr><td>${p.id}</td><td>${p.name}</td></tr>`).join('');
}
document.getElementById('saveProduct').onclick=async()=>{
  const id='test';const name='Produk Tes';
  const body={id,name,price:10000};
  const r=await fetch('/api/products',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
  const j=await r.json();if(j.ok){alert('Produk disimpan');load();}else alert('Gagal');
};
