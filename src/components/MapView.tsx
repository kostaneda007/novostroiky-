import { useEffect, useMemo, useRef, useState } from 'react';
import { YMaps, Map as YMap, Placemark, ZoomControl } from '@pbe/react-yandex-maps';
import properties from '../data/properties.json';

type Property = { id: string; price: number; title: string; description: string; address: string; city: string; complex: string; lat: number; lng: number; rooms: number; area: number; floor: string; totalFloors: string; feedName: string; images: string[]; phone: string; url: string; seller: string; sea?: number };
type Group = { address: string; items: Property[]; lat: number; lng: number; minPrice: number; feedName: string; complex: string };
type Filters = { rooms: number[]; city: string | null; complex: string | null; feed: string | null; priceMin: string; priceMax: string };

const EMPTY_FILTERS: Filters = { rooms: [], city: null, complex: null, feed: null, priceMin: '', priceMax: '' };
const ROOM_OPTIONS = [0, 1, 2, 3, 4];
const PHONE = '+7 950 673-25-68';
const roomLabel = (r: number) => (r === 0 ? 'Студия' : r === 4 ? '4+' : String(r));
const seaLabel = (m: number) => (m < 1000 ? m + ' м' : (m / 1000).toFixed(1).replace('.', ',') + ' км');
const formatPrice = (p: number) => new Intl.NumberFormat('ru-RU').format(p) + ' ₽';
const formatMln = (p: number) => (p / 1000000).toFixed(1).replace('.', ',') + ' млн';
const priceSuffix = (m: number) => (m > 0 ? 'от ' + formatMln(m) : 'цена по запросу');
const esc = (v: unknown) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const flexbeUrl = (p: Property) => 'https://coastal-estate.flexbe.ru/?property_id=' + p.id + '&price=' + p.price + '&address=' + encodeURIComponent(p.address);

