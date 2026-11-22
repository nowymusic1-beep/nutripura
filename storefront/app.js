'use strict';

const byId = id => document.getElementById(id);
const money = value => '$' + new Intl.NumberFormat('es-CL').format(value);
const isBottle = name => name === 'berberina' || name === 'magnesio';
const asset = name => 'img/' + name + (isBottle(name) ? '.png' : '.webp');
const pics = {
  hero: 'Pareja junto a los frascos Nutre Pure',
  berberina: 'Frasco original de Berberina Nutre Pure',
  magnesio: 'Frasco original de Magnesium Complex Nutre Pure',
  'berberina-escena': 'Berberina Nutre Pure en una escena botánica',
  'magnesio-escena': 'Magnesium Complex Nutre Pure con hojas y limas',
  botanical: 'Berberina Nutre Pure junto a una taza de té',
  ritual: 'Magnesium Complex Nutre Pure junto a agua con limón',
  duo: 'Berberina y Magnesium Complex Nutre Pure'
};
// Enlaces a las publicaciones de Mercado Libre. Reemplázalos por tus enlaces de referido.
const MERCADO_LIBRE_LINKS = {
  berberina: 'https://meli.la/2apy1KR',
  magnesio: 'https://www.mercadolibre.cl/magnesio-complex-gotas-nutre-pure-50-ml/up/MLCU5850421298'
};
const products = [
  { id:'berberina', title:'Berberina Nutre Pure', price:24990, tag:'BERBERINA', main:'berberina',
    slides:['berberina'], size:'60 ml',
    pitch:'Fórmula 7 en 1 con berberina, canela de Ceilán, cromo, melón amargo, cúrcuma, ginseng y glucomanano.',
    rating:{ value:'4,4', count:110 },
    notes:['7 componentes en una sola fórmula líquida','Unas gotas en agua, con suave sabor a frambuesa'] },
  { id:'magnesio', title:'Magnesium Complex Nutre Pure', price:14850, tag:'MAGNESIO', main:'magnesio',
    slides:['magnesio'], size:'50 ml',
    pitch:'Tres formas de magnesio (glicinato, citrato y malato) con vitamina B6, zinc, potasio y minerales traza.',
    notes:['El magnesio contribuye a disminuir el cansancio','Y al funcionamiento normal de músculos y sistema nervioso'] }
];
const webPrice = product => product.price - Math.round(product.price * .1);
const CROSS_SELL = {
  berberina: { offer:'magnesio', title:'¿Sumas el magnesio a tu rutina?',
    text:'Magnesium Complex combina 3 formas de magnesio con vitamina B6, zinc y potasio. El magnesio contribuye a disminuir el cansancio y al funcionamiento normal de los músculos.' },
  magnesio: { offer:'berberina', title:'¿Completas tu rutina con berberina?',
    text:'Berberina Nutre Pure reúne 7 componentes en una fórmula líquida: berberina, canela de Ceilán, cromo, melón amargo, cúrcuma, ginseng y glucomanano.' }
};
const PAYMENT_METHODS = ['Tarjeta de crédito','Tarjeta de débito','Transferencia'];
const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
};
const save = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Continue in the current session. */ }
};
const META_PIXEL_ID = '1089358126319120';
let marketingConsent = (() => {
  try { return localStorage.getItem('np-marketing-consent') || 'unknown'; } catch { return 'unknown'; }
})();
const visibleProductIds = new Set();
const viewedProductIds = new Set();
function newMetaEventId() {
  return window.crypto?.randomUUID?.() || 'np-' + Date.now() + '-' + Math.random().toString(36).slice(2);
}
function loadMetaPixel() {
  if (window.npMetaPixelLoaded) return;
  window.npMetaPixelLoaded = true;
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  window.fbq('init', META_PIXEL_ID);
  window.fbq('track', 'PageView');
}
function trackMeta(eventName, data, eventId) {
  if (marketingConsent !== 'granted' || typeof window.fbq !== 'function') return;
  if (eventId) window.fbq('track', eventName, data, { eventID: eventId });
  else window.fbq('track', eventName, data);
}
function getMetaCookie(name) {
  const entry = document.cookie.split('; ').find(cookie => cookie.startsWith(name + '='));
  if (!entry) return null;
  try { return decodeURIComponent(entry.slice(name.length + 1)); } catch { return null; }
}
function setMarketingConsent(accepted) {
  marketingConsent = accepted ? 'granted' : 'denied';
  try { localStorage.setItem('np-marketing-consent', marketingConsent); } catch (error) {
    console.warn('No se pudo guardar la preferencia de cookies.', error);
  }
  byId('marketing-consent').hidden = true;
  if (accepted) {
    loadMetaPixel();
    visibleProductIds.forEach(trackProductView);
  } else if (typeof window.fbq === 'function') {
    window.fbq('consent', 'revoke');
  }
}
const storedCart = read('np-nutre-pure-cart', {});
let cart = Object.fromEntries(products.map(({id}) => [id, Math.min(99, Math.max(0, Math.trunc(Number(storedCart?.[id])) || 0))]));
const motion = window.matchMedia('(prefers-reduced-motion: reduce)');
const SHIPPING_FEE = 3990;
function selectProduct(id, scroll = false) {
  if (!products.some(product => product.id === id)) return;
  document.body.dataset.product = id;
  document.querySelectorAll('[data-select-product]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.selectProduct === id)));
  if (scroll) document.getElementById(id)?.scrollIntoView({ behavior: motion.matches ? 'instant' : 'smooth', block: 'start' });
}

function trackProductView(id) {
  if (viewedProductIds.has(id)) return;
  const product = products.find(item => item.id === id);
  if (!product) return;
  trackMeta('ViewContent', {
    content_ids: [id],
    content_type: 'product',
    value: product.price - Math.round(product.price * .1),
    currency: 'CLP'
  }, newMetaEventId());
  if (marketingConsent === 'granted' && typeof window.fbq === 'function') viewedProductIds.add(id);
}
function photoMarkup(name, extra = '') {
  return '<img loading="lazy"' + (isBottle(name) ? ' class="bottle-image"' : '') + ' src="' + asset(name) + '" alt="' + pics[name] + '"' + extra + '>';
}
byId('products').innerHTML = products.map(product => {
  const slides = product.slides;
  const rating = product.rating
    ? `<a class="product-rating" href="#opiniones"><span aria-hidden="true">★★★★★</span> ${product.rating.value} · ${product.rating.count} opiniones en Mercado Libre</a>`
    : '<p class="product-rating is-new">Nuevo en la tienda</p>';
  return `<article class="product" id="${product.id}">
    <div class="gallery" tabindex="0" aria-label="Galería de ${product.tag}">
      ${slides.map((name, i) => `<button data-photo="${name}" class="${i === 0 ? 'product-packshot' : ''}" aria-label="Ampliar imagen ${i + 1}">${photoMarkup(name)}</button>`).join('')}
      <span class="product-badge">−10 % web</span>
    </div>
    <div class="product-body">
      <span class="tag">${product.tag} · ${product.size}</span><h3>${product.title}</h3>${rating}
      <p class="product-pitch">${product.pitch}</p>
      <ul>${product.notes.map(note => '<li>' + note + '</li>').join('')}</ul>
      <div class="product-buy">
        <p class="product-price"><del>${money(product.price)}</del> <strong>${money(webPrice(product))}</strong></p>
        <p class="product-gift">Incluye <b>3 libros digitales de regalo</b></p>
        <button class="pill buy-now" data-add="${product.id}">Comprar ahora</button>
        <p class="shipping-price">Despacho a todo Chile: ${money(SHIPPING_FEE)} por pedido</p>
      </div>
      <div class="pay-methods" aria-label="Medios de pago">
        <p><svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>Pago seguro con <b>Flow</b></p>
        <ul>${PAYMENT_METHODS.map(method => '<li>' + method + '</li>').join('')}</ul>
      </div>
    </div>
  </article>`;
}).join('');

const productObserver = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  const id = entry.target.id;
  visibleProductIds.add(id);
  trackProductView(id);
}), { threshold:.45 });
document.querySelectorAll('.product').forEach(product => {
  productObserver.observe(product);
  const gallery = product.querySelector('.gallery');
  const thumbs = [...product.querySelectorAll('[data-slide]')];
  function select(index) {
    const current = Math.min(thumbs.length - 1, Math.max(0, index));
    gallery.scrollTo({ left:current * gallery.clientWidth, behavior:motion.matches ? 'instant' : 'smooth' });
  }
  thumbs.forEach((button, i) => button.addEventListener('click', () => select(i)));
  gallery.addEventListener('scroll', () => {
    const active = Math.round(gallery.scrollLeft / gallery.clientWidth);
    thumbs.forEach((button, i) => button.setAttribute('aria-current', String(i === active)));
  }, { passive:true });
  gallery.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    select(Math.round(gallery.scrollLeft / gallery.clientWidth) + (event.key === 'ArrowRight' ? 1 : -1));
  });
});

