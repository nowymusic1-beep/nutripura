'use strict';

const byId = id => document.getElementById(id);
const money = value => '$' + new Intl.NumberFormat('es-CL').format(value);
const isBottle = name => name === 'berberina' || name === 'magnesio';
const asset = name => 'img/' + name + (isBottle(name) ? '.png' : '.webp');
const pics = {
  hero: 'Pareja junto a los frascos Nutre Pure',
  berberina: 'https://meli.la/2apy1KR',
  magnesio: 'Frasco original de Magnesium Complex Nutre Pure',
  'berberina-escena': 'Berberina Nutre Pure en una escena botánica',
  'magnesio-escena': 'Magnesium Complex Nutre Pure con hojas y limas',
  botanical: 'Berberina Nutre Pure junto a una taza de té',
  ritual: 'Magnesium Complex Nutre Pure junto a agua con limón',
  duo: 'Berberina y Magnesium Complex Nutre Pure'
};
// Enlaces a las publicaciones de Mercado Libre. Reemplázalos por tus enlaces de referido.
const MERCADO_LIBRE_LINKS = {
  berberina: 'https://meli.la/1xmrdwc',
  magnesio: 'https://meli.la/1wLmMVV'
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
    notes:['El magnesio contribuye a disminuir el cansancio','Y al funcionamiento normal de músculos y sistema nervioso'] },
  // Producto oculto para probar pagos reales. Se abre con https://www.nutricionpura.cl/?prueba
  { id:'prueba', hidden:true, title:'Pago de prueba', price:400, tag:'PRUEBA', main:'magnesio', slides:['magnesio'], size:'', pitch:'', notes:[] }
];
const isTestOrder = () => cart.prueba > 0;
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
byId('products').innerHTML = products.filter(product => !product.hidden).map(product => {
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
  if (isTestOrder()) return { subtotal, savings:0, shipping:0, total:subtotal };
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
      crossSell() + giftSummary() + '<p class="total"><span>Despacho</span><span>' + money(amounts.shipping) + '</span></p><p class="total"><strong>Total a pagar</strong><strong>' + money(amounts.total) + '</strong></p><button class="pill wide" id="continue-checkout">CONTINUAR CON EL PAGO</button>';
  }
  if (focusControl) (byId('cart-body').querySelector(focusControl) || byId('cart').querySelector('[data-close]')).focus();
}
function crossSell() {
  const inCart = products.filter(item => cart[item.id] > 0).map(item => item.id);
  if (inCart.length !== 1 || !CROSS_SELL[inCart[0]]) return '';
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
const REGIONS = CHILE_REGIONS.map(region => region.name);
const CHECKOUT_FIELDS = {
  firstName: { label:'Nombre', autocomplete:'given-name', max:60 },
  lastName: { label:'Apellido', autocomplete:'family-name', max:60 },
  email: { label:'Correo electrónico', type:'email', autocomplete:'email', max:254, hint:'Aquí te llega el comprobante de pago.' },
  phone: { label:'Celular', type:'tel', autocomplete:'tel-national', max:20, placeholder:'9 1234 5678', hint:'Para coordinar la entrega.' },
  region: { label:'Región', options:REGIONS, autocomplete:'address-level1' },
  comuna: { label:'Comuna', communes:true },
  address: { label:'Calle y número', max:150, placeholder:'Empieza a escribir y elige tu dirección', hint:'Te sugerimos direcciones de Chile mientras escribes.', lookup:true },
  unit: { label:'Depto, casa u oficina', autocomplete:'address-line2', max:60, optional:true },
  notes: { label:'Indicaciones para el despacho', max:200, optional:true, textarea:true, placeholder:'Ej.: dejar en conserjería' }
};
const fieldError = {
  email: value => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value) ? '' : 'Ingresa un correo válido.',
  firstName: value => /^\p{L}[\p{L}\s'.-]*$/u.test(value) ? '' : 'Ingresa tu nombre.',
  lastName: value => /^\p{L}[\p{L}\s'.-]*$/u.test(value) ? '' : 'Ingresa tu apellido.',
  phone: value => /^9\d{8}$/.test(value.replace(/\D/g, '').replace(/^56/, '')) ? '' : 'Ingresa un celular chileno de 9 dígitos, por ejemplo 9 1234 5678.',
  region: value => REGIONS.includes(value) ? '' : 'Elige tu región.',
  comuna: (value, form) => CHILE_REGIONS.find(region => region.name === form.elements.region.value)?.communes.includes(value) ? '' : 'Elige tu comuna.',
  address: value => value.trim().length >= 4 && /\d/.test(value) ? '' : 'Ingresa la calle y el número.'
};
const rememberedKey='np-checkout-customer';
function rememberedCustomer(){
  const saved=read(rememberedKey,null);
  if(saved&&saved.consent===true&&Number.isFinite(saved.expiresAt)&&saved.expiresAt>Date.now())return saved;
  if(saved)forgetCustomer();
  return null;
}
function forgetCustomer(){try{localStorage.removeItem(rememberedKey);}catch{}}
function fieldMarkup(name) {
  const field = CHECKOUT_FIELDS[name];
  const saved = name==='email' ? (rememberedCustomer()?.email || '') : '';
  const value = String(saved).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const common = ' id="co-' + name + '" name="' + name + '"' + (field.autocomplete ? ' autocomplete="' + field.autocomplete + '"' : '') + (field.optional ? '' : ' required') + ' aria-describedby="co-' + name + '-msg"';
  let control;
  if (field.communes) control = '<select' + common + ' disabled>' + communeOptions('', '') + '</select>';
  else if (field.lookup) control = '<div class="address-lookup"><input' + common + ' type="text" autocomplete="off" maxlength="' + field.max + '" value="' + value + '" placeholder="' + field.placeholder + '" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="address-suggestions">' +
    '<ul id="address-suggestions" class="address-suggestions" role="listbox" aria-label="Direcciones sugeridas" hidden></ul></div><p id="address-status" class="address-status" role="status" aria-live="polite" hidden></p>';
  else if (field.options) control = '<select' + common + '><option value="">Elige tu región</option>' + field.options.map(option => '<option' + (option === saved ? ' selected' : '') + '>' + option + '</option>').join('') + '</select>';
  else if (field.textarea) control = '<textarea' + common + ' maxlength="' + field.max + '" rows="2"' + (field.placeholder ? ' placeholder="' + field.placeholder + '"' : '') + '>' + value + '</textarea>';
  else control = '<input' + common + ' type="' + (field.type || 'text') + '" maxlength="' + field.max + '" value="' + value + '"' + (field.placeholder ? ' placeholder="' + field.placeholder + '"' : '') + '>';
  return '<div class="field field-' + name + '"><label for="co-' + name + '">' + field.label + (field.optional ? ' <small>(opcional)</small>' : '') + '</label>' + control +
    '<p class="field-msg" id="co-' + name + '-msg">' + (field.hint || '') + '</p></div>';
}
let mpEnabled = false;
fetch('/api/mercadopago/create').then(r=>r.json()).then(r=>{mpEnabled=r.enabled===true;const option=byId('mp-option');if(option)option.hidden=!mpEnabled;}).catch(()=>{});
function checkoutForm() {
  return '<ol class="np-checkout-steps" aria-label="Pasos de compra"><li>1 · Carrito</li><li id="np-step-data" aria-current="step">2 · Despacho</li><li id="np-step-pay">3 · Pago</li></ol><form class="checkout-form" id="flow-checkout-form" novalidate>' +
    '<div id="np-data-stage"><fieldset><legend>Datos de contacto</legend>' + fieldMarkup('email') + (rememberedCustomer()?'<div class="np-account"><button type="button" class="back-cart" id="np-use-saved">Usar datos guardados en este dispositivo</button><button type="button" class="back-cart" id="np-forget-saved">Olvidar datos guardados</button></div>':'') + '<div class="field-row">' + fieldMarkup('firstName') + fieldMarkup('lastName') + '</div>' + fieldMarkup('phone') + '</fieldset>' +
    '<fieldset><legend>Datos de despacho</legend>' + fieldMarkup('address') + '<div class="field-row">' + fieldMarkup('region') + fieldMarkup('comuna') + '</div>' + fieldMarkup('unit') + fieldMarkup('notes') + '<figure id="np-map-preview" hidden><img id="np-map-img" alt="Ubicación aproximada de la dirección seleccionada" loading="lazy"><figcaption>Ubicación aproximada. Confirma la calle y el número.</figcaption></figure><a id="np-map-link" target="_blank" rel="noopener noreferrer" hidden>Ver dirección en el mapa ↗</a></fieldset>' +
    '<label class="np-remember"><input type="checkbox" name="remember"> Recordar mis datos en este dispositivo durante 30 días (opcional)</label><button class="pill wide" type="button" id="np-continue">CONTINUAR AL PAGO →</button></div>' +
    '<div id="np-pay-stage" hidden><div class="np-pay-review" id="np-pay-review"></div><button class="back-cart" type="button" id="np-edit">← Editar datos de despacho</button><fieldset><legend>Medio de pago</legend><label><input type="radio" name="provider" value="flow" checked> Flow</label><label id="mp-option" '+(mpEnabled?'':'hidden')+'><input type="radio" name="provider" value="mercadopago"> Mercado Pago</label></fieldset><p class="checkout-note">Los libros digitales estarán disponibles al confirmar el pago.</p><button class="pill wide" type="submit">PAGAR CON FLOW</button></div><p class="checkout-error" id="checkout-error" role="alert" hidden></p></form>';
}
function setCheckoutStage(payment) {
  byId('np-data-stage').hidden=payment;
  byId('np-pay-stage').hidden=!payment;
  byId('np-step-data').removeAttribute('aria-current');
  byId('np-step-pay').removeAttribute('aria-current');
  byId(payment?'np-step-pay':'np-step-data').setAttribute('aria-current','step');
}
function refreshCheckoutMap(form) {
  const address=form.elements.address.value.trim(), commune=form.elements.comuna.value, region=form.elements.region.value;
  const link=byId('np-map-link'); if(!link)return;
  link.hidden=!(address&&commune&&region);
  const preview=byId('np-map-preview'),img=byId('np-map-img');
  const point=typeof addressLookup!=='undefined'&&addressLookup.state;
  const valid=point&&point.status==='verified'&&point.input===address&&point.commune===commune&&point.region===region&&Number.isFinite(point.lat)&&Number.isFinite(point.lon);
  if(preview&&img){preview.hidden=!valid;if(valid){const src='/api/address/map?lat='+encodeURIComponent(point.lat)+'&lon='+encodeURIComponent(point.lon);if(img.getAttribute('src')!==src)img.src=src;}else img.removeAttribute('src');}
  if(!link.hidden)link.href='https://www.google.com/maps/search/?api=1&query='+encodeURIComponent([address,commune,region,'Chile'].join(', '));
}
byId('checkout-body').addEventListener('change',event=>{const form=event.target.form;if(form?.id==='flow-checkout-form')refreshCheckoutMap(form);});
byId('checkout-body').addEventListener('click',async event=>{
  const button=event.target.closest('button');if(!button)return;
  const form=button.form;if(form?.id!=='flow-checkout-form')return;
  if(button.id==='np-use-saved'){
    const saved=rememberedCustomer();
    if(!saved||saved.email.toLowerCase()!==form.elements.email.value.trim().toLowerCase()){byId('checkout-error').textContent='Ingresa el correo asociado a los datos guardados en este dispositivo.';byId('checkout-error').hidden=false;form.elements.email.focus();return;}
    for(const name of ['firstName','lastName','phone','region','address','unit','notes'])if(typeof saved[name]==='string')form.elements[name].value=saved[name];
    syncCommunes(form,saved.comuna||'');form.elements.remember.checked=true;resetAddressState();refreshCheckoutMap(form);byId('checkout-error').hidden=true;return;
  }
  if(button.id==='np-forget-saved'){forgetCustomer();form.elements.remember.checked=false;for(const name of ['firstName','lastName','phone','region','address','unit','notes'])form.elements[name].value='';syncCommunes(form,'');form.elements.email.value='';resetAddressState();refreshCheckoutMap(form);button.parentElement.remove();form.elements.email.focus();return;}
  if(button.id==='np-edit'){setCheckoutStage(false);byId('checkout-error').hidden=true;form.elements.email.focus();return;}
  if(button.id!=='np-continue'||button.disabled)return;
  const error=byId('checkout-error'),invalid=validateCheckout(form);
  if(invalid){error.textContent='Revisa los campos marcados para continuar.';error.hidden=false;invalid.focus();return;}
  button.disabled=true;
  try{
    const ok=await verifyAddress(form);
    if(!ok){error.textContent='Revisa tu dirección para continuar.';error.hidden=false;form.elements.address.focus();return;}
    const again=validateCheckout(form);if(again){error.textContent='Revisa los campos marcados.';error.hidden=false;again.focus();return;}
    const review=byId('np-pay-review');review.replaceChildren();
    for(const value of ['Entrega a '+form.elements.firstName.value+' '+form.elements.lastName.value,form.elements.email.value,[form.elements.address.value,form.elements.unit.value,form.elements.comuna.value,form.elements.region.value].filter(Boolean).join(', '),'Total a pagar: '+money(totals().total)]){const p=document.createElement('p');p.textContent=value;review.append(p);}
    error.hidden=true;setCheckoutStage(true);form.elements.provider[0]?.focus();
  }finally{button.disabled=false;}
});
function showFieldError(form, name, message) {
  const control = form.elements[name];
  const msg = byId('co-' + name + '-msg');
  if (!control || !msg) return;
  control.setAttribute('aria-invalid', String(Boolean(message)));
  msg.textContent = message || CHECKOUT_FIELDS[name].hint || '';
  msg.classList.toggle('is-error', Boolean(message));
}
function validateCheckout(form) {
  let first = null;
  Object.keys(fieldError).forEach(name => {
    const message = fieldError[name](form.elements[name].value.trim(), form);
    showFieldError(form, name, message);
    if (message && !first) first = form.elements[name];
  });
  return first;
}
byId('checkout-body').addEventListener('change', event => {
  if(event.target.name==='provider'){event.target.form.querySelector('button[type=submit]').textContent=event.target.value==='mercadopago'?'PAGAR CON MERCADO PAGO':'PAGAR CON FLOW';return;}
  const form = event.target.form;
  if (!form || form.id !== 'flow-checkout-form' || !fieldError[event.target.name]) return;
  if (event.target.getAttribute('aria-invalid') !== null || event.target.value) showFieldError(form, event.target.name, fieldError[event.target.name](event.target.value.trim(), form));
});
function choosePurchaseChannel(){
  if(isTestOrder()){checkout();return;}
  const ids=products.filter(p=>cart[p.id]>0&&MERCADO_LIBRE_LINKS[p.id]);
  if(!ids.length)return;
  byId('cart-body').innerHTML='<div class="np-channel"><p class="eyebrow">ELIGE DÓNDE COMPRAR</p><h3>¿Dónde prefieres continuar?</h3><p>Elige nuestra tienda o la publicación de Mercado Libre.</p><button type="button" class="pill wide" id="np-shop-direct">COMPRAR EN NUTRICIÓN PURA</button><p class="np-channel-note">10% de descuento web · 3 libros digitales de regalo · Flow o Mercado Pago</p><div class="np-ml-options">'+ids.map(p=>'<a class="np-ml-choice" href="'+MERCADO_LIBRE_LINKS[p.id]+'" rel="sponsored noopener">Comprar '+p.title+' en Mercado Libre ↗</a>').join('')+'</div><p class="np-channel-note">Mercado Libre tiene sus propios precios, cantidades y condiciones de despacho. Tu carrito no se transfiere automáticamente.</p><button type="button" class="back-cart" id="np-channel-back">← Volver al carrito</button></div>';
  byId('np-shop-direct').focus();
}
function checkout() {
  if (!Object.values(cart).some(quantity => quantity > 0)) return;
  const amounts = totals();
  byId('checkout-body').innerHTML = '<div class="checkout-welcome"><p class="eyebrow">UN MOMENTO PARA TI</p><h3>Tu bienestar empieza aquí.</h3><p>Revisa lo que elegiste y los regalos que te acompañan.</p></div><div class="checkout-items">' +
    products.filter(item => cart[item.id]).map(item => '<div class="checkout-item">' + photoMarkup(item.main) + '<div><strong>' + item.title + '</strong><small>' + cart[item.id] + ' × ' + money(item.price) + '</small></div></div>').join('') + '</div>' +
    giftSummary() + '<p class="total"><span>Descuento web · 10 %</span><span>−' + money(amounts.savings) + '</span></p><p class="total"><span>Despacho</span><span>' + money(amounts.shipping) + '</span></p><p class="total checkout-grand"><strong>Total a pagar</strong><strong>' + money(amounts.total) + '</strong></p><p class="checkout-note">' + (isTestOrder() ? 'Pago de prueba: sin despacho.' : 'El total incluye el despacho de $3.990.') + '</p>' +
    '<button class="back-cart" id="back-cart">← Volver al carrito</button>' + checkoutForm();
  openDialog('checkout');
  refreshCheckoutMap(byId('flow-checkout-form'));
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
  if (button.id === 'continue-checkout') choosePurchaseChannel();
  if (button.id === 'np-shop-direct') {renderCart();checkout();}
  if (button.id === 'np-channel-back') {renderCart();byId('continue-checkout')?.focus();}
  if (button.id === 'back-cart') openDialog('cart');
});
byId('dismiss').addEventListener('click', () => { byId('dock').hidden = true; });
byId('checkout-body').addEventListener('submit', async event => {
  if (event.target.id !== 'flow-checkout-form') return;
  event.preventDefault();
  if (!Object.values(cart).some(quantity => quantity > 0)) return;
  const form = event.target;
  if (!byId('np-data-stage').hidden) { byId('np-continue').click(); return; }
  const submitButton = form.querySelector('button[type="submit"]');
  const error = byId('checkout-error');
  const invalid = validateCheckout(form);
  if (invalid) {
    error.textContent = 'Revisa los campos marcados para continuar.';
    error.hidden = false;
    setCheckoutStage(false);
    invalid.focus();
    return;
  }
  if (submitButton.disabled) return;
  submitButton.disabled = true;
  const addressOk = await verifyAddress(form);
  submitButton.disabled = false;
  if (!addressOk) {
    error.textContent = 'Revisa tu dirección para continuar.';
    error.hidden = false;
    setCheckoutStage(false);
    form.elements.address.focus();
    return;
  }
  const value = name => form.elements[name].value.trim();
  const customer = Object.fromEntries(['firstName','lastName','phone','region','comuna','address','unit','notes'].map(name => [name, value(name)]));
  if(form.elements.remember.checked && !isTestOrder()) save(rememberedKey, { ...customer, notes:'', email: value('email').toLowerCase(), consent:true, expiresAt:Date.now()+30*86400000 });
  else if(!form.elements.remember.checked) forgetCustomer();
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
  const provider = mpEnabled && form.elements.provider.value === 'mercadopago' ? 'mercadopago' : 'flow';
  const providerName = provider === 'flow' ? 'FLOW' : 'MERCADO PAGO';
  submitButton.textContent = 'CONECTANDO CON '+providerName+'…';
  error.hidden = true;
  fetch('/api/'+provider+'/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: value('email'),
      customer,
      items: orderItems,
      marketingConsent: marketingConsent === 'granted' && !isTestOrder(),
      eventId,
      fbp: marketingConsent === 'granted' ? getMetaCookie('_fbp') : null,
      fbc: marketingConsent === 'granted' ? getMetaCookie('_fbc') : null
    })
  }).then(async response => {
    const result = await response.json();
    if (!response.ok) {
      if (result.field) { setCheckoutStage(false); showFieldError(form, result.field, result.error); }
      throw new Error(result.error || 'No pudimos iniciar el pago.');
    }
    const checkoutUrl = new URL(result.checkoutUrl);
    if (!(provider==='flow' ? checkoutUrl.origin==='https://www.flow.cl' : ['https://www.mercadopago.cl','https://www.mercadopago.com','https://mercadopago.cl','https://mercadopago.com'].includes(checkoutUrl.origin))) throw new Error('La pasarela devolvió una dirección de pago no válida.');
    window.location.assign(checkoutUrl);
  }).catch(reason => {
    error.textContent = reason.message || 'No pudimos iniciar el pago. Inténtalo nuevamente.';
    error.hidden = false;
    submitButton.disabled = false;
    submitButton.textContent = 'PAGAR CON '+providerName;
  });
});
if (new URLSearchParams(window.location.search).has('prueba') || window.location.pathname === '/prueba') {
  Object.keys(cart).forEach(key => { cart[key] = key === 'prueba' ? 1 : 0; });
  save('np-nutre-pure-cart', cart);
  renderCart();
  // Espera a que cargue address-search.js, que arma los campos de región y comuna.
  window.addEventListener('DOMContentLoaded', checkout);
} else {
  if (cart.prueba) { cart.prueba = 0; save('np-nutre-pure-cart', cart); }
  renderCart();
}

