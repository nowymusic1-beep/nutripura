'use strict';

/* Secciones de contenido: componentes interactivos y opiniones de Mercado Libre.
   Depende de app.js (byId, addToCart, MERCADO_LIBRE_LINKS, openDialog). */

const ICONS = {
  activity:'<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
  flame:'<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  gauge:'<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  leaf:'<path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>',
  sparkles:'<path d="M12 3l1.9 5.8L20 10l-6.1 1.2L12 17l-1.9-5.8L4 10l6.1-1.2z"/><path d="M19 17v4M17 19h4"/>',
  zap:'<path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/>',
  waves:'<path d="M2 7c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 13c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/><path d="M2 19c2.5 0 2.5-2 5-2s2.5 2 5 2 2.5-2 5-2 2.5 2 5 2"/>',
  gem:'<path d="M6 3h12l4 6-10 13L2 9Z"/><path d="M2 9h20M12 22 8 9l4-6 4 6-4 13"/>',
  citrus:'<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6l12.8 12.8M18.4 5.6 5.6 18.4"/>',
  apple:'<path d="M12 20.94c1.5 0 2.75 1.06 4 1.06 3 0 6-8 6-12.22A4.91 4.91 0 0 0 17 5c-2.22 0-4 1.44-5 2-1-.56-2.78-2-5-2a4.9 4.9 0 0 0-5 4.78C2 14 5 22 8 22c1.25 0 2.5-1.06 4-1.06Z"/><path d="M10 2c1 .5 2 2 2 5"/>',
  brain:'<path d="M9.5 3A2.5 2.5 0 0 0 7 5.5v.3A3 3 0 0 0 4.5 9a3 3 0 0 0 .3 4.9A3 3 0 0 0 7 18.5 2.5 2.5 0 0 0 9.5 21H12V3Z"/><path d="M14.5 3A2.5 2.5 0 0 1 17 5.5v.3A3 3 0 0 1 19.5 9a3 3 0 0 1-.3 4.9 3 3 0 0 1-2.2 4.6 2.5 2.5 0 0 1-2.5 2.5H12V3Z"/>',
  shield:'<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
  heart:'<path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/>'
};
const icon = name => '<svg viewBox="0 0 24 24" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ICONS[name] + '</svg>';
const escapeHtml = text => String(text).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