function totals() {
  const subtotal = products.reduce((amount, item) => amount + cart[item.id] * item.price, 0);
  const savings = Math.round(subtotal * .1);
  return { subtotal, savings, shipping:SHIPPING_FEE, total:subtotal - savings + SHIPPING_FEE };
}
function renderCart(focusControl) {
  const count = Object.values(cart).reduce((sum, value) => sum + value, 0);
  const badge = byId('cart-count');
  badge.textContent = count;
  badge.hidden = !count;
  byId('discount-label').textContent = '10 % OFF + 3 libros de regalo';
  if (!count) {
    byId('cart-body').innerHTML = '<p>Tu carrito está vacío.</p><a class="pill wide" href="#catalogo">VER CATÁLOGO</a>';
  } else {
    const amounts = totals();
    byId('cart-body').innerHTML = products.filter(item => cart[item.id]).map(item => `
      <div class="cart-line">${photoMarkup(item.main)}<div><strong>${item.title}</strong>
      <div class="qty"><button data-qty="${item.id}" data-delta="-1" aria-label="Quitar una unidad de ${item.title}">−</button><span>${cart[item.id]}</span><button data-qty="${item.id}" data-delta="1" ${cart[item.id] >= 99 ? "disabled" : ""} aria-label="Agregar una unidad de ${item.title}">+</button></div></div><span>${money(cart[item.id] * item.price)}</span></div>`).join('') +
      '<p class="total"><span>Subtotal</span><span>' + money(amounts.subtotal) + '</span></p>' +
      '<p class="total"><span>Descuento web 10 %</span><span>−' + money(amounts.savings) + '</span></p>' +
      crossSell() + giftSummary() + '<p class="total"><span>Despacho</span><span>' + money(amounts.shipping) + '</span></p><p class="total"><strong>Total a pagar</strong><strong>' + money(amounts.total) + '</strong></p><button class="pill wide" id="continue-checkout">CONTINUAR AL PEDIDO</button>';
  }
  if (focusControl) (byId('cart-body').querySelector(focusControl) || byId('cart').querySelector('[data-close]')).focus();
}
function crossSell() {
  const inCart = products.filter(item => cart[item.id] > 0).map(item => item.id);
  if (inCart.length !== 1) return '';
  const pitch = CROSS_SELL[inCart[0]];
  const offer = products.find(item => item.id === pitch.offer);
  return '<div class="cross-sell">' + photoMarkup(offer.main) + '<div><strong>' + pitch.title + '</strong><p>' + pitch.text + '</p>' +
    '<p class="cross-sell-price"><del>' + money(offer.price) + '</del> <b>' + money(webPrice(offer)) + '</b> con tu 10 %</p>' +
    '<button class="pill" data-add="' + offer.id + '" data-cross-sell>Agregar ' + (offer.id === 'magnesio' ? 'magnesio' : 'berberina') + '</button></div></div>';
}
function addToCart(id) {
  const product = products.find(item => item.id === id);
  if (!product) return;
  selectProduct(id);
  changeQuantity(id, 1);
  trackMeta('AddToCart', {
    content_ids: [product.id],
    content_type: 'product',
    value: webPrice(product),
    currency: 'CLP'
  }, newMetaEventId());
  openDialog('cart');
}
function changeQuantity(id, delta) {
  if (!Object.hasOwn(cart, id)) return;
  cart[id] = Math.min(99, Math.max(0, cart[id] + delta));
  save('np-nutre-pure-cart', cart);
  renderCart(byId('cart').open ? '[data-qty="' + id + '"][data-delta="' + delta + '"]' : undefined);
}
function openDialog(id) {
  const panel = byId(id);
  const current = document.querySelector('dialog[open]');
  if (current && current !== panel) current.close();
  if (!panel.open) panel.showModal();
}
const giftBooks = [
  {title:'El regreso a lo natural',file:'el-regreso-a-lo-natural'},
  {title:'5 hábitos después de los 40',file:'5-habitos-despues-de-los-40'},
  {title:'Nutrición Pura · Una marca para acompañarte',file:'nutricion-pura-una-marca-para-acompanarte'}
];
function giftSummary() {
  return '<div class="cart-gift"><div class="gift-miniatures">' +
    giftBooks.map((book,i) => '<img src="img/libro-' + (i+1) + '.webp" alt="' + book.title + '">').join('') +
    '</div><div><strong>3 libros digitales de regalo</strong><p>Colección Nutrición Pura en PDF</p><b>Incluidos · $0</b></div></div>';
}
function checkout() {
  if (!Object.values(cart).some(quantity => quantity > 0)) return;
  const amounts = totals();
  byId('checkout-body').innerHTML = '<div class="checkout-welcome"><p class="eyebrow">UN MOMENTO PARA TI</p><h3>Tu bienestar empieza aquí.</h3><p>Revisa lo que elegiste y los regalos que te acompañan.</p></div><div class="checkout-items">' +
    products.filter(item => cart[item.id]).map(item => '<div class="checkout-item">' + photoMarkup(item.main) + '<div><strong>' + item.title + '</strong><small>' + cart[item.id] + ' × ' + money(item.price) + '</small></div></div>').join('') + '</div>' +
    giftSummary() + '<p class="total"><span>Descuento web · 10 %</span><span>−' + money(amounts.savings) + '</span></p><p class="total"><span>Despacho</span><span>' + money(amounts.shipping) + '</span></p><p class="total checkout-grand"><strong>Total a pagar</strong><strong>' + money(amounts.total) + '</strong></p><p class="checkout-note">El total incluye el despacho de $3.990.</p>' +
    '<button class="back-cart" id="back-cart">← Volver al carrito</button><form class="checkout-form" id="flow-checkout-form"><label for="checkout-email">Correo electrónico para el pago<input id="checkout-email" name="email" type="email" autocomplete="email" maxlength="254" required></label><p class="checkout-note">Flow procesará tu pago de forma segura. Los libros digitales estarán disponibles después de confirmar el pago.</p><p class="checkout-error" id="checkout-error" role="alert" hidden></p><button class="pill wide">PAGAR CON FLOW</button></form>';
  openDialog('checkout');
}
byId('consent-accept').addEventListener('click', () => setMarketingConsent(true));
byId('consent-reject').addEventListener('click', () => setMarketingConsent(false));
byId('manage-consent').addEventListener('click', () => { byId('marketing-consent').hidden = false; });
if (marketingConsent === 'granted') {
  loadMetaPixel();
} else if (marketingConsent !== 'denied') {
  byId('marketing-consent').hidden = false;
}
document.addEventListener('click', event => {
  const button = event.target.closest('button');
  const link = event.target.closest('dialog a[href^="#"]');
  if (link) link.closest('dialog').close();
  if (!button) {
    if (event.target instanceof HTMLDialogElement) {
      const rect = event.target.getBoundingClientRect();
      if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) event.target.close();
    }
    return;
  }
  if (button.dataset.selectProduct) selectProduct(button.dataset.selectProduct, true);
  if ('close' in button.dataset) button.closest('dialog').close();
  if (button.dataset.open) openDialog(button.dataset.open);
  if (button.dataset.add) addToCart(button.dataset.add);
  if (button.dataset.qty) changeQuantity(button.dataset.qty, Number(button.dataset.delta));
  if (button.dataset.photo) {
    const photo = byId('full-photo');
    photo.src = asset(button.dataset.photo);
    photo.alt = pics[button.dataset.photo];
    photo.classList.toggle('bottle-image', isBottle(button.dataset.photo));
    openDialog('photo');
  }
  if (button.id === 'continue-checkout') checkout();
  if (button.id === 'back-cart') openDialog('cart');
});
byId('dismiss').addEventListener('click', () => { byId('dock').hidden = true; });
byId('checkout-body').addEventListener('submit', event => {
  if (event.target.id !== 'flow-checkout-form') return;
  event.preventDefault();
  if (!Object.values(cart).some(quantity => quantity > 0)) return;
  const form = event.target;
  const submitButton = form.querySelector('button[type="submit"], button:not([type])');
  const error = byId('checkout-error');
  const eventId = newMetaEventId();
  const orderItems = products.filter(item => cart[item.id] > 0).map(item => ({ id: item.id, quantity: cart[item.id] }));
  const orderTotal = totals().total;
  trackMeta('InitiateCheckout', {
    content_ids: orderItems.map(item => item.id),
    contents: orderItems,
    content_type: 'product',
    value: orderTotal,
    currency: 'CLP'
  }, eventId);
  submitButton.disabled = true;
  submitButton.textContent = 'CONECTANDO CON FLOW…';
  error.hidden = true;
  fetch('/api/flow/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: form.elements.email.value.trim(),
      items: orderItems,
      marketingConsent: marketingConsent === 'granted',
      eventId,
      fbp: marketingConsent === 'granted' ? getMetaCookie('_fbp') : null,
      fbc: marketingConsent === 'granted' ? getMetaCookie('_fbc') : null
    })
  }).then(async response => {
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No pudimos iniciar el pago.');
    const checkoutUrl = new URL(result.checkoutUrl);
    if (checkoutUrl.origin !== 'https://www.flow.cl') throw new Error('Flow devolvió una dirección de pago no válida.');
    window.location.assign(checkoutUrl);
  }).catch(reason => {
    error.textContent = reason.message || 'No pudimos iniciar el pago. Inténtalo nuevamente.';
    error.hidden = false;
    submitButton.disabled = false;
    submitButton.textContent = 'PAGAR CON FLOW';
  });
});
renderCart();