const escapeName = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
let flowReturnToken = '';
let returnProvider = 'flow';
async function checkFlowReturn() {
  const params = new URLSearchParams(window.location.search);
  returnProvider = params.get('mp') === 'return' ? 'mercadopago' : 'flow';
  flowReturnToken = returnProvider==='mercadopago' ? (params.get('mp_token') || '') : (params.get('token') || '');
  if (!flowReturnToken && params.get('flow') !== 'return') return;
  openDialog('checkout');
  byId('checkout-body').innerHTML = '<p class="checkout-note" role="status">Estamos verificando tu pago…</p>';
  if (flowReturnToken) {
    history.replaceState(null, '', window.location.pathname + window.location.hash);
    await refreshFlowStatus();
  } else {
    byId('checkout-body').innerHTML = '<div class="checkout-error" role="alert">No recibimos el identificador de pago. Si ya pagaste, vuelve a intentarlo en unos instantes o contáctanos.</div>';
  }
}
async function refreshFlowStatus() {
  const body = byId('checkout-body');
  body.innerHTML = '<p class="checkout-note" role="status">Estamos verificando tu pago…</p>';
  try {
    const response = await fetch('/api/'+returnProvider+'/status', {
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
      body.innerHTML = '<div class="checkout-success"><span class="success-mark" aria-hidden="true">✓</span><p class="eyebrow">PAGO CONFIRMADO</p><h3>' + (result.firstName ? '¡Gracias, ' + escapeName(result.firstName) + '!' : 'Gracias por elegir Nutrición Pura.') + '</h3><p>Tu pago fue confirmado. Aquí puedes descargar tus tres libros de regalo.</p></div><div class="gift-delivery"><div class="gift-miniatures">' + giftBooks.map((book,i) => '<img src="img/libro-' + (i+1) + '.webp" alt="' + book.title + '">').join('') + '</div><h3>Tus tres libros de regalo</h3><details class="gift-fallback" open><summary>Descarga la colección en PDF</summary>' + giftBooks.map(book => '<a href="regalos/' + book.file + '.pdf" download>' + book.title + ' ↓</a>').join('') + '</details></div><a class="pill wide" href="#catalogo">VOLVER AL CATÁLOGO</a>';
    } else if (result.status === 'pending') {
      body.innerHTML = '<div class="checkout-note" role="status">La pasarela todavía no confirma el pago. Tus libros estarán disponibles cuando se confirme.</div><button class="pill wide" id="verify-flow-payment">VERIFICAR NUEVAMENTE</button><a class="pill wide" href="#catalogo">VOLVER AL CATÁLOGO</a>';
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

window.addEventListener('DOMContentLoaded',()=>{const requested=new URLSearchParams(location.search).get('producto');if(['berberina','magnesio'].includes(requested)){selectProduct(requested,true);trackProductView(requested);}});
