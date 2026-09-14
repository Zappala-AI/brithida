let store = { config: {}, products: [], promos: [] };
let lastOrderCount = 0;
let ordersLoaded = false;
const $ = selector => document.querySelector(selector);
const esc = value => String(value ?? '').replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const hoursInput = $('#localHours');
if (hoursInput && hoursInput.tagName === 'INPUT') {
  const hoursEditor = document.createElement('textarea');
  hoursEditor.id = 'localHours'; hoursEditor.rows = 3;
  hoursEditor.placeholder = 'Ejemplo:\n11:00 a 15:00\n21:00 a 02:30';
  hoursInput.replaceWith(hoursEditor);
}
async function api(url, options = {}) {
  const response = await fetch(url, { credentials: 'include', headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }, ...options });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Error(data.error || 'No se pudo completar la operación');
  return data;
}
function renderProducts() {
  $('#products').innerHTML = store.products.map((product, index) => `<div class="admin-product" data-i="${index}"><input data-f="name" value="${esc(product.name)}" placeholder="Nombre"><input data-f="category" value="${esc(product.category)}" placeholder="Categoría"><input data-f="price" type="number" min="0" value="${Number(product.price) || 0}" placeholder="Precio"><input data-f="description" value="${esc(product.description)}" placeholder="Descripción"><input class="image-input" data-image="${index}" type="file" accept="image/png,image/jpeg,image/webp"><button class="remove-product" data-remove="${index}" type="button" aria-label="Eliminar producto">×</button>${product.image ? '<small>Imagen cargada ✓</small>' : ''}</div>`).join('');
  $('#products').querySelectorAll('[data-remove]').forEach(button => button.onclick = () => { store.products.splice(Number(button.dataset.remove), 1); renderProducts(); });
  $('#products').querySelectorAll('[data-image]').forEach(input => input.onchange = async () => {
    const file = input.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => { try { const saved = await api('/api/admin/image', { method: 'POST', body: JSON.stringify({ filename: file.name, dataUrl: reader.result }) }); store.products[Number(input.dataset.image)].image = saved.url; input.insertAdjacentHTML('afterend', '<small>Imagen cargada ✓</small>'); } catch (error) { alert(error.message); } };
    reader.readAsDataURL(file);
  });
}
function renderPromos() {
  $('#promos').innerHTML = store.promos.map((promo, index) => `<div class="promo-row"><input data-f="title" value="${esc(promo.title)}" placeholder="Título"><input data-f="text" value="${esc(promo.text)}" placeholder="Texto"><input data-f="price" value="${esc(promo.price)}" placeholder="Precio o promo"><button class="remove-product" data-remove-promo="${index}" type="button" aria-label="Eliminar promoción">×</button></div>`).join('');
  $('#promos').querySelectorAll('[data-remove-promo]').forEach(button => button.onclick = () => { store.promos.splice(Number(button.dataset.removePromo), 1); renderPromos(); });
}
function collect() {
  document.querySelectorAll('#products .admin-product').forEach((row, index) => { const get = field => row.querySelector(`[data-f="${field}"]`).value.trim(); store.products[index] = { ...store.products[index], name: get('name') || 'Producto', category: get('category') || 'Otros', price: Number(get('price')) || 0, description: get('description') || 'Producto BRITHIDA' }; });
  document.querySelectorAll('#promos .promo-row').forEach((row, index) => { const get = field => row.querySelector(`[data-f="${field}"]`).value.trim(); store.promos[index] = { ...store.promos[index], title: get('title'), text: get('text'), price: get('price') }; });
}
function renderOrders(orders) {
  const box = $('#orders');
  if (!orders.length) { box.innerHTML = '<p class="admin-muted">Todavía no hay pedidos recibidos.</p>'; return; }
  box.innerHTML = orders.map(order => `<article class="order-row"><strong>${esc(order.name || 'Cliente')} · ${esc(order.total || '')}</strong><small>${new Date(order.createdAt).toLocaleString('es-AR')} · ${esc(order.phone || '')}</small><p>${(order.items || []).map(esc).join('<br>')}</p><small>${esc(order.delivery || '')} · ${esc(order.address || '')} · ${esc(order.payment || '')}</small></article>`).join('');
}
async function refreshOrders(showNotification = true) {
  try {
    const result = await api('/api/admin/orders');
    if (showNotification && ordersLoaded && result.orders.length > lastOrderCount && 'Notification' in window && Notification.permission === 'granted') new Notification('Nuevo pedido BRITHIDA', { body: 'Entró un pedido nuevo. Revisalo en el panel.' });
    lastOrderCount = result.orders.length; ordersLoaded = true; renderOrders(result.orders);
  } catch { /* La sesión puede haber expirado. */ }
}
async function load() {
  store = await api('/api/store');
  $('#phone').value = store.config.whatsappPhone || ''; $('#instagram').value = store.config.instagramUrl || ''; $('#facebook').value = store.config.facebookUrl || ''; $('#delivery').value = store.config.deliveryNote || ''; $('#localAddress').value = store.config.localAddress || ''; $('#localHours').value = store.config.localHours || ''; $('#pickupText').value = store.config.pickupText || '';
  renderProducts(); renderPromos(); await refreshOrders(false); if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission(); setInterval(() => refreshOrders(true), 10000);
}
async function showPanel() {
  try { const session = await api('/api/admin/session'); if (!session.authenticated) return; $('#loginView').hidden = true; $('#panelView').hidden = false; await load(); } catch { /* mostrar login */ }
}
$('#loginForm').onsubmit = async event => { event.preventDefault(); try { await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: new FormData(event.target).get('password') }) }); await showPanel(); } catch (error) { $('#loginError').textContent = error.message; } };
$('#addProduct').onclick = () => { store.products.push({ id: `producto-${Date.now()}`, category: 'Otros', name: 'Nuevo producto', description: 'Descripción del producto.', price: 0, emoji: '🍽️', tone: 'gold' }); renderProducts(); };
$('#addPromo').onclick = () => { store.promos.push({ title: 'Nueva promo', text: 'Descripción de la promoción.', price: '' }); renderPromos(); };
$('#save').onclick = async () => {
  try {
    collect();
    const cleanUrl = value => { const url = value.trim(); if (!url || url === '#') return '#'; return /^https?:\/\//i.test(url) ? url : `https://${url}`; };
    store.config.whatsappPhone = $('#phone').value.trim();
    store.config.instagramUrl = cleanUrl($('#instagram').value);
    store.config.facebookUrl = cleanUrl($('#facebook').value);
    store.config.deliveryNote = $('#delivery').value.trim(); store.config.localAddress = $('#localAddress').value.trim(); store.config.localHours = $('#localHours').value.trim(); store.config.pickupText = $('#pickupText').value.trim();
    await api('/api/admin/store', { method: 'POST', body: JSON.stringify({ config: store.config, products: store.products, promos: store.promos }) });
    const currentPassword = $('#currentPassword').value; const newPassword = $('#newPassword').value;
    if (newPassword) { await api('/api/admin/password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }); $('#currentPassword').value = ''; $('#newPassword').value = ''; }
    $('#status').textContent = 'Guardado correctamente.'; $('#status').className = 'status'; setTimeout(() => $('#status').textContent = '', 3000);
  } catch (error) { $('#status').textContent = error.message; $('#status').className = 'error'; }
};
$('#logout').onclick = async () => { await api('/api/admin/logout', { method: 'POST' }); location.reload(); };
showPanel();
