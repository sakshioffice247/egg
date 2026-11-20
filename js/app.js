/* EGG MOCKTAIL – app.js (static version: no server, no database, no external API)
   Everything runs inside the browser. The cart, orders and admin logs are kept in the
   browser's localStorage, so they survive a page refresh on the same computer/phone.
   Menu, prices and settings come from js/data.js. */
'use strict';
document.documentElement.classList.add('js');

const D = window.EM_DATA;
const R = D.restaurant, LOC = D.location, SOCIAL = D.social, DEL = D.delivery, SITE = D.site, MENU = D.menu;
const CUR = R.currency || '₹';

/* ============ HELPERS ============ */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = n => CUR + n;
const pad = n => String(n).padStart(2, '0');
const slug = s => String(s).toLowerCase().replace(/\s+/g, '-');
const WA_GENERIC = `https://wa.me/${R.whatsapp}?text=${encodeURIComponent('Hello EGG MOCKTAIL, I would like to place an order.')}`;
const MAPS_DIR = `https://www.google.com/maps/dir/?api=1&destination=${LOC.latitude},${LOC.longitude}`;
const MAPS_VIEW = LOC.place_link || `https://www.google.com/maps/search/?api=1&query=${LOC.latitude},${LOC.longitude}`;
const MAPS_EMBED = `https://maps.google.com/maps?q=${LOC.latitude},${LOC.longitude}&z=16&output=embed`;

/* ============ STORAGE (localStorage with a safe fallback) ============ */
const mem = {};
const store = {
  get(k, def) { try { const v = localStorage.getItem(k); if (v !== null) return JSON.parse(v); } catch (e) { /* blocked */ } return k in mem ? mem[k] : def; },
  set(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* blocked: memory only */ } }
};
const sess = {
  get(k) { try { return sessionStorage.getItem(k); } catch (e) { return mem['s_' + k] || null; } },
  set(k, v) { mem['s_' + k] = v; try { sessionStorage.setItem(k, v); } catch (e) { /* ignore */ } },
  del(k) { delete mem['s_' + k]; try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } }
};

/* ============ MENU LOOKUP ============ */
const ITEMS = {};
MENU.forEach(c => c.items.forEach(it => {
  ITEMS[it.id] = { id: it.id, name: it.name, price: typeof it.price === 'number' ? it.price : null, img: 'images/' + c.image, cat: c.name, catId: c.id };
}));

/* ============ TOAST ============ */
let toastTimer = 0;
function toast(msg, kind) {
  let t = $('#toast');
  if (!t) { document.body.insertAdjacentHTML('beforeend', '<div id="toast" class="toast" role="status" aria-live="polite"></div>'); t = $('#toast'); }
  t.textContent = msg; t.className = 'toast show ' + (kind || '');
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 4200);
}

/* ============ CART ============ */
let lastChanged = '';
let cart = store.get('em_cart', { items: [] });          // { items: [{id, quantity}] }
const lines = () => cart.items.filter(l => ITEMS[l.id] && ITEMS[l.id].price !== null).map(l => {
  const m = ITEMS[l.id]; return { id: l.id, name: m.name, cat: m.cat, price: m.price, quantity: l.quantity, line_total: m.price * l.quantity };
});
const cartCount = () => lines().reduce((a, l) => a + l.quantity, 0);
const cartSubtotal = () => lines().reduce((a, l) => a + l.line_total, 0);
const qtyOf = id => { const l = cart.items.find(i => i.id === id); return l ? l.quantity : 0; };
const saveCart = () => store.set('em_cart', cart);

function cartOp(op, id) {
  const maxQ = SITE.max_qty_per_item || 20, maxItems = SITE.max_items_in_cart || 100;
  if (op === 'clear') { cart.items = []; }
  else {
    const m = ITEMS[id]; if (!m || m.price === null) return;
    let l = cart.items.find(i => i.id === id);
    if (op === 'add') {
      if (cartCount() >= maxItems) { toast('Your order is full (maximum ' + maxItems + ' items).', 'err'); return; }
      if (l && l.quantity >= maxQ) { toast('Maximum ' + maxQ + ' of one item per order.', 'err'); return; }
      if (l) l.quantity++; else cart.items.push({ id, quantity: 1 });
    } else if (op === 'remove' && l) { l.quantity--; if (l.quantity <= 0) cart.items = cart.items.filter(i => i.id !== id); }
  }
  lastChanged = op === 'clear' ? '' : id;
  saveCart(); onCartChange();
}

function onCartChange() {
  $$('.qty[data-q]').forEach(e => { e.innerHTML = ctl(e.dataset.q); });
  refreshCart();
  if (typeof checkoutRefresh === 'function') checkoutRefresh();
  if (lastChanged) {
    $$(`button[data-a="${lastChanged}"]`).forEach(b => { const n = b.parentElement && b.parentElement.querySelector('b'); if (n) { n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); } });
    lastChanged = '';
  }
}

/* ============ LOGS / TRANSACTIONS (replace the database audit tables) ============ */
const nowISO = () => new Date().toISOString();
const utcStamp = () => nowISO().replace('T', ' ').slice(0, 19);
function audit(action, o = {}) {
  const logs = store.get('em_logs', []);
  logs.unshift({ at: utcStamp(), action, actor_type: o.actor_type || 'customer', actor: o.actor || '', entity_type: o.entity_type || '', entity_id: o.entity_id || '', details: o.details || '' });
  store.set('em_logs', logs.slice(0, 1000));
}
function addTxn(order, kind, note, by) {
  const t = store.get('em_txns', []);
  t.unshift({ at: utcStamp(), order_id: order.order_id, kind, amount: order.total, payment_method: order.payment_method, payment_status: order.payment_status, note: note || '', by: by || 'customer' });
  store.set('em_txns', t.slice(0, 1000));
}

/* ============ ORDERS ============ */
const ORDER_STATUSES = ['Pending', 'Confirmed', 'Preparing', 'Out for Delivery', 'Delivered', 'Cancelled'];
const PAYMENT_STATUSES = ['Unpaid', 'Paid', 'Refunded'];
const TERMINAL = ['Delivered', 'Cancelled'];
const getOrders = () => store.get('em_orders', []);
const saveOrders = o => store.set('em_orders', o);
const findOrder = id => getOrders().find(o => o.order_id === id);
const payLabel = id => { const m = (SITE.payment_methods || []).find(x => x.id === id); return m ? m.label : id; };
const stClass = s => 'st-' + slug(s);

function newOrderId() {
  const d = new Date(), chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let r = ''; for (let i = 0; i < 6; i++) r += chars[Math.floor(Math.random() * chars.length)];
  return `EM-${pad(d.getFullYear() % 100)}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${r}`;
}

function updateOrder(id, fn) {
  const all = getOrders(); const i = all.findIndex(o => o.order_id === id);
  if (i < 0) return null; fn(all[i]); saveOrders(all); return all[i];
}

function changeStatus(id, status, actorType, actor, note) {
  const o = findOrder(id); if (!o) return { err: 'Order not found.' };
  if (!ORDER_STATUSES.includes(status)) return { err: 'Unknown status.' };
  if (TERMINAL.includes(o.status)) return { err: 'This order is ' + o.status + ' and can no longer change.' };
  if (status === o.status) return { err: 'The order already has this status.' };
  const old = o.status;
  updateOrder(id, x => {
    x.status = status; x.updated_at = utcStamp();
    if (status === 'Cancelled') { x.cancelled_at = utcStamp(); x.cancel_reason = note || ''; }
    x.history.push({ old_status: old, new_status: status, at: utcStamp(), by: actorType === 'admin' ? actor : 'customer', note: note || '' });
  });
  audit(status === 'Cancelled' ? 'ORDER_CANCELLED' : 'ORDER_STATUS_CHANGED', { actor_type: actorType, actor, entity_type: 'order', entity_id: id, details: `from: ${old}, to: ${status}${note ? ', note: ' + note : ''}` });
  return { ok: true, old };
}

function changePayment(id, status, actor, note) {
  const o = findOrder(id); if (!o) return { err: 'Order not found.' };
  if (!PAYMENT_STATUSES.includes(status)) return { err: 'Unknown payment status.' };
  if (status === o.payment_status) return { err: 'Payment already has this status.' };
  const old = o.payment_status;
  const u = updateOrder(id, x => { x.payment_status = status; x.updated_at = utcStamp(); });
  addTxn(u, 'PAYMENT_STATUS_CHANGED', note || `${old} -> ${status}`, actor);
  audit('PAYMENT_STATUS_CHANGED', { actor_type: 'admin', actor, entity_type: 'order', entity_id: id, details: `from: ${old}, to: ${status}` });
  return { ok: true };
}

function whatsappMessage(o) {
  const L = [`*New order - ${R.name}*`, `Order ID: ${o.order_id}`, `Name: ${o.customer_name}`, `Phone: ${o.customer_phone}`,
    `Order type: ${o.order_type === 'delivery' ? 'Delivery' : 'Pickup'}`];
  if (o.order_type === 'delivery') L.push(`Delivery address: ${o.delivery_address}`);
  if (o.order_type === 'delivery' && o.delivery_method === 'gps') { L.push(`Distance from shop: ${o.delivery_km} km (from customer's live location)`); if (o.customer_map) L.push(`Customer location: ${o.customer_map}`); }
  else if (o.order_type === 'delivery' && o.delivery_method === 'manual') L.push('Delivery area was chosen manually (location not shared) - please verify.');
  L.push('', 'Items:');
  o.items.forEach((it, i) => L.push(`${i + 1}. ${it.name} - ${it.quantity} x ${CUR}${it.price} = ${CUR}${it.line_total}`));
  L.push('', `Subtotal: ${CUR}${o.subtotal}`);
  if (o.order_type === 'delivery') { L.push(`Delivery area: ${o.delivery_label}`); L.push(`Delivery charge: ${CUR}${o.delivery_charge}`); }
  else L.push('Delivery charge: none (pickup)');
  L.push(`*Total payable: ${CUR}${o.total}*`);
  L.push(`Payment: ${payLabel(o.payment_method)} - ${o.payment_status}`);
  if (o.notes) L.push(`Notes: ${o.notes}`);
  return L.join('\n');
}
const whatsappUrl = o => `https://wa.me/${R.whatsapp}?text=${encodeURIComponent(whatsappMessage(o))}`;

