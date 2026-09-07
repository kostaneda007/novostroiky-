const fs = require('fs');
const path = require('path');
const { parseString } = require('xml2js');


const feedsConfig = require('../src/config/feeds.json');

} и нужно достать X
  for (const k of Object.keys(v)) {
    if (typeof v[k] === 'object' && v[k] !== null) {
      const inner = unwrap(v[k]);
      if (inner !== '') return inner;
    }
  }
  return '';
}
  return v == null ? '' : v;
}
const MANUAL = require('./address-coords.json');

const PREV_PROPS = (() => {
  try {
    if (fs.existsSync(OUT_FILE)) return JSON.parse(fs.readFileSync(OUT_FILE, 'utf8'));
  } catch (e) {}
  return [];
})();

const CACHE_FILE = path.join(__dirname, 'geocode-cache.json');
const OUT_FILE = path.join(__dirname, '../src/data/properties.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
};

const CITY_COORDS = {
  'светлогорск': { lat: 54.9416, lng: 20.1555 },
  'пионерский': { lat: 54.9500, lng: 20.2167 },
  'отрадное': { lat: 54.9350, lng: 20.1800 },
  'калининград': { lat: 54.7104, lng: 20.4522 },
  'зеленоградск': { lat: 54.9601, lng: 20.4742 },
};

