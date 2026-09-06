import { useEffect, useMemo, useState } from 'react';
import { YMaps, Map as YMap, Placemark, ZoomControl } from '@pbe/react-yandex-maps';
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
const formatPrice = (p: number) => new Intl.NumberFormat('ru-RU').format(p) + ' ₽';
const formatMln = (p: number) => (p / 1000000).toFixed(1).replace('.', ',') + ' млн';
const priceSuffix = (m: number) => (m > 0 ? 'от ' + formatMln(m) : 'цена по запросу');
const esc = (v: unknown) => String(v == null ? '' : v).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const flexbeUrl = (p: Property) => 'https://coastal-estate.flexbe.ru/?property_id=' + p.id + '&price=' + p.price + '&address=' + encodeURIComponent(p.address);

const FAV_KEY = 'novostroiky39_favs';
const getFavs = (): string[] => { try { return JSON.parse(localStorage.getItem(FAV_KEY) || '[]'); } catch { return []; } };
const toggleFav = (id: string) => { const f = getFavs(); const i = f.indexOf(id); if (i >= 0) f.splice(i, 1); else f.push(id); localStorage.setItem(FAV_KEY, JSON.stringify(f)); window.dispatchEvent(new Event('favs-changed')); };
function useFavs(): string[] {
  const [f, setF] = useState<string[]>(getFavs());
  useEffect(() => { const on = () => setF(getFavs()); window.addEventListener('favs-changed', on); window.addEventListener('storage', on); return () => { window.removeEventListener('favs-changed', on); window.removeEventListener('storage', on); }; }, []);
  return f;
}
function useHash() {
  const [h, setH] = useState(window.location.hash);
  useEffect(() => { const on = () => setH(window.location.hash); window.addEventListener('hashchange', on); return () => window.removeEventListener('hashchange', on); }, []);
  return h;
}

function Chevron({ dir }: { dir: 'l' | 'r' }) {
  return <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">{dir === 'l' ? <path d="M15 18l-6-6 6-6" /> : <path d="M9 18l6-6-6-6" />}</svg>;
}
function ChatIcon() {
  return <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>;
}
function HeartIcon({ filled }: { filled: boolean }) {
  return <svg viewBox="0 0 24 24" className="w-5 h-5" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21.2l7.8-7.8 1-1a5.5 5.5 0 0 0 0-7.8z" /></svg>;
}