/* ============ DELIVERY (fixed area choices – no Google Maps, no API) ============ */
const ZONES = {
  zone: { label: 'Inside ' + DEL.zone_name, charge: DEL.zone_charge, note: 'Vijayanagar 4th Stage' },
  within: { label: `Outside ${DEL.zone_name}, within ${DEL.within_km_limit} km`, charge: DEL.within_km_charge, note: `Up to ${DEL.within_km_limit} km from the shop` },
  above: { label: `Above ${DEL.within_km_limit} km`, charge: DEL.above_km_charge, note: `More than ${DEL.within_km_limit} km from the shop` }
};
function haversineKm(a, b, c, d) {
  const r = x => x * Math.PI / 180, dLat = r(c - a), dLng = r(d - b);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a)) * Math.cos(r(c)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/* Delivery charge is decided by the straight-line distance between the customer's current
   location and the shop (LOC in js/data.js):
     within DEL.zone_radius_km (inside Vijayanagar 4th Stage) -> DEL.zone_charge       (Rs 25)
     up to DEL.within_km_limit km                              -> DEL.within_km_charge (Rs 50)
     above DEL.within_km_limit km                              -> DEL.above_km_charge  (Rs 70) */
const zoneForKm = km => km <= (DEL.zone_radius_km || 1.5) ? 'zone' : (km <= DEL.within_km_limit ? 'within' : 'above');
const fmtKm = km => (Math.abs(km - DEL.within_km_limit) < 0.1 || Math.abs(km - (DEL.zone_radius_km || 1.5)) < 0.1) ? km.toFixed(2) : km.toFixed(1);

/* ============ VALIDATION ============ */
function cleanName(v) { return String(v || '').replace(/\s+/g, ' ').trim().slice(0, 60); }
function validName(v) {
  const n = cleanName(v);
  if (n.length < 2) return [null, 'Please enter your name (at least 2 letters).'];
  if ((n.match(/[A-Za-z\u00C0-\u024F\u0900-\u0DFF]/g) || []).length < 2 || /[<>{}\[\]\\|^~`$%=;]/.test(n)) return [null, "Name can contain only letters, spaces and . ' -"];
  return [n, null];
}
function validPhone(v) {
  let d = String(v || '').replace(/[\s\-().]/g, '');
  if (d.replace(/\D/g, '').length > 10) d = d.replace(/^(\+91|0091|91|0)/, '');
  return /^[6-9]\d{9}$/.test(d) ? [d, null] : [null, 'Enter a valid 10-digit Indian mobile number (starts with 6, 7, 8 or 9).'];
}

/* ============ SHARED SNIPPETS ============ */
const SVG = {
  ig: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>',
  yt: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12 31 31 0 0 0 1 16.8a3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8ZM9.8 15.1V8.9L15.2 12l-5.4 3.1Z"/></svg>',
  x: '<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231Zm-1.161 17.52h1.833L7.084 4.126H5.117Z"/></svg>',
  wa: '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.8 14.2c-.2.7-1.4 1.3-1.9 1.4-.5.1-1.1.1-1.8-.1a14 14 0 0 1-4.5-2.8 9.5 9.5 0 0 1-2-2.7c-.4-.9-.1-1.9.5-2.5.2-.2.4-.3.6-.3h.4c.2 0 .4 0 .5.4l.8 1.9c.1.2 0 .4-.1.5l-.4.5c-.1.1-.2.3-.1.5.4.7 1.6 1.9 2.8 2.4.2.1.4.1.5-.1l.7-.8c.1-.2.3-.2.5-.1l1.8.9c.2.1.3.2.3.4 0 .3 0 .6-.1.9Z"/></svg>'
};
function socialLinks(withWa, cls) {
  const li = (url, label, icon) => url ? `<li><a href="${esc(url)}" target="_blank" rel="noopener noreferrer" aria-label="${esc(R.name)} on ${label}" title="${label}">${icon}<span>${label}</span></a></li>` : '';
  return `<ul class="${cls || 'social'}" aria-label="Follow ${esc(R.name)}">${li(SOCIAL.instagram, 'Instagram', SVG.ig)}${li(SOCIAL.youtube, 'YouTube', SVG.yt)}${li(SOCIAL.twitter_x && !/YOUR_X_USERNAME/.test(SOCIAL.twitter_x) ? SOCIAL.twitter_x : '', 'X', SVG.x)}${withWa ? li(WA_GENERIC, 'WhatsApp', SVG.wa) : ''}</ul>`;
}
const ctl = k => qtyOf(k)
  ? `<button type="button" data-d="${k}" aria-label="Remove one">−</button><b>${qtyOf(k)}</b><button type="button" data-a="${k}" aria-label="Add one">+</button>`
  : `<button type="button" class="btn sm" data-a="${k}">Add</button>`;
function cardHTML(k) {
  const it = ITEMS[k];
  const price = it.price === null ? '<span class="ask">Price on request</span>' : money(it.price);
  const control = it.price === null ? `<a class="btn sm o" href="tel:+91${esc(R.phone)}">Call</a>` : ctl(k);
  return `<article class="card rv" data-n="${esc((it.name + ' ' + it.cat).toLowerCase())}"><div class="pic">${SITE.sample_menu ? '<span class="badge">Sample</span>' : ''}<img src="${esc(it.img)}" alt="${esc(it.name)} at EGG MOCKTAIL, Vijayanagar, Mysuru" loading="lazy" decoding="async" width="400" height="300"></div><div class="cb"><h3>${esc(it.name)}</h3><p>${esc(it.cat)}</p><div class="row"><span class="price">${price}</span><div class="qty" data-q="${k}">${control}</div></div></div></article>`;
}
function renderMenuGrid(cats, heading) {
  return cats.map(c => `<section class="cat" id="cat-${esc(c.id)}" data-cat="${esc(c.id)}">${heading ? `<h2>${esc(c.name)}</h2>` : ''}<div class="mgrid">${c.items.map(i => cardHTML(i.id)).join('')}</div></section>`).join('');
}
const bandCta = (title, second) => `<section class="band"><div class="container"><h2 style="font-size:clamp(1.6rem,4vw,2.4rem)">${title}</h2><div class="cta"><a class="btn" data-order href="#/menu">Order Now</a>${second}</div></div></section>`;
const waBtn = '<a class="btn o" href="' + WA_GENERIC + '" target="_blank" rel="noopener noreferrer">Order on WhatsApp</a>';

/* ============ PAGES (public) ============ */
const pages = {};

pages.home = () => `
<section class="hero"><div class="hero-fx" aria-hidden="true"><i>🍳</i><i>🍹</i><i>🌯</i><i>🥚</i><i>🍔</i><i>🍨</i></div><div class="container hero-grid">
<div>
<p class="tag">${esc(R.tagline)}</p>
<h1>EGG <span>MOCKTAIL</span></h1>
<p class="lead">Egg rolls, egg burgers, egg biryani, egg snacks and refreshing mocktails in Vijayanagar, Mysuru.</p>
<p class="loc">&#128205; ${esc(R.address_lines)}</p>
<div class="cta"><a class="btn" data-order href="#/menu">Order Now</a><a class="btn o" href="#/menu">View Full Menu</a>${waBtn}</div>
</div>
<div class="collage"><img class="c1" src="images/cat-rolls.svg" alt="Egg rolls at EGG MOCKTAIL (sample picture)" width="400" height="300"><img class="c2" src="images/cat-mocktails.svg" alt="Fresh mocktails at EGG MOCKTAIL (sample picture)" width="400" height="300"><img class="c3" src="images/cat-burgers.svg" alt="Egg burgers at EGG MOCKTAIL (sample picture)" width="400" height="300"></div>
</div></section>
<div class="strip"><div class="container"><a href="#/menu/rolls">🌯 Egg Rolls</a><a href="#/menu/burgers">🍔 Egg Burgers</a><a href="#/menu/rice">🍚 Egg Biryani</a><a href="#/menu/starters">🍤 Egg Snacks</a><a href="#/menu/mocktails">🍹 Mocktails</a><a href="#/menu/ice-cream">🍨 Ice Cream</a></div></div>
<section><div class="container">
<h2 class="rv">Explore Our Menu</h2>
<p class="sub rv">From egg starters and burgers to rice, noodles, mocktails and ice cream. Tap a category to see its dishes.</p>
<div class="tiles">${MENU.map(c => `<a class="tile rv" href="#/menu/${esc(c.id)}"><img src="images/${esc(c.image)}" alt="${esc(c.name)} at EGG MOCKTAIL" loading="lazy" width="400" height="300"><h3>${esc(c.name)}</h3></a>`).join('')}</div>
</div></section>
<section class="alt"><div class="container">
<h2 class="rv">Must Try Starters</h2>
<p class="sub rv">A great way to begin. Add your favourites to your order and check out in a minute.</p>
<div id="featured">${MENU[0] ? renderMenuGrid([MENU[0]], false) : ''}</div>
<p style="margin-top:28px"><a class="btn o" href="#/menu">See the full menu</a></p>
${SITE.sample_menu ? '<p class="note">Sample dishes and pictures. The real menu and photos will replace these.</p>' : ''}
</div></section>
<section><div class="container center">
<h2 class="rv">How to Order</h2>
<p class="sub rv">Ordering from EGG MOCKTAIL takes three easy steps.</p>
<div class="steps">
<div class="step rv"><b>1</b><h3>Choose</h3><p>Browse the menu or search for a dish.</p></div>
<div class="step rv"><b>2</b><h3>Add to your order</h3><p>Pick quantities and see your bill and delivery charge.</p></div>
<div class="step rv"><b>3</b><h3>Place &amp; send on WhatsApp</h3><p>Your order gets an order ID, then opens in WhatsApp, ready to send.</p></div>
</div></div></section>
<section class="alt"><div class="container split">
<div class="rv"><h2>Egg Snacks, Rolls and Burgers in Mysuru</h2>
<p>EGG MOCKTAIL is a cafe for people who love eggs. Our menu is built around egg rolls, egg burgers, egg sandwiches, omelettes, egg fried rice and egg biryani, with cool mocktails and ice cream to finish.</p>
<p>Looking for egg food in Vijayanagar, a quick egg snack or a mocktail shop in Vijayanagar? We are near Marimallapa School. Read <a href="#/about"><u>about us</u></a> or open our <a href="#/contact"><u>contact and location</u></a> page.</p></div>
<div class="grid rv" style="grid-template-columns:1fr">
<div class="box"><h3>Eggetarian menu</h3><p>Starters, burgers, sandwiches, rolls, rice, noodles, fries, omelettes and main course dishes.</p></div>
<div class="box"><h3>Mocktails and ice cream</h3><p>Refreshing mocktails and ice cream to go with your meal.</p></div>
</div></div></section>
<section><div class="container split">
<div class="rv"><h2>Visit EGG MOCKTAIL</h2>
<p>${esc(R.address_lines)}</p>
<p>Phone: <a href="tel:+91${esc(R.phone)}"><b>${esc(R.phone)}</b></a></p>
<p style="margin-top:18px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn sm" href="${MAPS_DIR}" target="_blank" rel="noopener noreferrer">Get Directions</a><a class="btn sm o" href="${WA_GENERIC}" target="_blank" rel="noopener noreferrer">Order on WhatsApp</a><a class="btn sm o" href="#/contact">Contact Us</a></p></div>
${LOC.location_confirmed
    ? `<div class="rv"><iframe src="${MAPS_EMBED}" title="Map of ${esc(R.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>`
    : '<div class="mapph rv"><div><span>&#128205;</span><p><b>Google Maps pin coming soon</b></p><p class="demo">The exact map pin will be added once confirmed.</p></div></div>'}
</div></section>
<section class="band"><div class="container">
<h2 style="font-size:clamp(1.8rem,5vw,2.8rem)">Hungry? Order now.</h2>
<p class="sub" style="margin:10px auto 0">Pick your dishes and place your order online.</p>
<div class="cta"><a class="btn" data-order href="#/menu">Order Now</a>${waBtn}</div>
</div></section>`;

pages.about = () => `
<div class="ph"><div class="container"><h1>About EGG MOCKTAIL</h1><p>An Eggetarian Cafe in Vijayanagar, Mysuru.</p></div></div>
<section><div class="container split">
<div class="rv"><h2>Made for egg lovers</h2>
<p>EGG MOCKTAIL is an eggetarian cafe near Marimallapa School in Vijayanagar 4th Stage, Mysuru. We bring together the egg dishes people love, from egg rolls and egg burgers to omelettes, egg fried rice and egg biryani.</p>
<p>Pair your meal with a cool mocktail or finish with ice cream. Browse the <a href="#/menu"><u>full food menu</u></a> or find us on the <a href="#/contact"><u>contact and location</u></a> page.</p>
${SITE.sample_menu ? '<p class="note">Owner: replace this text with your own story and specialities.</p>' : ''}
<p style="margin-top:20px"><a class="btn" data-order href="#/menu">Order Now</a></p></div>
<div class="rv"><img class="aimg" src="images/cat-omelettes.svg" alt="Egg dishes at EGG MOCKTAIL (sample picture)" width="400" height="300"></div>
</div></section>
<section class="alt"><div class="container"><div class="grid">
<div class="box rv"><h3>Eggetarian menu</h3><p>Starters, burgers, sandwiches, rolls, rice, noodles, fries, omelettes and main course dishes.</p></div>
<div class="box rv"><h3>Mocktails and ice cream</h3><p>Refreshing mocktails and ice cream to go with your food.</p></div>
<div class="box rv"><h3>Easy ordering</h3><p>Add items to your order, see your delivery charge, and send your order on WhatsApp, or call us.</p></div>
</div></div></section>`;

let menuFilter = 'all';
pages.menu = (arg) => {
  menuFilter = MENU.some(c => c.id === arg) ? arg : 'all';
  return `
<div class="ph"><div class="container">
<h1>Full Food Menu</h1>
<p>Egg rolls, egg burgers, egg biryani, egg snacks, mocktails and more from EGG MOCKTAIL, Vijayanagar, Mysuru. Add items to your order, then check out.</p>
${SITE.sample_menu ? '<p class="note">Sample dishes and pictures. The real menu items, prices and photos will replace these.</p>' : ''}
</div></div>
<div class="tools"><div class="container">
<input id="q" type="search" placeholder="Search food: roll, biryani, mojito..." autocomplete="off" enterkeyhint="search" aria-label="Search food items">
<div class="chips" id="chips" role="group" aria-label="Menu categories"><button type="button" data-f="all">All</button>${MENU.map(c => `<button type="button" data-f="${esc(c.id)}">${esc(c.name)}</button>`).join('')}</div>
</div></div>
<div class="container" id="menu-root" style="padding-bottom:40px">${renderMenuGrid(MENU, true)}</div>
<div class="container"><p id="nores" hidden class="note">No dishes found. Try another word or choose "All".</p></div>
${bandCta('Ready to order?', waBtn)}`;
};
function applyFilters() {
  const q = $('#q'), t = q ? q.value.trim().toLowerCase() : '';
  let any = false;
  $$('[data-cat]').forEach(sec => {
    const inCat = menuFilter === 'all' || sec.dataset.cat === menuFilter;
    let show = 0;
    $$('.card', sec).forEach(c => { const m = inCat && (!t || c.dataset.n.includes(t)); c.hidden = !m; c.classList.add('in'); if (m) show++; });
    sec.hidden = !show; if (show) any = true;
  });
  const nr = $('#nores'); if (nr) nr.hidden = any;
  $$('#chips button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.f === menuFilter)));
  const on = $('#chips button[aria-pressed="true"]'), bar = $('#chips');
  if (on && bar && bar.scrollWidth > bar.clientWidth) bar.scrollTo({ left: on.offsetLeft - (bar.clientWidth - on.offsetWidth) / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
}
function jumpToMenuTop() {
  const root = $('#menu-root'), tools = $('.tools'); if (!root || !tools) return;
  const top = root.getBoundingClientRect().top + window.scrollY - tools.offsetHeight - ($('#site-header').offsetHeight || 0) - 8;
  if (window.scrollY > top) window.scrollTo({ top, behavior: reduceMotion() ? 'auto' : 'smooth' });
}
pages.menu.after = () => {
  const q = $('#q'); if (q) q.addEventListener('input', applyFilters);
  applyFilters();
  const chosen = $('#cat-' + menuFilter);
  if (menuFilter !== 'all' && chosen) setTimeout(() => chosen.scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
};

pages.contact = () => `
<div class="ph"><div class="container"><h1>Contact Us</h1><p>Call, WhatsApp or visit EGG MOCKTAIL near Marimallapa School, Vijayanagar, Mysuru.</p></div></div>
<section><div class="container split">
<div class="box rv"><h2>Find us</h2>
<p><b>${esc(R.name)}</b><br>${esc(R.address_lines)}</p>
<p>Phone: <a href="tel:+91${esc(R.phone)}"><b>${esc(R.phone)}</b></a></p>
<p>${esc(R.opening_hours)}</p>
<p style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><a class="btn sm" href="tel:+91${esc(R.phone)}">Call Now</a><a class="btn sm o" href="${WA_GENERIC}" target="_blank" rel="noopener noreferrer">Order on WhatsApp</a><a class="btn sm o" href="${MAPS_DIR}" target="_blank" rel="noopener noreferrer">Get Directions</a><a class="btn sm o" href="${esc(MAPS_VIEW)}" target="_blank" rel="noopener noreferrer">View on Google Maps</a></p>
${!LOC.location_confirmed ? '<p class="note">Placeholder map: the pin currently marks Marimallapa School. It will be replaced with the exact shop pin.</p>' : ''}
<h3 style="margin-top:22px">Follow us</h3>
${socialLinks(true)}</div>
<div class="rv"><iframe src="${MAPS_EMBED}" title="Map near ${esc(R.name)}" loading="lazy" referrerpolicy="no-referrer-when-downgrade"></iframe></div>
</div></section>
<section class="alt"><div class="container center">
<h2 class="rv">Delivery charges</h2>
<p class="sub rv">At checkout we measure the distance between your current location and the shop, and the right charge is added automatically.</p>
<div class="grid rv">
<div class="box"><h3>${money(DEL.zone_charge)}</h3><p>Inside ${esc(DEL.zone_name)}</p></div>
<div class="box"><h3>${money(DEL.within_km_charge)}</h3><p>Outside ${esc(DEL.zone_name)}, within ${DEL.within_km_limit} km</p></div>
<div class="box"><h3>${money(DEL.above_km_charge)}</h3><p>Above ${DEL.within_km_limit} km</p></div>
</div></div></section>
${bandCta('Prefer to order from the menu?', '<a class="btn o" href="#/menu">View Full Menu</a>')}`;

pages.notfound = () => `<section><div class="container center"><p class="tag">Error 404</p><h1 style="font-size:clamp(2rem,6vw,3.4rem)">Page not found</h1>
<p class="sub" style="margin:14px auto 24px">That page does not exist.</p>
<p><a class="btn" href="#/">Back to home</a> <a class="btn o" href="#/menu">View menu</a></p></div></section>`;

/* ----- CHECKOUT ----- */
let ck = { zone: '', type: 'delivery', busy: false };
pages.checkout = () => `
<div class="ph"><div class="container"><h1>Checkout</h1><p>Check your items, choose how you want to get your order, and place it. Then send it on WhatsApp.</p></div></div>
<section><div class="container co-grid">
<form id="co-form" class="co-form box" novalidate autocomplete="on">
  <div id="co-alert" class="alert err" role="alert" hidden></div>
  <fieldset class="seg">
    <legend>How would you like to get your order?</legend>
    <label class="seg-opt"><input type="radio" name="order_type" value="delivery" checked><span>🛵 Delivery</span></label>
    <label class="seg-opt"><input type="radio" name="order_type" value="pickup"><span>🏪 Pickup</span></label>
  </fieldset>
  <div class="field"><label for="f-name">Your name</label>
    <input id="f-name" name="name" maxlength="60" autocomplete="name" required aria-describedby="e-name"><p class="ferr" id="e-name" hidden></p></div>
  <div class="field"><label for="f-phone">Mobile number</label>
    <input id="f-phone" name="phone" inputmode="numeric" maxlength="16" autocomplete="tel-national" placeholder="10-digit mobile number" required aria-describedby="e-phone"><p class="ferr" id="e-phone" hidden></p></div>
  <div id="delivery-block">
    <div class="field"><label>Delivery charge (based on your distance from the shop)</label>
      <div class="locbox" id="locbox" data-state="idle">
        <div class="radar" aria-hidden="true"><i></i><i></i><i></i><span>📍</span></div>
        <div class="locmain">
          <p class="locline" id="loc-line">We work out your delivery charge from the distance between your current location and the shop.</p>
          <div class="addr-actions"><button type="button" class="btn sm" id="btn-locate">📍 Use my current location</button></div>
        </div>
      </div>
      <div id="quote-box" class="quote" aria-live="polite" hidden></div>
      <fieldset class="zones" id="zones">
        ${Object.entries(ZONES).map(([k, z]) => `<label class="zone-opt"><input type="radio" name="zone" value="${k}"><span><b>${esc(z.label)}</b><small>${esc(z.note)}</small></span><em>${money(z.charge)}</em></label>`).join('')}
      </fieldset>
      <p class="ferr" id="e-zone" hidden></p>
      <p class="hint" id="zone-hint" hidden>Location is not available, so please choose your delivery area above. The shop will check it against your address.</p>
    </div>
    <div class="field"><label for="f-address">Delivery address</label>
      <textarea id="f-address" name="address" rows="3" maxlength="300" autocomplete="street-address" placeholder="House / flat number, street, area, landmark, Mysuru" aria-describedby="e-address"></textarea>
      <p class="ferr" id="e-address" hidden></p></div>
  </div>
  <div class="field"><label for="f-notes">Notes for the kitchen (optional)</label>
    <input id="f-notes" name="notes" maxlength="200" placeholder="For example: less spicy, no onion"></div>
  <div class="field"><label for="f-pay">Payment method</label>
    <select id="f-pay" name="payment_method">${(SITE.payment_methods || []).map(m => `<option value="${esc(m.id)}">${esc(m.label)}</option>`).join('')}</select>
    <p class="hint">Payment is <b>not</b> taken on this website. You pay when you receive or collect the order. The shop marks it as paid.</p></div>
  <button type="submit" class="btn big" id="btn-place" disabled>Place order</button>
  <p class="hint" id="place-hint">Add items to your order to continue.</p>
</form>
<aside class="co-summary box" aria-label="Order summary">
  <h2>Your order</h2>
  <div id="co-items" class="list"></div>
  <dl class="bill">
    <div><dt>Food subtotal</dt><dd id="b-sub">–</dd></div>
    <div><dt>Delivery area</dt><dd id="b-cat">–</dd></div>
    <div><dt>Delivery charge</dt><dd id="b-chg">–</dd></div>
    <div class="grand"><dt>Final amount payable</dt><dd id="b-total">–</dd></div>
  </dl>
  <p><a class="btn o sm" href="#/menu">+ Add more items</a></p>
</aside>
</div></section>`;

function checkoutRefresh() {
  const form = $('#co-form'); if (!form) return;
  const delivery = ck.type === 'delivery';
  const z = ZONES[ck.zone];
  const setText = (id, v) => { const e = $(id); if (!e) return; if (e.textContent !== v) { e.textContent = v; if (e.tagName === 'DD' && e.dataset.seen) { e.classList.remove('flash'); void e.offsetWidth; e.classList.add('flash'); } } e.dataset.seen = '1'; };
  $('#co-items').innerHTML = lines().length ? lines().map(lineHTML).join('') : '<p class="demo">Your order is empty. <a href="#/menu"><u>Browse the menu</u></a></p>';
  setText('#b-sub', money(cartSubtotal()));
  if (!delivery) { setText('#b-cat', 'Pickup – no delivery'); setText('#b-chg', money(0)); setText('#b-total', money(cartSubtotal())); }
  else if (z) { setText('#b-cat', z.label + (ck.auto && ck.km != null ? ' · ' + fmtKm(ck.km) + ' km' : '')); setText('#b-chg', money(z.charge)); setText('#b-total', money(cartSubtotal() + z.charge)); }
  else { setText('#b-cat', '–'); setText('#b-chg', '–'); setText('#b-total', '–'); }
  const ready = cartCount() > 0 && !ck.busy && (!delivery || !!z);
  $('#btn-place').disabled = !ready;
  $('#place-hint').textContent = !cartCount() ? 'Add items to your order to continue.' : (delivery && !z ? (ck.locating ? 'Finding your location to calculate the delivery charge…' : 'Allow location access (or choose your area) to see the delivery charge.') : 'Your order is saved before WhatsApp opens.');
}

pages.checkout.after = () => {
  const form = $('#co-form');
  const f = n => form.elements[n];
  ck = { zone: '', type: 'delivery', busy: false, km: null, auto: false, locating: false };
  const fieldError = (name, msg) => {
    const p = $('#e-' + name); if (!p) return;
    p.hidden = !msg; p.textContent = msg || '';
    const el = form.elements[name]; if (el && el.setAttribute) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
  };
  const alertBox = msg => { const a = $('#co-alert'); a.hidden = !msg; a.textContent = msg || ''; if (msg) a.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); };
  const showQuote = (html, kind) => { const b = $('#quote-box'); b.hidden = !html; b.className = 'quote ' + (kind || ''); b.innerHTML = html || ''; };

  form.addEventListener('change', e => {
    if (e.target.name === 'order_type') {
      ck.type = e.target.value; $('#delivery-block').hidden = ck.type !== 'delivery'; alertBox(''); fieldError('zone', ''); fieldError('address', '');
    }
    if (e.target.name === 'zone') { ck.zone = e.target.value; ck.auto = false; ck.km = null; fieldError('zone', ''); }
    checkoutRefresh();
  });

  /* ----- distance-based delivery charge ----- */
  const locbox = $('#locbox'), locLine = $('#loc-line'), zonesEl = $('#zones'), locBtn = $('#btn-locate');
  const setLoc = (state, line) => { locbox.dataset.state = state; if (line) locLine.textContent = line; };
  const lockZones = on => { zonesEl.disabled = on; zonesEl.classList.toggle('locked', on); $('#zone-hint').hidden = on; };
  const meterHTML = km => {
    const lim = DEL.within_km_limit, rad = DEL.zone_radius_km || 1.5, max = lim * 1.6;
    const pct = Math.min(km / max, 1) * 100;
    return `<div class="meter" style="--zp:${(rad / max) * 100}%;--lp:${(lim / max) * 100}%"><div class="meter-track"><span class="meter-fill" style="--w:${pct}%"></span><i class="tick t1"></i><i class="tick t2"></i><span class="meter-pin" style="--w:${pct}%" aria-hidden="true">🛵</span></div><div class="meter-lbl"><em style="left:0">Shop</em><em style="left:${(rad / max) * 100}%">${rad} km</em><em style="left:${(lim / max) * 100}%">${lim} km</em></div></div>`;
  };
  function locFail(msg) {
    ck.locating = false; locBtn.disabled = false; locBtn.textContent = '📍 Try again';
    const wasAuto = ck.auto; ck.auto = false; ck.km = null; lockZones(false);
    if (wasAuto) { ck.zone = ''; form.querySelectorAll('input[name="zone"]').forEach(r => { r.checked = false; }); }
    setLoc('err', 'We could not read your location.');
    showQuote(`<p>⚠ ${esc(msg)}</p><p class="hint">You can still order: choose your delivery area below, or tap “Try again”.</p>`, 'err');
    checkoutRefresh();
  }
  function detectLocation() {
    if (ck.locating) return;
    if (!navigator.geolocation) { locFail('Your browser cannot share your location.'); return; }
    ck.locating = true; locBtn.disabled = true; locBtn.innerHTML = '<span class="spin" aria-hidden="true"></span> Finding you…';
    setLoc('busy', 'Finding your current location…'); showQuote('', ''); checkoutRefresh();
    navigator.geolocation.getCurrentPosition(pos => {
      ck.locating = false; locBtn.disabled = false; locBtn.textContent = '🔄 Update my location';
      const km = haversineKm(LOC.latitude, LOC.longitude, pos.coords.latitude, pos.coords.longitude);
      const key = zoneForKm(km), z = ZONES[key];
      Object.assign(ck, { km, zone: key, auto: true, lat: pos.coords.latitude, lng: pos.coords.longitude, acc: Math.round(pos.coords.accuracy || 0) });
      const radio = form.querySelector(`input[name="zone"][value="${key}"]`); if (radio) radio.checked = true;
      lockZones(true); fieldError('zone', '');
      setLoc('ok', `Location found. You are ${fmtKm(km)} km from the shop.`);
      showQuote(`<p>You are about <b>${fmtKm(km)} km</b> from the shop, so your delivery charge is <b>${money(z.charge)}</b> (${esc(z.label)}).</p>${meterHTML(km)}<p class="hint">${ck.acc > 1500 ? '⚠ Location accuracy is low (±' + ck.acc + ' m), so the shop may re-check the charge. ' : ''}Straight-line distance from your current location to the shop.</p>`, 'ok');
      checkoutRefresh();
    }, err => {
      let msg = err.code === 1 ? 'Location permission was denied. Allow location access in your browser, or choose your area from the list.'
        : err.code === 3 ? 'Finding your location took too long. Please try again or choose your area from the list.'
        : 'We could not find your location. Please try again or choose your area from the list.';
      if (location.protocol === 'http:' && !/^(localhost|127\.)/.test(location.hostname)) msg += ' (Browsers only share location on secure https websites.)';
      locFail(msg);
    }, { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 });
  }
  locBtn.addEventListener('click', detectLocation);

  form.addEventListener('submit', e => {
    e.preventDefault();
    if (ck.busy) return;
    alertBox(''); ['name', 'phone', 'address', 'zone'].forEach(n => fieldError(n, ''));
    let bad = false;
    const [name, nameErr] = validName(f('name').value);
    const [phone, phoneErr] = validPhone(f('phone').value);
    if (nameErr) { fieldError('name', nameErr); bad = true; }
    if (phoneErr) { fieldError('phone', phoneErr); bad = true; }
    const delivery = ck.type === 'delivery';
    const addr = f('address').value.replace(/\s+/g, ' ').trim();
    if (delivery) {
      if (!ZONES[ck.zone]) { fieldError('zone', 'Please share your location (or choose your delivery area) so we can work out the delivery charge.'); bad = true; }
      if (!addr) { fieldError('address', 'Please enter your delivery address.'); bad = true; }
      else if (addr.length < 10) { fieldError('address', 'Please enter a fuller address (house number, street, area, landmark).'); bad = true; }
    }
    if (!lines().length) { alertBox('Your order is empty. Please add items from the menu.'); return; }
    if (bad) { const first = $('[aria-invalid="true"]', form); if (first) first.focus(); return; }

    ck.busy = true;
    const btn = $('#btn-place'); btn.disabled = true; btn.innerHTML = '<span class="spin" aria-hidden="true"></span> Saving your order…';
    const items = lines().map(l => ({ id: l.id, name: l.name, category: l.cat, price: l.price, quantity: l.quantity, line_total: l.line_total }));
    const subtotal = items.reduce((a, i) => a + i.line_total, 0);
    const z = delivery ? ZONES[ck.zone] : null;
    const charge = z ? z.charge : 0;
    const d = new Date();
    const order = {
      order_id: newOrderId(),
      order_date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      order_time: `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`,
      created_at: utcStamp(), updated_at: utcStamp(),
      customer_name: name, customer_phone: phone,
      order_type: delivery ? 'delivery' : 'pickup',
      delivery_address: delivery ? addr : '',
      delivery_zone: delivery ? ck.zone : '', delivery_label: z ? z.label : '',
      delivery_km: delivery && ck.auto && ck.km != null ? Math.round(ck.km * 10) / 10 : null,
      delivery_method: delivery ? (ck.auto ? 'gps' : 'manual') : '',
      customer_map: delivery && ck.auto ? `https://www.google.com/maps/search/?api=1&query=${ck.lat},${ck.lng}` : '',
      delivery_charge: charge, subtotal, total: subtotal + charge,
      notes: String(f('notes').value || '').replace(/\s+/g, ' ').trim().slice(0, 200),
      payment_method: f('payment_method').value, payment_status: 'Unpaid', status: 'Pending',
      items, history: [{ old_status: null, new_status: 'Pending', at: utcStamp(), by: 'customer', note: 'Order placed' }]
    };
    const all = getOrders(); all.push(order); saveOrders(all);
    addTxn(order, 'ORDER_CREATED', 'Order placed, payment due on delivery/pickup', 'customer');
    audit('ORDER_CREATED', { entity_type: 'order', entity_id: order.order_id, details: `total: ${order.total}, type: ${order.order_type}, items: ${items.length}` });
    cart = { items: [] }; saveCart();
    location.hash = '#/order/' + order.order_id;
  });

  $('#delivery-block').hidden = false;
  lockZones(true);                       /* rate card is shown, but the charge comes from your distance */
  checkoutRefresh();
  if (navigator.geolocation) setTimeout(() => { if ($('#locbox') && ck.type === 'delivery') detectLocation(); }, 400);
  else locFail('Your browser cannot share your location.');
};

