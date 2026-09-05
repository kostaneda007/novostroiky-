const fs = require('fs');
const path = require('path');
const { parseString } = require('xml2js');

const feedsConfig = require('../src/config/feeds.json');
const MANUAL = require('./address-coords.json');
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

const pick = (obj, keys, fallback = '') => {
  for (const key of keys) {
    const raw = obj ? obj[key] : undefined;
    if (raw === undefined || raw === null) continue;
    const val = typeof raw === 'object' ? (raw._ !== undefined ? raw._ : '') : raw;
    if (String(val).trim() !== '') return val;
  }
  return fallback;
};

const clean = (text) =>
  String(text).replace(/<!\[CDATA\[|\]\]>/g, '').replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();

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

const getImages = (ad) => {
  const raw = ad.Image ?? ad.Photo ?? ad.Images ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list.map((i) => (typeof i === 'object' ? (i?._ ?? i?.$?.url ?? '') : i)).filter(Boolean);
};

const parseRooms = (value) => {
  const str = String(value).toLowerCase();
  if (str.includes('студ')) return 0;
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
};

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
    if (typeof v === 'string' && v.length < 200 && /(г\.|ул\.|б-р|пр-т|пер\.)/i.test(v)) return v.trim();
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

async function parseAvitoFeed(feed) {
  const response = await fetch(feed.url, { headers: HEADERS, redirect: 'follow' });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const xml = await response.text();
  const result = await new Promise((resolve, reject) =>
    parseString(xml, { explicitArray: false }, (err, res) => (err ? reject(err) : resolve(res)))
  );
  const ads = findAds(result);
  return ads.map((ad, i) => ({
    id: String(pick(ad, ['Id', 'ID', 'id'], i)),
    feedId: feed.id,
    feedName: feed.name,
    region: feed.region,
    price: parseInt(pick(ad, ['Price', 'price', 'Cost'], '0').replace(/[^0-9]/g, ''), 10) || 0,
    title: clean(pick(ad, ['Title', 'Name', 'name'], 'Объект недвижимости')),
    description: clean(pick(ad, ['Description', 'description'])),
    address: findAddress(ad, 0) || feed.defaultAddress || feed.region,
    lat: 0, lng: 0,
    rooms: parseRooms(pick(ad, ['Rooms', 'Room', 'RoomsCount'], '0')),
    area: parseFloat(pick(ad, ['Area', 'Square', 'SqM'], '0')) || 0,
    floor: String(pick(ad, ['Floor'], '')),
    totalFloors: String(pick(ad, ['FloorsTotal', 'TotalFloors'], '')),
    seller: clean(pick(ad, ['Company', 'Seller', 'SellerName'], feed.name)),
    phone: clean(pick(ad, ['Phone'], '')),
    images: getImages(ad),
    url: clean(pick(ad, ['Url', 'Link'], '')),
  }));
}

async function parseProfitbaseFeed(feed) {
  const response = await fetch(feed.url, { headers: HEADERS });
  if (!response.ok) throw new Error('HTTP ' + response.status);
  const xml = await response.text();
  const result = await new Promise((resolve, reject) =>
    parseString(xml, { explicitArray: false, explicitRoot: false }, (err, res) => (err ? reject(err) : resolve(res)))
  );
  const offers = findOffers(result);
  return offers.map((offer, i) => {
    const priceRaw = pick(offer, ['Price', 'price'], '0');
    const price = parseInt(String(priceRaw).replace(/[^0-9]/g, ''), 10) || 0;
    const lat = parseFloat(pick(offer, ['Latitude', 'latitude', 'lat'], '0')) || 0;
    const lng = parseFloat(pick(offer, ['Longitude', 'longitude', 'lng'], '0')) || 0;
    const address = clean(pick(offer, ['Address', 'address'], ''));
    const title = clean(pick(offer, ['Title', 'title', 'Name'], '')) || 'Квартира';
    return {
      id: String(pick(offer, ['Id', 'id', 'ID'], i)),
      feedId: feed.id,
      feedName: feed.name,
      region: feed.region,
      price,
      title,
      description: clean(pick(offer, ['Description', 'description'], '')),
      address: address || feed.region,
      lat, lng,
      rooms: parseRooms(pick(offer, ['Rooms', 'rooms', 'RoomsCount'], '0')),
      area: parseFloat(pick(offer, ['Area', 'area', 'Square'], '0')) || 0,
      floor: String(pick(offer, ['Floor', 'floor'], '')),
      totalFloors: String(pick(offer, ['FloorsTotal', 'floorsCount', 'TotalFloors'], '')),
      seller: clean(pick(offer, ['Company', 'Seller', 'Developer'], feed.name)),
      phone: clean(pick(offer, ['Phone', 'phone'], '')),
      images: getImages(offer),
      url: clean(pick(offer, ['Url', 'url', 'Link'], '')),
    };
  });
}

async function parseFeed(feed) {
  console.log('Парсинг: ' + feed.name + ' (' + feed.format + ')');
  console.log('   URL: ' + feed.url);
  if (feed.format === 'profitbase') {
    return await parseProfitbaseFeed(feed);
  }
  return await parseAvitoFeed(feed);
}

async function main() {
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
  let all = [];
  for (const feed of feedsConfig.feeds.filter((f) => f.active)) {
    try {
      const props = await parseFeed(feed);
      console.log('   Найдено: ' + props.length);
      all = all.concat(props);
    } catch (e) {
      console.error('   Ошибка: ' + e.message);
    }
  }
  if (all.length === 0) return;

  // Для Avito-объектов без координат — берём из MANUAL или CITY_COORDS
  all.forEach((p, i) => {
    if (p.lat !== 0 && p.lng !== 0) return; // Profitbase уже с координатами
    const addr = p.address;
    if (MANUAL[addr]) {
      const base = MANUAL[addr];
      const idx = all.filter(x => x.address === addr).indexOf(p);
      const angle = idx * 2.399;
      const radius = 0.000035 * Math.sqrt(idx);
      p.lat = Number((base.lat + radius * Math.sin(angle)).toFixed(6));
      p.lng = Number((base.lng + radius * Math.cos(angle)).toFixed(6));
    } else {
      const cityCoords = findCityCoords(addr) || CITY_COORDS['светлогорск'];
      const idx = all.filter(x => x.address === addr).indexOf(p);
      const angle = idx * 2.399;
      const radius = 0.000035 * Math.sqrt(idx);
      p.lat = Number((cityCoords.lat + radius * Math.sin(angle)).toFixed(6));
      p.lng = Number((cityCoords.lng + radius * Math.cos(angle)).toFixed(6));
    }
  });

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  fs.writeFileSync(OUT_FILE, JSON.stringify(all, null, 2));
  console.log('💾 Сохранено: ' + all.length + ' объектов');
}

main();