const ORBITS = {
  berberina: {
    bottle: 'img/berberina.png',
    bottleAlt: 'Frasco de Berberina Nutre Pure rodeado por sus siete componentes',
    items: [
      { name:'Berberina', benefit:'El componente más investigado', icon:'activity', photo:'img/ingredientes/0.webp',
        text:'Proviene de plantas como el agracejo. Una revisión de 46 ensayos observó efectos sobre glucosa y lípidos en adultos con diabetes tipo 2, aunque la calidad de los estudios fue variable.',
        alt:'Frutos de agracejo (Berberis vulgaris), planta que contiene berberina', caption:'Agracejo, planta de origen', file:'Berberis_vulgaris_-_img_19287.jpg', author:'Pmau', license:'CC BY-SA 4.0', licenseUrl:'https://creativecommons.org/licenses/by-sa/4.0/' },
      { name:'Canela de Ceilán', benefit:'Especia de uso tradicional', icon:'flame', photo:'img/ingredientes/1.webp',
        text:'La canela "verdadera", estudiada por su posible relación con la respuesta de la glucosa. La evidencia disponible todavía no es concluyente.',
        alt:'Rollos de corteza de canela de Ceilán', caption:'Canela de Ceilán, corteza', file:'Cinnamomum_verum_spices.jpg', author:'Simon A. Eugster', license:'CC BY-SA 3.0', licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/' },
      { name:'Cromo', benefit:'Mineral del metabolismo', icon:'gauge', photo:'img/ingredientes/2.webp',
        text:'Participa en procesos relacionados con carbohidratos y grasas. Según los NIH, los estudios sobre glucosa muestran resultados desiguales.',
        alt:'Cristales del elemento cromo', caption:'Cromo elemental (no es la forma del suplemento)', file:'Chromium_crystals_and_1cm3_cube.jpg', author:'Alchemist-hp', license:'FAL', licenseUrl:'https://artlibre.org/licence/lal/en/' },
      { name:'Melón amargo', benefit:'Fruto de la cocina asiática', icon:'leaf', photo:'img/ingredientes/3.webp',
        text:'Se usa en cocinas y prácticas tradicionales de Asia. Se investiga su relación con la glucosa, aunque las revisiones consideran que aún falta evidencia.',
        alt:'Melón amargo fresco', caption:'Melón amargo, fruto', file:'Bittermelloncloseup.jpg', author:'FlyingToaster', license:'CC BY 3.0', licenseUrl:'https://creativecommons.org/licenses/by/3.0/' },
      { name:'Cúrcuma', benefit:'Raíz rica en curcuminoides', icon:'sparkles', photo:'img/ingredientes/4.webp',
        text:'Raíz usada ampliamente como especia. Sus curcuminoides tienen actividad antioxidante y sus efectos como suplemento siguen en investigación.',
        alt:'Rizomas y polvo de cúrcuma', caption:'Cúrcuma, rizoma y polvo', file:'Curcuma_longa_roots.jpg', author:'Simon A. Eugster', license:'CC BY-SA 3.0', licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/' },
      { name:'Panax ginseng', benefit:'Raíz tradicional de Asia', icon:'zap', photo:'img/ingredientes/5.webp',
        text:'Se emplea tradicionalmente en Asia y se estudia por su relación con la energía y la glucosa. Los resultados todavía son limitados.',
        alt:'Raíces de ginseng', caption:'Ginseng, raíz', file:'Insam_(ginseng).jpg', author:'국립국어원', license:'CC BY-SA 2.0 KR', licenseUrl:'https://creativecommons.org/licenses/by-sa/2.0/kr/' },
      { name:'Glucomanano', benefit:'Fibra soluble del konjac', icon:'waves', photo:'img/ingredientes/6.webp',
        text:'Fibra que absorbe agua y forma un gel. Por eso es importante tomarla con suficiente líquido y respetar el modo de uso de la etiqueta.',
        alt:'Tubérculo de konjac, fuente de glucomanano', caption:'Konjac, origen del glucomanano', file:'Amorphophallus_konjac_knolle.jpg', author:'Sebastian Stabinger', license:'CC BY-SA 3.0', licenseUrl:'https://creativecommons.org/licenses/by-sa/3.0/' }
    ]
  },
  magnesio: {
    bottle: 'img/magnesio.png',
    bottleAlt: 'Frasco de Magnesium Complex Nutre Pure rodeado por sus siete componentes',
    items: [
      { name:'Glicinato de magnesio', benefit:'Forma quelada', icon:'gem', photo:'img/magnesio/glicinato.webp',
        text:'Magnesio unido al aminoácido glicina. Es una de las formas que más se eligen porque suele ser bien tolerada a nivel digestivo.', alt:'Ilustración de una molécula', caption:'Ilustración Nutrición Pura' },
      { name:'Citrato de magnesio', benefit:'Buena solubilidad', icon:'citrus', photo:'img/magnesio/citrato.webp',
        text:'Magnesio unido al ácido cítrico, una de las formas más estudiadas por lo bien que se disuelve. En cantidades altas puede tener efecto laxante.', alt:'Ilustración de una rodaja de limón', caption:'Ilustración Nutrición Pura' },
      { name:'Malato de magnesio', benefit:'Ácido málico de las frutas', icon:'apple', photo:'img/magnesio/malato.webp',
        text:'Magnesio unido al ácido málico, presente en frutas como la manzana. El magnesio contribuye al metabolismo energético normal.', alt:'Ilustración de una manzana verde', caption:'Ilustración Nutrición Pura' },
      { name:'Vitamina B6', benefit:'Sistema nervioso', icon:'brain', photo:'img/magnesio/b6.webp',
        text:'Contribuye al funcionamiento normal del sistema nervioso y a disminuir el cansancio y la fatiga.', alt:'Ilustración de garbanzos, fuente de vitamina B6', caption:'Ilustración Nutrición Pura' },
      { name:'Zinc', benefit:'Defensas', icon:'shield', photo:'img/magnesio/zinc.webp',
        text:'Contribuye al funcionamiento normal del sistema inmunitario y a proteger las células frente al daño oxidativo.', alt:'Ilustración de semillas de zapallo, fuente de zinc', caption:'Ilustración Nutrición Pura' },
      { name:'Potasio', benefit:'Músculos y presión arterial', icon:'heart', photo:'img/magnesio/potasio.webp',
        text:'Contribuye al funcionamiento normal de los músculos y al mantenimiento de una presión arterial normal.', alt:'Ilustración de una palta, fuente de potasio', caption:'Ilustración Nutrición Pura' },
      { name:'Minerales traza', benefit:'Oligoelementos', icon:'sparkles', photo:'img/magnesio/minerales.webp',
        text:'Minerales que el cuerpo necesita en cantidades muy pequeñas. Revisa la etiqueta para conocer cuáles incluye y en qué cantidad.', alt:'Ilustración de cristales minerales', caption:'Ilustración Nutrición Pura' }
    ]
  }
};

function renderOrbit(root) {
  const config = ORBITS[root.dataset.orbit];
  if (!config) return;
  const total = config.items.length;
  root.innerHTML = '<div class="orbit-stage"><i class="orbit-ring outer"></i><i class="orbit-ring inner"></i>' +
    '<img class="orbit-bottle" src="' + config.bottle + '" alt="' + config.bottleAlt + '" loading="lazy">' +
    config.items.map((item, i) => {
      const angle = (-90 + i * 360 / total) * Math.PI / 180;
      return '<button class="orbit-node" style="--x:' + (50 + 42 * Math.cos(angle)).toFixed(2) + '%;--y:' + (50 + 42 * Math.sin(angle)).toFixed(2) + '%" data-index="' + i + '" aria-pressed="false" aria-label="Ver ' + escapeHtml(item.name) + '">' + icon(item.icon) + '<span>' + escapeHtml(item.name) + '</span></button>';
    }).join('') + '</div><article class="orbit-card" aria-live="polite"></article>';
  const card = root.querySelector('.orbit-card');
  const nodes = [...root.querySelectorAll('.orbit-node')];
  let current = -1;
  function show(index) {
    if (index === current) return;
    current = index;
    const item = config.items[index];
    nodes.forEach((node, i) => { node.classList.toggle('is-active', i === index); node.setAttribute('aria-pressed', String(i === index)); });
    const credit = item.file
      ? '<a href="https://commons.wikimedia.org/wiki/File:' + encodeURIComponent(item.file) + '" target="_blank" rel="noopener">Foto: ' + escapeHtml(item.author) + '</a>, <a href="' + item.licenseUrl + '" target="_blank" rel="noopener">' + item.license + '</a>'
      : '';
    card.innerHTML = '<figure><img src="' + item.photo + '" alt="' + escapeHtml(item.alt) + '"><figcaption>' + escapeHtml(item.caption) + (credit ? ' · ' + credit : '') + '</figcaption></figure>' +
      '<div class="orbit-copy"><p class="orbit-count"><b>' + (index + 1) + '</b> de ' + total + '</p><i class="orbit-icon">' + icon(item.icon) + '</i>' +
      '<p class="orbit-benefit">' + escapeHtml(item.benefit) + '</p><h3>' + escapeHtml(item.name) + '</h3><p>' + escapeHtml(item.text) + '</p></div>';
  }
  nodes.forEach((node, i) => {
    node.addEventListener('mouseenter', () => show(i));
    node.addEventListener('focus', () => show(i));
    node.addEventListener('click', () => show(i));
  });
  root.addEventListener('keydown', event => {
    if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key) || !event.target.classList.contains('orbit-node')) return;
    event.preventDefault();
    const next = (current + (event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : -1) + total) % total;
    nodes[next].focus();
  });
  show(0);
  // Precarga las fotos para que el cambio al pasar el mouse sea inmediato.
  const preload = () => config.items.forEach(item => { const img = new Image(); img.src = item.photo; });
  new IntersectionObserver((entries, observer) => {
    if (entries.some(entry => entry.isIntersecting)) { observer.disconnect(); preload(); }
  }, { rootMargin:'400px' }).observe(root);
}
document.querySelectorAll('[data-orbit]').forEach(renderOrbit);