/* ----- ORDER CONFIRMATION ----- */
pages.order = (id) => {
  const o = findOrder(id);
  if (!o) return `<section><div class="container center"><p class="tag">Order not found</p><h1 style="font-size:clamp(2rem,6vw,3.4rem)">We could not find that order</h1>
  <p class="sub" style="margin:14px auto 24px">Orders are saved in the browser you used to place them.</p><p><a class="btn" href="#/">Back to home</a> <a class="btn o" href="#/menu">View menu</a></p></div></section>`;
  const cancelled = o.status === 'Cancelled';
  return `
<div class="ph"><div class="container">
  ${cancelled ? `<p class="tag">Order cancelled</p><h1>Order ${esc(o.order_id)}</h1><p>This order was cancelled.</p>`
      : `<p class="tag ok-tag">✔ Order saved</p><h1>Thank you, ${esc(o.customer_name.split(' ')[0])}!</h1><p>Your order is saved. Next, send it on WhatsApp so the kitchen sees it straight away.</p>`}
</div></div>
<section><div class="container co-grid" id="order-root" data-order-id="${esc(o.order_id)}">
<div class="box">
  <h2>Order ${esc(o.order_id)}</h2>
  <p class="meta">Placed ${esc(o.order_date)} at ${esc(o.order_time.slice(0, 5))} &middot; Status: <b class="pill ${stClass(o.status)}">${esc(o.status)}</b></p>
  <div class="table-wrap"><table class="bill-table">
    <thead><tr><th>Item</th><th class="num">Qty</th><th class="num">Price</th><th class="num">Amount</th></tr></thead>
    <tbody>${o.items.map(it => `<tr><td>${esc(it.name)}</td><td class="num">${it.quantity}</td><td class="num">${money(it.price)}</td><td class="num">${money(it.line_total)}</td></tr>`).join('')}</tbody>
  </table></div>
  <dl class="bill">
    <div><dt>Food subtotal</dt><dd>${money(o.subtotal)}</dd></div>
    ${o.order_type === 'delivery'
      ? `${o.delivery_method === 'gps' ? `<div><dt>Distance from shop</dt><dd>${o.delivery_km} km</dd></div>` : ''}<div><dt>Delivery area</dt><dd>${esc(o.delivery_label)}</dd></div><div><dt>Delivery charge</dt><dd>${money(o.delivery_charge)}</dd></div>`
      : '<div><dt>Delivery</dt><dd>Pickup – no charge</dd></div>'}
    <div class="grand"><dt>Total payable</dt><dd>${money(o.total)}</dd></div>
  </dl>
</div>
<aside class="box">
  <h2>Details</h2>
  <p><b>${esc(o.customer_name)}</b><br>${esc(o.customer_phone)}</p>
  ${o.order_type === 'delivery' ? `<p><b>Deliver to:</b><br>${esc(o.delivery_address)}</p>` : `<p><b>Pickup</b> from ${esc(R.address_lines)}</p>`}
  ${o.notes ? `<p><b>Notes:</b> ${esc(o.notes)}</p>` : ''}
  <p><b>Payment:</b> ${esc(payLabel(o.payment_method))} – <span class="pill pay-${slug(o.payment_status)}">${esc(o.payment_status)}</span><br>
  <small class="demo">No online payment has been taken. Please pay when you receive or collect your order.</small></p>
  ${!cancelled ? `<a class="btn big" id="wa-send" href="${whatsappUrl(o)}" target="_blank" rel="noopener noreferrer">Send order on WhatsApp</a>
  <p class="hint">This opens WhatsApp with your order ready to send. <b>The restaurant receives it only after you press Send in WhatsApp.</b> You can also call us on <a href="tel:+91${esc(R.phone)}"><u>${esc(R.phone)}</u></a>.</p>` : ''}
  ${o.status === 'Pending' ? '<button class="link" id="cancel-order" type="button">Cancel this order</button>' : ''}
  <p style="margin-top:14px"><button class="btn o sm" type="button" id="print-order">Print / save bill</button> <a class="btn o sm" href="#/menu">Order more</a></p>
  <div id="order-msg" class="alert" hidden role="status"></div>
</aside>
</div></section>`;
};
pages.order.after = (id) => {
  const msg = (t, kind) => { const m = $('#order-msg'); m.hidden = !t; m.textContent = t || ''; m.className = 'alert ' + (kind || ''); };
  const wa = $('#wa-send');
  if (wa) wa.addEventListener('click', () => {
    audit('WHATSAPP_LINK_OPENED', { entity_type: 'order', entity_id: id, details: 'customer opened the WhatsApp link' });
    msg('WhatsApp should open in a new tab. Your message is only delivered after you press Send in WhatsApp.', 'ok');
  });
  const cancel = $('#cancel-order');
  if (cancel) cancel.addEventListener('click', () => {
    if (!confirm('Cancel this order?')) return;
    const r = changeStatus(id, 'Cancelled', 'customer', '', 'Cancelled by customer');
    if (r.err) msg(r.err, 'err'); else route();
  });
  const pr = $('#print-order'); if (pr) pr.addEventListener('click', () => window.print());
};

