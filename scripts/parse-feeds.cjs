const fs = require('fs');
const path = require('path');
const { parseString } = require('xml2js');
const feedsConfig = require('../src/config/feeds.json');
const MANUAL = require('./address-coords.json');

const CACHE_FILE = path.join(__dirname, 'geocode-cache.json');
const OUT_FILE = path.join(__dirname, '../src/data/properties.json');
const CITY_COORDS = {
  'светлогорск': { lat: 54.9416, lng: 20.1555 },
  'калининград': { lat: 54.7104, lng: 20.4522 },
  'пионерский': { lat: 54.9500, lng: 20.2167 },
  'отрадное': { lat: 54.9434, lng: 20.1209 },
  'зеленоградск': { lat: 54.9601, lng: 20.4742 },
  'прибрежное': { lat: 54.7247, lng: 20.4324 },
  'гурьевск': { lat: 54.7733, lng: 20.6100 },
};

const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function fetchWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept': '*/*' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return await r.text();
    } catch (e) {
      if (i === tries - 1) throw e;
      await sleep(1000 * (i + 1));
    }
  }
}

// Универсальное извлечение чисел из вложенных тегов <price><value>123</value></price>
function getNum(node, keys) {
  if (!node || typeof node !== 'object') return 0;
  for (const k of keys) {
    if (node[k] !== undefined) {
      let v = node[k];
      if (v && typeof v === 'object') {
        if (v.value !== undefined) v = v.value;
        else if (v['final-price'] !== undefined) v = v['final-price'];
        else if (v._ !== undefined) v = v._;
      }
      const str = String(v).replace(/[^\d.]/g, '');
      const num = parseFloat(str);
      if (!isNaN(num) && num > 0) return num;
    }
  }
  return 0;
}

function deep(node, keys, def) {
  if (!node) return def;
  for (const k of keys) if (node[k] !== undefined) return node[k];
  return def;
}
const digits = (v) => String(v == null ? '' : v).replace(/[^\d]/g, '');
const parseArea = (v) => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? 0 : n; };
const parseRooms = (v) => { const s = String(v || ''); if (/студ/i.test(s)) return 0; const m = s.match(/\d/); return m ? +m[0] : 0; };
const clean = (v) => String(v == null ? '' : v).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function getImages(node) {
  const out = [];
  const isUrl = (v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim());
  const walk = (n, d) => {
    if (!n || typeof n !== 'object' || d > 5) return;
    if (Array.isArray(n)) { n.forEach(x => walk(x, d)); return; }
    if (n.$) for (const ak of Object.keys(n.$)) { const v = n.$[ak]; if (isUrl(v)) out.push(String(v).trim()); }
    if (typeof n._ === 'string' && isUrl(n._)) out.push(n._.trim());
    for (const k of Object.keys(n)) {
      if (k === '$' || k === '_') continue;
      const v = n[k];
      if (typeof v === 'string' && isUrl(v)) out.push(v.trim());
      else if (v && typeof v === 'object') walk(v, d + 1);
    }
  };
  walk(node, 0);
  return Array.from(new Set(out)).filter(u => /\.(jpe?g|png|webp|svg)/i.test(u) || /img|image|photo|upload|plan/i.test(u)).slice(0, 12);
}

function findAds(node) {
  if (!node || typeof node !== 'object') return [];
  if (node.Ad) return Array.isArray(node.Ad) ? node.Ad : [node.Ad];
  for (const k of Object.keys(node)) { const f = findAds(node[k]); if (f.length) return f; }
  return [];
}
function findOffers(node) {
  if (!node || typeof node !== 'object') return [];
  if (node.Offer) return Array.isArray(node.Offer) ? node.Offer : [node.Offer];
  if (node.offer) return Array.isArray(node.offer) ? node.offer : [node.offer];
  for (const k of Object.keys(node)) { const f = findOffers(node[k]); if (f.length) return f; }
  return [];
}

function detectCity(address, lat, lng) {
  const lower = String(address || '').toLowerCase();
  for (const c of Object.keys(CITY_COORDS)) if (lower.includes(c)) return c[0].toUpperCase() + c.slice(1);
  return 'Светлогорск';
}

function extractComplex(text) {
  const t = String(text || '');
  const patterns = [
    /(?:ЖК|Жилой комплекс|ГК)[\s«"']*([^«»"'\n]{2,40})[»"']?/i,
    /«([^»]{2,40})»/,
  ];
  for (const re of patterns) { const m = t.match(re); if (m) return m[1].trim(); }
  return '';
}

function hashStr(s) { let h = 5381; s = String(s); for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) | 0; return (h >>> 0).toString(36); }
function mapAvito(ad, feed, i) {
  const addr = deep(ad, ['Address', 'address'], {});
  const street = deep(addr, ['Street', 'street'], '') || deep(ad, ['street', 'Street'], '');
  const locality = deep(addr, ['Locality', 'locality'], '') || deep(ad, ['locality', 'Locality'], '');
  const fullAddr = (locality ? locality + ', ' : '') + (street || feed.defaultAddress || feed.region);
  const price = parseInt(digits(deep(ad, ['Price', 'price', 'Cost', 'cost'], 0)), 10) || 0;
  return {
    id: feed.id + '-' + hashStr(deep(ad, ['Url', 'url', 'UniqueID', 'Id'], '') || (fullAddr + '|' + price)),
    feedId: feed.id, feedName: feed.name, region: feed.region,
    price, area: parseArea(deep(ad, ['Area', 'area', 'TotalArea'], 0)),
    rooms: parseRooms(deep(ad, ['Rooms', 'rooms', 'RoomsCount'], 0)),
    title: clean(deep(ad, ['Title', 'title', 'Type'], '')) || 'Квартира',
    description: clean(deep(ad, ['Description', 'description'], '')),
    address: fullAddr,
    lat: Number(deep(ad, ['Latitude', 'latitude', 'lat'], 0)) || 0,
    lng: Number(deep(ad, ['Longitude', 'longitude', 'lng', 'lon'], 0)) || 0,
    floor: String(deep(ad, ['Floor', 'floor'], '') || ''),
    totalFloors: String(deep(ad, ['TotalFloors', 'totalFloors'], '') || ''),
    images: getImages(ad),
  };
}

function mapOffer(offer, feed, i) {
  const loc = deep(offer, ['location', 'Location'], {});
  const street = deep(loc, ['address', 'Address', 'street'], '') || deep(offer, ['address', 'street'], '');
  const locality = deep(loc, ['locality-name', 'locality', 'city'], '') || deep(offer, ['locality', 'city'], '');
  const complex = deep(offer, ['building-name', 'complex', 'Complex'], '');
  const fullAddr = (locality ? locality + ', ' : '') + (street || complex || feed.region);
  return {
    id: feed.id + '-' + hashStr(deep(offer, ['url', 'Url', 'internal-id', 'id'], '') || (fullAddr + '|' + getNum(offer, ['discount', 'price', 'Price']) + '|' + getNum(offer, ['area', 'Area']))),
    feedId: feed.id, feedName: feed.name, region: feed.region,
    price: getNum(offer, ['discount', 'price', 'Price', 'total-price', 'cost', 'final-price', 'amount']),
    area: getNum(offer, ['area', 'Area', 'total-area', 'totalArea', 'living-space', 'kitchen-space']),
    rooms: parseRooms(deep(offer, ['rooms', 'Rooms', 'roomsCount'], '')),
    title: clean(deep(offer, ['type', 'Type', 'category'], '')) || (complex ? 'Квартира в ЖК ' + complex : 'Квартира'),
    description: clean(deep(offer, ['description', 'Description'], '')),
    address: fullAddr,
    lat: Number(deep(loc, ['latitude', 'lat'], 0)) || Number(deep(offer, ['latitude'], 0)) || 0,
    lng: Number(deep(loc, ['longitude', 'lng', 'lon'], 0)) || Number(deep(offer, ['longitude'], 0)) || 0,
    floor: String(deep(offer, ['floor', 'Floor'], '') || ''),
    totalFloors: String(deep(offer, ['floors-total', 'totalFloors'], '') || ''),
    images: getImages(offer),
  };
}

async function parseFeed(feed) {
  console.log('Парсинг: ' + feed.name + ' (' + feed.format + ')');
  const xml = await fetchWithRetry(feed.url);
  console.log('   Скачано: ' + xml.length + ' байт');
  return new Promise((resolve, reject) => {
    parseString(xml, { explicitArray: false, mergeAttrs: false }, (e, res) => {
      if (e) return reject(e);
      try {
        if (feed.format === 'avito') resolve(findAds(res).map((a, i) => mapAvito(a, feed, i)));
        else resolve(findOffers(res).map((o, i) => mapOffer(o, feed, i)));
      } catch (err) { reject(err); }
    });
  });
}

async function main() {
  let cache = {};
  if (fs.existsSync(CACHE_FILE)) { try { cache = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')); } catch (e) {} }

  // Предыдущие данные для fallback
  let prevProps = [];
  if (fs.existsSync(OUT_FILE)) { try { prevProps = JSON.parse(fs.readFileSync(OUT_FILE, 'utf8')); if (!Array.isArray(prevProps)) prevProps = []; } catch (e) {} }
  const prevByFeed = {};
  prevProps.forEach(p => { if (!prevByFeed[p.feedId]) prevByFeed[p.feedId] = []; prevByFeed[p.feedId].push(p); });

  const all = [];
  for (const feed of feedsConfig.feeds.filter(f => f.active)) {
    try {
      const props = await parseFeed(feed);
      console.log('   Найдено: ' + props.length);
      if (props.length > 0) {
        const ex = props[0];
        console.log('   Пример: цена=' + ex.price + ' площ=' + ex.area + ' адрес=' + ex.address + ' lat=' + ex.lat);
        all.push(...props);
      } else if (prevByFeed[feed.id]) {
        console.log('   ♻️ Фид пустой — восстановлено ' + prevByFeed[feed.id].length + ' из кэша');
        all.push(...prevByFeed[feed.id]);
      }
    } catch (e) {
      console.error('   ❌ Ошибка: ' + e.message);
      if (prevByFeed[feed.id]) {
        console.log('   ♻️ Восстановлено ' + prevByFeed[feed.id].length + ' объектов из кэша');
        all.push(...prevByFeed[feed.id]);
      }
    }
    await sleep(200);
  }

  // Геокодинг и расстановка координат
  all.forEach(p => {
    if (p.lat !== 0 && p.lng !== 0) return;
    const base = MANUAL[p.address] || CITY_COORDS[(p.city || '').toLowerCase()] || CITY_COORDS['светлогорск'];
    const sameAddr = all.filter(x => x.address === p.address);
    const idx = sameAddr.indexOf(p);
    const angle = idx * 2.399;
    const radius = 0.000035 * Math.sqrt(idx);
    p.lat = Number((base.lat + radius * Math.sin(angle)).toFixed(6));
    p.lng = Number((base.lng + radius * Math.cos(angle)).toFixed(6));
  });
  all.forEach(p => { p.city = detectCity(p.address, p.lat, p.lng); });
  all.forEach(p => { p.complex = extractComplex((p.description || '') + ' ' + (p.title || '')); });

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  fs.writeFileSync(OUT_FILE, JSON.stringify(all, null, 2));

  // Статистика по фидам
  console.log('\n📊 Итоговая статистика:');
  const feeds = ['ksi-svetlogorsk', 'k8-profitbase', 'ksk39'];
  feeds.forEach(f => {
    const x = all.filter(p => p.feedId === f);
    const wp = x.filter(p => p.price > 0).length;
    const wa = x.filter(p => p.area > 0).length;
    console.log('   ' + f + ': ' + x.length + ' объектов (' + wp + ' с ценой, ' + wa + ' с площадью)');
  });
  console.log('💾 Всего сохранено: ' + all.length + ' объектов');
}

main().catch(e => { console.error('FATAL:', e); process.exit(1); });