const FAV_KEY = 'novostroiky39_favs';
const CMP_KEY = 'novostroiky39_cmp';
const getStore = (k: string): string[] => { try { return JSON.parse(localStorage.getItem(k) || '[]'); } catch { return []; } };
const setStore = (k: string, v: string[]) => { localStorage.setItem(k, JSON.stringify(v)); window.dispatchEvent(new Event('store-changed')); };
const toggleStore = (k: string, id: string, max = 0) => { const f = getStore(k); const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else { if (max && f.length >= max) { alert('Можно выбрать не более ' + max + ' квартир'); return; } f.push(id); } setStore(k, f); };
function useStore(k: string): string[] {
  const [f, setF] = useState<string[]>(getStore(k));
  useEffect(() => { const on = () => setF(getStore(k)); window.addEventListener('store-changed', on); window.addEventListener('storage', on); return () => { window.removeEventListener('store-changed', on); window.removeEventListener('storage', on); }; }, [k]);
  return f;
}
function useHash() {
  const [h, setH] = useState(window.location.hash);
  useEffect(() => { const on = () => setH(window.location.hash); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return h;
}

function Chevron({ dir }: { dir: 'l' | 'r' }) { return <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{dir === 'l' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}</svg>; }
function XIcon() { return <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12" /></svg>; }
function ChatIcon() { return <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>; }
function HeartIcon({ filled }: { filled: boolean }) { return <svg viewBox="0 0 24 24" className="w-5 h-5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>; }

function Header({ hash }: { hash: string }) {
  const favs = useStore(FAV_KEY);
  const cmp = useStore(CMP_KEY);
  const [open, setOpen] = useState(false);
  const nav = [
    { h: '#/', l: 'Карта' }, { h: '#/complexes', l: 'ЖК' }, { h: '#/analytics', l: 'Аналитика' },
    { h: '#/budget', l: 'Бюджет' }, { h: '#/calc', l: 'Калькулятор' }, { h: '#/compare', l: 'Сравнить' }, { h: '#/about', l: 'О нас' },
  ];
  const act = (h: string) => (h === '#/' ? (hash === '#/' || hash === '' || hash.indexOf('#/property') === 0) : hash.indexOf(h) === 0);
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#E0D7C8]">
      <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <a href="#/" className="font-serif text-lg font-medium whitespace-nowrap">Новостройки <span className="text-[#7A5900] font-bold">39</span></a>
        <nav className="hidden md:flex items-center gap-1">
          {nav.map((n) => <a key={n.h} href={n.h} className={'px-3 py-2 rounded-full text-sm font-medium transition ' + (act(n.h) ? 'bg-[#FFDEA6] text-[#261900]' : 'text-[#4C4639] hover:bg-[#F4EEE3]')}>{n.l}{n.h === '#/favorites' ? '' : n.h === '#/compare' && cmp.length > 0 ? ' · ' + cmp.length : ''}</a>)}
          <a href="#/favorites" className={'ml-1 px-3 py-2 rounded-full text-sm font-medium flex items-center gap-1 ' + (hash.indexOf('#/favorites') === 0 ? 'bg-[#FFDEA6] text-[#261900]' : 'text-[#7A5900] hover:bg-[#F4EEE3]')}><HeartIcon filled={favs.length > 0} /> {favs.length}</a>
        </nav>
        <button className="md:hidden w-12 h-12 -mr-2 rounded-full flex items-center justify-center hover:bg-[#F4EEE3]" onClick={() => setOpen(!open)} aria-label="Меню">
          <svg viewBox="0 0 24 24" className="w-7 h-7" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
      {open && (
        <nav className="md:hidden border-t border-[#E0D7C8] bg-white px-5 py-2 flex flex-col">
          {nav.map((n) => (
            <a key={n.h} href={n.h} onClick={() => setOpen(false)} className="py-4 text-lg font-medium text-[#1E1B13] border-b border-[#F4EEE3] last:border-0 flex items-center justify-between">
              {n.l}
              {n.h === '#/compare' && cmp.length > 0 && <span className="text-base text-[#0369A1]">· {cmp.length}</span>}
            </a>
          ))}
          <a href="#/favorites" onClick={() => setOpen(false)} className="py-4 text-lg font-medium text-[#7A5900] flex items-center justify-between">Избранное<span className="text-base">· {favs.length}</span></a>
        </nav>
      )}
    </header>
  );
}

function isHeadingLine(l: string) { return l.length <= 42 && /[А-ЯA-Z]{3,}/.test(l) && l === l.toUpperCase(); }
function isEmojiLine(l: string) { return /^[\u{1F000}-\u{1FAFF}\u{2190}-\u{2BFF}\u{2705}\u{FE0F}•✔⚠✳]/u.test(l); }
function Description({ text }: { text: string }) {
  return <div>{text.split('\n').map((l, i) => { const t = l.trim(); if (!t) return <div key={i} className="h-2" />; if (isHeadingLine(t)) return <h4 key={i} className="text-sm font-bold tracking-wide text-[#7A5900] mt-3 mb-1">{t}</h4>; return <p key={i} className={'py-0.5 text-[15px] leading-relaxed ' + (isEmojiLine(t) ? 'text-[#1E1B13]' : 'text-[#4C4639]')}>{t}</p>; })}</div>;
}

function PhotoSlider({ images, alt }: { images: string[]; alt: string }) {
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const [i, setI] = useState(0);
  const good = images.filter((u) => !bad[u]);
  const markBad = (u: string) => setBad((b) => (b[u] ? b : { ...b, [u]: true }));
  if (!good.length) return null;
  const idx = i % good.length;
  return (
    <div>
      <div className="relative rounded-[28px] overflow-hidden bg-[#F4EEE3] border border-[#E0D7C8]">
        <img referrerPolicy="no-referrer" loading="lazy" src={good[idx]} alt={alt} onError={() => markBad(good[idx])} className="w-full h-[300px] sm:h-[440px] object-contain" />
        {good.length > 1 && (<>
          <button onClick={() => setI((idx - 1 + good.length) % good.length)} className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 shadow-md flex items-center justify-center hover:bg-[#FFDEA6]"><Chevron dir="l" /></button>
          <button onClick={() => setI((idx + 1) % good.length)} className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 shadow-md flex items-center justify-center hover:bg-[#FFDEA6]"><Chevron dir="r" /></button>
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-[#1E1B13]/55 text-white text-xs font-medium">{idx + 1} из {good.length}</div>
        </>)}
      </div>
      {good.length > 1 && (
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
          {good.map((u, k) => <button key={u} onClick={() => setI(k)} className={'shrink-0 rounded-xl overflow-hidden border-2 ' + (k === idx ? 'border-[#7A5900]' : 'border-transparent opacity-70')}><img referrerPolicy="no-referrer" loading="lazy" src={u} alt="" onError={() => markBad(u)} className="w-20 h-14 object-cover" /></button>)}
        </div>
      )}
    </div>
  );
}

function FavButton({ id }: { id: string }) {
  const favs = useStore(FAV_KEY); const on = favs.includes(id);
  return <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleStore(FAV_KEY, id); }} aria-label="В избранное" className={'w-10 h-10 rounded-full flex items-center justify-center border transition ' + (on ? 'bg-[#7A5900] border-[#7A5900] text-white' : 'bg-white border-[#E0D7C8] text-[#7A5900] hover:border-[#7A5900]')}><HeartIcon filled={on} /></button>;
}
function CompareButton({ id }: { id: string }) {
  const cmp = useStore(CMP_KEY); const on = cmp.includes(id);
  return <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleStore(CMP_KEY, id, 3); }} className={'h-10 px-3 rounded-full border text-xs font-medium transition ' + (on ? 'bg-[#0369A1] border-[#0369A1] text-white' : 'bg-white border-[#E0D7C8] text-[#0369A1] hover:border-[#0369A1]')}>{on ? '✓ В сравнении' : 'Сравнить'}</button>;
}
function PhoneButton() {
  const [show, setShow] = useState(false);
  return show
    ? <a href={'tel:' + PHONE.replace(/[^+0-9]/g, '')} className="w-full h-12 px-4 rounded-full bg-[#7A5900] text-white text-sm font-medium flex items-center justify-center whitespace-nowrap">{PHONE}</a>
    : <button onClick={() => setShow(true)} className="w-full h-12 px-4 rounded-full bg-[#7A5900] text-white text-sm font-medium whitespace-nowrap">Показать телефон</button>;
}

function complexOf(items: Property[]) {
  const c: Record<string, number> = {};
  items.forEach((p) => { if (p.complex) c[p.complex] = (c[p.complex] || 0) + 1; });
  let best = ''; let n = 0;
  Object.entries(c).forEach(([k, v]) => { if (v > n) { n = v; best = k; } });
  return best;
}
function balloonHtml(g: Group) {
  const rows = g.items.filter((p) => p.price > 0).slice(0, 5).map((p) => '<div style="margin:6px 0;border-bottom:1px solid #eee;padding-bottom:6px"><b>' + formatPrice(p.price) + '</b><br/><span style="color:#888">' + (p.rooms === 0 ? 'Студия' : p.rooms + '-комн.') + ' · ' + p.area + ' м²</span></div>').join('');
  return '<div style="max-width:280px;font-family:Roboto,sans-serif"><div style="font-weight:700;font-size:16px;margin-bottom:4px">' + g.items.length + ' квартир · ' + priceSuffix(g.minPrice) + '</div><div style="color:#555;margin-bottom:8px">' + esc(g.address) + '</div>' + rows + '</div>';
}

function PropertyCard({ p }: { p: Property }) {
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const [i, setI] = useState(0);
  const good = p.images.filter((u) => !bad[u]);
  const markBad = (u: string) => setBad((b) => (b[u] ? b : { ...b, [u]: true }));
  const idx = good.length ? i % good.length : 0;
  const block = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  return (
    <a href={'#/property/' + encodeURIComponent(p.id)} target="_blank" rel="noopener" className="block rounded-[24px] bg-white border border-[#E0D7C8] shadow-sm p-3 hover:shadow-lg hover:border-[#7A5900] transition">
      {good.length ? (
        <div className="relative rounded-2xl overflow-hidden bg-[#F4EEE3]">
          <img referrerPolicy="no-referrer" loading="lazy" src={good[idx]} alt={p.title} onError={() => markBad(good[idx])} className="w-full h-56 object-cover" />
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-[#1E1B13]/55 text-white text-xs font-medium">{idx + 1} из {good.length}</div>
          {good.length > 1 && (<>
            <button onClick={(e) => { block(e); setI((idx - 1 + good.length) % good.length); }} className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center"><Chevron dir="l" /></button>
            <button onClick={(e) => { block(e); setI((idx + 1) % good.length); }} className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 shadow flex items-center justify-center"><Chevron dir="r" /></button>
          </>)}
        </div>
      ) : <div className="w-full h-40 bg-[#F4EEE3] rounded-2xl flex items-center justify-center text-[#7E7669] text-sm">нет фото</div>}
      <div className="px-1.5 pt-3 pb-1 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="text-2xl font-bold text-[#7A5900]">{p.price > 0 ? formatPrice(p.price) : 'Цена по запросу'}</div>
          <div className="flex gap-1.5"><FavButton id={p.id} /><CompareButton id={p.id} /></div>
        </div>
        <div className="text-[15px] font-medium">{p.rooms === 0 ? 'Студия' : p.rooms + '-комн.'} квартира · {p.area > 0 ? String(p.area).replace('.', ',') + ' м²' : ''} {p.floor ? '· ' + p.floor + (p.totalFloors ? '/' + p.totalFloors : '') + ' эт.' : ''}</div>
        <div className="text-sm text-[#4C4639]">{p.complex ? 'ЖК «' + p.complex + '» · ' : ''}{p.address}</div>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {p.sea != null && p.sea <= 5000 && <span className="px-3 py-1.5 rounded-lg bg-[#E0F2FE] text-[#0369A1] text-xs font-medium">🌊 {seaLabel(p.sea)} до моря</span>}
          <span className="px-3 py-1.5 rounded-lg bg-[#E6F4EA] text-[#1E7E34] text-xs font-medium">От застройщика</span>
          <span className="px-3 py-1.5 rounded-lg bg-[#FFF3E0] text-[#B26A00] text-xs font-medium">Без комиссии</span>
        </div>
        <div className="flex gap-2 pt-2">
          <div onClick={block} className="flex-1 min-w-0"><PhoneButton /></div>
          <a href={flexbeUrl(p)} target="_blank" rel="noopener" onClick={block} aria-label="Заявка" className="w-12 h-12 rounded-2xl bg-[#ECE5D8] flex items-center justify-center text-[#1E1B13] hover:bg-[#FFDEA6] transition"><ChatIcon /></a>
        </div>
      </div>
    </a>
  );
}

function AddressCards({ group, onClose }: { group: Group; onClose: () => void }) {
  const sorted = [...group.items].sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E0D7C8] bg-[#F4EEE3]">
        <button onClick={onClose} className="hidden md:flex w-11 h-11 rounded-full items-center justify-center hover:bg-[#ECE5D8] text-[#4C4639]"><Chevron dir="l" /></button>
        <button onClick={onClose} className="md:hidden w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#ECE5D8] text-[#4C4639]" aria-label="Закрыть"><XIcon /></button>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{group.complex ? '«' + group.complex + '» · ' : ''}{group.address}</div>
          <div className="text-xs text-[#4C4639]">{priceSuffix(group.minPrice)} · {group.items.length} квартир</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">{sorted.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
    </>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={'shrink-0 h-9 px-4 rounded-full border text-sm font-medium transition ' + (active ? 'bg-[#FFDEA6] border-[#FFDEA6] text-[#261900]' : 'bg-white border-[#E0D7C8] text-[#4C4639] hover:border-[#7A5900]')}>{children}</button>;
}

function AddressList({ groups, total, query, setQuery, onSelect, filters, setFilters, cities, complexes, feeds, filtersOpen, setFiltersOpen }: { groups: Group[]; total: number; query: string; setQuery: (v: string) => void; onSelect: (a: string) => void; filters: Filters; setFilters: (f: Filters) => void; cities: string[]; complexes: string[]; feeds: string[]; filtersOpen: boolean; setFiltersOpen: (b: boolean) => void }) {
  const sorted = [...groups].sort((a, b) => (a.minPrice || Infinity) - (b.minPrice || Infinity));
  const active = filters.rooms.length > 0 || !!filters.city || !!filters.complex || !!filters.feed || !!filters.priceMin || !!filters.priceMax;
  const toggleRoom = (r: number) => setFilters({ ...filters, rooms: filters.rooms.includes(r) ? filters.rooms.filter((x) => x !== r) : [...filters.rooms, r] });
  return (
    <>
      <div className="px-5 pt-5 pb-2 flex items-center justify-between">
        <div><h2 className="text-xl font-medium">Все адреса</h2><p className="text-xs text-[#4C4639] mt-1">{total} объектов · {groups.length} адресов</p></div>
        <button onClick={() => setFiltersOpen(!filtersOpen)} className="flex items-center gap-1 px-3 py-2 rounded-full bg-white border border-[#E0D7C8] text-sm text-[#4C4639]">
          <svg viewBox="0 0 24 24" className={'w-4 h-4 transition ' + (filtersOpen ? 'rotate-180' : '')} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9l6 6 6-6" /></svg>Фильтры
        </button>
      </div>
      {filtersOpen && (
        <div className="px-4 pb-3 space-y-2">
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по адресу или ЖК..." className="w-full py-3 px-5 rounded-full bg-white border border-[#E0D7C8] text-sm focus:outline-none focus:border-[#7A5900]" />
          <div className="grid grid-cols-2 gap-2">
            <select value={filters.city || ''} onChange={(e) => { const c = e.target.value || null; setFilters({ ...filters, city: c, complex: null }); }} className="h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm"><option value="">Все города</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</select>
            <select value={filters.complex || ''} onChange={(e) => setFilters({ ...filters, complex: e.target.value || null })} className="h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm"><option value="">Все ЖК</option>{complexes.map((c) => <option key={c} value={c}>{c}</option>)}</select>
          </div>
          <select value={filters.feed || ''} onChange={(e) => setFilters({ ...filters, feed: e.target.value || null })} className="w-full h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm"><option value="">Все застройщики</option>{feeds.map((f) => <option key={f} value={f}>{f}</option>)}</select>
          <div className="flex gap-2 overflow-x-auto pb-1">{ROOM_OPTIONS.map((r) => <Chip key={r} active={filters.rooms.includes(r)} onClick={() => toggleRoom(r)}>{roomLabel(r)}</Chip>)}</div>
          <div className="flex gap-2 items-center">
            <input value={filters.priceMin} onChange={(e) => setFilters({ ...filters, priceMin: e.target.value })} type="number" placeholder="Цена от, млн" className="flex-1 min-w-0 h-10 px-4 rounded-full bg-white border border-[#E0D7C8] text-sm" />
            <input value={filters.priceMax} onChange={(e) => setFilters({ ...filters, priceMax: e.target.value })} type="number" placeholder="до, млн" className="flex-1 min-w-0 h-10 px-4 rounded-full bg-white border border-[#E0D7C8] text-sm" />
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

function MapScreen() {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(typeof window !== "undefined" ? window.innerWidth >= 768 : true);
  const [sheetFull, setSheetFull] = useState(false);
  const sheetTouch = useRef<number | null>(null);

  const cities = useMemo(() => { const c: Record<string, number> = {}; (properties as Property[]).forEach((p) => { if (p.city && p.city !== 'Другое') c[p.city] = (c[p.city] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a]); }, []);
  
  

  const filteredProps = useMemo(() => (properties as Property[]).filter((p) => {
    if (filters.rooms.length && !filters.rooms.some((r) => (r === 4 ? p.rooms >= 4 : p.rooms === r))) return false;
    if (filters.city && p.city !== filters.city) return false;
    if (filters.complex && p.complex !== filters.complex) return false;
    if (filters.feed && p.feedName !== filters.feed) return false;
    const min = parseFloat(filters.priceMin) || 0; const max = parseFloat(filters.priceMax) || Infinity;
    if (p.price > 0 && (p.price < min * 1e6 || p.price > max * 1e6)) return false;
    return true;
  }), [filters]);

  const groups = useMemo<Group[]>(() => {
    const g: Record<string, Property[]> = {};
    filteredProps.forEach((p) => { (g[p.address] = g[p.address] || []).push(p); });
    return Object.entries(g).map(([address, items]) => {
      const pos = items.map((p) => p.price).filter((x) => x > 0);
      return { address, items, lat: items.reduce((s, p) => s + p.lat, 0) / items.length, lng: items.reduce((s, p) => s + p.lng, 0) / items.length, minPrice: pos.length ? Math.min(...pos) : 0, feedName: items[0].feedName, complex: complexOf(items) };
    });
  }, [filteredProps]);

    const complexes = useMemo(() => {
    const c: Record<string, number> = {};
    filteredProps.forEach((pp) => { if (pp.complex) c[pp.complex] = (c[pp.complex] || 0) + 1; });
    return Object.keys(c).sort((a, b) => c[b] - c[a]);
  }, [filteredProps]);
  const feeds = useMemo(() => Array.from(new Set(filteredProps.map((pp) => pp.feedName))), [filteredProps]);
const selectedGroup = useMemo(() => groups.find((g) => g.address === selectedAddress) || null, [groups, selectedAddress]);
  const center = useMemo(() => { if (!groups.length) return [54.82, 20.45] as [number, number]; return [groups.reduce((s, g) => s + g.lat, 0) / groups.length, groups.reduce((s, g) => s + g.lng, 0) / groups.length] as [number, number]; }, [groups]);
  const filteredAddresses = useMemo(() => { if (!query) return groups; const q = query.toLowerCase(); return groups.filter((g) => g.address.toLowerCase().includes(q) || g.feedName.toLowerCase().includes(q) || (g.complex || '').toLowerCase().includes(q)); }, [groups, query]);

  return (
    <YMaps query={{ apikey: 'c3af7e4b-4ca3-4229-92c7-9ad4abd70c6a', lang: 'ru_RU' }}>
      <div className="flex flex-col md:flex-row h-full bg-[#FDF9F3] text-[#1E1B13]">
        <div className="relative h-[45dvh] shrink-0 md:h-full md:flex-1">
          <YMap defaultState={{ bounds: [[54.55, 19.95], [55.05, 20.85]], behaviors: ['drag', 'dblClickZoom', 'multiTouch'] }} options={{ suppressMapOpenBlock: true, restrictBounds: true }} style={{ width: '100%', height: '100%' }}>
            <ZoomControl />
            {groups.map((g) => (
              <Placemark key={g.address} geometry={[g.lat, g.lng]} properties={{ iconContent: g.items.length + ' · ' + priceSuffix(g.minPrice), hintContent: g.address, balloonContent: balloonHtml(g) }} options={{ preset: selectedAddress === g.address ? 'islands#redStretchyIcon' : 'islands#blueStretchyIcon', balloonMaxWidth: 320 }} onClick={() => setSelectedAddress(g.address)} />
            ))}
          </YMap>
        </div>
        <aside className={(selectedGroup ? (sheetFull ? 'fixed inset-x-0 bottom-0 top-14 z-30 rounded-t-3xl shadow-2xl md:static md:z-auto md:rounded-none md:shadow-none ' : 'fixed inset-x-0 bottom-0 z-30 rounded-t-3xl shadow-2xl md:static md:z-auto md:rounded-none md:shadow-none ') : '') + 'flex-1 min-h-0 w-full md:flex-none md:w-[480px] bg-[#F4EEE3] border-t md:border-t-0 md:border-l border-[#E0D7C8] flex flex-col'} style={selectedGroup && !sheetFull ? { top: '45dvh' } : undefined}>
          {selectedGroup && (
            <div className="md:hidden flex justify-center py-2 shrink-0 cursor-grab" onClick={() => setSheetFull((v) => !v)} onTouchStart={(e) => { sheetTouch.current = e.touches[0].clientY; }} onTouchEnd={(e) => { if (sheetTouch.current == null) return; const dy = e.changedTouches[0].clientY - sheetTouch.current; if (dy < -40) setSheetFull(true); else if (dy > 40) setSheetFull(false); sheetTouch.current = null; }}>
              <div className="w-10 h-1.5 rounded-full bg-[#D8CDBB]" />
            </div>
          )}
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

function Stat({ label, value }: { label: string; value: string }) { return <div className="rounded-2xl bg-[#F4EEE3] p-4"><div className="text-xs text-[#4C4639] uppercase tracking-wide">{label}</div><div className="text-lg font-medium mt-1">{value}</div></div>; }

function similarProps(cur: Property, all: Property[]) {
  return all.filter((p) => p.id !== cur.id).map((p) => {
    let s = 0;
    if (p.complex && cur.complex && p.complex === cur.complex) s += 100; else if (p.city && cur.city && p.city === cur.city) s += 20;
    if (p.rooms === cur.rooms) s += 30;
    if (p.price > 0 && cur.price > 0) { const d = Math.abs(p.price - cur.price) / cur.price; if (d < 0.2) s += 25; else if (d < 0.4) s += 10; }
    if (p.area > 0 && cur.area > 0 && Math.abs(p.area - cur.area) < 15) s += 10;
    return { p, s };
  }).sort((a, b) => b.s - a.s).slice(0, 4).map((x) => x.p);
}

function PropertyPage({ property }: { property: Property }) {
  const similar = useMemo(() => similarProps(property, properties as Property[]), [property]);
  return (
    <main className="max-w-4xl mx-auto px-5 py-6 space-y-5">
      <button onClick={() => { if (window.history.length > 1) window.history.back(); else window.location.hash = '#/'; }} className="md:hidden -ml-2 flex items-center gap-1 text-sm font-medium text-[#4C4639]"><Chevron dir="l" /> Назад</button>
      <PhotoSlider images={property.images} alt={property.title} />
      <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[#7A5900] font-bold text-3xl">{property.price > 0 ? formatPrice(property.price) : 'Цена по запросу'}</div>
          <div className="flex gap-1.5"><FavButton id={property.id} /><CompareButton id={property.id} /></div>
        </div>
        <div className="text-lg mt-1">{property.complex ? 'ЖК «' + property.complex + '» · ' : ''}{property.address}</div>
        <div className="text-sm text-[#4C4639] mt-1">{property.feedName} · {property.seller}</div>
        {property.sea != null && property.sea <= 5000 && <div className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-[#E0F2FE] text-[#0369A1] text-sm font-medium">🌊 {seaLabel(property.sea)} до моря</div>}
        <div className="grid grid-cols-3 gap-3 mt-5">
          <Stat label="Комнат" value={property.rooms === 0 ? 'Студия' : String(property.rooms)} />
          <Stat label="Площадь" value={property.area > 0 ? property.area + ' м²' : '—'} />
          <Stat label="Этаж" value={property.floor ? property.floor + (property.totalFloors ? '/' + property.totalFloors : '') : '—'} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          <a href={'tel:' + PHONE.replace(/[^+0-9]/g, '')} className="py-3.5 rounded-full bg-[#7A5900] text-white font-medium text-center hover:shadow-lg">Позвонить: {PHONE}</a>
          <a href={flexbeUrl(property)} target="_blank" rel="noopener" className="py-3.5 rounded-full bg-[#FFDEA6] text-[#261900] font-medium text-center hover:shadow-lg">Оставить заявку на просмотр</a>
        </div>
      </div>
      {property.description && <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6"><h3 className="text-sm font-medium uppercase tracking-wider text-[#4C4639] mb-3">Описание</h3><Description text={property.description} /></div>}
      {similar.length > 0 && (
        <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6">
          <h3 className="text-sm font-medium uppercase tracking-wider text-[#4C4639] mb-4">Похожие предложения</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{similar.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
        </div>
      )}
    </main>
  );
}

function FavoritesPage() {
  const favs = useStore(FAV_KEY);
  const items = useMemo(() => (properties as Property[]).filter((p) => favs.includes(p.id)), [favs]);
  return (
    <main className="max-w-4xl mx-auto px-5 py-6">
      <h1 className="text-2xl font-serif font-medium mb-4">Избранное · {items.length}</h1>
      {items.length === 0 ? <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-10 text-center text-[#4C4639]">Пока пусто. Нажимайте ❤️ на карточках.<div className="mt-4"><a href="#/" className="text-[#7A5900] font-medium hover:underline">← К карте</a></div></div> : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{items.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
      )}
    </main>
  );
}

function ComparePage() {
  const cmp = useStore(CMP_KEY);
  const items = useMemo(() => (properties as Property[]).filter((p) => cmp.includes(p.id)), [cmp]);
  const rows: [string, (p: Property) => string][] = [
    ['Комнат', (p) => (p.rooms === 0 ? 'Студия' : String(p.rooms))],
    ['Площадь', (p) => (p.area > 0 ? p.area + ' м²' : '—')],
    ['Этаж', (p) => (p.floor ? p.floor + (p.totalFloors ? '/' + p.totalFloors : '') : '—')],
    ['ЖК', (p) => (p.complex ? '«' + p.complex + '»' : '—')],
    ['Адрес', (p) => p.address],
    ['До моря', (p) => (p.sea != null ? seaLabel(p.sea) : '—')],
    ['Цена за м²', (p) => (p.price > 0 && p.area > 0 ? new Intl.NumberFormat('ru-RU').format(Math.round(p.price / p.area)) + ' ₽' : '—')],
    ['Застройщик', (p) => p.feedName],
  ];
  return (
    <main className="max-w-5xl mx-auto px-5 py-6">
      <h1 className="text-2xl font-serif font-medium mb-4">Сравнение · {items.length}</h1>
      {items.length < 2 ? <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-10 text-center text-[#4C4639]">Отметьте 2–3 квартиры кнопкой «Сравнить» на карточках.</div> : (
        <div className="overflow-x-auto rounded-[28px] bg-white border border-[#E0D7C8]">
          <table className="w-full text-sm">
            <thead><tr><th className="text-left p-4 text-[#4C4639] font-medium w-36">Параметр</th>{items.map((p) => (
              <th key={p.id} className="p-4 align-top min-w-[220px]">
                {p.images[0] && <img referrerPolicy="no-referrer" loading="lazy" src={p.images[0]} alt="" className="w-full h-40 object-contain rounded-xl mb-2 bg-[#F4EEE3]" />}
                <a href={'#/property/' + encodeURIComponent(p.id)} target="_blank" rel="noopener" className="block font-bold text-[#7A5900] hover:underline">{p.price > 0 ? formatPrice(p.price) : 'Цена по запросу'}</a>
                <button onClick={() => toggleStore(CMP_KEY, p.id)} className="text-xs text-[#4C4639] hover:text-red-600 mt-1">убрать ✕</button>
              </th>))}</tr></thead>
            <tbody>{rows.map(([l, fn]) => <tr key={l} className="border-t border-[#F4EEE3]"><td className="p-4 text-[#4C4639]">{l}</td>{items.map((p) => <td key={p.id} className="p-4 text-center">{fn(p)}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
    </main>
  );
}

function ComplexesPage() {
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [feed, setFeed] = useState('');
  const [rooms, setRooms] = useState<number[]>([]);
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');
  const [seaOnly, setSeaOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [applied, setApplied] = useState<{ sel: string[]; rooms: number[]; priceMin: string; priceMax: string; seaOnly: boolean } | null>(null);
  const all = properties as Property[];
  const complexes = useMemo(() => {
    const m: Record<string, Property[]> = {};
    all.forEach((p) => { if (p.complex) (m[p.complex] = m[p.complex] || []).push(p); });
    return Object.entries(m).map(([name, items]) => {
      const pos = items.map((p) => p.price).filter((x) => x > 0);
      const sea = items.map((p) => p.sea).filter((x) => x != null) as number[];
      return { name, items, minPrice: pos.length ? Math.min(...pos) : 0, city: items[0].city, feed: items[0].feedName, sea: sea.length ? Math.min(...sea) : null };
    }).sort((a, b) => b.items.length - a.items.length);
  }, [all]);
  const cities = useMemo(() => Array.from(new Set(complexes.map((c) => c.city).filter(Boolean))).sort(), [complexes]);
  const feeds = useMemo(() => Array.from(new Set(complexes.map((c) => c.feed))), [complexes]);
  const filteredComplexes = complexes.filter((c) => {
    if (query && !(c.name + ' ' + c.city).toLowerCase().includes(query.toLowerCase())) return false;
    if (city && c.city !== city) return false;
    if (feed && c.feed !== feed) return false;
    if (seaOnly && !(c.sea != null && c.sea <= 5000)) return false;
    if (priceMax && c.minPrice > parseFloat(priceMax) * 1e6) return false;
    return true;
  });
  const toggle = (n: string) => setSel((v) => (v.includes(n) ? v.filter((x) => x !== n) : [...v, n]));
  const apply = () => { setApplied({ sel, rooms, priceMin, priceMax, seaOnly }); if (window.innerWidth < 768) setTimeout(() => document.getElementById('jk-results')?.scrollIntoView({ behavior: 'smooth' }), 50); };
  const results = useMemo(() => {
    if (!applied || applied.sel.length === 0) return [];
    return all.filter((p) => {
      if (!applied.sel.includes(p.complex || '')) return false;
      if (applied.rooms.length && !applied.rooms.some((r) => (r === 4 ? p.rooms >= 4 : p.rooms === r))) return false;
      const mn = parseFloat(applied.priceMin) || 0; const mx = parseFloat(applied.priceMax) || Infinity;
      if (p.price > 0 && (p.price < mn * 1e6 || p.price > mx * 1e6)) return false;
      if (applied.seaOnly && !(p.sea != null && p.sea <= 5000)) return false;
      return true;
    }).sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  }, [applied, all]);
  const activeCount = rooms.length + (city ? 1 : 0) + (feed ? 1 : 0) + (seaOnly ? 1 : 0) + (priceMin ? 1 : 0) + (priceMax ? 1 : 0);
  return (
    <main className="max-w-[1400px] mx-auto px-4 md:px-5 py-5 pb-24 md:pb-8">
      <h1 className="text-2xl md:text-3xl font-serif font-medium mb-4">Жилые комплексы · {filteredComplexes.length}</h1>
      <div className="flex flex-col md:flex-row gap-4">
        <aside className="md:w-[380px] shrink-0 space-y-3">
          <button onClick={() => setFiltersOpen(!filtersOpen)} className="w-full flex items-center justify-between h-12 px-4 rounded-2xl bg-white border border-[#E0D7C8] text-sm font-medium">
            <span>Фильтры{activeCount ? ' · ' + activeCount : ''}</span>
            <svg viewBox="0 0 24 24" className={'w-4 h-4 transition ' + (filtersOpen ? 'rotate-180' : '')} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9l6 6 6-6" /></svg>
          </button>
          {filtersOpen && (
            <div className="rounded-2xl bg-white border border-[#E0D7C8] p-3 space-y-2">
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск ЖК..." className="w-full h-11 px-4 rounded-xl bg-white border border-[#E0D7C8] text-sm focus:outline-none focus:border-[#7A5900]" />
              <div className="grid grid-cols-2 gap-2">
                <select value={city} onChange={(e) => setCity(e.target.value)} className="h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm"><option value="">Все города</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                <select value={feed} onChange={(e) => setFeed(e.target.value)} className="h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm"><option value="">Все застройщики</option>{feeds.map((f) => <option key={f} value={f}>{f}</option>)}</select>
              </div>
              <div className="flex gap-2 overflow-x-auto pb-1">{ROOM_OPTIONS.map((r) => <Chip key={r} active={rooms.includes(r)} onClick={() => setRooms((v) => (v.includes(r) ? v.filter((x) => x !== r) : [...v, r]))}>{roomLabel(r)}</Chip>)}</div>
              <div className="grid grid-cols-2 gap-2">
                <input value={priceMin} onChange={(e) => setPriceMin(e.target.value)} type="number" placeholder="Цена от, млн" className="h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm" />
                <input value={priceMax} onChange={(e) => setPriceMax(e.target.value)} type="number" placeholder="до, млн" className="h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm" />
              </div>
              <button onClick={() => setSeaOnly(!seaOnly)} className={'w-full h-11 px-4 rounded-xl border text-sm font-medium transition ' + (seaOnly ? 'bg-[#E0F2FE] border-[#0369A1] text-[#0369A1]' : 'bg-white border-[#E0D7C8] text-[#4C4639]')}>🌊 Только у моря</button>
            </div>
          )}
          <div className="space-y-2 md:max-h-[calc(100vh-240px)] md:overflow-y-auto md:pr-1">
            {filteredComplexes.map((c) => (
              <button key={c.name} onClick={() => toggle(c.name)} className={'w-full text-left rounded-2xl border p-4 transition relative ' + (sel.includes(c.name) ? 'border-[#7A5900] bg-[#FFDEA6]/40 shadow-md' : 'bg-white border-[#E0D7C8] hover:shadow-md')}>
                {sel.includes(c.name) && <span className="absolute top-3 right-3 w-6 h-6 rounded-full bg-[#7A5900] text-white text-xs flex items-center justify-center">✓</span>}
                <div className="font-bold text-[#7A5900] pr-8">«{c.name}»</div>
                <div className="text-sm mt-0.5">{c.city} · {c.feed}</div>
                <div className="text-xs text-[#4C4639] mt-1">{c.items.length} кв. · {priceSuffix(c.minPrice)}{c.sea != null && c.sea <= 5000 ? ' · 🌊 ' + seaLabel(c.sea) : ''}</div>
              </button>
            ))}
            {filteredComplexes.length === 0 && <div className="text-center text-sm text-[#4C4639] py-8">Ничего не найдено</div>}
            <button onClick={apply} className="hidden md:block w-full h-12 rounded-full bg-[#7A5900] text-white text-sm font-bold hover:shadow-lg transition">Применить ({sel.length})</button>
          </div>
        </aside>
        <section id="jk-results" className="flex-1 min-w-0">
          {applied && applied.sel.length > 0 ? (
            <>
              <div className="flex items-center justify-between mb-3">
                <div className="text-sm text-[#4C4639]">Найдено: <b>{results.length}</b> квартир в {applied.sel.length} ЖК</div>
                <button onClick={() => setApplied(null)} className="text-sm text-[#7A5900] hover:underline">Сбросить</button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {results.map((p) => <PropertyCard key={p.id} p={p} />)}
              </div>
              {results.length === 0 && <div className="rounded-2xl bg-white border border-[#E0D7C8] p-8 text-center text-sm text-[#4C4639]">Нет квартир по выбранным условиям</div>}
            </>
          ) : (
            <div className="h-full min-h-[300px] flex items-center justify-center rounded-[28px] bg-white border border-[#E0D7C8] text-[#4C4639] text-sm text-center p-6">Отметьте один или несколько комплексов и нажмите «Применить» — здесь появятся квартиры</div>
          )}
        </section>
      </div>
      <div className="fixed bottom-0 inset-x-0 z-30 md:hidden bg-white/95 backdrop-blur border-t border-[#E0D7C8] p-3 flex gap-2">
        <button onClick={() => setSel([])} className="h-12 px-4 rounded-full border border-[#E0D7C8] text-sm font-medium text-[#4C4639]">Сброс</button>
        <button onClick={apply} disabled={sel.length === 0} className={'flex-1 h-12 rounded-full text-sm font-bold transition ' + (sel.length ? 'bg-[#7A5900] text-white' : 'bg-[#E0D7C8] text-[#7E7669]')}>Применить {sel.length ? '(' + sel.length + ')' : ''}</button>
      </div>
    </main>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-6"><h3 className="text-sm font-medium uppercase tracking-wider text-[#4C4639] mb-4">{title}</h3>{children}</div>;
}
function Bar({ label, value, display, max, color }: { label: string; value: number; display: string; max: number; color: string }) {
  return (
    <div className="mb-3 last:mb-0">
      <div className="flex justify-between text-sm mb-1"><span>{label}</span><b>{display}</b></div>
      <div className="h-2.5 rounded-full bg-[#F4EEE3]"><div className="h-2.5 rounded-full" style={{ width: Math.max(4, (value / max) * 100) + '%', background: color }} /></div>
    </div>
  );
}
function AnalyticsPage() {
  const [city, setCity] = useState('');
  const all = useMemo(() => (city ? (properties as Property[]).filter((p) => p.city === city) : (properties as Property[])), [city]);
  const citiesAll = useMemo(() => Array.from(new Set((properties as Property[]).map((p) => p.city).filter(Boolean))).sort(), []);
  const stats = useMemo(() => {
    const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    const med = (a: number[]) => { if (!a.length) return 0; const q = [...a].sort((x, y) => x - y); const m = Math.floor(q.length / 2); return q.length % 2 ? q[m] : (q[m - 1] + q[m]) / 2; };
    const priced = all.filter((p) => p.price > 0);
    const pricedArea = priced.filter((p) => p.area > 0);
    const byCity: Record<string, number[]> = {};
    pricedArea.forEach((p) => { (byCity[p.city] = byCity[p.city] || []).push(p.price / p.area); });
    const cities = Object.entries(byCity).map(([c, a]) => ({ c, v: avg(a), n: a.length })).filter((x) => x.n >= 5).sort((a, b) => b.v - a.v);
    const byRooms: Record<number, number[]> = {};
    pricedArea.forEach((p) => { (byRooms[p.rooms] = byRooms[p.rooms] || []).push(p.price / p.area); });
    const rooms = Object.entries(byRooms).map(([r, a]) => ({ r: Number(r), v: avg(a), n: a.length })).sort((a, b) => a.r - b.r);
    const budgets = [
      { label: 'до 3 млн', min: 0, max: 3 }, { label: '3–5 млн', min: 3, max: 5 }, { label: '5–8 млн', min: 5, max: 8 },
      { label: '8–12 млн', min: 8, max: 12 }, { label: '12–20 млн', min: 12, max: 20 }, { label: '20+ млн', min: 20, max: Infinity },
    ].map((b) => ({ label: b.label, count: priced.filter((p) => p.price >= b.min * 1e6 && p.price < b.max * 1e6).length }));
    const areaB = [0, 30, 50, 70, 90, Infinity];
    const areaL = ['до 30 м²', '30–50 м²', '50–70 м²', '70–90 м²', '90+ м²'];
    const areaDist = areaL.map((label, i) => ({ label, count: pricedArea.filter((p) => p.area >= areaB[i] && p.area < areaB[i + 1]).length }));
    const seaB = [0, 1000, 2000, 5000, Infinity];
    const seaL = ['до 1 км', '1–2 км', '2–5 км', '5+ км'];
    const seaDist = seaL.map((label, i) => ({ label, count: all.filter((p) => p.sea != null && p.sea >= seaB[i] && p.sea < seaB[i + 1]).length }));
    const byComplex: Record<string, number> = {};
    all.forEach((p) => { if (p.complex) byComplex[p.complex] = (byComplex[p.complex] || 0) + 1; });
    const topComplexes = Object.entries(byComplex).sort((a, b) => b[1] - a[1]).slice(0, 10);
    const byFeed: Record<string, { n: number; prices: number[]; areas: number[] }> = {};
    all.forEach((p) => { const f = (byFeed[p.feedName] = byFeed[p.feedName] || { n: 0, prices: [], areas: [] }); f.n++; if (p.price > 0) f.prices.push(p.price); if (p.area > 0) f.areas.push(p.area); });
    const feeds = Object.entries(byFeed).map(([n, f]) => ({ n, count: f.n, avg: avg(f.prices), avgArea: avg(f.areas) })).sort((a, b) => b.count - a.count);
    return {
      total: all.length, avgPrice: avg(priced.map((p) => p.price)), medPrice: med(priced.map((p) => p.price)),
      avgM2: avg(pricedArea.map((p) => p.price / p.area)), medM2: med(pricedArea.map((p) => p.price / p.area)),
      avgArea: avg(pricedArea.map((p) => p.area)), coastal: all.filter((p) => p.sea != null && p.sea <= 2000).length,
      cities, rooms, budgets, areaDist, seaDist, topComplexes, feeds,
      maxCity: Math.max(...cities.map((c) => c.v), 1), maxBudget: Math.max(...budgets.map((b) => b.count), 1),
      maxArea: Math.max(...areaDist.map((a) => a.count), 1), maxSea: Math.max(...seaDist.map((x) => x.count), 1),
      maxRooms: Math.max(...rooms.map((r) => r.v), 1),
    };
  }, [all]);
  const f = (x: number) => new Intl.NumberFormat('ru-RU').format(Math.round(x));
  const fM = (x: number) => (x / 1e6).toFixed(1).replace('.', ',') + ' млн';
  return (
    <main className="max-w-6xl mx-auto px-4 md:px-5 py-6 space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl md:text-3xl font-serif font-medium">Аналитика рынка</h1>
        <select value={city} onChange={(e) => setCity(e.target.value)} className="h-11 px-4 rounded-xl bg-white border border-[#E0D7C8] text-sm">
          <option value="">Вся область</option>
          {citiesAll.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Всего объектов" value={String(stats.total)} />
        <Stat label="Средняя цена" value={fM(stats.avgPrice)} />
        <Stat label="Медиана цены" value={fM(stats.medPrice)} />
        <Stat label="Средняя ₽/м²" value={f(stats.avgM2) + ' ₽'} />
        <Stat label="Медиана ₽/м²" value={f(stats.medM2) + ' ₽'} />
        <Stat label="Средняя площадь" value={stats.avgArea.toFixed(0) + ' м²'} />
        <Stat label="У моря ≤ 2 км" value={String(stats.coastal)} />
        <Stat label="ЖК в топе" value={String(stats.topComplexes.length)} />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        <Card title="💰 Цена м² по городам">{stats.cities.map((c) => <Bar key={c.c} label={c.c + ' · ' + c.n + ' кв.'} value={c.v} display={f(c.v) + ' ₽'} max={stats.maxCity} color="#7A5900" />)}</Card>
        <Card title="🚪 Цена м² по комнатам">{stats.rooms.map((r) => <Bar key={r.r} label={roomLabel(r.r) + ' · ' + r.n + ' кв.'} value={r.v} display={f(r.v) + ' ₽'} max={stats.maxRooms} color="#B26A00" />)}</Card>
        <Card title="📊 Распределение по бюджету">{stats.budgets.map((b) => <Bar key={b.label} label={b.label} value={b.count} display={String(b.count)} max={stats.maxBudget} color="#0369A1" />)}</Card>
        <Card title="📐 Распределение по площади">{stats.areaDist.map((a) => <Bar key={a.label} label={a.label} value={a.count} display={String(a.count)} max={stats.maxArea} color="#1E7E34" />)}</Card>
        <Card title="🌊 Удалённость от моря">{stats.seaDist.map((x) => <Bar key={x.label} label={x.label} value={x.count} display={String(x.count)} max={stats.maxSea} color="#0E7490" />)}</Card>
        <Card title="🏆 Топ-10 ЖК по квартирам">
          {stats.topComplexes.map(([n, c], i) => (
            <div key={n} className="flex items-center justify-between py-1.5 border-b border-[#F4EEE3] last:border-0 text-sm"><span className="truncate">{i + 1}. «{n}»</span><b>{c}</b></div>
          ))}
        </Card>
      </div>
      <Card title="🏗 Застройщики">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {stats.feeds.map((d) => (
            <div key={d.n} className="rounded-2xl bg-[#F4EEE3] p-4">
              <div className="font-bold text-[#7A5900]">{d.n}</div>
              <div className="text-xs text-[#4C4639] mt-1">{d.count} объектов · ср. {d.avgArea.toFixed(0)} м²</div>
              <div className="text-sm font-medium mt-2">от {fM(d.avg)}</div>
            </div>
          ))}
        </div>
      </Card>
      <div className="rounded-[28px] p-8 text-center" style={{ background: 'linear-gradient(135deg,#FFDEA6 0%,#F4C870 100%)' }}>
        <div className="text-2xl font-serif font-bold text-[#261900]">Нужна персональная подборка?</div>
        <a href="https://coastal-estate.flexbe.ru/" target="_blank" rel="noopener" className="inline-block mt-4 px-8 py-4 rounded-full bg-[#7A5900] text-white font-bold hover:shadow-xl transition">Подобрать квартиру →</a>
      </div>
    </main>
  );
}

function BudgetPage() {
  const budgets = [5, 8, 10, 15, 20];
  const [sel, setSel] = useState(10);
  const items = useMemo(() => (properties as Property[]).filter((p) => p.price > 0 && p.price <= sel * 1e6).sort((a, b) => b.price - a.price), [sel]);
  return (
    <main className="max-w-4xl mx-auto px-5 py-6">
      <h1 className="text-2xl font-serif font-medium mb-4">Подбор по бюджету</h1>
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4">{budgets.map((b) => <Chip key={b} active={sel === b} onClick={() => setSel(b)}>до {b} млн</Chip>)}</div>
      <p className="text-sm text-[#4C4639] mb-4">Найдено: {items.length}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{items.slice(0, 30).map((p) => <PropertyCard key={p.id} p={p} />)}</div>
    </main>
  );
}

function AboutPage() {
  return (
    <main className="max-w-5xl mx-auto px-4 md:px-5 py-6 space-y-6">
      <section className="rounded-[32px] p-8 md:p-12 text-white" style={{ background: 'linear-gradient(135deg,#1E1B13 0%,#3d3624 50%,#7A5900 100%)' }}>
        <div className="text-sm uppercase tracking-[0.2em] text-[#FFDEA6] mb-2">Агентство элитной недвижимости</div>
        <h1 className="text-3xl md:text-5xl font-serif font-medium leading-tight">Новостройки <span className="text-[#FFDEA6] font-bold">39</span></h1>
        <p className="text-lg md:text-xl text-white/85 mt-4 max-w-3xl leading-relaxed">Персональный подбор премиальных квартир в Калининградской области. Работаем напрямую с ведущими застройщиками побережья — без посредников, без комиссий, с юридическим сопровождением сделки.</p>
        <div className="flex flex-wrap gap-3 mt-6">
          <a href={'tel:' + PHONE.replace(/[^+0-9]/g, '')} className="px-6 py-3 rounded-full bg-[#FFDEA6] text-[#261900] font-bold hover:shadow-xl transition">{PHONE}</a>
          <a href="https://coastal-estate.flexbe.ru/" target="_blank" rel="noopener" className="px-6 py-3 rounded-full bg-white/10 backdrop-blur text-white border border-white/20 font-medium hover:bg-white/20 transition">Персональная подборка →</a>
        </div>
      </section>
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-2xl bg-white border border-[#E0D7C8] p-4"><div className="text-2xl font-bold text-[#7A5900]">8+</div><div className="text-xs text-[#4C4639] mt-1">лет на рынке</div></div>
        <div className="rounded-2xl bg-white border border-[#E0D7C8] p-4"><div className="text-2xl font-bold text-[#7A5900]">420+</div><div className="text-xs text-[#4C4639] mt-1">сделок закрыто</div></div>
        <div className="rounded-2xl bg-white border border-[#E0D7C8] p-4"><div className="text-2xl font-bold text-[#7A5900]">12</div><div className="text-xs text-[#4C4639] mt-1">застройщиков</div></div>
        <div className="rounded-2xl bg-white border border-[#E0D7C8] p-4"><div className="text-2xl font-bold text-[#7A5900]">600+</div><div className="text-xs text-[#4C4639] mt-1">довольных клиентов</div></div>
      </section>
      <section className="rounded-[28px] bg-white border border-[#E0D7C8] p-6 md:p-8">
        <h2 className="text-2xl font-serif font-medium mb-2">Почему выбирают нас</h2>
        <p className="text-[#4C4639] mb-6">Мы не просто продаём квадратные метры — мы подбираем образ жизни у Балтийского моря.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { icon: '🎯', t: 'Персональный подход', d: 'Менеджер изучает ваши приоритеты: вид из окна, тишина, близость к морю, инфраструктура для детей.' },
            { icon: '🔐', t: 'Закрытые предложения', d: 'Доступ к квартирам вне открытой продажи: пентхаусы, видовые лоты, специальные цены от застройщика.' },
            { icon: '⚖️', t: 'Юридическая чистота', d: 'Проверяем ДДУ, эскроу-счета, историю участка. Сопровождаем сделку от брони до получения ключей.' },
            { icon: '💎', t: 'Без комиссий', d: 'Наши услуги оплачивает застройщик. Вы получаете ту же цену, что и при прямой покупке, плюс сервис.' },
            { icon: '🏦', t: 'Ипотека под ключ', d: 'Работаем с 15+ банками. Одобрение за 1 день, ставка ниже рыночной, семейная и IT-ипотека.' },
            { icon: '✈️', t: 'Удалённая покупка', d: 'Онлайн-показы по видеосвязи, электронный ДДУ, доставка ключей. Подходит для клиентов из любого города.' },
          ].map((b) => (
            <div key={b.t} className="rounded-2xl bg-[#FDF9F3] p-5">
              <div className="text-2xl mb-2">{b.icon}</div>
              <div className="font-bold">{b.t}</div>
              <div className="text-sm text-[#4C4639] mt-1 leading-relaxed">{b.d}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[28px] bg-white border border-[#E0D7C8] p-6 md:p-8">
        <h2 className="text-2xl font-serif font-medium mb-4">Сегменты работы</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="rounded-2xl border-2 border-[#7A5900] p-5"><div className="text-xs uppercase tracking-wider text-[#7A5900] font-bold">Премиум</div><div className="text-lg font-bold mt-1">от 20 млн ₽</div><div className="text-sm text-[#4C4639] mt-2">Пентхаусы и видовые квартиры в Светлогорске и Зеленоградске, апартаменты на первой линии.</div></div>
          <div className="rounded-2xl border border-[#E0D7C8] p-5"><div className="text-xs uppercase tracking-wider text-[#B26A00] font-bold">Бизнес</div><div className="text-lg font-bold mt-1">от 10 млн ₽</div><div className="text-sm text-[#4C4639] mt-2">Закрытые жилые комплексы, квартиры с террасами и дизайнерской отделкой.</div></div>
          <div className="rounded-2xl border border-[#E0D7C8] p-5"><div className="text-xs uppercase tracking-wider text-[#4C4639] font-bold">Инвестиции</div><div className="text-lg font-bold mt-1">любой бюджет</div><div className="text-sm text-[#4C4639] mt-2">Подбор квартир под сдачу в аренду, расчёт доходности, управление объектом.</div></div>
        </div>
      </section>
      <section className="rounded-[28px] bg-white border border-[#E0D7C8] p-6 md:p-8">
        <h2 className="text-2xl font-serif font-medium mb-4">Как мы работаем</h2>
        <div className="space-y-3">
          {[
            { n: '01', t: 'Знакомство', d: 'Созваниваемся, обсуждаем бюджет, локации, приоритеты. 30 минут.' },
            { n: '02', t: 'Подборка', d: 'За 2 дня готовим 10–15 объектов под ваш запрос, включая закрытые предложения.' },
            { n: '03', t: 'Показы', d: 'Организуем онлайн или очные показы. Сравниваем варианты, ведём переговоры о скидке.' },
            { n: '04', t: 'Сделка', d: 'Юристы проверяют документы, получаем ипотеку, оформляем ДДУ. Вы платите после регистрации.' },
          ].map((x) => (
            <div key={x.n} className="flex gap-4 items-start rounded-2xl bg-[#FDF9F3] p-4">
              <div className="text-3xl font-serif font-bold text-[#7A5900] shrink-0">{x.n}</div>
              <div><div className="font-bold">{x.t}</div><div className="text-sm text-[#4C4639] mt-0.5">{x.d}</div></div>
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-[28px] p-8 text-center" style={{ background: 'linear-gradient(135deg,#FFDEA6 0%,#F4C870 100%)' }}>
        <div className="text-2xl font-serif font-bold text-[#261900]">Готовы начать подбор?</div>
        <p className="text-[#4C4639] mt-2">Бесплатная консультация и персональная подборка за 48 часов</p>
        <a href="https://coastal-estate.flexbe.ru/" target="_blank" rel="noopener" className="inline-block mt-4 px-8 py-4 rounded-full bg-[#7A5900] text-white font-bold text-lg hover:shadow-xl transition">Записаться на консультацию →</a>
      </section>
      <section className="rounded-[28px] bg-white border border-[#E0D7C8] p-6 md:p-8">
        <h2 className="text-2xl font-serif font-medium mb-4">Контакты</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div><div className="text-xs uppercase tracking-wider text-[#4C4639]">Телефон</div><a href={'tel:' + PHONE.replace(/[^+0-9]/g, '')} className="text-xl font-bold text-[#7A5900]">{PHONE}</a></div>
          <div><div className="text-xs uppercase tracking-wider text-[#4C4639]">Режим работы</div><div className="text-lg font-medium">Ежедневно 9:00–21:00</div></div>
          <div><div className="text-xs uppercase tracking-wider text-[#4C4639]">Офис</div><div className="text-sm">г. Калининград, Прегольская наб., 6</div></div>
          <div><div className="text-xs uppercase tracking-wider text-[#4C4639]">Показы</div><div className="text-sm">Светлогорск · Зеленоградск · Пионерский</div></div>
        </div>
      </section>
    </main>
  );
}
function MortgageCalculator() {
  const [price, setPrice] = useState(8000000);
  const [down, setDown] = useState(20);
  const [years, setYears] = useState(20);
  const [program, setProgram] = useState('regular');
  const programs = [
    { id: 'regular', name: 'Рыночная', rate: 18, desc: 'Стандартная ставка' },
    { id: 'family', name: 'Семейная', rate: 6, desc: 'Семьи с детьми' },
    { id: 'it', name: 'IT-ипотека', rate: 6, desc: 'IT-специалисты' },
    { id: 'subsidy', name: 'Льготная', rate: 2, desc: 'Господдержка' },
  ];
  const cur = programs.find((x) => x.id === program) || programs[0];
  const principal = price * (1 - down / 100);
  const m = cur.rate / 100 / 12;
  const n = years * 12;
  const pay = m > 0 ? (principal * m) / (1 - Math.pow(1 + m, -n)) : principal / n;
  const f = (x: number) => new Intl.NumberFormat('ru-RU').format(Math.round(x));
  return (
    <main className="max-w-5xl mx-auto px-4 md:px-5 py-6">
      <h1 className="text-2xl md:text-3xl font-serif font-medium mb-1">Ипотечный калькулятор</h1>
      <p className="text-sm text-[#4C4639] mb-6">Выберите программу — ставка подставится автоматически. Работаем с 15+ банками-партнёрами.</p>
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-3 space-y-4">
          <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-5 md:p-6">
            <div className="flex justify-between items-baseline mb-2"><label className="text-sm text-[#4C4639]">Стоимость</label><div className="text-xl font-bold text-[#7A5900]">{f(price)} ₽</div></div>
            <input type="range" min={2000000} max={50000000} step={100000} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full accent-[#7A5900]" />
            <div className="flex justify-between text-xs text-[#7E7669] mt-1"><span>2 млн</span><span>50 млн</span></div>
          </div>
          <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-5 md:p-6">
            <div className="flex justify-between items-baseline mb-2"><label className="text-sm text-[#4C4639]">Взнос</label><div className="text-xl font-bold text-[#7A5900]">{down}% · {f(price * down / 100)} ₽</div></div>
            <input type="range" min={0} max={90} step={5} value={down} onChange={(e) => setDown(Number(e.target.value))} className="w-full accent-[#7A5900]" />
          </div>
          <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-5 md:p-6">
            <label className="text-sm text-[#4C4639]">Срок</label>
            <div className="flex flex-wrap gap-2 mt-3">
              {[5, 10, 15, 20, 25, 30].map((y) => (
                <button key={y} onClick={() => setYears(y)} className={'px-4 py-2 rounded-full border text-sm font-medium transition ' + (years === y ? 'bg-[#7A5900] border-[#7A5900] text-white' : 'bg-white border-[#E0D7C8] text-[#4C4639] hover:border-[#7A5900]')}>{y} лет</button>
              ))}
            </div>
          </div>
          <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-5 md:p-6">
            <label className="text-sm text-[#4C4639]">Программа</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-3">
              {programs.map((pr) => (
                <button key={pr.id} onClick={() => setProgram(pr.id)} className={'text-left rounded-2xl border-2 p-3 transition ' + (program === pr.id ? 'border-[#7A5900] bg-[#FDF9F3]' : 'border-[#E0D7C8] bg-white hover:border-[#7A5900]/50')}>
                  <div className="font-medium text-sm">{pr.name} · {pr.rate}%</div>
                  <div className="text-xs text-[#4C4639] mt-1">{pr.desc}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-[28px] p-6 sticky top-20 text-white" style={{ background: 'linear-gradient(135deg,#7A5900 0%,#B26A00 100%)' }}>
            <div className="text-sm text-white/80">Платёж в месяц</div>
            <div className="text-4xl font-bold mt-1">{f(pay)} ₽</div>
            <div className="text-sm text-white/70 mt-1">«{cur.name}» · {cur.rate}%</div>
            <div className="h-px bg-white/20 my-5" />
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-white/80">Кредит</span><b>{f(principal)} ₽</b></div>
              <div className="flex justify-between"><span className="text-white/80">Переплата</span><b>{f(pay * n - principal)} ₽</b></div>
              <div className="flex justify-between"><span className="text-white/80">Всего</span><b>{f(pay * n)} ₽</b></div>
            </div>
          </div>
          <a href={'https://coastal-estate.flexbe.ru/?price=' + price + '&program=' + program} target="_blank" rel="noopener" className="block w-full py-4 rounded-full bg-[#FFDEA6] text-[#261900] font-bold text-center hover:shadow-lg transition">Оставить заявку на ипотеку</a>
          <div className="rounded-2xl bg-white border border-[#E0D7C8] p-4 text-xs text-[#4C4639]">💡 Расчёт ориентировочный. Поможем получить одобрение в 15+ банках.</div>
        </div>
      </div>
    </main>
  );
}
export default function MapView() {
  const hash = useHash();
  const propertyId = hash.indexOf('#/property/') === 0 ? decodeURIComponent(hash.slice(11)) : null;
  const propertyPage = useMemo(() => (propertyId ? ((properties as Property[]).find((p) => p.id === propertyId) || null) : null), [propertyId]);
  let content: React.ReactNode; let isMap = false;
  if (hash === '#/calc') content = <MortgageCalculator />;
  else if (hash === '#/favorites') content = <FavoritesPage />;
  else if (hash === '#/complexes') content = <ComplexesPage />;
  else if (hash === '#/analytics') content = <AnalyticsPage />;
  else if (hash === '#/budget') content = <BudgetPage />;
  else if (hash === '#/compare') content = <ComparePage />;
  else if (hash === '#/about') content = <AboutPage />;
  else if (propertyPage) content = <PropertyPage property={propertyPage} />;
  else { content = <MapScreen />; isMap = true; }
  return (
    <div className={(isMap ? 'h-dvh overflow-hidden' : 'min-h-dvh') + ' bg-[#FDF9F3] text-[#1E1B13] flex flex-col'}>
      <Header hash={hash} />
      <div className={isMap ? 'flex-1 min-h-0' : ''}>{content}</div>
    </div>
  );
}
