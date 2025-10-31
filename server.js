import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, 'public')));

const DATA_DIR = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const ORDERS_FILE = path.join(DATA_DIR, 'orders.json');

const cfg = {
  port: process.env.PORT || 3000,
  baseUrl: process.env.BASE_URL || 'http://localhost:3000',
  publicApiKey: process.env.PUBLIC_API_KEY || 'RyuuXiao',
  adminKey: process.env.ADMIN_KEY || 'CHANGE_ME_ADMIN_KEY',
  pajak: Number(process.env.PAJAK || '3'),
  paymentWindowMinutes: Number(process.env.PAYMENT_WINDOW_MINUTES || '30'),
  provider: {
    apikey: process.env.API_KEY || 'RyuuXiao',
    username: process.env.API_USERNAME || 'adjie22',
    tokenorkut: process.env.API_TOKENORKUT || ''
  }
};

function readJSON(file) {
  try { return JSON.parse(fs.readFileSync(file, 'utf-8')); }
  catch { return null; }
}
function writeJSON(file, data) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

function guardApiKey(req, res, next) {
  const key = req.query.apikey || req.headers['x-api-key'];
  if (key !== cfg.publicApiKey) return res.status(401).json({ status:false, message:'Invalid API key' });
  next();
}
function guardAdmin(req, res, next) {
  const key = req.headers['x-admin-key'];
  if (key !== cfg.adminKey) return res.status(401).json({ status:false, message:'Invalid admin key' });
  next();
}

function pickUnitPrice(prod) {
  const first = (prod.stok[0]||'').split('|');
  if (first.length >= 6 && !isNaN(Number(first[5]))) return Number(first[5]);
  return Number(prod.price);
}

function genRef(len=6) {
  const al = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let out = 'TRX-';
  for (let i=0;i<len;i++) out += al[Math.floor(Math.random()*al.length)];
  return out;
}

function deliverStock(order, products) {
  const prod = products.products.find(p => p.id === order.product_id);
  if (!prod) throw new Error('Product not found for delivery');
  const items = [];
  for (let i=0;i<order.qty;i++) {
    const line = prod.stok.shift();
    if (!line) break;
    const [email, pass, profil='-', pin='-', fa='-'] = line.split('|');
    items.push({ email, password: pass, profil, pin, fa });
  }
  prod.terjual += items.length;
  order.delivered = true;
  order.items = items;
  writeJSON(PRODUCTS_FILE, products);
}

app.get('/api/products', guardApiKey, (req, res) => {
  const products = readJSON(PRODUCTS_FILE) || { products: [] };
  const out = products.products.map(p => ({
    id: p.id, name: p.name, price: Number(p.price), category: p.category || '-', stok: p.stok.length, terjual: p.terjual||0
  }));
  res.json({ status:true, products: out });
});

app.get('/api/status', guardApiKey, (req, res) => {
  const trx_id = String(req.query.trx_id||'');
  const orders = readJSON(ORDERS_FILE) || [];
  const ord = orders.find(o => o.trx_id === trx_id);
  if (!ord) return res.status(404).json({ status:false, message:'Not found' });
  res.json({ status:true, ...ord });
});

app.post('/api/order', guardApiKey, async (req, res) => {
  try {
    const { product_id, qty=1, pay_now=false, paid=false } = req.body || {};
    const q = Math.max(1, Number(qty));
    const products = readJSON(PRODUCTS_FILE);
    if (!products) return res.status(500).json({ status:false, message:'Products storage missing' });
    const prod = products.products.find(p => p.id === product_id);
    if (!prod) return res.status(404).json({ status:false, message:'Product not found' });
    if (prod.stok.length < q) return res.status(400).json({ status:false, message:`Stok tidak cukup. Tersedia: ${prod.stok.length}` });

    const unit = pickUnitPrice(prod);
    const base = unit * q;
    const adminFee = Math.ceil(base * (cfg.pajak/100));
    const total = base + adminFee;
    const trx_id = genRef(6);
    const expiresAt = Date.now() + cfg.paymentWindowMinutes*60*1000;

    const orders = readJSON(ORDERS_FILE) || [];
    const order = {
      trx_id, product_id, qty: q, base, adminFee, total, paid: Boolean(paid),
      delivered: false, created_at: Date.now()
    };

    // If paid=true (testing), deliver immediately
    if (order.paid) {
      deliverStock(order, products);
      orders.push(order);
      writeJSON(ORDERS_FILE, orders);
      return res.json({ status:true, message:'Order berhasil & dikirim', trx_id, details:{ produk: prod.name, items: order.items } });
    }

    // If pay_now -> create QRIS
    let qris = null;
    if (pay_now) {
      const url = `https://apii.ryuuxiao.biz.id/orderkuota/createpayment`;
      try {
        const resp = await axios.get(url, {
          params: {
            apikey: cfg.provider.apikey,
            username: cfg.provider.username,
            token: cfg.provider.tokenorkut,
            amount: total
          }, timeout: 15000
        });
        if (resp?.data?.status) {
          const imageqris = resp.data.result?.imageqris?.url;
          qris = { amount: total, image_url: imageqris, expires_at: expiresAt };
          order.qris = qris;
        }
      } catch (e) {
        console.error('createpayment error', e.message);
      }
    }

    orders.push(order);
    writeJSON(ORDERS_FILE, orders);
    res.json({
      status:true, message:'Order dibuat', trx_id, total,
      ...(qris ? { qris } : {})
    });
  } catch (e) {
    console.error('order error', e);
    res.status(500).json({ status:false, message:'Server error' });
  }
});