function Header({ hash }: { hash: string }) {
  const cmp = useCmp();
  const favs = useFavs();
  const [open, setOpen] = useState(false);
  const nav = [
    { h: '#/', l: 'Карта' }, { h: '#/complexes', l: 'ЖК' }, { h: '#/analytics', l: 'Аналитика' },
    { h: '#/budget', l: 'Бюджет' }, { h: '#/calc', l: 'Калькулятор' }, { h: '#/compare', l: 'Сравнить' }, { h: '#/about', l: 'О нас' },
  ];
  const act = (h: string) => (h === '#/' ? (hash === '#/' || hash === '' || hash.indexOf('#/property') === 0) : hash.indexOf(h) === 0);
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur border-b border-[#E0D7C8]">
      <div className="max-w-[1400px] mx-auto px-4 h-16 flex items-center justify-between gap-3">
        <a href="#/" className="font-serif text-lg font-medium whitespace-nowrap">Новостройки <span className="text-[#7A5900] font-bold">39</span></a>
        <nav className="hidden md:flex items-center gap-1">
          {nav.map((n) => <a key={n.h} href={n.h} className={'px-3 py-2 rounded-full text-sm font-medium transition ' + (act(n.h) ? 'bg-[#FFDEA6] text-[#261900]' : 'text-[#4C4639] hover:bg-[#F4EEE3]')}>{n.l}{n.h === '#/compare' && cmp.length > 0 ? ' · ' + cmp.length : ''}</a>)}
          <a href="#/favorites" className={'ml-1 px-3 py-2 rounded-full text-sm font-medium flex items-center gap-1 ' + (hash.indexOf('#/favorites') === 0 ? 'bg-[#FFDEA6] text-[#261900]' : 'text-[#7A5900] hover:bg-[#F4EEE3]')}><HeartIcon filled={favs.length > 0} /> {favs.length}</a>
        </nav>
        <button className="md:hidden w-10 h-10 rounded-full flex items-center justify-center hover:bg-[#F4EEE3]" onClick={() => setOpen(!open)} aria-label="Меню">
          <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M3 12h18M3 18h18" /></svg>
        </button>
      </div>
      {open && (
        <nav className="md:hidden border-t border-[#E0D7C8] bg-white px-4 py-2 flex flex-col">
          {nav.map((n) => <a key={n.h} href={n.h} onClick={() => setOpen(false)} className="py-2 text-sm font-medium">{n.l}{n.h === '#/compare' && cmp.length > 0 ? ' · ' + cmp.length : ''}</a>)}
          <a href="#/favorites" onClick={() => setOpen(false)} className="py-2 text-sm font-medium text-[#7A5900]">Избранное ({favs.length})</a>
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
  const good = images.filter((u) => !bad[u]);
  const [i, setI] = useState(0);
  if (!good.length) return null;
  const idx = i % good.length;
  const markBad = (u: string) => setBad((b) => (b[u] ? b : { ...b, [u]: true }));
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
  const favs = useFavs(); const on = favs.includes(id);
  return <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFav(id); }} aria-label="В избранное" className={'w-10 h-10 rounded-full flex items-center justify-center border transition ' + (on ? 'bg-[#7A5900] border-[#7A5900] text-white' : 'bg-white border-[#E0D7C8] text-[#7A5900] hover:border-[#7A5900]')}><HeartIcon filled={on} /></button>;
}

const CMP_KEY = 'novostroiky39_cmp';
const getCmp = (): string[] => { try { return JSON.parse(localStorage.getItem(CMP_KEY) || '[]'); } catch { return []; } };
const toggleCmp = (id: string) => {
  const f = getCmp(); const i = f.indexOf(id);
  if (i >= 0) f.splice(i, 1);
  else { if (f.length >= 3) { alert('Можно сравнить не более 3 квартир'); return; } f.push(id); }
  localStorage.setItem(CMP_KEY, JSON.stringify(f));
  window.dispatchEvent(new Event('cmp-changed'));
};
function useCmp(): string[] {
  const [f, setF] = useState<string[]>(getCmp());
  useEffect(() => { const on = () => setF(getCmp()); window.addEventListener('cmp-changed', on); window.addEventListener('storage', on); return () => { window.removeEventListener('cmp-changed', on); window.removeEventListener('storage', on); }; }, []);
  return f;
}

function CompareButton({ id }: { id: string }) {
  const cmp = useCmp(); const on = cmp.includes(id);
  return (
    <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleCmp(id); }} className={'h-10 px-3 rounded-full border text-xs font-medium transition ' + (on ? 'bg-[#0369A1] border-[#0369A1] text-white' : 'bg-white border-[#E0D7C8] text-[#0369A1] hover:border-[#0369A1]')}>
      {on ? '✓ В сравнении' : 'Сравнить'}
    </button>
  );
}