/* ============ CART DRAWER ============ */
function buildCart() {
  if ($('#cart')) return;
  document.body.insertAdjacentHTML('beforeend',
    `<div class="scrim" id="cart-scrim"></div><button class="fab" id="cart-open" type="button" aria-controls="cart">🛒 Order Now (<span id="cc">0</span>)</button>
<aside class="drawer" id="cart" aria-label="Your order" aria-hidden="true">
<div class="row"><h3 style="font-size:1.5rem">Your order</h3><button type="button" class="btn o sm" id="cart-close">Close</button></div>
<div class="list" id="cl"></div>
<div class="row"><b>Food subtotal</b><b class="price" id="ct"></b></div>
<p class="demo" id="cn">Delivery charge is worked out from your location at checkout.</p>
<a class="btn" id="cw" href="#/checkout" style="margin-top:10px">Checkout</a>
<a class="btn o" href="tel:+91${esc(R.phone)}" style="margin-top:8px">Call to order</a>
<button type="button" class="link" id="cclr">Clear order</button></aside>`);
  $('#cw').addEventListener('click', e => {
    if (!cartCount()) { e.preventDefault(); $('#cn').textContent = 'Please add items first.'; } else openCart(false);
  });
  $('#cclr').addEventListener('click', () => { if (cartCount()) cartOp('clear'); });
}
function lineHTML(i) {
  return `<div class="line"><span>${esc(i.name)}<br><small class="demo">${money(i.price)} each</small></span><span class="qty"><button type="button" data-d="${esc(i.id)}" aria-label="Remove one ${esc(i.name)}">−</button><b>${i.quantity}</b><button type="button" data-a="${esc(i.id)}" aria-label="Add one ${esc(i.name)}">+</button></span></div>`;
}
function refreshCart() {
  const cc = $('#cc'); if (!cc) return;
  cc.textContent = cartCount();
  $('#ct').textContent = money(cartSubtotal());
  $('#cl').innerHTML = lines().length ? lines().map(lineHTML).join('') : '<p class="demo">Your order is empty. <a href="#/menu"><u>Browse the menu</u></a></p>';
  const cw = $('#cw'); if (cw) cw.classList.toggle('disabled', !cartCount());
}
function openCart(open) {
  const d = $('#cart'); if (!d) return;
  d.classList.toggle('open', open); d.setAttribute('aria-hidden', String(!open));
  const sc = $('#cart-scrim'); if (sc) sc.classList.toggle('show', open);
  const t = open ? $('#cart-close') : $('#cart-open'); if (t) t.focus();
}

