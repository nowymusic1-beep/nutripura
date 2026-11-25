'use strict';

/* Buscador de direcciones del checkout (igual que en Pasión Fútbol).
   Sugiere direcciones reales de Chile mientras se escribe, completa región y comuna
   y verifica la dirección antes de pagar. Si el servicio no está disponible, se puede
   escribir la dirección a mano. Depende de app.js y chile-communes.js. */

const addressLookup = {
  debounce: null,
  blurTimer: null,
  controller: null,
  cache: new Map(),
  suggestions: [],
  active: -1,
  verifying: false,
  disabled: false,
  state: { status: 'idle', input: '', formattedAddress: '' }
};
const normGeo = text => String(text || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/^region\s+(?:de(?:l)?\s+)?(?:la\s+|los\s+|las\s+)?/, '')
  .replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
const checkoutFormEl = () => byId('flow-checkout-form');
const escapeText = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

function communeOptions(regionName, selected) {
  const region = CHILE_REGIONS.find(item => item.name === regionName);
  if (!region) return '<option value="">Primero elige tu región</option>';
  return '<option value="">Elige tu comuna</option>' + region.communes.map(name =>
    '<option' + (normGeo(name) === normGeo(selected) ? ' selected' : '') + '>' + escapeText(name) + '</option>').join('');
}
function syncCommunes(form, selected) {
  const select = form.elements.comuna;
  select.innerHTML = communeOptions(form.elements.region.value, selected ?? select.value);
  select.disabled = !form.elements.region.value;
}

function setAddressStatus(kind, html) {
  const status = byId('address-status');
  if (!status) return;
  status.className = 'address-status' + (kind ? ' is-' + kind : '');
  status.hidden = !html;
  status.innerHTML = html || '';
}
function resetAddressState() {
  if (addressLookup.state.status === 'idle') return;
  addressLookup.state = { status: 'idle', input: '', formattedAddress: '' };
  setAddressStatus('', '');
}
function hideSuggestions() {
  const list = byId('address-suggestions');
  addressLookup.suggestions = [];
  addressLookup.active = -1;
  if (!list) return;
  list.hidden = true;
  list.innerHTML = '';
  checkoutFormEl()?.elements.address.setAttribute('aria-expanded', 'false');
}
function renderSuggestions(items) {
  const list = byId('address-suggestions');
  addressLookup.suggestions = items;
  addressLookup.active = -1;
  if (!items.length || !list) return hideSuggestions();
  list.innerHTML = items.map((item, i) => '<li><button type="button" role="option" id="address-option-' + i + '" data-suggestion="' + i + '" aria-selected="false"><strong>' +
    escapeText(item.mainText) + '</strong>' + (item.secondaryText ? '<small>' + escapeText(item.secondaryText) + '</small>' : '') + '</button></li>').join('');
  list.hidden = false;
  checkoutFormEl().elements.address.setAttribute('aria-expanded', 'true');
}

// Busca la región y comuna de la lista oficial que corresponden a lo que devolvió el mapa.
function matchPlace(regionText, communeText) {
  const commune = normGeo(communeText);
  const region = normGeo(regionText);
  for (const item of CHILE_REGIONS) {
    const regionMatch = region && (normGeo(item.name).includes(region) || region.includes(normGeo(item.name)));
    const found = item.communes.find(name => normGeo(name) === commune);
    if (found && (regionMatch || !region)) return { region: item.name, commune: found };
  }
  const byRegion = CHILE_REGIONS.find(item => region && (normGeo(item.name).includes(region) || region.includes(normGeo(item.name))));
  return { region: byRegion?.name || '', commune: '' };
}
function applyPlace(form, regionText, communeText) {
  const match = matchPlace(regionText, communeText);
  if (match.region && form.elements.region.value !== match.region) {
    form.elements.region.value = match.region;
    syncCommunes(form, match.commune);
  } else if (match.commune) {
    form.elements.comuna.value = match.commune;
  }
  ['region', 'comuna'].forEach(name => { if (form.elements[name].value) showFieldError(form, name, ''); });
  return match;
}

function applyVerified(form, data) {
  if (data.streetLine) form.elements.address.value = data.streetLine;
  const match = applyPlace(form, data.region, data.commune);
  addressLookup.state = { status: 'verified', input: form.elements.address.value.trim(), formattedAddress: data.formattedAddress || '' };
  showFieldError(form, 'address', '');
  refreshCheckoutMap(form);
  if (match.commune && form.elements.comuna.value && normGeo(form.elements.comuna.value) !== normGeo(match.commune)) {
    setAddressStatus('warn', 'Encontramos la dirección en <strong>' + escapeText(match.commune) + '</strong>, pero elegiste otra comuna. Revisa cuál es la correcta.');
    return true;
  }
  setAddressStatus(data.numberConfirmed === false ? 'warn' : 'verified', data.numberConfirmed === false
    ? 'Calle encontrada: ' + escapeText(data.formattedAddress) + '. Revisa que el número sea correcto.'
    : 'Dirección verificada: ' + escapeText(data.formattedAddress));
  return true;
}

async function postAddress(path, body, signal) {
  const response = await fetch(path, { method:'POST', headers:{ 'Content-Type':'application/json' }, body: JSON.stringify(body), signal });
  const data = await response.json().catch(() => ({}));
  if (response.status === 503 && data.code === 'MAPS_NOT_CONFIGURED') addressLookup.disabled = true;
  return { response, data };
}