const rich = (text) =>
  String(text)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p[^>]*>/gi, '\n\n')
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'")
    .split('\n')
    .map((l) => l.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const clean = (text) =>
  String(text).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

const parseRooms = (value) => {
  const str = String(value).toLowerCase();
  if (str.includes('студ')) return 0;
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
};

function deep(node, keys, depth) {
  if (!node || typeof node !== 'object' || depth > 4) return '';
  for (const k of keys) {
    const v = node[k];
    if (v === undefined || v === null) continue;
    if (typeof v === 'object') {
      if (v._ !== undefined && String(v._).trim()) return String(v._).trim();
    } else if (String(v).trim()) {
      return String(v).trim();
    }
  }
  for (const k of Object.keys(node)) {
    const v = node[k];
    if (v && typeof v === 'object') {
      const found = deep(v, keys, depth + 1);
      if (found) return found;
    }
  }
  return '';
}

function getImages(node) {
  const out = [];
  const isUrl = (v) => typeof v === 'string' && /^https?:\/\/\S+$/i.test(v.trim());
  const isImgKey = (k) => /image|photo|picture|фото|галере|gallery/i.test(String(k));
  const collectAll = (n, d) => {
    if (d > 3 || !n || typeof n !== 'object') return;
    if (Array.isArray(n)) { n.forEach((x) => collectAll(x, d)); return; }
    if (typeof n._ === 'string' && isUrl(n._)) out.push(n._.trim());
    if (n.$) for (const ak of Object.keys(n.$)) { if (isUrl(n.$[ak])) out.push(String(n.$[ak]).trim()); }
    for (const k of Object.keys(n)) {
      if (k === '$' || k === '_') continue;
      const v = n[k];
      if (typeof v === 'string') { if (isUrl(v)) out.push(v.trim()); }
      else if (v && typeof v === 'object') collectAll(v, d + 1);
    }
  };
  const walk = (n, d) => {
    if (!n || typeof n !== 'object' || d > 5) return;
    if (Array.isArray(n)) { n.forEach((x) => walk(x, d)); return; }
    for (const k of Object.keys(n)) {
      const v = n[k];
      if (isImgKey(k)) collectAll(v, 0);
      else if (v && typeof v === 'object') walk(v, d + 1);
    }
  };
  walk(node, 0);
  return Array.from(new Set(out)).slice(0, 12);
}
function findAddress(node, depth) {
  if (!node || typeof node !== 'object' || depth > 3) return '';
  for (const key of ['Address', 'address', 'FullAddress', 'LocationAddress']) {
    const v = node[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object' && typeof v._ === 'string' && v._.trim()) return v._.trim();
  }
  for (const key of Object.keys(node)) {
    if (['Description', 'description', 'Title', 'title'].includes(key)) continue;
    const v = node[key];
    if (typeof v === 'string' && v.length < 200 && /(г\.|ул\.|б-р|пр-т|пер\.|бул\.)/i.test(v)) return v.trim();
  }
  for (const key of Object.keys(node)) {
    if (['Description', 'description', 'Title', 'title'].includes(key)) continue;
    const found = findAddress(node[key], depth + 1);
    if (found) return found;
  }
  return '';
}

function findCityCoords(address) {
  const lower = address.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return null;
}

function parseArea(v) {
  if (!v) return 0;
  const s = String(v).replace(/,/g, '.');
  const m = s.match(/([0-9]+(?:\.[0-9]+)?)/);
  return m ? parseFloat(m[1]) : 0;
}

const CITY_CENTERS = {
  'Калининград': { lat: 54.7104, lng: 20.4522 },
  'Светлогорск': { lat: 54.9416, lng: 20.1555 },
  'Пионерский': { lat: 54.9500, lng: 20.2167 },
  'Отрадное': { lat: 54.9434, lng: 20.1209 },
  'Зеленоградск': { lat: 54.9601, lng: 20.4742 },
  'Прибрежное': { lat: 54.7247, lng: 20.4324 },
};

function extractComplex(text) {
  const t = String(text || '');
  const Q = '[«"\']';
  const QE = '[»"\']';
  const patterns = [
    new RegExp('(?:ЖК|Жилой комплекс|Жилой квартал|Гостиничный комплекс|ГК|Апарт-отель|комплекс)\\s*' + Q + '([^«»"\'\n]{2,50})' + QE),
    new RegExp('комплекс(?:а)?\\s+бизнес-класса\\s+' + Q + '([^«»"\'\n]{2,50})' + QE),
    new RegExp(Q + '([^«»"\'\n]{2,40})' + QE + '\\s*[-—]\\s*(?:это\\s+)?(?:элитный\\s+)?(?:гостиничный\\s+)?(?:жилой\\s+)?комплекс'),
    new RegExp('дом\\s+' + Q + '([^«»"\'\n]{2,50})' + QE, 'i'),
    new RegExp('ЖК\\s+([А-ЯA-ZЁ][А-ЯA-ZЁа-яa-z0-9\\-]{2,25})'),
  ];
  for (const re of patterns) {
    const m = t.match(re);
    if (m) return m[1].replace(/\s+/g, ' ').trim();
  }
  return '';
}

const COAST = [[54.65,19.92],[54.70,19.98],[54.78,20.00],[54.85,20.00],[54.87,20.03],[54.90,20.10],[54.93,20.12],[54.94,20.15],[54.95,20.23],[54.96,20.35],[54.96,20.47],[54.97,20.60]];
function seaDistance(lat, lng) {
  let best = Infinity;
  for (const [clat, clng] of COAST) {
    const dLat = (clat - lat) * Math.PI / 180;
    const dLng = (clng - lng) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat * Math.PI / 180) * Math.cos(clat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    const d = 6371000 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    if (d < best) best = d;
  }
  return Math.round(best / 50) * 50;
}

function detectCity(address, lat, lng) {
  const lower = String(address || '').toLowerCase();
  for (const c of Object.keys(CITY_CENTERS)) {
    if (lower.includes(c.toLowerCase())) return c;
  }
  if (lat && lng) {
    let best = null;
    let bestD = 0.12;
    for (const [c, cc] of Object.entries(CITY_CENTERS)) {
      const d = Math.sqrt((cc.lat - lat) * (cc.lat - lat) + (cc.lng - lng) * (cc.lng - lng));
      if (d < bestD) { bestD = d; best = c; }
    }
    if (best) return best;
  }
  return 'Другое';
}

const digits = (s) => String(s).replace(/[^0-9]/g, '');

function unwrap(v) {
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.value != null) return v.value;
    if (v.Value != null) return v.Value;
    if (v._ != null) return v._;
    if (v['#text'] != null) return v['#text'];
    // Рекурсивно ищем value в первом свойстве
    const keys = Object.keys(v);
    if (keys.length === 1 && typeof v[keys[0]] === 'object') {
      return unwrap(v[keys[0]]);
    }
    return '';
  }
  return String(v);
}