/* ============ ADMIN (works inside this same browser) ============ */
const AD = D.admin || { username: 'admin', password: 'admin' };
const isAdmin = () => sess.get('em_admin') === '1';
const PER_PAGE = 25;
const admState = { q: '', status: '', from: '', to: '', page: 1, cq: '', lq: '', ltab: 'audit', lpage: 1 };

function admShell(active, inner) {
  return `<div class="admin-main"><header class="adm-bar"><div class="container bar">
<a class="logo" href="#/admin">🍳 EGG <span>MOCKTAIL</span> <small class="adm-tag">Admin</small></a>
<nav class="adm-nav" aria-label="Admin">
<a href="#/admin" ${active === 'orders' ? 'aria-current="page"' : ''}>Orders</a>
<a href="#/admin/customers" ${active === 'customers' ? 'aria-current="page"' : ''}>Customers</a>
<a href="#/admin/logs" ${active === 'logs' ? 'aria-current="page"' : ''}>Logs</a>
<a href="#/">View website</a>
${THEME_BTN}
<button class="btn o sm" type="button" id="adm-logout">Log out (${esc(AD.username)})</button>
</nav></div></header><div class="container" style="padding-top:24px;padding-bottom:70px">${inner}</div></div>`;
}

function customersList() {
  const map = {};
  getOrders().forEach(o => {
    const c = map[o.customer_phone] || (map[o.customer_phone] = { phone: o.customer_phone, name: o.customer_name, orders: [], since: o.created_at });
    c.orders.push(o); c.name = o.customer_name; if (o.created_at < c.since) c.since = o.created_at;
  });
  return Object.values(map).map(c => ({ ...c, count: c.orders.length, spent: c.orders.filter(o => o.status !== 'Cancelled').reduce((a, o) => a + o.total, 0), last: c.orders.map(o => o.created_at).sort().pop() }))
    .sort((a, b) => (b.last || '').localeCompare(a.last || ''));
}

