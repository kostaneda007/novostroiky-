import { useEffect, useMemo, useState } from 'react';
import { YMaps, Map as YMap, Placemark } from '@pbe/react-yandex-maps';
import properties from '../data/properties.json';

type Property = {
  id: string; price: number; title: string; description: string; address: string;
  lat: number; lng: number; rooms: number; area: number; floor: string; totalFloors: string;
  feedName: string; images: string[]; phone: string; url: string; seller: string;
};

type Group = { address: string; items: Property[]; lat: number; lng: number; minPrice: number; feedName: string };

const formatPrice = (price: number) => new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
const formatMln = (price: number) => (price / 1000000).toFixed(1).replace('.', ',') + ' млн';
const priceSuffix = (min: number) => (min > 0 ? 'от ' + formatMln(min) : 'цена по запросу');
const PHONE = '+7 950 673-25-68';

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

function PhotoSlider({ images, alt }: { images: string[]; alt: string }) {
  const [i, setI] = useState(0);
  if (!images.length) return null;
  const prev = () => setI((v) => (v - 1 + images.length) % images.length);
  const next = () => setI((v) => (v + 1) % images.length);
  return (
    <div>
      <div className="relative rounded-[28px] overflow-hidden bg-[#F4EEE3] border border-[#E0D7C8]">
        <img src={images[i]} alt={alt} className="w-full h-[300px] sm:h-[440px] object-contain" />
        {images.length > 1 && (
          <>
            <button onClick={prev} aria-label="Предыдущее фото" className="absolute left-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[#1E1B13] hover:bg-[#FFDEA6] transition">
              <Chevron dir="l" />
            </button>
            <button onClick={next} aria-label="Следующее фото" className="absolute right-3 top-1/2 -translate-y-1/2 w-11 h-11 rounded-full bg-white/95 shadow-md flex items-center justify-center text-[#1E1B13] hover:bg-[#FFDEA6] transition">
              <Chevron dir="r" />
            </button>
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#1E1B13]/60 text-white text-xs font-medium">{i + 1} / {images.length}</div>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto mt-3 pb-1">
          {images.map((u, k) => (
            <button key={k} onClick={() => setI(k)} className={'shrink-0 rounded-xl overflow-hidden border-2 ' + (k === i ? 'border-[#7A5900]' : 'border-transparent opacity-70 hover:opacity-100')}>
              <img src={u} alt="" className="w-20 h-14 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
    g.address + '</div>' + rows + more + '</div>';
}

export default function MapView() {
  const hash = useHash();
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  const propertyId = hash.indexOf('#/property/') === 0 ? decodeURIComponent(hash.slice(11)) : null;
  const propertyPage = useMemo(
    () => (propertyId ? ((properties as Property[]).find((p) => p.id === propertyId) || null) : null),
    [propertyId]
  );

  const groups = useMemo<Group[]>(() => {
    const grouped: Record<string, Property[]> = {};
    for (const p of properties as Property[]) {
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
      };
    });
  }, []);

  const selectedGroup = useMemo(() => groups.find((g) => g.address === selectedAddress) || null, [groups, selectedAddress]);

  const center = useMemo(() => {
    if (groups.length === 0) return [54.9392, 20.1405] as [number, number];
    const lat = groups.reduce((s, g) => s + g.lat, 0) / groups.length;
    const lng = groups.reduce((s, g) => s + g.lng, 0) / groups.length;
    return [lat, lng] as [number, number];
  }, [groups]);

  const filteredAddresses = useMemo(() => {
    if (!query) return groups;
    const q = query.toLowerCase();
    return groups.filter((g) => g.address.toLowerCase().includes(q) || g.feedName.toLowerCase().includes(q));
  }, [groups, query]);

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
            <p className="text-xs text-[#4C4639] mt-1">{(properties as Property[]).length} объектов · {groups.length} адресов</p>
          </div>
        </div>

        <aside className="w-[480px] bg-[#F4EEE3] border-l border-[#E0D7C8] flex flex-col">
          {selectedGroup ? (
            <AddressCards group={selectedGroup} onClose={() => setSelectedAddress(null)} />
          ) : (
            <AddressList groups={filteredAddresses} query={query} setQuery={setQuery} onSelect={(a) => setSelectedAddress(a)} />
          )}
        </aside>
      </div>
    </YMaps>
  );
}

function PropertyPage({ property }: { property: Property }) {
  return (
    <div className="min-h-screen bg-[#FDF9F3] text-[#1E1B13]">
      <header className="sticky top-0 z-10 bg-[#FDF9F3]/95 backdrop-blur border-b border-[#E0D7C8]">
        <div className="max-w-4xl mx-auto px-5 h-16 flex items-center justify-between">
          <a href="#/" className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#ECE5D8] transition text-[#4C4639]" aria-label="К карте">
            <Chevron dir="l" />
          </a>
          <div className="text-lg font-medium">Новостройки <span className="text-[#7A5900] font-bold">39</span></div>
          <div className="w-11" />
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-6 space-y-5">
        <PhotoSlider images={property.images} alt={property.title} />
        <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6">
          <div className="text-[#7A5900] font-bold text-3xl mb-2">{property.price > 0 ? formatPrice(property.price) : 'Цена по запросу'}</div>
          <div className="text-lg text-[#1E1B13]">{property.address}</div>
          <div className="text-sm text-[#4C4639] mt-1">{property.feedName} · {property.seller}</div>
          <div className="grid grid-cols-3 gap-3 mt-5">
            <Stat label="Комнат" value={property.rooms === 0 ? 'Студия' : String(property.rooms)} />
            <Stat label="Площадь" value={property.area > 0 ? property.area + ' м²' : '—'} />
            <Stat label="Этаж" value={property.floor ? property.floor + (property.totalFloors ? '/' + property.totalFloors : '') : '—'} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
            <a href={'tel:' + PHONE.replace(/[^+0-9]/g, '')} className="h-13 py-3.5 rounded-full bg-[#7A5900] text-white font-medium text-center hover:shadow-lg transition">
              Позвонить: {PHONE}
            </a>
            <a href={'https://coastal-estate.flexbe.ru/?property_id=' + property.id + '&price=' + property.price + '&address=' + encodeURIComponent(property.address)} target="_blank" rel="noopener" className="py-3.5 rounded-full bg-[#FFDEA6] text-[#261900] font-medium text-center hover:shadow-lg transition">
              Оставить заявку на просмотр
            </a>
          </div>
        </div>
        {property.description && (
          <div className="rounded-[28px] bg-white border border-[#E0D7C8] shadow-sm p-6">
            <h3 className="text-sm font-medium uppercase tracking-wider text-[#4C4639] mb-3">Описание</h3>
            <p className="text-[#1E1B13] leading-relaxed whitespace-pre-line">{property.description}</p>
          </div>
        )}
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

function AddressCards({ group, onClose }: { group: Group; onClose: () => void }) {
  const sorted = [...group.items].sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  return (
    <>
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#E0D7C8]">
        <button onClick={onClose} className="w-11 h-11 rounded-full flex items-center justify-center hover:bg-[#ECE5D8] transition text-[#4C4639]" aria-label="Назад">
          <Chevron dir="l" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="font-medium truncate">{group.address}</div>
          <div className="text-xs text-[#4C4639]">{priceSuffix(group.minPrice)} · {group.items.length} квартир</div>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {sorted.map((p) => (
          <a key={p.id} href={'#/property/' + encodeURIComponent(p.id)} target="_blank" rel="noopener" className="flex gap-3 rounded-[20px] bg-white border border-[#E0D7C8] p-3 hover:shadow-md transition">
            {p.images[0] ? (
              <img src={p.images[0]} alt="" className="w-24 h-24 object-cover rounded-2xl shrink-0" />
            ) : (
              <div className="w-24 h-24 bg-[#F4EEE3] rounded-2xl shrink-0 flex items-center justify-center text-[#7E7669] text-xs">нет фото</div>
            )}
            <div className="flex-1 min-w-0">
              <div className="text-[#7A5900] font-bold">{p.price > 0 ? formatPrice(p.price) : 'Цена по запросу'}</div>
              <div className="text-sm text-[#1E1B13] mt-0.5">{p.rooms === 0 ? 'Студия' : p.rooms + '-комн.'} · {p.area > 0 ? p.area + ' м²' : ''} {p.floor ? '· эт. ' + p.floor : ''}</div>
              <div className="text-xs text-[#4C4639] mt-1 truncate">{p.title}</div>
            </div>
          </a>
        ))}
      </div>
    </>
  );
}

function AddressList({ groups, query, setQuery, onSelect }: { groups: Group[]; query: string; setQuery: (v: string) => void; onSelect: (a: string) => void }) {
  const sorted = [...groups].sort((a, b) => (a.minPrice || Infinity) - (b.minPrice || Infinity));
  return (
    <>
      <div className="px-5 pt-5 pb-3">
        <h2 className="text-xl font-medium">Все адреса</h2>
        <p className="text-xs text-[#4C4639] mt-1">{groups.length} адресов</p>
      </div>
      <div className="px-4 pb-3">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по адресу или ЖК..." className="w-full h-13 py-3 px-5 rounded-full bg-white border border-[#E0D7C8] text-sm focus:outline-none focus:border-[#7A5900]" />
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-2">
        {sorted.map((g) => (
          <button key={g.address} onClick={() => onSelect(g.address)} className="w-full text-left rounded-[20px] bg-white border border-[#E0D7C8] px-4 py-3 hover:shadow-md transition">
            <div className="text-[#7A5900] font-bold">{g.items.length} кв. · {priceSuffix(g.minPrice)}</div>
            <div className="text-sm text-[#1E1B13] truncate mt-0.5">{g.address}</div>
            <div className="text-xs text-[#4C4639] mt-0.5">{g.feedName}</div>
          </button>
        ))}
      </div>
    </>
  );
}