// Admin endpoints
app.post('/api/admin/product', guardAdmin, (req, res) => {
  const { id, name, price, category, desc, snk, profit=0 } = req.body || {};
  if (!id || !name) return res.status(400).json({ status:false, message:'id & name required' });
  const data = readJSON(PRODUCTS_FILE) || { products: [], categories: [] };
  let p = data.products.find(x => x.id===id);
  if (!p) {
    p = { id, name, price:Number(price||0), category, desc, snk, profit:Number(profit), terjual:0, stok:[] };
    data.products.push(p);
  } else {
    p.name=name; p.price=Number(price||0); p.category=category; p.desc=desc; p.snk=snk; p.profit=Number(profit);
  }
  if (category && !data.categories.includes(category)) data.categories.push(category);
  writeJSON(PRODUCTS_FILE, data);
  res.json({ status:true, message:'Saved', product:p });
});

app.post('/api/admin/stock/add', guardAdmin, (req, res) => {
  const { product_id, lines=[] } = req.body || {};
  if (!product_id || !Array.isArray(lines) || lines.length===0) return res.status(400).json({ status:false, message:'product_id & lines required' });
  const data = readJSON(PRODUCTS_FILE);
  const p = data?.products?.find(x=>x.id===product_id);
  if (!p) return res.status(404).json({ status:false, message:'Product not found' });
  const sanitized = lines.map(l => String(l).trim()).filter(Boolean);
  p.stok.push(...sanitized);
  writeJSON(PRODUCTS_FILE, data);
  res.json({ status:true, added: sanitized.length, stok: p.stok.length });
});

app.post('/api/admin/stock/clear', guardAdmin, (req, res) => {
  const { product_id } = req.body || {};
  const data = readJSON(PRODUCTS_FILE);
  const p = data?.products?.find(x=>x.id===product_id);
  if (!p) return res.status(404).json({ status:false, message:'Product not found' });
  p.stok = []; writeJSON(PRODUCTS_FILE, data);
  res.json({ status:true, message:'Stock cleared' });
});

// Background polling of QRIS mutasi
setInterval(async () => {
  try {
    const orders = readJSON(ORDERS_FILE) || [];
    const pending = orders.filter(o => !o.paid && o.qris && Date.now() < (o.qris.expires_at||0));
    if (pending.length === 0) return;
    const url = `https://apii.ryuuxiao.biz.id/orderkuota/mutasiqr`;
    const r = await axios.get(url, { params:{
      apikey: cfg.provider.apikey,
      username: cfg.provider.username,
      token: cfg.provider.tokenorkut
    }, timeout: 15000 });
    const list = r?.data?.result || [];
    if (!Array.isArray(list) || list.length===0) return;
    const products = readJSON(PRODUCTS_FILE);
    let changed = false;
    for (const ord of pending) {
      const hit = list.find(x => x.status==='IN' && Number(String(x.kredit||'0').replace(/\./g,'')) === Number(ord.total));
      if (hit) {
        ord.paid = true;
        if (!ord.delivered) {
          try { deliverStock(ord, products); } catch(e) { console.error('deliver error', e.message); }
        }
        changed = true;
      }
    }
    if (changed) writeJSON(ORDERS_FILE, orders);
  } catch (e) {
    console.error('polling error', e.message);
  }
}, 10000);

// Fallback to index.html
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(cfg.port, () => {
  console.log('Server running on', cfg.port);
});
