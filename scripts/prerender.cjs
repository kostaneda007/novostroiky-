const fs = require('fs');
const path = require('path');

const props = require('../src/data/properties.json');
const SITE = 'https://kostaneda007.github.io/novostroiky-';
const PUBLIC = path.join(__dirname, '..', 'public');
const PHONE = '+7 950 673-25-68';

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const fmt = (n) => new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
const roomsLabel = (p) => (p.rooms === 0 ? 'Студия' : p.rooms + '-комн.');
const slugify = (s) => s.toLowerCase().replace(/[^a-zа-яё0-9]+/gi, '-').replace(/^-+|-+$/g, '').slice(0, 80);

const CSS = ':root{color-scheme:light}*{box-sizing:border-box}body{margin:0;background:#fafaf9;color:#1c1917;font-family:Roboto,system-ui,-apple-system,"Segoe UI",sans-serif;line-height:1.55}header{background:#fff;border-bottom:1px solid #e7e5e4;position:sticky;top:0}.wrap{max-width:960px;margin:0 auto;padding:0 20px}.bar{display:flex;justify-content:space-between;align-items:center;padding:14px 0}.logo{font-family:Roboto,system-ui,sans-serif;font-size:20px;color:#1c1917;text-decoration:none}.logo b{color:#d97706}a.back{color:#57534e;text-decoration:none;font-size:14px}main{padding:28px 0 60px}h1{font-family:Roboto,system-ui,sans-serif;font-size:30px;margin:0 0 6px}h2{font-family:Roboto,system-ui,sans-serif;font-size:20px;margin:24px 0 10px}.price{font-family:Roboto,system-ui,sans-serif;font-size:34px;color:#d97706;margin:10px 0}.meta{color:#57534e;font-size:15px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:10px;margin:18px 0}.grid img{width:100%;height:180px;object-fit:contain;background:#fff;border:1px solid #e7e5e4;border-radius:10px}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:18px 0}.stat{background:#fff;border:1px solid #e7e5e4;border-radius:10px;padding:12px}.stat .l{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#78716c}.stat .v{font-size:16px;font-weight:600;margin-top:4px}.btns{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin:20px 0}.btn{display:block;text-align:center;padding:14px;border-radius:999px;font-weight:600;text-decoration:none}.btn.call{background:#f59e0b;color:#1c1917}.btn.req{border:1px solid #d97706;color:#b45309}.desc{white-space:pre-line;color:#44403c;font-size:15px}a.card{display:flex;gap:12px;padding:14px;background:#fff;border:1px solid #e7e5e4;border-radius:16px;margin-bottom:10px;text-decoration:none;color:inherit}a.card:hover{border-color:#d97706}a.card img{width:96px;height:76px;object-fit:contain;border-radius:8px;background:#fafaf9;border:1px solid #f0efee}.card .p{color:#d97706;font-weight:600}@media(max-width:640px){.btns{grid-template-columns:1fr}.stats{grid-template-columns:1fr 1fr}}';

function shell(o) {
  const ogImage = o.ogImage ? '<meta property="og:image" content="' + esc(o.ogImage) + '">' : '';
  return '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<title>' + esc(o.title) + '</title>\n<meta name="description" content="' + esc(o.description) + '">\n<link rel="canonical" href="' + o.canonical + '">\n<meta name="robots" content="index,follow,max-image-preview:large,max-snippet:-1">\n<meta property="og:site_name" content="Новостройки 39">\n<meta property="og:title" content="' + esc(o.title) + '">\n<meta property="og:description" content="' + esc(o.description) + '">\n<meta property="og:type" content="' + (o.type || 'website') + '">\n<meta property="og:url" content="' + o.canonical + '">\n<meta property="og:locale" content="ru_RU">\n' + ogImage + '\n<script type="application/ld+json">' + JSON.stringify(o.jsonld) + '</script>\n<style>' + CSS + '</style>\n\n</head>\n<body>\n<header><div class="wrap bar"><a class="back" href="' + SITE + '/">← К карте</a><a class="logo" href="' + SITE + '/">Новостройки <b>39</b></a></div></header>\n<main class="wrap">' + o.body + '\n</main>\n</body>\n</html>';
}