function mapOffer(offer, feed, i) {
  const addr = offer && offer.Address ? offer.Address : offer;
  const locality = deep(addr, ['locality', 'Locality', 'city', 'City'], 0) || deep(offer, ['locality', 'Locality'], 0);
  const street = deep(addr, ['street', 'Street'], 0) || deep(offer, ['address', 'Address', 'street', 'Street'], 0);
  const complex = deep(offer, ['complex', 'Complex', 'building-name', 'BuildingName'], 0);
  const rawAddr = (street ? street : '') || (locality ? locality : '') || (complex ? complex : '');
  const fullAddr = locality && street && street.indexOf(locality) === -1
    ? locality + ', ' + street
    : (rawAddr || feed.defaultAddress || feed.region);
  const coordLat = Number(deep(addr, ['latitude', 'Latitude', 'lat'], 0)) || Number(deep(offer, ['latitude', 'Latitude', 'lat'], 0)) || 0;
  const coordLng = Number(deep(addr, ['longitude', 'Longitude', 'lng', 'lon'], 0)) || Number(deep(offer, ['longitude', 'Longitude', 'lng', 'lon'], 0)) || 0;
  const rawId = deep(offer, ['id', 'Id', 'ID', 'object-id', 'OfferId'], 0);
  const id = rawId || (feed.id + '-' + i + '-' + rawAddr.slice(0, 30));
  return {
    id: String(id),
    feedId: feed.id,
    feedName: feed.name,
    region: feed.region,
    price: parseInt(digits(unwrap(deep(offer, ['price', 'Price', 'total-price', 'cost', 'Cost', 'final-price', 'finalPrice', 'discount-price', 'discount', 'amount', 'Amount'], 0))), 10) || 0,
    title: clean(deep(offer, ['title', 'Title', 'name', 'Name', 'type', 'Type'], 0)) || (complex ? 'Квартира в ЖК ' + complex : 'Квартира'),
    description: rich(deep(offer, ['description', 'Description'], 0)),
    address: fullAddr,
    lat: coordLat,
    lng: coordLng,
    rooms: parseRooms(deep(offer, ['rooms', 'Rooms', 'roomsCount'], 0)),
    area: parseArea(unwrap(deep(offer, ['area', 'Area', 'total-area', 'totalArea', 'square', 'TotalArea', 'space', 'Space', 'living-space'], 0))),
    floor: String(deep(offer, ['floor', 'Floor'], 0)),
    totalFloors: String(deep(offer, ['floors-total', 'floorsTotal', 'total-floors', 'TotalFloors'], 0)),
    seller: clean(deep(offer, ['company', 'Company', 'seller', 'Seller', 'developer', 'Developer'], 0)) || feed.name,
    phone: clean(deep(offer, ['phone', 'Phone'], 0)),
    images: getImages(offer),
    url: clean(deep(offer, ['url', 'Url', 'link', 'Link'], 0)),
  };
}

function mapAvito(ad, feed, i) {
  return {
    id: String(deep(ad, ['Id', 'ID', 'id'], 0) || i),
    feedId: feed.id,
    feedName: feed.name,
    region: feed.region,
    price: parseInt(digits(deep(ad, ['Price', 'price', 'Cost'], 0)), 10) || 0,
    title: clean(deep(ad, ['Title', 'Name', 'name'], 0)) || 'Объект недвижимости',
    description: rich(deep(ad, ['Description', 'description'], 0)),
    address: findAddress(ad, 0) || feed.defaultAddress || feed.region,
    lat: 0,
    lng: 0,
    rooms: parseRooms(deep(ad, ['Rooms', 'Room', 'RoomsCount'], 0)),
    area: parseFloat(deep(ad, ['Area', 'Square', 'SqM'], 0)) || 0,
    floor: String(deep(ad, ['Floor'], 0)),
    totalFloors: String(deep(ad, ['FloorsTotal', 'TotalFloors'], 0)),
    seller: clean(deep(ad, ['Company', 'Seller', 'SellerName'], 0)) || feed.name,
    phone: clean(deep(ad, ['Phone'], 0)),
    images: getImages(ad),
    url: clean(deep(ad, ['Url', 'Link'], 0)),
  };
}

const findAds = (node) => {
  if (!node || typeof node !== 'object') return [];
  if (node.Ad) return Array.isArray(node.Ad) ? node.Ad : [node.Ad];
  for (const key of Object.keys(node)) {
    const found = findAds(node[key]);
    if (found.length) return found;
  }
  return [];
};

const findOffers = (node) => {
  if (!node || typeof node !== 'object') return [];
  if (node.Offer) return Array.isArray(node.Offer) ? node.Offer : [node.Offer];
  if (node.offer) return Array.isArray(node.offer) ? node.offer : [node.offer];
  for (const key of Object.keys(node)) {
    const found = findOffers(node[key]);
    if (found.length) return found;
  }
  return [];
};