pages.adminLogin = () => `<div class="admin-main"><div class="container"><div class="login-wrap box login">
<p class="tag">Admin</p><h1>Sign in</h1>
<div id="login-err" class="alert err" hidden role="alert"></div>
<form id="login-form" novalidate>
<div class="field"><label for="lu">Username</label><input id="lu" name="u" autocomplete="username" required></div>
<div class="field"><label for="lp">Password</label><input id="lp" name="p" type="password" autocomplete="current-password" required></div>
<button class="btn big" type="submit">Log in</button>
</form>
<p class="hint">Default login is in <code>js/data.js</code> (username <code>${esc(AD.username)}</code>). Change it before sharing the site.</p>
<p><a href="#/"><u>← Back to website</u></a></p>
</div></div></div>`;
pages.adminLogin.after = () => {
  $('#login-form').addEventListener('submit', e => {
    e.preventDefault();
    const u = $('#lu').value.trim(), p = $('#lp').value;
    const box = $('#login-err');
    if (u === AD.username && p === AD.password) {
      sess.set('em_admin', '1'); audit('ADMIN_LOGIN', { actor_type: 'admin', actor: u }); location.hash = '#/admin'; route();
    } else { box.hidden = false; box.textContent = 'Wrong username or password.'; audit('ADMIN_LOGIN_FAILED', { actor_type: 'admin', actor: u }); }
  });
};

pages.adminOrders = () => {
  const all = getOrders();
  const today = (() => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; })();
  const live = all.filter(o => o.status !== 'Cancelled');
  const sum = a => a.reduce((s, o) => s + o.total, 0);
  const s = admState;
  const q = s.q.toLowerCase();
  let rows = all.filter(o =>
    (!q || [o.order_id, o.customer_name, o.customer_phone, o.delivery_address].some(v => String(v || '').toLowerCase().includes(q))) &&
    (!s.status || o.status === s.status) && (!s.from || o.order_date >= s.from) && (!s.to || o.order_date <= s.to)
  ).slice().reverse();
  const pages_ = Math.max(1, Math.ceil(rows.length / PER_PAGE)); s.page = Math.min(s.page, pages_);
  const shown = rows.slice((s.page - 1) * PER_PAGE, s.page * PER_PAGE);
  return admShell('orders', `
<h1 class="adm-h">Orders dashboard</h1>
<div class="cards">
  <div class="stat"><span>Total orders</span><b>${all.length}</b></div>
  <div class="stat"><span>Today's orders</span><b>${all.filter(o => o.order_date === today).length}</b></div>
  <div class="stat"><span>Total sales (recorded)</span><b>${money(sum(live))}</b><small>Cancelled orders excluded. Today: ${money(sum(live.filter(o => o.order_date === today)))}</small></div>
  <div class="stat warn"><span>Pending orders</span><b>${all.filter(o => o.status === 'Pending').length}</b></div>
  <div class="stat good"><span>Completed (Delivered)</span><b>${all.filter(o => o.status === 'Delivered').length}</b></div>
  <div class="stat"><span>Cancelled</span><b>${all.filter(o => o.status === 'Cancelled').length}</b></div>
</div>
<form class="filters box" id="f-orders">
  <div class="field grow"><label for="aq">Search</label><input id="aq" name="q" value="${esc(s.q)}" placeholder="Order ID, name, phone or address"></div>
  <div class="field"><label for="ast">Status</label><select id="ast" name="status"><option value="">All</option>${ORDER_STATUSES.map(x => `<option${x === s.status ? ' selected' : ''}>${x}</option>`).join('')}</select></div>
  <div class="field"><label for="adf">From date</label><input id="adf" type="date" name="from" value="${esc(s.from)}"></div>
  <div class="field"><label for="adt">To date</label><input id="adt" type="date" name="to" value="${esc(s.to)}"></div>
  <div class="field act"><button class="btn sm" type="submit">Filter</button> <button class="btn o sm" type="button" id="f-reset">Reset</button></div>
</form>
<p class="meta">${rows.length} order${rows.length === 1 ? '' : 's'} found. <button class="link" type="button" id="export-csv" style="margin:0 0 0 10px">Download orders (CSV)</button></p>
<div class="table-wrap"><table class="adm-table">
<thead><tr><th>Order ID</th><th>Date &amp; time</th><th>Customer</th><th>Type</th><th class="num">Items</th><th>Area</th><th class="num">Delivery</th><th class="num">Total</th><th>Status</th><th>Payment</th></tr></thead>
<tbody>${shown.length ? shown.map(o => `<tr><td><a href="#/admin/orders/${esc(o.order_id)}"><b>${esc(o.order_id)}</b></a></td>
<td>${esc(o.order_date)}<br><small>${esc(o.order_time.slice(0, 5))}</small></td>
<td>${esc(o.customer_name)}<br><small>${esc(o.customer_phone)}</small></td>
<td>${o.order_type === 'delivery' ? 'Delivery' : 'Pickup'}</td><td class="num">${o.items.reduce((a, i) => a + i.quantity, 0)}</td>
<td><small>${esc(o.delivery_label || '–')}${o.delivery_km != null ? ' · ' + esc(o.delivery_km) + ' km' : ''}</small></td>
<td class="num">${money(o.delivery_charge)}</td><td class="num"><b>${money(o.total)}</b></td>
<td><span class="pill ${stClass(o.status)}">${esc(o.status)}</span></td><td><span class="pill pay-${slug(o.payment_status)}">${esc(o.payment_status)}</span></td></tr>`).join('')
  : '<tr><td colspan="10" class="empty">No orders match. New orders will appear here.</td></tr>'}</tbody></table></div>
${pages_ > 1 ? `<nav class="pager" aria-label="Pages">${s.page > 1 ? '<button class="btn o sm" type="button" data-pg="-1">← Previous</button>' : ''}<span>Page ${s.page} of ${pages_}</span>${s.page < pages_ ? '<button class="btn o sm" type="button" data-pg="1">Next →</button>' : ''}</nav>` : ''}
<p class="hint">Orders are stored in this browser only (no database). Open the admin page on the same computer/phone that receives the customer orders, and use “Download orders (CSV)” to keep a backup.</p>`);
};
pages.adminOrders.after = () => {
  const s = admState;
  $('#f-orders').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target.elements; s.q = f.q.value.trim(); s.status = f.status.value; s.from = f.from.value; s.to = f.to.value; s.page = 1; route();
  });
  $('#f-reset').addEventListener('click', () => { Object.assign(s, { q: '', status: '', from: '', to: '', page: 1 }); route(); });
  $$('[data-pg]').forEach(b => b.addEventListener('click', () => { s.page += Number(b.dataset.pg); route(); }));
  $('#export-csv').addEventListener('click', () => {
    const head = ['order_id', 'date', 'time', 'customer', 'phone', 'type', 'address', 'delivery_area', 'items', 'subtotal', 'delivery_charge', 'total', 'status', 'payment_method', 'payment_status', 'notes', 'distance_km', 'location_method'];
    const q = v => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const csv = [head.join(',')].concat(getOrders().map(o => [o.order_id, o.order_date, o.order_time, o.customer_name, o.customer_phone, o.order_type, o.delivery_address, o.delivery_label,
      o.items.map(i => i.quantity + ' x ' + i.name).join('; '), o.subtotal, o.delivery_charge, o.total, o.status, payLabel(o.payment_method), o.payment_status, o.notes, o.delivery_km == null ? '' : o.delivery_km, o.delivery_method || ''].map(q).join(','))).join('\r\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'egg-mocktail-orders.csv';
    document.body.appendChild(a); a.click(); a.remove();
  });
};