function propertyPage(p) {
  const url = SITE + '/property/' + p.id + '.html';
  const imgs = (p.images || []).slice(0, 8);
  const complex = p.complex || '';
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'Apartment',
    name: roomsLabel(p) + ' квартира, ' + p.address + (complex ? ' (ЖК ' + complex + ')' : ''),
    description: (p.description || '').slice(0, 500),
    url: url,
    photo: imgs,
    address: { '@type': 'PostalAddress', streetAddress: p.address, addressLocality: p.city || p.region, addressCountry: 'RU' },
    geo: { '@type': 'GeoCoordinates', latitude: p.lat, longitude: p.lng },
    numberOfRooms: p.rooms,
    floorSize: p.area ? { '@type': 'QuantitativeValue', value: p.area, unitCode: 'MTK' } : undefined,
    offers: p.price ? { '@type': 'Offer', price: p.price, priceCurrency: 'RUB', seller: { '@type': 'RealEstateAgent', name: p.seller, telephone: PHONE } } : undefined,
  };
  const body = '<h1>' + esc(roomsLabel(p)) + ' квартира · ' + esc(p.address) + (complex ? ' · ЖК «' + esc(complex) + '»' : '') + '</h1>\n<div class="meta">' + esc(p.feedName) + ' · ' + esc(p.seller) + '</div>\n<div class="price">' + (p.price ? esc(fmt(p.price)) : 'Цена по запросу') + '</div>\n' +
    (imgs.length ? '<div class="grid">' + imgs.map((u) => '<img src="' + esc(u) + '" alt="' + esc(roomsLabel(p) + ' квартира, ' + p.address) + '" loading="lazy">').join('') + '</div>' : '') +
    '<div class="stats"><div class="stat"><div class="l">Комнат</div><div class="v">' + (p.rooms === 0 ? 'Студия' : p.rooms) + '</div></div><div class="stat"><div class="l">Площадь</div><div class="v">' + (p.area ? p.area + ' м²' : '—') + '</div></div><div class="stat"><div class="l">Этаж</div><div class="v">' + (p.floor ? esc(p.floor + (p.totalFloors ? '/' + p.totalFloors : '')) : '—') + '</div></div></div>\n' +
    '<div class="btns"><a class="btn call" href="tel:' + PHONE.replace(/[^+0-9]/g, '') + '">Позвонить: ' + PHONE + '</a><a class="btn req" href="https://coastal-estate.flexbe.ru/?property_id=' + p.id + '&price=' + p.price + '&address=' + encodeURIComponent(p.address) + '">Оставить заявку на просмотр</a></div>\n' +
    (p.description ? '<h2>Описание</h2><p class="desc">' + esc(p.description) + '</p>' : '');
  const title = roomsLabel(p) + ' квартира ' + (p.area ? p.area + ' м² ' : '') + (p.price ? '— ' + fmt(p.price) + ' ' : '') + '— ' + p.address + ' | Новостройки 39';
  const description = roomsLabel(p) + ' квартира ' + (p.area ? p.area + ' м² ' : '') + 'по адресу ' + p.address + '. ' + (p.price ? 'Цена ' + fmt(p.price) + '. ' : '') + 'Новостройки 39 — новостройки Калининградской области.';
  return { file: path.join(PUBLIC, 'property', p.id + '.html'), html: shell({ title, description, canonical: url, jsonld, ogImage: imgs[0], type: 'article', body }) };
}

function addressPage(address, items) {
  const slug = slugify(address);
  const url = SITE + '/address/' + slug + '.html';
  const pos = items.map((i) => i.price).filter((x) => x > 0);
  const min = pos.length ? Math.min.apply(null, pos) : 0;
  const complex = (items.map((i) => i.complex).filter(Boolean)[0]) || '';
  const sorted = items.slice().sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  const jsonld = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: (complex ? 'ЖК «' + complex + '» — ' : 'Новостройки: ') + address,
    url: url,
    numberOfItems: items.length,
    itemListElement: sorted.slice(0, 50).map((p, i) => ({ '@type': 'ListItem', position: i + 1, url: SITE + '/property/' + p.id + '.html', name: roomsLabel(p) + (p.area ? ', ' + p.area + ' м²' : '') })),
  };
  const body = '<h1>' + (complex ? 'ЖК «' + esc(complex) + '» · ' : '') + esc(address) + '</h1>\n<div class="meta">' + items.length + ' квартир · ' + (min ? 'от ' + fmt(min) : 'цена по запросу') + '</div>\n<div style="margin-top:18px">' +
    sorted.map((p) => '<a class="card" href="' + SITE + '/property/' + p.id + '.html">' + (p.images[0] ? '<img src="' + esc(p.images[0]) + '" alt="" loading="lazy">' : '') + '<div><div class="p">' + (p.price ? esc(fmt(p.price)) : 'Цена по запросу') + '</div><div>' + roomsLabel(p) + (p.area ? ' · ' + p.area + ' м²' : '') + (p.floor ? ' · эт. ' + p.floor : '') + '</div></div></a>').join('') + '</div>';
  return { file: path.join(PUBLIC, 'address', slug + '.html'), html: shell({ title: (complex ? 'ЖК «' + complex + '» — ' : 'Новостройки, ') + address + ' — ' + items.length + ' квартир | Новостройки 39', description: (complex ? 'ЖК «' + complex + '»: ' : 'Новостройки по адресу ' + address + ': ') + items.length + ' квартир от застройщика. ' + (min ? 'Цены от ' + fmt(min) + '. ' : '') + 'Фото и цены.', canonical: url, jsonld, body }) };
}

function main() {
  fs.mkdirSync(path.join(PUBLIC, 'property'), { recursive: true });
  fs.mkdirSync(path.join(PUBLIC, 'address'), { recursive: true });
  fs.mkdirSync(path.join(PUBLIC, 'data'), { recursive: true });
  fs.copyFileSync(path.join(__dirname, '../src/data/properties.json'), path.join(PUBLIC, 'data/properties.json'));

  const urls = [SITE + '/'];
  for (const p of props) {
    const r = propertyPage(p);
    fs.writeFileSync(r.file, r.html);
    urls.push(SITE + '/property/' + p.id + '.html');
  }
  const byAddr = {};
  props.forEach((p) => { (byAddr[p.address] = byAddr[p.address] || []).push(p); });
  for (const address of Object.keys(byAddr)) {
    const r = addressPage(address, byAddr[address]);
    fs.writeFileSync(r.file, r.html);
    urls.push(SITE + '/address/' + path.basename(r.file));
  }
  fs.writeFileSync(path.join(PUBLIC, 'sitemap.xml'), '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls.map((u) => '<url><loc>' + u + '</loc></url>').join('\n') + '\n</urlset>\n');
  console.log('✅ Пререндер: ' + props.length + ' страниц квартир + ' + Object.keys(byAddr).length + ' страниц адресов + sitemap.xml');
}

main();