async function fetchSuggestions(form, query) {
  const commune = form.elements.comuna.value;
  const key = query.toLowerCase() + '|' + commune;
  addressLookup.controller?.abort();
  if (addressLookup.cache.has(key)) return renderSuggestions(addressLookup.cache.get(key));
  const controller = new AbortController();
  addressLookup.controller = controller;
  try {
    const { response, data } = await postAddress('/api/address/autocomplete', { input: query, communeName: commune }, controller.signal);
    if (controller.signal.aborted || form.elements.address.value.trim() !== query) return;
    if (!response.ok) return hideSuggestions();
    const items = Array.isArray(data.suggestions) ? data.suggestions : [];
    if (addressLookup.cache.size > 60) addressLookup.cache.delete(addressLookup.cache.keys().next().value);
    addressLookup.cache.set(key, items);
    renderSuggestions(items);
  } catch (error) {
    if (error?.name !== 'AbortError') hideSuggestions();
  } finally {
    if (addressLookup.controller === controller) addressLookup.controller = null;
  }
}

// Devuelve true si se puede seguir al pago: dirección verificada, o el servicio no respondió.
async function verifyAddress(form, placeId = '') {
  const input = form.elements.address.value.trim();
  if (addressLookup.disabled) return true;
  if (addressLookup.state.status === 'verified' && addressLookup.state.input === input) return true;
  addressLookup.verifying = true;
  setAddressStatus('checking', 'Verificando tu dirección…');
  try {
    const { response, data } = await postAddress('/api/address/verify', { input, placeId, communeName: form.elements.comuna.value });
    if (!response.ok) {
      setAddressStatus(addressLookup.disabled ? '' : 'warn', addressLookup.disabled ? '' : 'No pudimos verificar la dirección ahora. Revisa que la calle y el número estén bien.');
      return true;
    }
    if (data.status === 'verified') return applyVerified(form, data);
    if (data.status === 'route_only') {
      applyPlace(form, data.region, data.commune);
      addressLookup.state = { status: 'route_only', input, formattedAddress: '' };
      setAddressStatus('warn', 'Encontramos la calle. Escribe también el número de tu casa o edificio.');
      return false;
    }
    addressLookup.state = { status: 'not_found', input, formattedAddress: '' };
    setAddressStatus('error', 'No encontramos esta dirección en Chile. Revisa la calle, el número y la comuna, o elige una sugerencia de la lista.');
    return false;
  } catch {
    setAddressStatus('warn', 'No pudimos verificar la dirección ahora. Revisa que la calle y el número estén bien.');
    return true;
  } finally {
    addressLookup.verifying = false;
  }
}

const checkoutBody = byId('checkout-body');
checkoutBody.addEventListener('input', event => {
  const form = checkoutFormEl();
  if (!form || event.target !== form.elements.address) return;
  resetAddressState();
  clearTimeout(addressLookup.debounce);
  const query = event.target.value.trim();
  if (query.length < 4 || addressLookup.disabled) {
    addressLookup.controller?.abort();
    return hideSuggestions();
  }
  addressLookup.debounce = setTimeout(() => fetchSuggestions(form, query), 250);
});
checkoutBody.addEventListener('change', event => {
  const form = checkoutFormEl();
  if (!form) return;
  if (event.target === form.elements.region) { syncCommunes(form, ''); resetAddressState(); }
  if (event.target === form.elements.comuna) resetAddressState();
});
checkoutBody.addEventListener('keydown', event => {
  const form = checkoutFormEl();
  if (!form || event.target !== form.elements.address || !addressLookup.suggestions.length) return;
  const options = [...byId('address-suggestions').querySelectorAll('[role="option"]')];
  if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
    event.preventDefault();
    addressLookup.active = (addressLookup.active + (event.key === 'ArrowDown' ? 1 : -1) + options.length) % options.length;
    options.forEach((option, i) => option.setAttribute('aria-selected', String(i === addressLookup.active)));
    form.elements.address.setAttribute('aria-activedescendant', options[addressLookup.active].id);
  } else if (event.key === 'Enter' && addressLookup.active >= 0) {
    event.preventDefault();
    options[addressLookup.active].click();
  } else if (event.key === 'Escape') {
    hideSuggestions();
  }
});
checkoutBody.addEventListener('click', event => {
  const option = event.target.closest('[data-suggestion]');
  const form = checkoutFormEl();
  if (!option || !form) return;
  const item = addressLookup.suggestions[Number(option.dataset.suggestion)];
  hideSuggestions();
  clearTimeout(addressLookup.blurTimer);
  if (!item) return;
  const input = form.elements.address;
  if (item.hasStreetNumber) {
    applyVerified(form, item);
  } else {
    input.value = (item.streetLine || item.mainText) + ' ';
    applyPlace(form, item.region, item.commune);
    addressLookup.state = { status: 'route_only', input: input.value.trim(), formattedAddress: '' };
    setAddressStatus('warn', 'Escribe el número de tu casa o edificio para terminar.');
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
});
// Al salir del campo se verifica sola (con una pausa para que un toque en una sugerencia llegue primero).
checkoutBody.addEventListener('focusout', event => {
  const form = checkoutFormEl();
  if (!form || event.target !== form.elements.address) return;
  clearTimeout(addressLookup.blurTimer);
  addressLookup.blurTimer = setTimeout(() => {
    hideSuggestions();
    const value = form.elements.address.value.trim();
    if (!addressLookup.verifying && value.length >= 5 && /\d/.test(value) && addressLookup.state.input !== value) verifyAddress(form);
  }, 350);
});
checkoutBody.addEventListener('focusin', event => {
  if (event.target.name === 'address') clearTimeout(addressLookup.blurTimer);
});