/* Opiniones reales de la publicación de Berberina Nutre Pure en Mercado Libre,
   copiadas tal como aparecen (revisadas el 22 de noviembre de 2026). */
const ML_SUMMARY = { rating:4.4, count:110, sold:'+1.000' };
const ML_REVIEWS = [
  { stars:5, date:'jul. 2026', text:'Sabor: dulzor a frambuesa es agradable su sabor. Disolución: lo agite antes de consumirlo, me lo tomé con un poco de agua le agregué 5 gotas para probar. Lo he consumido recientemente aún no sé el resultado, espero que me haga bien 👍.' },
  { stars:5, date:'jun. 2026', text:'Efectos: lo estoy empezando a utilizar. Sabor: diluido en agua sin sabor fuerte. Buena presentación. Se ve de buena calidad.' },
  { stars:5, date:'jul. 2026', text:'Excelente mi papá notó mejoría desde el primer uso.' },
  { stars:4, date:'ago. 2026', text:'Hasta hoy, va bien tomandolo. En el segundo frasco esperando ver resultados tambien en sangre.' },
  { stars:5, date:'jun. 2026', text:'Efectos: primera vez que la tomo. Disolución: agitar antes. Rico sabor es fácil de tomar.' },
  { stars:5, date:'sep. 2026', text:'Tiene sabor a gelatina de frambuesa, es como espeso. El gotario dificulta sacar hasta la última gota. Dura muy poco. Pero creo que es buena. No pude seguir comprando porque se agotó.' },
  { stars:5, date:'may. 2026', text:'Disolución: perfecta. Efectos: energía.' },
  { stars:5, date:'jul. 2026', text:'Es bueno pero no hace milagros.' },
  { stars:5, date:'ago. 2026', text:'Buen producto lo recomiendo.' }
];
const stars = value => '<span class="stars" aria-label="' + String(value).replace('.', ',') + ' de 5 estrellas"><span style="--fill:' + (value / 5 * 100) + '%" aria-hidden="true">★★★★★</span></span>';