let flowReturnToken = '';
async function checkFlowReturn() {
  const params = new URLSearchParams(window.location.search);
  flowReturnToken = params.get('token') || '';
  if (!flowReturnToken && params.get('flow') !== 'return') return;
  openDialog('checkout');
  byId('checkout-body').innerHTML = '<p class="checkout-note" role="status">Estamos verificando tu pago con Flow…</p>';
  if (flowReturnToken) {
    history.replaceState(null, '', window.location.pathname + window.location.hash);
    await refreshFlowStatus();
  } else {
    byId('checkout-body').innerHTML = '<div class="checkout-error" role="alert">No recibimos el identificador de pago. Si ya pagaste, vuelve a intentarlo en unos instantes o contáctanos.</div>';
  }
}
async function refreshFlowStatus() {
  const body = byId('checkout-body');
  body.innerHTML = '<p class="checkout-note" role="status">Estamos verificando tu pago con Flow…</p>';
  try {
    const response = await fetch('/api/flow/status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: flowReturnToken })
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || 'No pudimos verificar el pago.');
    if (result.status === 'paid') {
      trackMeta('Purchase', {
        content_ids: (result.items || []).map(item => item.id),
        contents: result.items || [],
        content_type: 'product',
        value: result.amount,
        currency: result.currency || 'CLP'
      }, result.eventId);
      Object.keys(cart).forEach(key => { cart[key] = 0; });
      save('np-nutre-pure-cart', cart);
      renderCart();
      body.innerHTML = '<div class="checkout-success"><span class="success-mark" aria-hidden="true">✓</span><p class="eyebrow">PAGO CONFIRMADO POR FLOW</p><h3>Gracias por elegir Nutrición Pura.</h3><p>Tu pago fue confirmado. Aquí puedes descargar tus tres libros de regalo.</p></div><div class="gift-delivery"><div class="gift-miniatures">' + giftBooks.map((book,i) => '<img src="img/libro-' + (i+1) + '.webp" alt="' + book.title + '">').join('') + '</div><h3>Tus tres libros de regalo</h3><details class="gift-fallback" open><summary>Descarga la colección en PDF</summary>' + giftBooks.map(book => '<a href="regalos/' + book.file + '.pdf" download>' + book.title + ' ↓</a>').join('') + '</details></div><a class="pill wide" href="#catalogo">VOLVER AL CATÁLOGO</a>';
    } else if (result.status === 'pending') {
      body.innerHTML = '<div class="checkout-note" role="status">Flow todavía no confirma el pago. Tus libros estarán disponibles cuando se confirme.</div><button class="pill wide" id="verify-flow-payment">VERIFICAR NUEVAMENTE</button><a class="pill wide" href="#catalogo">VOLVER AL CATÁLOGO</a>';
    } else {
      body.innerHTML = '<div class="checkout-note" role="status">El pago no fue confirmado. No se registró una compra pagada.</div><a class="pill wide" href="#catalogo">VOLVER AL CATÁLOGO</a>';
    }
  } catch (error) {
    body.innerHTML = '<div class="checkout-error" role="alert"></div><button class="pill wide" id="verify-flow-payment">INTENTAR VERIFICAR DE NUEVO</button>';
    body.querySelector('[role="alert"]').textContent = error.message || 'No pudimos verificar el pago.';
  }
}
byId('checkout-body').addEventListener('click', event => {
  if (event.target.id === 'verify-flow-payment') refreshFlowStatus();
});
checkFlowReturn();

const observer = new IntersectionObserver(entries => entries.forEach(entry => {
  if (!entry.isIntersecting) return;
  observer.unobserve(entry.target);
  const number = Number(entry.target.dataset.count);
  const suffix = entry.target.dataset.suffix || '';
  const prefix = entry.target.dataset.prefix || '';
  const duration = Number(entry.target.dataset.duration) || 2200;
  const start = performance.now();
  function animate(now) {
    const progress = motion.matches ? 1 : Math.min((now - start) / duration, 1);
    entry.target.textContent = prefix + new Intl.NumberFormat('es-CL').format(Math.round(number * (1 - (1 - progress) ** 2))) + suffix;
    if (progress < 1) requestAnimationFrame(animate);
  }
  requestAnimationFrame(animate);
}), { threshold:.7 });
document.querySelectorAll('[data-count]').forEach(element => observer.observe(element));
