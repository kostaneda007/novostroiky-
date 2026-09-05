const fs = require('fs');
const path = require('path');
const { parseString } = require('xml2js');

const feedsConfig = require('../src/config/feeds.json');
const API_KEY = '5c024328-1ece-4be5-8464-12af0e286a90';
const CACHE_FILE = path.join(__dirname, 'geocode-cache.json');
const OUT_FILE = path.join(__dirname, '../src/data/properties.json');

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'ru-RU,ru;q=0.9,en;q=0.8',
};

const CITY_COORDS = {
  'светлогорск': { lat: 54.9416, lng: 20.1555 },
  'пионерский': { lat: 54.9500, lng: 20.2167 },
  'отрадное': { lat: 54.9350, lng: 20.1800 },
  'калининград': { lat: 54.7104, lng: 20.4522 },
  'зеленоградск': { lat: 54.9601, lng: 20.4742 },
  'балтийск': { lat: 54.6500, lng: 19.9167 },
  'янтарный': { lat: 54.8700, lng: 20.1800 },
  'светлый': { lat: 54.6833, lng: 20.1500 },
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
  String(text)
    .replace(/<!\[CDATA\[|\]\]>/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/\s+/g, ' ')
    .trim();

const findAds = (node) => {
  if (!node || typeof node !== 'object') return [];
  if (node.Ad) return Array.isArray(node.Ad) ? node.Ad : [node.Ad];
  for (const key of Object.keys(node)) {
    const found = findAds(node[key]);
    if (found.length) return found;
  }
  return [];
};

const getImages = (ad) => {
  const raw = ad.Image ?? ad.Photo ?? ad.Images ?? [];
  const list = Array.isArray(raw) ? raw : [raw];
  return list
    .map((i) => (typeof i === 'object' ? (i?._ ?? i?.$?.url ?? '') : i))
    .filter(Boolean);
};

const parseRooms = (value) => {
  const str = String(value).toLowerCase();
  if (str.includes('студ')) return 0;
  const num = parseInt(str, 10);
  return isNaN(num) ? 0 : num;
};

const ADDR_RE = /(г\.|гор\.|пос\.|ул\.|б-р|бул\.|просп\.|пр-т|пер\.|ш\.|наб\.|мкр\.)/i;
const SKIP_KEYS = new Set(['Description', 'description', 'Title', 'title']);

function findAddress(node, depth) {
  if (!node || typeof node !== 'object' || depth > 3) return '';
  for (const key of ['Address', 'address', 'FullAddress', 'LocationAddress']) {
    const v = node[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
    if (v && typeof v === 'object' && typeof v._ === 'string' && v._.trim()) return v._.trim();
  }
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const v = node[key];
    if (typeof v === 'string' && v.length < 200 && ADDR_RE.test(v)) return v.trim();
  }
  for (const key of Object.keys(node)) {
    if (SKIP_KEYS.has(key)) continue;
    const found = findAddress(node[key], depth + 1);
    if (found) return found;
  }
  return '';
}

async function geocode(address) {
  try {
    const fullAddr = address.includes('Калининградск') ? address : 'Калининградская область, ' + address;
    const url = 'https://geocode-maps.yandex.ru/1.x/?apikey=' + API_KEY + '&format=json&geocode=' + encodeURIComponent(fullAddr);
    const res = await fetch(url);
    const json = await res.json();
    const member = json.response.GeoObjectCollection.featureMember[0];
    if (!member) return null;
    const coords = member.GeoObject.Point.coordinates;
    return { lat: Number(coords[1]), lng: Number(coords[0]) };
  } catch (e) {
    return null;
  }
}

function findCityCoords(address) {
  const lower = address.toLowerCase();
  for (const [city, coords] of Object.entries(CITY_COORDS)) {
    if (lower.includes(city)) return coords;
  }
  return null;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function parseFeed(feed) {
  console.log('Парсинг: ' + feed.name);
  console.log('   URL: ' + feed.url);
  try {
    const response = await fetch(feed.url, { headers: HEADERS, redirect: 'follow' });
    if (!response.ok) throw new Error('HTTP ' + response.status);
    const xml = await response.text();
    console.log('   Скачано: ' + xml.length + ' байт');
    const result = await new Promise((resolve, reject) =>
      parseString(xml, { explicitArray: false }, (err, res) => (err ? reject(err) : resolve(res)))
    );
    const ads = findAds(result);
    console.log('   Найдено объявлений: ' + ads.length);
    return ads.map((ad, i) => ({
      id: String(pick(ad, ['Id', 'ID', 'id'], i)),
      feedId: feed.id,
      feedName: feed.name,
      region: feed.region,
      price: parseInt(pick(ad, ['Price', 'price', 'Cost'], '0'), 10) || 0,
      title: clean(pick(ad, ['Title', 'Name', 'name'], 'Объект недвижимости')),
      description: clean(pick(ad, ['Description', 'description'])),
      address: findAddress(ad, 0) || feed.defaultAddress || feed.region,
      lat: 0,
      lng: 0,
      rooms: parseRooms(pick(ad, ['Rooms', 'Room', 'RoomsCount'], '0')),
      area: parseFloat(pick(ad, ['Area', 'Square', 'SqM'], '0')) || 0,
      floor: String(pick(ad, ['Floor'], '')),
      totalFloors: String(pick(ad, ['FloorsTotal', 'TotalFloors'], '')),
      seller: clean(pick(ad, ['Company', 'Seller', 'SellerName'], feed.name)),
      phone: clean(pick(ad, ['Phone'], '')),
      images: getImages(ad),
      url: clean(pick(ad, ['Url', 'Link'], '')),
    }));
  } catch (e) {
    console.error('   Ошибка скачивания: ' + e.message);
    if (e.cause) console.error('   Причина: ' + (e.cause.message || e.cause.code || e.cause));
    return [];
  }
}

async function main() {
  const cache = fs.existsSync(CACHE_FILE) ? JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8')) : {};
  let all = [];
  for (const feed of feedsConfig.feeds.filter((f) => f.active)) {
    const props = await parseFeed(feed);
    if (props.length > 0) all = all.concat(props);
  }
  if (all.length === 0) {
    console.log('❌ Нет данных для сохранения');
    return;
  }

  const unique = Array.from(new Set(all.map((p) => p.address))).filter(Boolean);
  console.log('Уникальных адресов: ' + unique.length);

  let geocoded = 0, fallback = 0;
  for (const addr of unique) {
    if (cache[addr]) { geocoded++; continue; }
    let coords = await geocode(addr);
    if (coords) {
      cache[addr] = coords;
      geocoded++;
    } else {
      const cityCoords = findCityCoords(addr);
      cache[addr] = cityCoords || CITY_COORDS['светлогорск'];
      fallback++;
    }
    await sleep(150);
  }
  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
  console.log('   📍 Геокодировано: ' + geocoded + ', по городам: ' + fallback);

  const addrCounters = {};
  all.forEach((p) => {
    addrCounters[p.address] = (addrCounters[p.address] || 0) + 1;
    const idx = addrCounters[p.address];
    const base = cache[p.address] || CITY_COORDS['светлогорск'];
    const angle = idx * 2.399;
    const radius = 0.0004 * Math.sqrt(idx);
    p.lat = Number((base.lat + radius * Math.sin(angle)).toFixed(6));
    p.lng = Number((base.lng + radius * Math.cos(angle)).toFixed(6));
  });

  fs.writeFileSync(OUT_FILE, JSON.stringify(all, null, 2));
  console.log('💾 Сохранено: ' + all.length + ' объектов');
}

main();
