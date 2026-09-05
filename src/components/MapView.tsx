import { useEffect, useMemo, useState } from 'react';
import { YMaps, Map as YMap, Placemark } from '@pbe/react-yandex-maps';
import properties from '../data/properties.json';

type Property = {
  id: string; price: number; title: string; description: string; address: string; city: string; complex: string;
  lat: number; lng: number; rooms: number; area: number; floor: string; totalFloors: string;
  feedName: string; images: string[]; phone: string; url: string; seller: string; sea?: number;
};

type Group = { address: string; items: Property[]; lat: number; lng: number; minPrice: number; feedName: string; complex: string };
type Filters = { rooms: number[]; city: string | null; complex: string | null; feed: string | null; priceMin: string; priceMax: string };

const EMPTY_FILTERS: Filters = { rooms: [], city: null, complex: null, feed: null, priceMin: '', priceMax: '' };
const ROOM_OPTIONS = [0, 1, 2, 3, 4];
const roomLabel = (r: number) => (r === 0 ? 'Студия' : r === 4 ? '4+' : String(r));
const seaLabel = (m: number) => (m < 1000 ? m + ' м' : (m / 1000).toFixed(1).replace('.', ',') + ' км');
const PHONE = '+7 950 673-25-68';

const formatPrice = (price: number) => new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
const formatMln = (price: number) => (price / 1000000).toFixed(1).replace('.', ',') + ' млн';
const priceSuffix = (min: number) => (min > 0 ? 'от ' + formatMln(min) : 'цена по запросу');
const flexbeUrl = (p: Property) => 'https://coastal-estate.flexbe.ru/?property_id=' + p.id + '&price=' + p.price + '&address=' + encodeURIComponent(p.address);

const FAV_KEY = 'novostroiky39_favs';
function getFavs(): string[] { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } }
function toggleFav(id: string) { const f = getFavs(); const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); localStorage.setItem(FAV_KEY, JSON.stringify(f)); window.dispatchEvent(new Event('favs-changed')); }
function useFavs(): string[] {
  const [favs, setFavs] = useState<string[]>(getFavs());
  useEffect(() => { const on = () => setFavs(getFavs()); window.addEventListener('favs-changed', on); window.addEventListener('storage', on); return () => { window.removeEventListener('favs-changed', on); window.removeEventListener('storage', on); }; }, []);
  return favs;
}

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function Chevron({ dir }: { dir: 'l' | 'r' }) {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
      {dir === 'l' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}
    </svg>
  );
}

function ChatIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

function isHeadingLine(l: string) { return l.length <= 42 && /[А-ЯA-Z]{3,}/.test(l) && l === l.toUpperCase(); }
function isEmojiLine(l: string) { return /^[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2705}\u{FE0F}•✔⚠✳]/u.test(l); }

function Description({ text }: { text: string }) {
  return (
    <div>
      {text.split('\n').map((l, i) => {
        const t = l.trim();
        if (!t) return <div key={i} className="h-2" />;
        if (isHeadingLine(t)) return <h4 key={i} className="text-sm font-bold tracking-wide text-[#7A5900] mt-3 mb-1">{t}</h4>;
        return <p key={i} className={'py-0.5 text-[15px] leading-relaxed ' + (isEmojiLine(t) ? 'text-[#1E1B13]' : 'text-[#4C4639]')}>{t}</p>;
      })}
    </div>
  );
}

