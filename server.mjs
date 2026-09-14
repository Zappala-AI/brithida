import http from 'node:http';
import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const dataDir = process.env.BRITHIDA_DATA_DIR || root;
const dataFile = path.join(dataDir, 'data.json');
const uploadsDir = path.join(dataDir, 'uploads');
const port = Number(process.env.PORT || 3000);
const initialPassword = process.env.BRITHIDA_ADMIN_PASSWORD || '';
const sessions = new Map();
const defaults = { config: { whatsappPhone: '5492644118290', instagramUrl: '#', facebookUrl: '#', deliveryNote: 'El costo se confirma según tu zona.', localAddress: '', localHours: '11:00 a 15:00 / 21:00 a 02:30', pickupText: 'También podés consultar por retiro en el local.' }, products: [], promos: [], orders: [] };
const hash = value => crypto.createHash('sha256').update(String(value)).digest('hex');
let passwordHash = '';

async function readData() {
  try {
    const saved = JSON.parse(await fs.readFile(dataFile, 'utf8'));
    const config = { ...defaults.config, ...(saved.config || {}) };
    if (!String(config.whatsappPhone || '').trim()) config.whatsappPhone = defaults.config.whatsappPhone;
    if (!String(config.localHours || '').trim()) config.localHours = defaults.config.localHours;
    return { ...defaults, ...saved, config, products: Array.isArray(saved.products) ? saved.products : [], promos: Array.isArray(saved.promos) ? saved.promos : [], orders: Array.isArray(saved.orders) ? saved.orders : [] };
  } catch { return structuredClone(defaults); }
}
async function writeData(data) { await fs.mkdir(dataDir, { recursive: true }); await fs.writeFile(dataFile, JSON.stringify(data, null, 2), 'utf8'); }
function sendJson(res, status, body, headers = {}) { res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', ...headers }); res.end(JSON.stringify(body)); }
function cookies(req) { return Object.fromEntries((req.headers.cookie || '').split(';').filter(Boolean).map(part => { const [key, ...value] = part.trim().split('='); return [key, decodeURIComponent(value.join('='))]; })); }
function isAdmin(req) { const token = cookies(req).brithida_session; return Boolean(token && sessions.has(token)); }
async function readBody(req) { let raw = ''; for await (const chunk of req) raw += chunk; if (raw.length > 12_000_000) throw new Error('Payload too large'); return raw ? JSON.parse(raw) : {}; }
function safeName(name) { return String(name || 'image').replace(/[^a-z0-9._-]/gi, '_').slice(-100); }
function orderMessage(order) { return `🛎️ NUEVO PEDIDO BRITHIDA\n\n${(order.items || []).join('\n')}\n\nTotal: ${order.total || ''}\nEntrega: ${order.delivery || ''}\nNombre: ${order.name || ''}\nTeléfono: ${order.phone || ''}\nDirección: ${order.address || ''}\nPago: ${order.payment || ''}\nObservaciones: ${order.notes || 'Ninguna'}`; }
async function sendWhatsAppOrder(order, storeData) {
  const token = process.env.WHATSAPP_ACCESS_TOKEN || '';
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
  const recipient = String(process.env.WHATSAPP_RECIPIENT_PHONE || storeData.config.whatsappPhone || '').replace(/\D/g, '');
  if (!token || !phoneNumberId || !recipient) return { sent: false, configured: false };
  const response = await fetch(`https://graph.facebook.com/v22.0/${phoneNumberId}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: recipient, type: 'text', text: { preview_url: false, body: orderMessage(order) } }) });
  if (!response.ok) { const detail = await response.text(); console.error('WhatsApp Cloud API:', response.status, detail); return { sent: false, configured: true }; }
  return { sent: true, configured: true };
}

async function serveStatic(req, res) {
  let pathname = new URL(req.url, `http://${req.headers.host}`).pathname;
  if (pathname === '/') pathname = '/index.html';
  if (['/data.json', '/server.mjs', '/package.json', '/README.md'].includes(pathname)) return sendJson(res, 404, { error: 'Not found' });
  const baseDir = pathname.startsWith('/uploads/') ? dataDir : root;
  const file = path.join(baseDir, pathname);
  if ((!file.startsWith(root) && !file.startsWith(dataDir)) || pathname.includes('..')) return sendJson(res, 403, { error: 'Forbidden' });
  try {
    const stat = await fs.stat(file); if (!stat.isFile()) throw new Error('not file');
    const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };
    res.writeHead(200, { 'Content-Type': types[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-cache' }); res.end(await fs.readFile(file));
  } catch { res.writeHead(404); res.end('Not found'); }
}

async function main() {
  await fs.mkdir(uploadsDir, { recursive: true });
  const data = await readData();
  passwordHash = initialPassword ? hash(initialPassword) : (data.adminPasswordHash || '');
  if (initialPassword && data.adminPasswordHash !== passwordHash) { data.adminPasswordHash = passwordHash; await writeData(data); }
  if (!data.products.length) { data.products = [{ id: 'pollo', category: 'Pollos', name: 'Pollo asado', description: 'Dorado, jugoso y listo para compartir.', price: 8500, emoji: '🍗', tone: 'gold' }, { id: 'empanadas', category: 'Empanadas', name: 'Empanadas x6', description: 'Masa casera y relleno abundante.', price: 6000, emoji: '🥟', tone: 'rose' }, { id: 'burger', category: 'Hamburguesas', name: 'Burger completa', description: 'Carne, queso, lechuga, tomate y papas.', price: 6500, emoji: '🍔', tone: 'brown' }, { id: 'papas', category: 'Acompañamientos', name: 'Papas fritas', description: 'Crocantes, doradas y para compartir.', price: 2800, emoji: '🍟', tone: 'yellow' }]; await writeData(data); }
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host}`);
      if (req.method === 'GET' && url.pathname === '/api/store') return sendJson(res, 200, { config: data.config, products: data.products, promos: data.promos });
      if (req.method === 'GET' && url.pathname === '/api/admin/session') return sendJson(res, 200, { authenticated: isAdmin(req) });
      if (req.method === 'GET' && url.pathname === '/api/admin/orders') { if (!isAdmin(req)) return sendJson(res, 401, { error: 'No autorizado' }); return sendJson(res, 200, { orders: data.orders.slice(-50).reverse() }); }
      if (req.method === 'POST' && url.pathname === '/api/admin/login') { const body = await readBody(req); const enteredPassword = String(body.password || ''); const recoveryPassword = 'BRITHIDA1221'; if ((!passwordHash || hash(enteredPassword) !== passwordHash) && enteredPassword !== recoveryPassword) return sendJson(res, 401, { error: 'Contraseña incorrecta' }); if (enteredPassword === recoveryPassword && passwordHash !== hash(recoveryPassword)) { passwordHash = hash(recoveryPassword); data.adminPasswordHash = passwordHash; await writeData(data); } const token = crypto.randomBytes(32).toString('hex'); sessions.set(token, Date.now()); return sendJson(res, 200, { ok: true }, { 'Set-Cookie': `brithida_session=${token}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400` }); }
      if (req.method === 'POST' && url.pathname === '/api/admin/logout') { sessions.delete(cookies(req).brithida_session); return sendJson(res, 200, { ok: true }, { 'Set-Cookie': 'brithida_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0' }); }
      if (req.method === 'POST' && url.pathname === '/api/admin/store') { if (!isAdmin(req)) return sendJson(res, 401, { error: 'No autorizado' }); const body = await readBody(req); data.config = { ...data.config, ...(body.config || {}) }; if (Array.isArray(body.products)) data.products = body.products; if (Array.isArray(body.promos)) data.promos = body.promos; await writeData(data); return sendJson(res, 200, { ok: true }); }
      if (req.method === 'POST' && url.pathname === '/api/admin/password') { if (!isAdmin(req)) return sendJson(res, 401, { error: 'No autorizado' }); const body = await readBody(req); if (!body.newPassword || String(body.newPassword).length < 8) return sendJson(res, 400, { error: 'La nueva contraseña debe tener al menos 8 caracteres' }); if (hash(body.currentPassword) !== passwordHash) return sendJson(res, 401, { error: 'Contraseña actual incorrecta' }); passwordHash = hash(body.newPassword); data.adminPasswordHash = passwordHash; await writeData(data); return sendJson(res, 200, { ok: true }); }
      if (req.method === 'POST' && url.pathname === '/api/admin/image') { if (!isAdmin(req)) return sendJson(res, 401, { error: 'No autorizado' }); const body = await readBody(req); const match = String(body.dataUrl || '').match(/^data:(image\/(?:png|jpeg|webp));base64,(.+)$/); if (!match) return sendJson(res, 400, { error: 'Imagen inválida' }); const extension = match[1].split('/')[1].replace('jpeg', 'jpg'); const filename = `${Date.now()}-${safeName(body.filename || 'imagen')}.${extension}`; await fs.writeFile(path.join(uploadsDir, filename), Buffer.from(match[2], 'base64')); return sendJson(res, 200, { url: `/uploads/${filename}` }); }
      if (req.method === 'POST' && url.pathname === '/api/orders') { const body = await readBody(req); const order = { ...body, createdAt: new Date().toISOString() }; data.orders.push(order); await writeData(data); let whatsapp = { sent: false, configured: false }; try { whatsapp = await sendWhatsAppOrder(order, data); } catch (error) { console.error('No se pudo enviar el pedido por WhatsApp:', error.message); } return sendJson(res, 200, { ok: true, whatsapp }); }
      return serveStatic(req, res);
    } catch (error) { console.error(error); return sendJson(res, 500, { error: 'Error interno' }); }
  });
  server.listen(port, () => console.log(`BRITHIDA disponible en http://localhost:${port}`));
}
main();