pages.adminOrder = (id) => {
  const o = findOrder(id);
  if (!o) return admShell('orders', '<p><a href="#/admin"><u>← All orders</u></a></p><h1 class="adm-h">Order not found</h1>');
  const logs = store.get('em_logs', []).filter(l => l.entity_type === 'order' && l.entity_id === id);
  const txns = store.get('em_txns', []).filter(t => t.order_id === id);
  const final = TERMINAL.includes(o.status);
  return admShell('orders', `
<p><a href="#/admin"><u>← All orders</u></a></p>
<h1 class="adm-h">Order ${esc(o.order_id)} <span class="pill ${stClass(o.status)}">${esc(o.status)}</span></h1>
<p class="meta">Placed ${esc(o.order_date)} at ${esc(o.order_time)} (restaurant time) &middot; <a href="${whatsappUrl(o)}" target="_blank" rel="noopener noreferrer"><u>Open order message in WhatsApp</u></a> &middot; <a href="#" id="print-adm"><u>Print</u></a></p>
<div class="two">
<div class="box"><h2>Customer</h2>
<p><b>${esc(o.customer_name)}</b><br><a href="tel:+91${esc(o.customer_phone)}">${esc(o.customer_phone)}</a></p>
<p><b>Order type:</b> ${o.order_type === 'delivery' ? 'Delivery' : 'Pickup'}</p>
${o.order_type === 'delivery' ? `<p><b>Delivery address:</b><br>${esc(o.delivery_address)}</p><p><b>Delivery area:</b> ${esc(o.delivery_label)}${o.delivery_method === 'gps' ? ` (${o.delivery_km} km from shop)` : o.delivery_method === 'manual' ? ' (chosen manually, please verify)' : ''}<br><b>Delivery charge:</b> ${money(o.delivery_charge)}${o.customer_map ? `<br><a href="${esc(o.customer_map)}" target="_blank" rel="noopener noreferrer"><u>Customer location on map</u></a>` : ''}</p>` : ''}
${o.notes ? `<p><b>Notes:</b> ${esc(o.notes)}</p>` : ''}
${o.cancelled_at ? `<p><b>Cancelled:</b> ${esc(o.cancelled_at)}${o.cancel_reason ? ' – ' + esc(o.cancel_reason) : ''}</p>` : ''}
</div>
<div class="box"><h2>Update order</h2>
${final ? `<p class="hint">This order is <b>${esc(o.status)}</b> and can no longer change status.</p>` : `
<form id="st-form" class="stack">
  <div class="field"><label for="ns">New status</label><select id="ns" name="status">${ORDER_STATUSES.filter(s => s !== o.status).map(s => `<option>${s}</option>`).join('')}</select></div>
  <div class="field"><label for="nn">Note / cancel reason (optional)</label><input id="nn" name="note" maxlength="200"></div>
  <button class="btn sm" type="submit">Save status</button>
</form>`}
<hr>
<form id="pay-form" class="stack">
  <p><b>Payment:</b> ${esc(payLabel(o.payment_method))} – <span class="pill pay-${slug(o.payment_status)}">${esc(o.payment_status)}</span><br><small class="demo">No online payments are collected by this website. Mark Paid only after you receive the money.</small></p>
  <div class="field"><label for="ps">Set payment status</label><select id="ps" name="payment_status">${PAYMENT_STATUSES.filter(s => s !== o.payment_status).map(s => `<option>${s}</option>`).join('')}</select></div>
  <button class="btn o sm" type="submit">Save payment status</button>
</form></div>
</div>
<div class="box"><h2>Ordered items</h2><div class="table-wrap"><table class="adm-table">
<thead><tr><th>Item</th><th>Category</th><th class="num">Unit price</th><th class="num">Qty</th><th class="num">Amount</th></tr></thead>
<tbody>${o.items.map(it => `<tr><td>${esc(it.name)}</td><td>${esc(it.category)}</td><td class="num">${money(it.price)}</td><td class="num">${it.quantity}</td><td class="num">${money(it.line_total)}</td></tr>`).join('')}</tbody>
<tfoot><tr><td colspan="4" class="num">Food subtotal</td><td class="num">${money(o.subtotal)}</td></tr>
<tr><td colspan="4" class="num">Delivery charge</td><td class="num">${money(o.delivery_charge)}</td></tr>
<tr class="grand"><td colspan="4" class="num"><b>Total payable</b></td><td class="num"><b>${money(o.total)}</b></td></tr></tfoot></table></div></div>
<div class="two">
<div class="box"><h2>Status history</h2><ul class="timeline">${o.history.slice().reverse().map(h => `<li><b>${esc(h.new_status)}</b>${h.old_status ? ` <small>(was ${esc(h.old_status)})</small>` : ''}<br><small>${esc(h.at)} by ${esc(h.by)}${h.note ? ' – ' + esc(h.note) : ''}</small></li>`).join('')}</ul></div>
<div class="box"><h2>Transactions</h2><div class="table-wrap"><table class="adm-table small"><thead><tr><th>When (UTC)</th><th>Type</th><th class="num">Amount</th><th>Payment</th><th>By</th></tr></thead>
<tbody>${txns.map(t => `<tr><td>${esc(t.at)}</td><td>${esc(t.kind)}<br><small>${esc(t.note)}</small></td><td class="num">${money(t.amount)}</td><td>${esc(t.payment_status)}</td><td>${esc(t.by)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No entries.</td></tr>'}</tbody></table></div></div>
</div>
<div class="box"><h2>Activity log for this order</h2><div class="table-wrap"><table class="adm-table small"><thead><tr><th>When (UTC)</th><th>Action</th><th>Who</th><th>Details</th></tr></thead>
<tbody>${logs.map(l => `<tr><td>${esc(l.at)}</td><td>${esc(l.action)}</td><td>${esc(l.actor_type)}${l.actor ? ': ' + esc(l.actor) : ''}</td><td>${esc(l.details)}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">No entries.</td></tr>'}</tbody></table></div></div>`);
};
pages.adminOrder.after = (id) => {
  const sf = $('#st-form');
  if (sf) sf.addEventListener('submit', e => {
    e.preventDefault();
    const s = sf.elements.status.value;
    if ((s === 'Cancelled' || s === 'Delivered') && !confirm('Mark this order as ' + s + '? This cannot be changed afterwards.')) return;
    const r = changeStatus(id, s, 'admin', AD.username, sf.elements.note.value.trim());
    if (r.err) toast(r.err, 'err'); else toast(`Status changed from ${r.old} to ${s}.`);
    route();
  });
  $('#pay-form').addEventListener('submit', e => {
    e.preventDefault();
    const r = changePayment(id, e.target.elements.payment_status.value, AD.username, '');
    if (r.err) toast(r.err, 'err'); else toast('Payment status updated.');
    route();
  });
  const p = $('#print-adm'); if (p) p.addEventListener('click', e => { e.preventDefault(); window.print(); });
};

pages.adminCustomers = () => {
  const q = admState.cq.toLowerCase();
  const rows = customersList().filter(c => !q || c.name.toLowerCase().includes(q) || c.phone.includes(q));
  return admShell('customers', `
<h1 class="adm-h">Customers</h1>
<form class="filters box" id="f-cust"><div class="field grow"><label for="cq">Search name or phone</label><input id="cq" name="q" value="${esc(admState.cq)}"></div>
<div class="field act"><button class="btn sm" type="submit">Search</button> <button class="btn o sm" type="button" id="c-reset">Reset</button></div></form>
<div class="table-wrap"><table class="adm-table"><thead><tr><th>Name</th><th>Phone</th><th class="num">Orders</th><th class="num">Total spent</th><th>Last order (UTC)</th></tr></thead><tbody>
${rows.map(c => `<tr><td><a href="#/admin/customers/${esc(c.phone)}"><b>${esc(c.name)}</b></a></td><td>${esc(c.phone)}</td><td class="num">${c.count}</td><td class="num">${money(c.spent)}</td><td>${esc(c.last || '–')}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No customers yet.</td></tr>'}
</tbody></table></div>`);
};
pages.adminCustomers.after = () => {
  $('#f-cust').addEventListener('submit', e => { e.preventDefault(); admState.cq = e.target.elements.q.value.trim(); route(); });
  $('#c-reset').addEventListener('click', () => { admState.cq = ''; route(); });
};
pages.adminCustomer = (phone) => {
  const c = customersList().find(x => x.phone === phone);
  if (!c) return admShell('customers', '<p><a href="#/admin/customers"><u>← All customers</u></a></p><h1 class="adm-h">Customer not found</h1>');
  return admShell('customers', `
<p><a href="#/admin/customers"><u>← All customers</u></a></p>
<h1 class="adm-h">${esc(c.name)}</h1>
<p class="meta">${esc(c.phone)} &middot; customer since ${esc(c.since)} (UTC) &middot; ${c.count} order${c.count === 1 ? '' : 's'} &middot; ${money(c.spent)} spent (cancelled excluded)</p>
<div class="table-wrap"><table class="adm-table"><thead><tr><th>Order ID</th><th>Date</th><th>Type</th><th class="num">Total</th><th>Status</th><th>Payment</th></tr></thead><tbody>
${c.orders.slice().reverse().map(o => `<tr><td><a href="#/admin/orders/${esc(o.order_id)}"><b>${esc(o.order_id)}</b></a></td><td>${esc(o.order_date)} ${esc(o.order_time.slice(0, 5))}</td><td>${o.order_type === 'delivery' ? 'Delivery' : 'Pickup'}</td><td class="num">${money(o.total)}</td><td><span class="pill ${stClass(o.status)}">${esc(o.status)}</span></td><td><span class="pill pay-${slug(o.payment_status)}">${esc(o.payment_status)}</span></td></tr>`).join('')}
</tbody></table></div>`);
};

pages.adminLogs = () => {
  const s = admState, q = s.lq.toLowerCase();
  let rows = s.ltab === 'audit'
    ? store.get('em_logs', []).filter(l => !q || [l.action, l.entity_id, l.actor, l.details].some(v => String(v || '').toLowerCase().includes(q)))
    : store.get('em_txns', []).filter(t => !q || [t.order_id, t.kind, t.note].some(v => String(v || '').toLowerCase().includes(q)));
  const pg = Math.max(1, Math.ceil(rows.length / 100)); s.lpage = Math.min(s.lpage, pg);
  const shown = rows.slice((s.lpage - 1) * 100, s.lpage * 100);
  const table = s.ltab === 'audit'
    ? `<table class="adm-table small"><thead><tr><th>When (UTC)</th><th>Action</th><th>Who</th><th>Record</th><th>Details</th></tr></thead><tbody>
${shown.map(l => `<tr><td>${esc(l.at)}</td><td><b>${esc(l.action)}</b></td><td>${esc(l.actor_type)}${l.actor ? ': ' + esc(l.actor) : ''}</td><td>${l.entity_type === 'order' ? `<a href="#/admin/orders/${esc(l.entity_id)}">${esc(l.entity_id)}</a>` : esc(l.entity_id)}</td><td>${esc(l.details)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">No entries.</td></tr>'}</tbody></table>`
    : `<table class="adm-table small"><thead><tr><th>When (UTC)</th><th>Order</th><th>Type</th><th class="num">Amount</th><th>Method</th><th>Payment</th><th>Note</th><th>By</th></tr></thead><tbody>
${shown.map(t => `<tr><td>${esc(t.at)}</td><td><a href="#/admin/orders/${esc(t.order_id)}">${esc(t.order_id)}</a></td><td><b>${esc(t.kind)}</b></td><td class="num">${money(t.amount)}</td><td>${esc(payLabel(t.payment_method))}</td><td>${esc(t.payment_status)}</td><td>${esc(t.note)}</td><td>${esc(t.by)}</td></tr>`).join('') || '<tr><td colspan="8" class="empty">No entries.</td></tr>'}</tbody></table>`;
  return admShell('logs', `
<h1 class="adm-h">Operational logs</h1>
<div class="tabs"><button class="btn sm${s.ltab === 'audit' ? '' : ' o'}" type="button" data-tab="audit">Audit log</button><button class="btn sm${s.ltab === 'transactions' ? '' : ' o'}" type="button" data-tab="transactions">Transactions</button></div>
<form class="filters box" id="f-logs"><div class="field grow"><label for="lq">Search</label><input id="lq" name="q" value="${esc(s.lq)}" placeholder="${s.ltab === 'audit' ? 'Action, order ID, person or details' : 'Order ID, type or note'}"></div>
<div class="field act"><button class="btn sm" type="submit">Search</button> <button class="btn o sm" type="button" id="l-reset">Reset</button></div></form>
<p class="meta">${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}. Times are UTC.</p>
<div class="table-wrap">${table}</div>
${pg > 1 ? `<nav class="pager">${s.lpage > 1 ? '<button class="btn o sm" type="button" data-lp="-1">← Newer</button>' : ''}<span>Page ${s.lpage} of ${pg}</span>${s.lpage < pg ? '<button class="btn o sm" type="button" data-lp="1">Older →</button>' : ''}</nav>` : ''}`);
};
pages.adminLogs.after = () => {
  const s = admState;
  $$('[data-tab]').forEach(b => b.addEventListener('click', () => { s.ltab = b.dataset.tab; s.lpage = 1; route(); }));
  $('#f-logs').addEventListener('submit', e => { e.preventDefault(); s.lq = e.target.elements.q.value.trim(); s.lpage = 1; route(); });
  $('#l-reset').addEventListener('click', () => { s.lq = ''; s.lpage = 1; route(); });
  $$('[data-lp]').forEach(b => b.addEventListener('click', () => { s.lpage += Number(b.dataset.lp); route(); }));
};

/* ============ ROUTER ============ */
const TITLES = {
  home: 'EGG MOCKTAIL – An Eggetarian Cafe, Vijayanagar 4th Stage, Mysuru',
  about: 'About EGG MOCKTAIL | Eggetarian Cafe near Marimallapa School, Mysuru',
  menu: 'Full Menu | Egg Rolls, Burgers, Biryani & Mocktails | EGG MOCKTAIL',
  contact: 'Contact & Location | EGG MOCKTAIL, Vijayanagar 4th Stage, Mysuru',
  checkout: 'Checkout | EGG MOCKTAIL', order: 'Your order | EGG MOCKTAIL', admin: 'Admin | EGG MOCKTAIL'
};

function footerHTML() {
  return `<div class="grid">
<div><h3>${esc(R.name)}</h3><p>${esc(R.tagline)}.<br>${esc(R.address_lines)}.</p>${socialLinks(false, 'social foot-social')}</div>
<div><h3>Explore</h3><a href="#/">Home</a><a href="#/about">About Us</a><a href="#/menu">Full Food Menu</a><a href="#/menu/rolls">Egg Rolls</a><a href="#/menu/burgers">Burgers</a><a href="#/menu/mocktails">Mocktails</a><a href="#/contact">Contact Us</a></div>
<div><h3>Contact</h3><a href="tel:+91${esc(R.phone)}">Call: <span>${esc(R.phone)}</span></a><a href="${WA_GENERIC}" target="_blank" rel="noopener noreferrer">Order on WhatsApp</a><a href="${MAPS_DIR}" target="_blank" rel="noopener noreferrer">Get directions</a></div>
</div>
<p class="copy">&copy; 2026 ${esc(R.name)}. All rights reserved. <a href="#/admin" style="display:inline;opacity:.6">Admin</a></p>`;
}

function route() {
  const hash = (location.hash || '#/').replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean).map(decodeURIComponent);
  const main = $('#main');
  const first = parts[0] || 'home';
  let key = first, arg = parts[1], html = '', active = first, title = TITLES[first] || TITLES.home;
  const adminMode = first === 'admin';

  document.body.classList.toggle('admin', adminMode);
  $('#site-header').hidden = adminMode; $('#site-footer').hidden = adminMode;
  openCart(false);

  if (adminMode) {
    title = TITLES.admin;
    if (!isAdmin()) { key = 'adminLogin'; }
    else if (parts[1] === 'orders' && parts[2]) { key = 'adminOrder'; arg = parts[2]; }
    else if (parts[1] === 'customers' && parts[2]) { key = 'adminCustomer'; arg = parts[2]; }
    else if (parts[1] === 'customers') key = 'adminCustomers';
    else if (parts[1] === 'logs') key = 'adminLogs';
    else key = 'adminOrders';
  } else if (first === 'order') { key = 'order'; arg = parts[1]; }
  else if (!['home', 'about', 'menu', 'contact', 'checkout'].includes(key)) { key = 'notfound'; title = 'Page not found | EGG MOCKTAIL'; active = ''; }

  main.innerHTML = pages[key](arg);
  main.classList.remove('page-in'); void main.offsetWidth; main.classList.add('page-in');
  document.title = title;
  $$('#nav a[data-nav]').forEach(a => { if (a.dataset.nav === active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
  $('#nav').classList.remove('open'); document.documentElement.classList.remove('nav-open'); $('.burger').setAttribute('aria-expanded', 'false'); $('.burger').setAttribute('aria-label', 'Open menu');

  const publicPage = !adminMode && !['checkout', 'order'].includes(key);
  const fab = $('#cart-open');
  if (publicPage) { buildCart(); if ($('#cart-open')) $('#cart-open').hidden = false; $('#cart').hidden = false; }
  else if (fab) { fab.hidden = true; $('#cart').hidden = true; }
  refreshCart();

  if (pages[key].after) pages[key].after(arg);
  reveal();
  applyTheme(curTheme());
  if (!(key === 'menu' && arg)) window.scrollTo(0, 0);
  onScroll();
}

function reveal() {
  $$('.rv:not(.in)').forEach(e => {
    const sibs = [...e.parentElement.children].filter(c => c.classList.contains('rv'));
    e.style.transitionDelay = Math.min(sibs.indexOf(e), 8) * 70 + 'ms';
  });
  const clearDelay = e => setTimeout(() => { e.style.transitionDelay = ''; }, 1300);
  if (!('IntersectionObserver' in window)) { $$('.rv').forEach(e => { e.classList.add('in'); clearDelay(e); }); return; }
  const io = new IntersectionObserver(en => en.forEach(x => { if (x.isIntersecting) { x.target.classList.add('in'); clearDelay(x.target); io.unobserve(x.target); } }), { threshold: .1 });
  $$('.rv:not(.in)').forEach(e => io.observe(e));
}

/* ============ THEME (dark / light) ============ */
const THEME_KEY = 'em_theme';
const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const THEME_BTN = '<button class="theme-toggle" type="button" aria-label="Switch to light theme" title="Switch theme"><svg class="ico-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"/></svg><svg class="ico-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg></button>';
const curTheme = () => document.documentElement.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
function applyTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name="theme-color"]'); if (m) m.setAttribute('content', t === 'light' ? '#fffaf0' : '#0a0a0a');
  $$('.theme-toggle').forEach(b => { const l = t === 'light' ? 'Switch to dark theme' : 'Switch to light theme'; b.setAttribute('aria-label', l); b.title = l; });
}
function toggleTheme(btn) {
  const next = curTheme() === 'light' ? 'dark' : 'light';
  const go = () => { applyTheme(next); store.set(THEME_KEY, next); };
  const root = document.documentElement;
  if (document.startViewTransition && !reduceMotion()) {
    const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    try {
      const vt = document.startViewTransition(go);
      vt.ready.then(() => root.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] }, { duration: 650, easing: 'cubic-bezier(.4,0,.2,1)', pseudoElement: '::view-transition-new(root)' })).catch(() => {});
      return;
    } catch (err) { /* fall through to the simple fade */ }
  }
  if (!reduceMotion()) { root.classList.add('theme-anim'); setTimeout(() => root.classList.remove('theme-anim'), 500); }
  go();
}
if (window.matchMedia) {
  const mq = matchMedia('(prefers-color-scheme: light)');
  const onSys = e => { if (store.get(THEME_KEY, null) === null) applyTheme(e.matches ? 'light' : 'dark'); };
  if (mq.addEventListener) mq.addEventListener('change', onSys); else if (mq.addListener) mq.addListener(onSys);
}

/* ============ MOTION HELPERS ============ */
function flyToCart(r) {
  const fab = $('#cart-open'); if (!fab || fab.hidden || reduceMotion() || !fab.getBoundingClientRect) return;
  const t = fab.getBoundingClientRect();
  const sx = r.left + r.width / 2, sy = r.top + r.height / 2, dx = t.left + t.width / 2 - sx, dy = t.top + t.height / 2 - sy;
  const dot = document.createElement('span'); dot.className = 'fly'; dot.textContent = '🍳';
  dot.style.left = (sx - 14) + 'px'; dot.style.top = (sy - 14) + 'px';
  document.body.appendChild(dot);
  const done = () => { dot.remove(); fab.classList.remove('bump'); void fab.offsetWidth; fab.classList.add('bump'); };
  if (!dot.animate) { done(); return; }
  const a = dot.animate([
    { transform: 'translate(0,0) scale(1)', opacity: 1 },
    { transform: `translate(${dx * .45}px,${dy * .45 - 70}px) scale(1.25)`, opacity: 1, offset: .45 },
    { transform: `translate(${dx}px,${dy}px) scale(.35)`, opacity: .3 }
  ], { duration: 720, easing: 'cubic-bezier(.45,0,.75,.55)' });
  a.onfinish = done; a.oncancel = done;
}
document.addEventListener('pointerdown', e => {
  const t = e.target.closest && e.target.closest('.btn,.fab,.qty button,.chips button');
  if (!t || t.disabled || t.classList.contains('disabled') || reduceMotion()) return;
  const r = t.getBoundingClientRect(), s = Math.max(r.width, r.height) * 2;
  const el = document.createElement('span'); el.className = 'rip';
  el.style.cssText = `width:${s}px;height:${s}px;left:${e.clientX - r.left - s / 2}px;top:${e.clientY - r.top - s / 2}px`;
  t.appendChild(el); setTimeout(() => el.remove(), 650);
}, { passive: true });
let scrollTick = false;
function onScroll() {
  scrollTick = false;
  const h = document.documentElement, max = h.scrollHeight - h.clientHeight;
  const bar = $('.progress'); if (bar) bar.style.setProperty('--p', max > 0 ? Math.min(1, window.scrollY / max) : 0);
  const hd = $('#site-header'); if (hd) hd.classList.toggle('scrolled', window.scrollY > 8);
}
window.addEventListener('scroll', () => { if (!scrollTick) { scrollTick = true; requestAnimationFrame(onScroll); } }, { passive: true });

/* ============ GLOBAL EVENTS ============ */
document.addEventListener('click', e => {
  if (e.target.id === 'cart-scrim') { openCart(false); return; }
  const tt = e.target.closest('.theme-toggle'); if (tt) { toggleTheme(tt); return; }
  const a = e.target.closest('a[data-order]');
  if (a && cartCount() && $('#cart') && !$('#cart').hidden) { e.preventDefault(); openCart(true); return; }
  const b = e.target.closest('button');
  if (!b) return;
  const d = b.dataset;
  if (d.f !== undefined) { menuFilter = d.f; applyFilters(); jumpToMenuTop(); }
  else if (d.a) { const before = cartCount(), r = b.getBoundingClientRect(); cartOp('add', d.a); if (cartCount() > before) flyToCart(r); }
  else if (d.d) cartOp('remove', d.d);
  else if (b.id === 'cart-open') openCart(true);
  else if (b.id === 'cart-close') openCart(false);
  else if (b.id === 'adm-logout') { audit('ADMIN_LOGOUT', { actor_type: 'admin', actor: AD.username }); sess.del('em_admin'); location.hash = '#/admin'; route(); }
});
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#cart') && $('#cart').classList.contains('open')) openCart(false); });
window.addEventListener('hashchange', route);
/* keep the cart in sync if it is changed in another tab */
window.addEventListener('storage', e => { if (e.key === 'em_cart') { cart = store.get('em_cart', { items: [] }); onCartChange(); } });

document.addEventListener('DOMContentLoaded', () => {
  $('#footer-inner').innerHTML = footerHTML();
  document.body.insertAdjacentHTML('afterbegin', '<div class="progress" aria-hidden="true"><i></i></div>');
  applyTheme(curTheme());
  const burger = $('.burger'), nav = $('#nav');
  const setNav = o => { nav.classList.toggle('open', o); burger.setAttribute('aria-expanded', String(o)); burger.setAttribute('aria-label', o ? 'Close menu' : 'Open menu'); document.documentElement.classList.toggle('nav-open', o); };
  burger.addEventListener('click', () => setNav(!nav.classList.contains('open')));
  nav.addEventListener('click', e => { if (e.target.closest('a')) setNav(false); });
  document.addEventListener('click', e => { if (nav.classList.contains('open') && !e.target.closest('#nav, .burger')) setNav(false); });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('open')) { setNav(false); burger.focus(); } });
  window.addEventListener('resize', () => { if (innerWidth > 820 && nav.classList.contains('open')) setNav(false); });
  route();
});