async function fetchWithRetry(url, opts, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const r = await fetch(url, opts);
      if (r.ok) return r;
      console.log('   ⚠️ HTTP ' + r.status + ', попытка ' + (i+1) + '/' + retries);
    } catch (e) {
      console.log('   ⚠️ ' + e.message + ', попытка ' + (i+1) + '/' + retries);
    }
    if (i < retries - 1) await new Promise(r => setTimeout(r, 2000 * (i + 1)));
  }
  throw new Error('fetch failed after ' + retries + ' attempts');
}
async function parseFeed(feed) {
  console.log('Парсинг: ' + feed.name + ' (' + feed.format + ')');
  const response = await fetchWithRetry(feed.url, { headers: HEADERS, redirect: 'follow' });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const xml = await response.text();
  const result = await new Promise((resolve, reject) =>
    parseString(xml, { explicitArray: false }, (err, res) => (err ? reject(err) : resolve(res)))
  );
  if (feed.format === 'profitbase' || feed.format === 'yandex') {
    const offers = findOffers(result);
    if (offers.length) return offers.map((o, i) => mapOffer(o, feed, i));
  }
  return findAds(result).map((a, i) => mapAvito(a, feed, i));
}

async function main() {
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
  let all = [];
  for (const feed of feedsConfig.feeds.filter((f) => f.active)) {
    try {
      const props = await parseFeed(feed);
      console.log('   Найдено: ' + props.length);
      if (props[0]) {
        console.log('   Пример: цена=' + props[0].price + ' площ=' + props[0].area + ' адрес=' + props[0].address + ' lat=' + props[0].lat);
      }
      all = all.concat(props);
    } catch (e) {
      console.error('   Ошибка: ' + e.message);
    }
  }
  if (all.length === 0) return;

  all.forEach((p) => {
    if (p.lat !== 0 && p.lng !== 0) return;
    const base = MANUAL[p.address] || findCityCoords(p.address) || CITY_COORDS['светлогорск'];
    const idx = all.filter((x) => x.address === p.address).indexOf(p);
    const angle = idx * 2.399;
    const radius = 0.000035 * Math.sqrt(idx);
    p.lat = Number((base.lat + radius * Math.sin(angle)).toFixed(6));
    p.lng = Number((base.lng + radius * Math.cos(angle)).toFixed(6));
  });

  all.forEach((p) => { p.complex = extractComplex(p.description + ' ' + p.title); });

  all.forEach((p) => { p.city = detectCity(p.address, p.lat, p.lng); });
const complexCity = {};
all.forEach((p) => { if (p.complex && p.city) complexCity[p.complex] = p.city; });

  all.forEach((p) => { if (p.lat && p.lng) p.sea = seaDistance(p.lat, p.lng); });

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  
  // Fallback: если фид упал, берём его старые объекты из кэша
  if (PREV_PROPS && PREV_PROPS.length > 0) {
    const newFeeds = new Set(all.map(p => p.feedId));
    const oldFeeds = new Set(PREV_PROPS.map(p => p.feedId));
    const lostFeeds = Array.from(oldFeeds).filter(f => !newFeeds.has(f));
    if (lostFeeds.length > 0) {
      const restored = PREV_PROPS.filter(p => lostFeeds.includes(p.feedId));
      console.log('   ♻️ Восстановлено ' + restored.length + ' объектов из кэша (упали фиды: ' + lostFeeds.join(', ') + ')');
      all = all.concat(restored);
    }
  }

  const result = { lastUpdated: new Date().toISOString(), total: all.length, feeds: {}, properties: all };
  for (const p of all) {
    if (!result.feeds[p.feedId]) result.feeds[p.feedId] = { name: p.feedName, count: 0, withPrice: 0 };
    result.feeds[p.feedId].count++;
    if (p.price > 0) result.feeds[p.feedId].withPrice++;
  }
  fs.writeFileSync(OUT_FILE, JSON.stringify(result, null, 2));
fs.writeFileSync(path.join(__dirname, '../src/data/complex-cities.json'), JSON.stringify(complexCity, null, 2));
  console.log('Сохранено: ' + all.length + ' объектов');
}

main();