function PhotoSlider({ images, alt }: { images: string[]; alt: string }) {
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const good = images.filter((u) => !bad[u]);
  const [i, setI] = useState(0);
  if (!good.length) return null;
  const idx = i % good.length;
  const prev = () => setI((idx - 1 + good.length) % good.length);
  const next = () => setI((idx + 1) % good.length);
  const markBad = (u: string) => setBad((b) => (b[u] ? b : { ...b, [u]: true }));
  return (
    <div>
      <div className="relative rounded-[28px] overflow-hidden bg-[#F4EEE3] border border-[#E0D7C8]">
        <img src={good[idx]} alt={alt} onError={() => markBad(good[idx])} className="w-full h-[300px] sm:h-[440px] object-contain" />
        {good.length > 1 && (
          <>
            <button onClick={prev} aria-label="Предыдущее фото" className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[#1E1B13] hover:bg-[#FFDEA6] transition"><Chevron dir="l" /></button>
            <button onClick={next} aria-label="Следующее фото" className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[#1E1B13] hover:bg-[#FFDEA6] transition"><Chevron dir="r" /></button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1E1B13]/55 text-white text-xs font-medium">
              {idx + 1} из {good.length}
              <span className="flex gap-1">
                {good.slice(0, 4).map((_, k) => (
                  <span key={k} className={'h-1.5 rounded-full ' + (k === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50')} />
                ))}
              </span>
            </div>
          </>
        )}
      </div>
      {good.length > 1 && (
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
          {good.map((u, k) => (
            <button key={u} onClick={() => setI(k)} className={'shrink-0 rounded-xl overflow-hidden border-2 ' + (k === idx ? 'border-[#7A5900]' : 'border-transparent opacity-70 hover:opacity-100')}>
              <img src={u} alt="" onError={() => markBad(u)} className="w-20 h-14 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function complexOf(items: Property[]) {
  const c: Record<string, number> = {};
  items.forEach((p) => { if (p.complex) c[p.complex] = (c[p.complex] || 0) + 1; });
  let best = '';
  let n = 0;
  Object.entries(c).forEach(([k, v]) => { if (v > n) { n = v; best = k; } });
  return best;
}

function balloonHtml(g: Group) {
  const rows = g.items.filter((p) => p.price > 0).slice(0, 5).map((p) =>
    '<div style="margin:6px 0;border-bottom:1px solid #eee;padding-bottom:6px"><b>' +
    formatPrice(p.price) + '</b><br/><span style="color:#888">' +
    (p.rooms === 0 ? 'Студия' : p.rooms + '-комн.') + ' · ' + p.area + ' м²</span></div>'
  ).join('');
  const more = g.items.length > 5 ? '<div style="color:#7A5900;margin-top:8px">ещё ' + (g.items.length - 5) + ' объявлений</div>' : '';
  return '<div style="max-width:280px;font-family:Roboto,sans-serif"><div style="font-weight:700;font-size:16px;margin-bottom:4px">' +
    g.items.length + ' квартир · ' + priceSuffix(g.minPrice) + '</div><div style="color:#555;margin-bottom:8px">' +
    (g.complex ? '«' + g.complex + '» · ' : '') + g.address + '</div>' + rows + more + '</div>';
}

export default function MapView() {
  const hash = useHash();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const propertyId = hash.indexOf('#/property/') === 0 ? decodeURIComponent(hash.slice(11)) : null;
  const propertyPage = useMemo(
    () => (propertyId ? ((properties as Property[]).find((p) => p.id === propertyId) || null) : null),
    [propertyId]
  );

  const cities = useMemo(() => {
    const counts: Record<string, number> = {};
    (properties as Property[]).forEach((p) => { if (p.city && p.city !== 'Другое') counts[p.city] = (counts[p.city] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, []);

  const feeds = useMemo(() => Array.from(new Set((properties as Property[]).map((p) => p.feedName))), []);

  const complexes = useMemo(() => {
    const counts: Record<string, number> = {};
    (properties as Property[]).forEach((p) => { if (p.complex) counts[p.complex] = (counts[p.complex] || 0) + 1; });
    return Object.keys(counts).sort((a, b) => counts[b] - counts[a]);
  }, []);

  const filteredProps = useMemo(() => (properties as Property[]).filter((p) => {
    if (filters.rooms.length && !filters.rooms.some((r) => (r === 4 ? p.rooms >= 4 : p.rooms === r))) return false;
    if (filters.city && p.city !== filters.city) return false;
    if (filters.complex && p.complex !== filters.complex) return false;
    if (filters.feed && p.feedName !== filters.feed) return false;
    const min = parseFloat(filters.priceMin) || 0;
    const max = parseFloat(filters.priceMax) || Infinity;
    if (p.price > 0 && (p.price < min * 1e6 || p.price > max * 1e6)) return false;
    return true;
  }), [filters]);

  const groups = useMemo<Group[]>(() => {
    const grouped: Record<string, Property[]> = {};
    for (const p of filteredProps) {
      if (!grouped[p.address]) grouped[p.address] = [];
      grouped[p.address].push(p);
    }
    return Object.entries(grouped).map(([address, items]) => {
      const pos = items.map((p) => p.price).filter((x) => x > 0);
      return {
        address,
        items,
        lat: items.reduce((s, p) => s + p.lat, 0) / items.length,
        lng: items.reduce((s, p) => s + p.lng, 0) / items.length,
        minPrice: pos.length ? Math.min(...pos) : 0,
        feedName: items[0].feedName,
        complex: complexOf(items),
      };
    });
  }, [filteredProps]);

  const selectedGroup = useMemo(() => groups.find((g) => g.address === selectedAddress) || null, [groups, selectedAddress]);

  const center = useMemo(() => {
    if (groups.length === 0) return [54.7104, 20.4522] as [number, number];
    const lat = groups.reduce((s, g) => s + g.lat, 0) / groups.length;
    const lng = groups.reduce((s, g) => s + g.lng, 0) / groups.length;
    return [lat, lng] as [number, number];
  }, [groups]);

  const filteredAddresses = useMemo(() => {
    if (!query) return groups;
    const q = query.toLowerCase();
    return groups.filter((g) => g.address.toLowerCase().includes(q) || g.feedName.toLowerCase().includes(q) || (g.complex || '').toLowerCase().includes(q));
  }, [groups, query]);

  if (hash === '#/calc') return <MortgageCalculator />;
  if (hash === '#/favorites') return <FavoritesPage />;

  if (propertyPage) return <PropertyPage property={propertyPage} />;

  return (
    <YMaps query={{ apikey: 'c3af7e4b-4ca3-4229-92c7-9ad4abd70c6a', lang: 'ru_RU' }}>
      <div className="flex h-screen bg-[#FDF9F3] text-[#1E1B13]">
        <div className="flex-1 relative">
          <YMap
            defaultState={{ center, zoom: 10 }}
            options={{ suppressMapOpenBlock: true }}
            style={{ width: '100%', height: '100%' }}
          >
            {groups.map((g) => (
              <Placemark
                key={g.address}
                geometry={[g.lat, g.lng]}
                properties={{
                  iconContent: g.items.length + ' · ' + priceSuffix(g.minPrice),
                  hintContent: g.address,
                  balloonContent: balloonHtml(g),
                }}
                options={{
                  preset: selectedAddress === g.address ? 'islands#redStretchyIcon' : 'islands#blueStretchyIcon',
                  balloonMaxWidth: 320,
                }}
                onClick={() => setSelectedAddress(g.address)}
              />
            ))}
          </YMap>
          <div className="absolute top-4 left-4 bg-white rounded-3xl shadow-lg px-5 py-4">
            <h1 className="text-xl font-medium tracking-wide">Новостройки <span className="text-[#7A5900] font-bold">39</span></h1>
            <p className="text-xs text-[#4C4639] mt-1">{filteredProps.length} объектов · {groups.length} адресов</p>
            <div className="mt-2 flex gap-3"><a href="#/calc" className="text-xs font-medium text-[#7A5900] hover:underline">Калькулятор →</a><a href="#/favorites" className="text-xs font-medium text-[#7A5900] hover:underline">Избранное →</a></div>
          </div>
        </div>

        <aside className="w-[480px] bg-[#F4EEE3] border-l border-[#E0D7C8] flex flex-col">
          {selectedGroup ? (
            <AddressCards group={selectedGroup} onClose={() => setSelectedAddress(null)} />
          ) : (
            <AddressList groups={filteredAddresses} total={filteredProps.length} query={query} setQuery={setQuery} onSelect={(a) => setSelectedAddress(a)} filters={filters} setFilters={setFilters} cities={cities} complexes={complexes} feeds={feeds} filtersOpen={filtersOpen} setFiltersOpen={setFiltersOpen} />
          )}
        </aside>
      </div>
    </YMaps>
  );
}

function similarPropss(current: Property, all: Property[]): Property[] {
  const scored = all
    .filter((p) => p.id !== current.id && (p.price > 0 || current.price === 0))
    .map((p) => {
      let score = 0;
      if (p.complex && current.complex && p.complex === current.complex) score += 100;
      else if (p.city && current.city && p.city === current.city) score += 20;
      if (p.rooms === current.rooms) score += 30;
      if (p.price > 0 && current.price > 0) {
        const diff = Math.abs(p.price - current.price) / current.price;
        if (diff < 0.2) score += 25;
        else if (diff < 0.4) score += 10;
      }
      if (p.area > 0 && current.area > 0 && Math.abs(p.area - current.area) < 15) score += 10;
      return { p, score };
    })
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, 4).map((x) => x.p);
}

function PropertyPage({ property }: { property: Property }) {
  return (
    <div className="min-h-screen bg-[#FDF9F3] text-[#1E1B13]">
      <header className="sticky top-0 z-10 bg-[#FDF9F3]/95 backdrop-blur border-b border-[#E0D7C8]">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="#/" className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#ECE5D8] transition text-[#4C4639]" aria-label="К карте"><Chevron dir="l" /></a>
          <div className="text-lg font-medium">Новостройки <span className="text-[#7A5900] font-bold">39</span></div>
          <div className="w-11" />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        <PhotoSlider images={property.images} alt={property.title} />
        <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6">
          <div className="text-[#7A5900] font-bold text-3xl mb-2">{property.price > 0 ? formatPrice(property.price) : 'Цена по запросу'}</div>
          <div className="text-lg">{property.complex ? 'ЖК «' + property.complex + '» · ' : ''}{property.address}</div>
          <div className="text-sm text-[#4C4639] mt-1">{property.feedName} · {property.seller}</div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <Stat label="Комнат" value={property.rooms === 0 ? 'Студия' : String(property.rooms)} />
            <Stat label="Площадь" value={property.area > 0 ? property.area + ' м²' : '—'} />
            <Stat label="Этаж" value={property.floor ? property.floor + (property.totalFloors ? '/' + property.totalFloors : '') : '—'} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            <a href={'tel:' + PHONE.replace(/[^+0-9]/g, '')} className="py-3.5 rounded-full bg-[#7A5900] text-white font-medium text-center hover:shadow-lg transition">Позвонить: {PHONE}</a>
            <a href={flexbeUrl(property)} target="_blank" rel="noopener" className="py-3.5 rounded-full bg-[#FFDEA6] text-[#261900] font-medium text-center hover:shadow-lg transition">Оставить заявку на просмотр</a>
          </div>
        </div>
        {property.description && (
          <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6">
            <h3 className="text-sm font-medium uppercase tracking-wider text-[#4C4639] mb-3">Описание</h3>
            <Description text={property.description} />
          </div>
        )}
        <SimilarProperties current={property} />
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-[#F4EEE3] p-4">
      <div className="text-xs text-[#4C4639] uppercase tracking-wide">{label}</div>
      <div className="text-lg font-medium mt-1">{value}</div>
    </div>
  );
}

function PhoneButton() {
  const [show, setShow] = useState(false);
  return show ? (
    <a href={'tel:' + PHONE.replace(/[^+0-9]/g, '')} className="w-full h-12 px-4 rounded-full bg-[#7A5900] text-white text-sm font-medium flex items-center justify-center hover:shadow-lg transition whitespace-nowrap">{PHONE}</a>
  ) : (
    <button onClick={() => setShow(true)} className="w-full h-12 px-4 rounded-full bg-[#7A5900] text-white text-sm font-medium hover:shadow-lg transition whitespace-nowrap">Показать телефон</button>
  );
}

function PropertyCard({ p }: { p: Property }) {
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const good = p.images.filter((u) => !bad[u]);
  const [i, setI] = useState(0);
  const href = '#/property/' + encodeURIComponent(p.id);
  const blockClick = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const markBad = (u: string) => setBad((b) => (b[u] ? b : { ...b, [u]: true }));
  const idx = good.length ? i % good.length : 0;
  const niceTitle = p.title && !/продаж|аренд/i.test(p.title) ? p.title : '';
  return (
    <a href={href} target="_blank" rel="noopener" className="block rounded-[24px] bg-white border border-[#E0D7C8] shadow-sm p-3 hover:shadow-lg hover:border-[#7A5900] transition cursor-pointer">
      {good.length > 0 ? (
        <div className="relative w-full rounded-2xl overflow-hidden bg-[#F4EEE3]">
          <img src={good[idx]} alt={p.title} onError={() => markBad(good[idx])} className="w-full h-56 object-cover" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#1E1B13]/55 text-white text-xs font-medium">
            {idx + 1} из {good.length}
            <span className="flex gap-1">
              {good.slice(0, 4).map((_, k) => (
                <span key={k} className={'h-1.5 rounded-full ' + (k === idx ? 'w-4 bg-white' : 'w-1.5 bg-white/50')} />
              ))}
            </span>
          </div>
          {good.length > 1 && (
            <>
              <button onClick={(e) => { blockClick(e); setI((idx - 1 + good.length) % good.length); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"><Chevron dir="l" /></button>
              <button onClick={(e) => { blockClick(e); setI((idx + 1) % good.length); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center hover:bg-white"><Chevron dir="r" /></button>
            </>
          )}
        </div>
      ) : (
        <div className="w-full h-40 bg-[#F4EEE3] rounded-2xl flex items-center justify-center text-[#7E7669] text-sm">нет фото</div>
      )}
      <div className="px-1.5 pt-3 pb-1 space-y-2">
        <div className="flex items-start justify-between gap-2"><div className="text-2xl font-bold text-[#7A5900]">{p.price > 0 ? formatPrice(p.price) : 'Цена по запросу'}</div><FavButton id={p.id} /></div>
        <div className="text-[15px] font-medium">
          {p.rooms === 0 ? 'Студия' : p.rooms + '-комн.'} квартира · {p.area > 0 ? String(p.area).replace('.', ',') + ' м²' : ''} {p.floor ? '· ' + p.floor + (p.totalFloors ? '/' + p.totalFloors : '') + ' эт.' : ''}
        </div>
        <div className="text-sm text-[#4C4639]">{p.complex ? 'ЖК «' + p.complex + '» · ' : ''}{p.address}</div>
        {niceTitle && <div className="text-xs text-[#4C4639] truncate">{niceTitle}</div>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {p.sea != null && p.sea <= 5000 && <span className="px-3 py-1.5 rounded-lg bg-[#E0F2FE] text-[#0369A1] text-xs font-medium">🌊 {seaLabel(p.sea)} до моря</span>}
          <span className="px-3 py-1.5 rounded-lg bg-[#E6F4EA] text-[#1E7E34] text-xs font-medium">От застройщика</span>
          <span className="px-3 py-1.5 rounded-lg bg-[#FFF3E0] text-[#B26A00] text-xs font-medium">Без комиссии</span>
          {p.price > 0 && <span className="px-3 py-1.5 rounded-lg bg-[#F4EEE3] text-[#4C4639] text-xs font-medium">Ипотека доступна</span>}
        </div>
        <div className="flex gap-2 pt-2">
          <div onClick={blockClick} className="flex-1 min-w-0"><PhoneButton /></div>
          <a href={flexbeUrl(p)} target="_blank" rel="noopener" aria-label="Оставить заявку" onClick={blockClick} className="w-12 h-12 rounded-2xl bg-[#ECE5D8] flex items-center justify-center text-[#1E1B13] hover:bg-[#FFDEA6] transition"><ChatIcon /></a>
        </div>
      </div>
    </a>
  );
}

function SimilarProperties({ current }: { current: Property }) {
  const similar = useMemo(() => similarPropss(current, properties as Property[]), [current]);
  if (similar.length === 0) return null;
  return (
    <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6">
      <h3 className="text-sm font-medium uppercase tracking-wider text-[#4C4639] mb-4">Похожие предложения</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {similar.map((p) => (
          <a key={p.id} href={'#/property/' + encodeURIComponent(p.id)} target="_blank" rel="noopener" className="flex gap-3 rounded-2xl bg-[#F4EEE3] p-3 hover:shadow-md transition">
            {p.images[0] ? (
              <img onError={(e) => { e.currentTarget.style.display = 'none'; }} src={p.images[0]} alt="" className="w-24 h-24 object-cover rounded-xl shrink-0" />
            ) : (
              <div className="w-24 h-24 bg-white rounded-xl shrink-0 flex items-center justify-center text-[#7E7669] text-xs">нет фото</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[#7A5900] font-bold">{p.price > 0 ? formatPrice(p.price) : 'Цена по запросу'}</div>
              <div className="text-sm mt-0.5">{p.rooms === 0 ? 'Студия' : p.rooms + '-комн.'} · {p.area > 0 ? p.area + ' м²' : ''}</div>
              <div className="text-xs text-[#4C4639] mt-1 truncate">{p.complex ? 'ЖК «' + p.complex + '»' : p.address}</div>
              {p.complex && <div className="text-xs text-[#4C4639] truncate">{p.address}</div>}
            </div>
          </a>
        ))}
      </div>
    </div>
  );
}

function AddressCards({ group, onClose }: { group: Group; onClose: () => void }) {
  const sorted = [...group.items].sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E0D7C8]">
        <button onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#ECE5D8] transition text-[#4C4639]" aria-label="Назад"><Chevron dir="l" /></button>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{group.complex ? '«' + group.complex + '» · ' : ''}{group.address}</div>
          <div className="text-xs text-[#4C4639]">{priceSuffix(group.minPrice)} · {group.items.length} квартир</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sorted.map((p) => <PropertyCard key={p.id} p={p} />)}
      </div>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={'shrink-0 h-9 px-4 rounded-full border text-sm font-medium transition ' + (active ? 'bg-[#FFDEA6] border-[#FFDEA6] text-[#261900]' : 'bg-white border-[#E0D7C8] text-[#4C4639] hover:border-[#7A5900]')}>
      {children}
    </button>
  );
}

function AddressList({ groups, total, query, setQuery, onSelect, filters, setFilters, cities, complexes, feeds, filtersOpen, setFiltersOpen }: {
  groups: Group[]; total: number; query: string; setQuery: (v: string) => void; onSelect: (a: string) => void;
  filters: Filters; setFilters: (f: Filters) => void; cities: string[]; complexes: string[]; feeds: string[]; filtersOpen: boolean; setFiltersOpen: (b: boolean) => void;
}) {
  const sorted = [...groups].sort((a, b) => (a.minPrice || Infinity) - (b.minPrice || Infinity));
  const active = filters.rooms.length > 0 || !!filters.city || !!filters.complex || !!filters.feed || !!filters.priceMin || !!filters.priceMax;
  const toggleRoom = (r: number) => {
    const rooms = filters.rooms.includes(r) ? filters.rooms.filter((x) => x !== r) : [...filters.rooms, r];
    setFilters({ ...filters, rooms });
  };
  return (
    <>
      <div className="px-5 pt-5 pb-2">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-medium">Все адреса</h2>
            <p className="text-xs text-[#4C4639] mt-1">{total} объектов · {groups.length} адресов</p>
          </div>
          <button onClick={() => setFiltersOpen(!filtersOpen)} className="flex items-center gap-1 px-3 py-2 rounded-full bg-white border border-[#E0D7C8] text-sm text-[#4C4639] hover:border-[#7A5900] transition">
            <svg viewBox="0 0 24 24" className={'w-4 h-4 transition ' + (filtersOpen ? 'rotate-180' : '')} fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 9l6 6 6-6" /></svg>
            Фильтры
            {(filters.rooms.length || filters.city || filters.complex || filters.feed || filters.priceMin || filters.priceMax) && <span className="ml-1 w-5 h-5 rounded-full bg-[#7A5900] text-white text-xs flex items-center justify-center">{(filters.rooms.length || 0) + (filters.city ? 1 : 0) + (filters.complex ? 1 : 0) + (filters.feed ? 1 : 0) + (filters.priceMin ? 1 : 0) + (filters.priceMax ? 1 : 0)}</span>}
          </button>
        </div>
      </div>
      {filtersOpen && (
      <div className="px-4 pb-3 space-y-2">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по адресу или ЖК..." className="w-full py-3 px-5 rounded-full bg-white border border-[#E0D7C8] text-sm focus:outline-none focus:border-[#7A5900]" />
        <div className="grid grid-cols-2 gap-2">
          <select value={filters.city || ''} onChange={(e) => setFilters({ ...filters, city: e.target.value || null })} className="h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm text-[#1E1B13] focus:outline-none focus:border-[#7A5900]">
            <option value="">Все города</option>
            {cities.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filters.complex || ''} onChange={(e) => setFilters({ ...filters, complex: e.target.value || null })} className="h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm text-[#1E1B13] focus:outline-none focus:border-[#7A5900]">
            <option value="">Все ЖК</option>
            {complexes.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {ROOM_OPTIONS.map((r) => <Chip key={r} active={filters.rooms.includes(r)} onClick={() => toggleRoom(r)}>{roomLabel(r)}</Chip>)}
        </div>
        <select value={filters.feed || ''} onChange={(e) => setFilters({ ...filters, feed: e.target.value || null })} className="w-full h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm text-[#1E1B13] focus:outline-none focus:border-[#7A5900]">
          <option value="">Все застройщики</option>
          {feeds.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <div className="flex gap-2 items-center">
          <input value={filters.priceMin} onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })} type="number" placeholder="Цена от, млн" className="flex-1 min-w-0 h-10 px-4 rounded-full bg-white border border-[#E0D7C8] text-sm focus:outline-none focus:border-[#7A5900]" />
          <input value={filters.priceMax} onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })} type="number" placeholder="до, млн" className="flex-1 min-w-0 h-10 px-4 rounded-full bg-white border border-[#E0D7C8] text-sm focus:outline-none focus:border-[#7A5900]" />
          {active && <button onClick={() => setFilters(EMPTY_FILTERS)} className="shrink-0 h-10 px-4 rounded-full bg-[#7A5900] text-white text-sm font-medium">Сброс</button>}
        </div>
      </div>
      )}
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {sorted.map((g) => (
          <button key={g.address} onClick={() => onSelect(g.address)} className="w-full text-left rounded-[20px] bg-white border border-[#E0D7C8] px-4 py-3 hover:shadow-md transition">
            <div className="font-bold text-[#7A5900] truncate">{g.complex ? '«' + g.complex + '»' : g.address}</div>
            <div className="text-sm truncate mt-0.5">{g.address}</div>
            <div className="text-xs text-[#4C4639] mt-0.5">{g.items.length} кв. · {priceSuffix(g.minPrice)} · {g.feedName}</div>
          </button>
        ))}
        {sorted.length === 0 && <div className="text-center text-sm text-[#4C4639] py-10">Ничего не найдено. Измените фильтры.</div>}
      </div>
    </>
  );
}

function MortgageCalculator() {
  const [price, setPrice] = useState(6000000);
  const [down, setDown] = useState(20);
  const [years, setYears] = useState(20);
  const [rate, setRate] = useState(18);
  const principal = price * (1 - down / 100);
  const m = rate / 100 / 12;
  const n = years * 12;
  const pay = m > 0 ? (principal * m) / (1 - Math.pow(1 + m, -n)) : principal / n;
  const fmt = (x: number) => new Intl.NumberFormat('ru-RU').format(Math.round(x));
  return (
    <div className="min-h-screen bg-[#FDF9F3] text-[#1E1B13]">
      <header className="sticky top-0 z-10 bg-[#FDF9F3]/95 backdrop-blur border-b border-[#E0D7C8]">
        <div className="max-w-3xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="#/" className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#ECE5D8] transition text-[#4C4639]" aria-label="К карте"><Chevron dir="l" /></a>
          <div className="text-lg font-medium">Ипотечный <span className="text-[#7A5900] font-bold">калькулятор</span></div>
          <div className="w-11" />
        </div>
      </header>
      <main className="max-w-3xl mx-auto px-5 py-6">
        <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6 space-y-5">
          <div>
            <label className="text-sm text-[#4C4639]">Стоимость квартиры: <b>{fmt(price)} ₽</b></label>
            <input type="range" min={2000000} max={50000000} step={100000} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full" />
          </div>
          <div>
            <label className="text-sm text-[#4C4639]">Первоначальный взнос: <b>{down}% ({fmt(price * down / 100)} ₽)</b></label>
            <input type="range" min={0} max={90} step={5} value={down} onChange={(e) => setDown(Number(e.target.value))} className="w-full" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm text-[#4C4639]">Срок, лет</label>
              <input type="number" min={1} max={30} value={years} onChange={(e) => setYears(Number(e.target.value))} className="mt-1 w-full h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] focus:outline-none focus:border-[#7A5900]" />
            </div>
            <div>
              <label className="text-sm text-[#4C4639]">Ставка, %</label>
              <select value={rate} onChange={(e) => setRate(Number(e.target.value))} className="mt-1 w-full h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] focus:outline-none focus:border-[#7A5900]">
                <option value={18}>Обычная 18%</option>
                <option value={6}>Семейная 6%</option>
                <option value={6}>IT 6%</option>
                <option value={2}>Льготная 2%</option>
              </select>
            </div>
          </div>
          <div className="rounded-2xl bg-[#FFDEA6] p-5 text-center">
            <div className="text-sm text-[#261900]">Платёж в месяц</div>
            <div className="text-3xl font-bold text-[#261900]">{fmt(pay)} ₽</div>
            <div className="text-xs text-[#261900]/70 mt-1">Кредит {fmt(principal)} ₽ · переплата {fmt(pay * n - principal)} ₽</div>
          </div>
          <a href="https://coastal-estate.flexbe.ru/" target="_blank" rel="noopener" className="block w-full py-3.5 rounded-full bg-[#7A5900] text-white font-medium text-center hover:shadow-lg transition">Оставить заявку на ипотеку</a>
        </div>
      </main>
    </div>
  );
}

function FavButton({ id }: { id: string }) {
  const favs = useFavs();
  const on = favs.includes(id);
  return (
    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(id); }} aria-label="В избранное" className={'w-10 h-10 rounded-full flex items-center justify-center border transition ' + (on ? 'bg-[#7A5900] border-[#7A5900] text-white' : 'bg-white border-[#E0D7C8] text-[#7A5900] hover:border-[#7A5900]')}>
      <svg viewBox="0 0 24 24" className="w-5 h-5" fill={on ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>
    </button>
  );
}

function FavoritesPage() {
  const favs = useFavs();
  const items = useMemo(() => (properties as Property[]).filter((p) => favs.includes(p.id)), [favs]);
  return (
    <div className="min-h-screen bg-[#FDF9F3] text-[#1E1B13]">
      <header className="sticky top-0 z-10 bg-[#FDF9F3]/95 backdrop-blur border-b border-[#E0D7C8]">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="#/" className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#ECE5D8] transition text-[#4C4639]" aria-label="К карте"><Chevron dir="l" /></a>
          <div className="text-lg font-medium">Избранное <span className="text-[#7A5900] font-bold">{items.length}</span></div>
          <div className="w-11" />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-6">
        {items.length === 0 ? (
          <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-10 text-center text-[#4C4639]">
            Пока пусто. Нажимайте ❤️ на карточках, чтобы сохранить квартиры.
            <div className="mt-4"><a href="#/" className="text-[#7A5900] font-medium hover:underline">← К карте</a></div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{items.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
        )}
      </main>
    </div>
  );
}