function CompareBar() {
  const cmp = useCmp();
  if (cmp.length < 2) return null;
  return (
    <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 flex items-center gap-3 bg-white border border-[#E0D7C8] shadow-lg rounded-full px-4 py-2">
      <span className="text-sm text-[#4C4639]">Выбрано: {cmp.length}</span>
      <a href="#/compare" className="px-4 py-2 rounded-full bg-[#7A5900] text-white text-sm font-medium">Сравнить</a>
      <button onClick={() => { localStorage.setItem(CMP_KEY, '[]'); window.dispatchEvent(new Event('cmp-changed')); }} className="text-sm text-[#4C4639] hover:text-[#7A5900]">Сбросить</button>
    </div>
  );
}

function ComparePage() {
  const cmp = useCmp();
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
      <h1 className="text-2xl font-serif font-medium mb-4">Сравнение квартир</h1>
      {items.length < 2 ? (
        <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-10 text-center text-[#4C4639]">Отметьте 2–3 квартиры синей кнопкой сравнения на карточках — и они появятся здесь в таблице.</div>
      ) : (
        <div className="overflow-x-auto rounded-[28px] bg-white border border-[#E0D7C8]">
          <table className="w-full text-sm">
            <thead>
              <tr>
                <th className="text-left p-4 text-[#4C4639] font-medium w-36">Параметр</th>
                {items.map((p) => (
                  <th key={p.id} className="p-4 align-top min-w-[220px]">
                    {p.images[0] && <img referrerPolicy="no-referrer" loading="lazy" src={p.images[0]} alt="" className="w-full h-32 object-cover rounded-xl mb-2" />}
                    <a href={'#/property/' + encodeURIComponent(p.id)} target="_blank" rel="noopener" className="block font-bold text-[#7A5900] hover:underline">{p.price > 0 ? formatPrice(p.price) : 'Цена по запросу'}</a>
                    <button onClick={() => toggleCmp(p.id)} className="text-xs text-[#4C4639] hover:text-red-600 mt-1">убрать ✕</button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map(([l, fn]) => (
                <tr key={l} className="border-t border-[#F4EEE3]">
                  <td className="p-4 text-[#4C4639]">{l}</td>
                  {items.map((p) => <td key={p.id} className="p-4 text-center">{fn(p)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
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
  const good = p.images.filter((u) => !bad[u]);
  const [i, setI] = useState(0);
  const markBad = (u: string) => setBad((b) => (b[u] ? b : { ...b, [u]: true }));
  const idx = good.length ? i % good.length : 0;
  const block = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); };
  const niceTitle = p.title && !/продаж|аренд/i.test(p.title) ? p.title : '';
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
          <a href={flexbeUrl(p)} target="_blank" rel="noopener" onClick={block} aria-label="Заявка" className="w-12 h-12 rounded-2xl bg-[#ECE5D8] flex items-center justify-center hover:bg-[#FFDEA6]"><ChatIcon /></a>
        </div>
      </div>
    </a>
  );
}

function similarProps(cur: Property, all: Property[]): Property[] {
  return all.filter((p) => p.id !== cur.id).map((p) => {
    let s = 0;
    if (p.complex && cur.complex && p.complex === cur.complex) s += 100; else if (p.city && cur.city && p.city === cur.city) s += 20;
    if (p.rooms === cur.rooms) s += 30;
    if (p.price > 0 && cur.price > 0) { const d = Math.abs(p.price - cur.price) / cur.price; if (d < 0.2) s += 25; else if (d < 0.4) s += 10; }
    if (p.area > 0 && cur.area > 0 && Math.abs(p.area - cur.area) < 15) s += 10;
    return { p, s };
  }).sort((a, b) => b.s - a.s).slice(0, 4).map((x) => x.p);
}

function Stat({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl bg-[#F4EEE3] p-4"><div className="text-xs text-[#4C4639] uppercase tracking-wide">{label}</div><div className="text-lg font-medium mt-1">{value}</div></div>;
}

function PropertyPage({ property }: { property: Property }) {
  const similar = useMemo(() => similarProps(property, properties as Property[]), [property]);
  return (
    <main className="max-w-4xl mx-auto px-5 py-6 space-y-5">
      <PhotoSlider images={property.images} alt={property.title} />
      <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6">
        <div className="flex items-start justify-between gap-3">
          <div className="text-[#7A5900] font-bold text-3xl">{property.price > 0 ? formatPrice(property.price) : 'Цена по запросу'}</div>
          <FavButton id={property.id} />
        </div>
        <div className="text-lg mt-1">{property.complex ? 'ЖК «' + property.complex + '» · ' : ''}{property.address}</div>
        <div className="text-sm text-[#4C4639] mt-1">{property.feedName} · {property.seller}</div>
        {property.sea != null && property.sea <= 5000 && <div className="mt-2 inline-block px-3 py-1.5 rounded-lg bg-[#E0F2FE] text-[#0369A1] text-sm font-medium">🌊 {seaLabel(property.sea)} до моря</div>}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mt-5">
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

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button onClick={onClick} className={'shrink-0 h-9 px-4 rounded-full border text-sm font-medium transition ' + (active ? 'bg-[#FFDEA6] border-[#FFDEA6] text-[#261900]' : 'bg-white border-[#E0D7C8] text-[#4C4639] hover:border-[#7A5900]')}>{children}</button>;
}

function MapScreen() {
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(true);

  const cities = useMemo(() => { const c: Record<string, number> = {}; (properties as Property[]).forEach((p) => { if (p.city && p.city !== 'Другое') c[p.city] = (c[p.city] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a]); }, []);
  const complexes = useMemo(() => { const c: Record<string, number> = {}; (properties as Property[]).forEach((p) => { if (p.complex) c[p.complex] = (c[p.complex] || 0) + 1; }); return Object.keys(c).sort((a, b) => c[b] - c[a]); }, []);
  const feeds = useMemo(() => Array.from(new Set((properties as Property[]).map((p) => p.feedName))), []);

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

  const selectedGroup = useMemo(() => groups.find((g) => g.address === selectedAddress) || null, [groups, selectedAddress]);
  const center = useMemo(() => { if (!groups.length) return [54.7104, 20.4522] as [number, number]; return [groups.reduce((s, g) => s + g.lat, 0) / groups.length, groups.reduce((s, g) => s + g.lng, 0) / groups.length] as [number, number]; }, [groups]);
  const filteredAddresses = useMemo(() => { if (!query) return groups; const q = query.toLowerCase(); return groups.filter((g) => g.address.toLowerCase().includes(q) || g.feedName.toLowerCase().includes(q) || (g.complex || '').toLowerCase().includes(q)); }, [groups, query]);
  const active = filters.rooms.length > 0 || !!filters.city || !!filters.complex || !!filters.feed || !!filters.priceMin || !!filters.priceMax;
  const toggleRoom = (r: number) => setFilters({ ...filters, rooms: filters.rooms.includes(r) ? filters.rooms.filter((x) => x !== r) : [...filters.rooms, r] });

  return (
    <YMaps query={{ apikey: 'c3af7e4b-4ca3-4229-92c7-9ad4abd70c6a', lang: 'ru_RU' }}>
      <div className="flex flex-col md:flex-row h-full bg-[#FDF9F3] text-[#1E1B13]">
        <div className="relative h-[45dvh] shrink-0 md:h-full md:flex-1">
          <YMap defaultState={{ bounds: [[54.25, 19.9], [55.35, 22.9]], behaviors: ['drag', 'dblClickZoom'] }} options={{ suppressMapOpenBlock: true, restrictBounds: true }} style={{ width: '100%', height: '100%' }}>
            {groups.map((g) => (
              <Placemark key={g.address} geometry={[g.lat, g.lng]} properties={{ iconContent: g.items.length + ' · ' + priceSuffix(g.minPrice), hintContent: g.address, balloonContent: balloonHtml(g) }} options={{ preset: selectedAddress === g.address ? 'islands#redStretchyIcon' : 'islands#blueStretchyIcon', balloonMaxWidth: 320 }} onClick={() => setSelectedAddress(g.address)} />
            ))}
          <ZoomControl />
          </YMap>
        </div>
        <aside className="flex-1 min-h-0 w-full md:flex-none md:w-[480px] bg-[#F4EEE3] border-t md:border-t-0 md:border-l border-[#E0D7C8] flex flex-col">
          {selectedGroup ? (
            <>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E0D7C8]">
                <button onClick={() => setSelectedAddress(null)} className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#ECE5D8] text-[#4C4639]"><Chevron dir="l" /></button>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{selectedGroup.complex ? '«' + selectedGroup.complex + '» · ' : ''}{selectedGroup.address}</div>
                  <div className="text-xs text-[#4C4639]">{priceSuffix(selectedGroup.minPrice)} · {selectedGroup.items.length} квартир</div>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-3">{[...selectedGroup.items].sort((a, b) => (a.price || Infinity) - (b.price || Infinity)).map((p) => <PropertyCard key={p.id} p={p} />)}</div>
            </>
          ) : (
            <>
              <div className="px-5 pt-5 pb-2 flex items-center justify-between">
                <div><h2 className="text-xl font-medium">Все адреса</h2><p className="text-xs text-[#4C4639] mt-1">{filteredProps.length} объектов · {groups.length} адресов</p></div>
                <button onClick={() => setFiltersOpen(!filtersOpen)} className="flex items-center gap-1 px-3 py-2 rounded-full bg-white border border-[#E0D7C8] text-sm text-[#4C4639]">
                  <svg viewBox="0 0 24 24" className={'w-4 h-4 transition ' + (filtersOpen ? 'rotate-180' : '')} fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M6 9l6 6 6-6" /></svg>
                  Фильтры
                </button>
              </div>
              {filtersOpen && (
                <div className="px-4 pb-3 space-y-2">
                  <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по адресу или ЖК..." className="w-full py-3 px-5 rounded-full bg-white border border-[#E0D7C8] text-sm focus:outline-none focus:border-[#7A5900]" />
                  <div className="grid grid-cols-2 gap-2">
                    <select value={filters.city || ''} onChange={(e) => setFilters({ ...filters, city: e.target.value || null })} className="h-11 px-3 rounded-xl bg-white border border-[#E0D7C8] text-sm"><option value="">Все города</option>{cities.map((c) => <option key={c} value={c}>{c}</option>)}</select>
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
                {[...filteredAddresses].sort((a, b) => (a.minPrice || Infinity) - (b.minPrice || Infinity)).map((g) => (
                  <button key={g.address} onClick={() => setSelectedAddress(g.address)} className="w-full text-left rounded-[20px] bg-white border border-[#E0D7C8] px-4 py-3 hover:shadow-md transition">
                    <div className="font-bold text-[#7A5900] truncate">{g.complex ? '«' + g.complex + '»' : g.address}</div>
                    <div className="text-sm truncate mt-0.5">{g.address}</div>
                    <div className="text-xs text-[#4C4639] mt-0.5">{g.items.length} кв. · {priceSuffix(g.minPrice)} · {g.feedName}</div>
                  </button>
                ))}
                {filteredAddresses.length === 0 && <div className="text-center text-sm text-[#4C4639] py-10">Ничего не найдено.</div>}
              </div>
            </>
          )}
        </aside>
      </div>
    </YMaps>
  );
}

function FavoritesPage() {
  const favs = useFavs();
  const items = useMemo(() => (properties as Property[]).filter((p) => favs.includes(p.id)), [favs]);
  return (
    <main className="max-w-4xl mx-auto px-5 py-6">
      {items.length === 0 ? (
        <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-10 text-center text-[#4C4639]">Пока пусто. Нажимайте ❤️ на карточках.<div className="mt-4"><a href="#/" className="text-[#7A5900] font-medium hover:underline">← К карте</a></div></div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{items.map((p) => <PropertyCard key={p.id} p={p} />)}</div>
      )}
    </main>
  );
}

function MortgageCalculator() {
  const [price, setPrice] = useState(6000000); const [down, setDown] = useState(20); const [years, setYears] = useState(20); const [rate, setRate] = useState(18);
  const principal = price * (1 - down / 100); const m = rate / 100 / 12; const n = years * 12;
  const pay = m > 0 ? (principal * m) / (1 - Math.pow(1 + m, -n)) : principal / n;
  const f = (x: number) => new Intl.NumberFormat('ru-RU').format(Math.round(x));
  return (
    <main className="max-w-3xl mx-auto px-5 py-6">
      <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6 space-y-5">
        <div><label className="text-sm text-[#4C4639]">Стоимость: <b>{f(price)} ₽</b></label><input type="range" min={2000000} max={50000000} step={100000} value={price} onChange={(e) => setPrice(Number(e.target.value))} className="w-full" /></div>
        <div><label className="text-sm text-[#4C4639]">Взнос: <b>{down}%</b></label><input type="range" min={0} max={90} step={5} value={down} onChange={(e) => setDown(Number(e.target.value))} className="w-full" /></div>
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm text-[#4C4639]">Срок, лет</label><input type="number" min={1} max={30} value={years} onChange={(e) => setYears(Number(e.target.value))} className="mt-1 w-full h-11 px-3 rounded-xl bg-white border border-[#E0D7C8]" /></div>
          <div><label className="text-sm text-[#4C4639]">Ставка</label><select value={rate} onChange={(e) => setRate(Number(e.target.value))} className="mt-1 w-full h-11 px-3 rounded-xl bg-white border border-[#E0D7C8]"><option value={18}>Обычная 18%</option><option value={6}>Семейная 6%</option><option value={2}>Льготная 2%</option></select></div>
        </div>
        <div className="rounded-2xl bg-[#FFDEA6] p-5 text-center"><div className="text-sm text-[#261900]">Платёж в месяц</div><div className="text-3xl font-bold text-[#261900]">{f(pay)} ₽</div><div className="text-xs text-[#261900]/70 mt-1">Кредит {f(principal)} ₽ · переплата {f(pay * n - principal)} ₽</div></div>
        <a href="https://coastal-estate.flexbe.ru/" target="_blank" rel="noopener" className="block w-full py-3.5 rounded-full bg-[#7A5900] text-white font-medium text-center">Оставить заявку на ипотеку</a>
      </div>
    </main>
  );
}

function ComplexesPage() {
  const [sel, setSel] = useState<string | null>(null);
  const complexes = useMemo(() => {
    const m: Record<string, Property[]> = {};
    (properties as Property[]).forEach((p) => { if (p.complex) (m[p.complex] = m[p.complex] || []).push(p); });
    return Object.entries(m).map(([name, items]) => {
      const pos = items.map((p) => p.price).filter((x) => x > 0);
      const sea = items.map((p) => p.sea).filter((x) => x != null) as number[];
      return { name, items, minPrice: pos.length ? Math.min(...pos) : 0, city: items[0].city, sea: sea.length ? Math.min(...sea) : null };
    }).sort((a, b) => b.items.length - a.items.length);
  }, []);
  const cur = complexes.find((c) => c.name === sel);
  return (
    <main className="max-w-4xl mx-auto px-5 py-6">
      <h1 className="text-2xl font-serif font-medium mb-4">Жилые комплексы <span className="text-[#7A5900] font-bold">{complexes.length}</span></h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
        {complexes.map((c) => (
          <button key={c.name} onClick={() => setSel(c.name === sel ? null : c.name)} className={'text-left rounded-[20px] bg-white border p-4 transition ' + (sel === c.name ? 'border-[#7A5900] shadow-md' : 'border-[#E0D7C8] hover:shadow-md')}>
            <div className="font-bold text-[#7A5900]">«{c.name}»</div>
            <div className="text-sm mt-0.5">{c.city}</div>
            <div className="text-xs text-[#4C4639] mt-1">{c.items.length} кв. · {priceSuffix(c.minPrice)}{c.sea != null && c.sea <= 5000 ? ' · 🌊 ' + seaLabel(c.sea) : ''}</div>
          </button>
        ))}
      </div>
      {cur && <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">{cur.items.map((p) => <PropertyCard key={p.id} p={p} />)}</div>}
    </main>
  );
}

function AnalyticsPage() {
  const stats = useMemo(() => {
    const all = properties as Property[];
    const priced = all.filter((p) => p.price > 0 && p.area > 0);
    const avg = (a: number[]) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
    const byCity: Record<string, number[]> = {};
    priced.forEach((p) => { (byCity[p.city] = byCity[p.city] || []).push(p.price / p.area); });
    const cities = Object.entries(byCity).map(([c, a]) => ({ c, v: avg(a), n: a.length })).sort((a, b) => b.v - a.v);
    const byRooms: Record<number, number[]> = {};
    priced.forEach((p) => { (byRooms[p.rooms] = byRooms[p.rooms] || []).push(p.price / p.area); });
    const rooms = Object.entries(byRooms).map(([r, a]) => ({ r: Number(r), v: avg(a), n: a.length }));
    return { total: all.length, avgM2: avg(priced.map((p) => p.price / p.area)), cities, rooms, max: Math.max(...cities.map((x) => x.v)) };
  }, []);
  const f = (x: number) => new Intl.NumberFormat('ru-RU').format(Math.round(x));
  return (
    <main className="max-w-4xl mx-auto px-5 py-6 space-y-5">
      <h1 className="text-2xl font-serif font-medium">Аналитика рынка</h1>
      <div className="grid grid-cols-2 gap-3">
        <Stat label="Всего объектов" value={String(stats.total)} />
        <Stat label="Средняя цена м²" value={f(stats.avgM2) + ' ₽'} />
      </div>
      <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-6">
        <h3 className="text-sm font-medium uppercase tracking-wider text-[#4C4639] mb-4">Цена м² по городам</h3>
        {stats.cities.map((c) => (
          <div key={c.c} className="mb-3">
            <div className="flex justify-between text-sm"><span>{c.c}</span><b>{f(c.v)} ₽</b></div>
            <div className="h-2 rounded-full bg-[#F4EEE3] mt-1"><div className="h-2 rounded-full bg-[#7A5900]" style={{ width: (c.v / stats.max) * 100 + '%' }} /></div>
          </div>
        ))}
      </div>
      <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-6">
        <h3 className="text-sm font-medium uppercase tracking-wider text-[#4C4639] mb-4">Цена м² по комнатам</h3>
        {stats.rooms.map((r) => (
          <div key={r.r} className="mb-3">
            <div className="flex justify-between text-sm"><span>{roomLabel(r.r)}</span><b>{f(r.v)} ₽</b></div>
            <div className="h-2 rounded-full bg-[#F4EEE3] mt-1"><div className="h-2 rounded-full bg-[#B26A00]" style={{ width: (r.v / stats.max) * 100 + '%' }} /></div>
          </div>
        ))}
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
    <main className="max-w-3xl mx-auto px-5 py-6 space-y-5">
      <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-6">
        <h1 className="text-2xl font-serif font-medium">Новостройки <span className="text-[#7A5900] font-bold">39</span></h1>
        <p className="text-[#4C4639] mt-3 leading-relaxed">Агрегатор новостроек Калининградской области. Мы собираем квартиры напрямую от застройщиков — КалининградСтройИнвест, К8, КСК 39 — и показываем их на одной карте с актуальными ценами, планировками и фото. Данные обновляются автоматически каждые 6 часов.</p>
      </div>
      <div className="rounded-[28px] bg-white border border-[#E0D7C8] p-6">
        <h3 className="text-sm font-medium uppercase tracking-wider text-[#4C4639] mb-3">Контакты</h3>
        <a href={'tel:' + PHONE.replace(/[^+0-9]/g, '')} className="block text-xl font-bold text-[#7A5900]">{PHONE}</a>
        <a href="https://coastal-estate.flexbe.ru/" target="_blank" rel="noopener" className="inline-block mt-3 px-5 py-3 rounded-full bg-[#FFDEA6] text-[#261900] font-medium">Оставить заявку</a>
      </div>
    </main>
  );
}

export default function MapView() {
  const hash = useHash();
  const propertyId = hash.indexOf('#/property/') === 0 ? decodeURIComponent(hash.slice(11)) : null;
  const propertyPage = useMemo(() => (propertyId ? ((properties as Property[]).find((p) => p.id === propertyId) || null) : null), [propertyId]);

  let content: React.ReactNode;
  let isMap = false;
  if (hash === '#/calc') content = <MortgageCalculator />;
  else if (hash === '#/favorites') content = <FavoritesPage />;
  else if (hash === '#/complexes') content = <ComplexesPage />;
  else if (hash === '#/analytics') content = <AnalyticsPage />;
  else if (hash === '#/budget') content = <BudgetPage />;
  else if (hash === '#/about') content = <AboutPage />;
  else if (hash === '#/compare') content = <ComparePage />;
  else if (propertyPage) content = <PropertyPage property={propertyPage} />;
  else { content = <MapScreen />; isMap = true; }

  return (
    <div className={(isMap ? 'h-[100dvh] overflow-hidden' : 'min-h-[100dvh]') + ' bg-[#FDF9F3] text-[#1E1B13] flex flex-col'}>
      <Header hash={hash} />
      <div className={isMap ? 'flex-1 min-h-0 overflow-hidden' : ''}>{content}</div>
      <CompareBar />
    </div>
  );
}