function renderReviews() {
  const root = byId('ml-reviews');
  if (!root) return;
  byId('ml-summary').innerHTML = '<strong>' + String(ML_SUMMARY.rating).replace('.', ',') + '</strong><div>' + stars(ML_SUMMARY.rating) +
    '<p>' + ML_SUMMARY.count + ' opiniones · ' + ML_SUMMARY.sold + ' vendidos</p></div>';
  root.innerHTML = ML_REVIEWS.map((review, i) => '<li><button class="review" data-review="' + i + '" aria-haspopup="dialog">' + stars(review.stars) +
    '<p>' + escapeHtml(review.text) + '</p><small><b>Comprador en Mercado Libre</b> · ' + review.date + '</small></button></li>').join('');
  byId('ml-all-reviews').href = MERCADO_LIBRE_LINKS.berberina;
}
renderReviews();

document.addEventListener('click', event => {
  const review = event.target.closest('[data-review]');
  if (!review) return;
  const data = ML_REVIEWS[Number(review.dataset.review)];
  byId('review-quote').innerHTML = stars(data.stars) + '<p>' + escapeHtml(data.text) + '</p>';
  byId('review-ml-link').href = MERCADO_LIBRE_LINKS.berberina;
  openDialog('review-choice');
});
byId('review-buy-here')?.addEventListener('click', () => {
  byId('review-choice').close();
  addToCart('berberina');
});
