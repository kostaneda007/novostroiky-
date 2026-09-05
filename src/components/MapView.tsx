import { useEffect, useMemo, useState } from 'react';
import { YMaps, Map as YMap, Placemark } from '@pbe/react-yandex-maps';
import properties from '../data/properties.json';

type Property = {
  id: string;
  price: number;
  title: string;
  description: string;
  address: string;
  lat: number;
  lng: number;
  rooms: number;
  area: number;
  floor: string;
  totalFloors: string;
  feedName: string;
  images: string[];
  phone: string;
  url: string;
  seller: string;
};

type Group = {
  address: string;
  items: Property[];
  lat: number;
  lng: number;
  minPrice: number;
  feedName: string;
};

const DEFAULT_PHONE = '+7 950 673-25-68';
const formatPrice = (price: number) => new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
const formatMln = (price: number) => (price / 1000000).toFixed(1).replace('.', ',') + ' млн';
const priceSuffix = (min: number) => (min > 0 ? 'от ' + formatMln(min) : 'цена по запросу');
const propertyUrl = (p: Property) => '#/property/' + encodeURIComponent(p.id);

function useHash() {
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return hash;
}

function balloonHtml(g: Group) {
  const rows = g.items.filter((p) => p.price > 0).slice(0, 5).map((p) =>
    '<div style="margin:6px 0;border-bottom:1px solid #eee;padding-bottom:6px"><b>' +
    formatPrice(p.price) + '</b><br/><span style="color:#888">' +
    (p.rooms === 0 ? 'Студия' : p.rooms + '-комн.') + ' · ' + p.area + ' м²</span></div>'
  ).join('');
  const more = g.items.length > 5 ? '<div style="color:#2563eb;margin-top:8px">ещё ' + (g.items.length - 5) + ' объявлений</div>' : '';
  return '<div style="max-width:280px;font-family:sans-serif"><div style="font-weight:700;font-size:16px;margin-bottom:4px">' +
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
      <div className="flex h-screen bg-neutral-950 text-neutral-100">
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
          <div className="absolute top-4 left-4 bg-neutral-950/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-4 py-3">
            <h1 className="text-xl font-serif tracking-wide">Новостройки <span className="text-amber-400">39</span></h1>
            <p className="text-xs text-neutral-400 mt-1">{(properties as Property[]).length} объектов · {groups.length} адресов</p>
          </div>
        </div>

        <aside className="w-[480px] bg-neutral-950 border-l border-neutral-800 flex flex-col">
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
  const [img, setImg] = useState(0);
  const imgs = property.images;
  const phone = property.phone || DEFAULT_PHONE;
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <header className="sticky top-0 z-10 bg-neutral-950/90 backdrop-blur border-b border-neutral-800">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <a href="#/" className="text-neutral-400 hover:text-amber-400 transition text-sm">← К карте</a>
          <div className="font-serif tracking-wide">Новостройки <span className="text-amber-400">39</span></div>
        </div>
      </header>
      <main className="max-w-4xl mx-auto px-5 py-6 space-y-6">
        {imgs.length > 0 && (
          <img src={imgs[img] || imgs[0]} alt={property.title} className="w-full max-h-[560px] object-contain rounded-xl bg-neutral-900" />
        )}
        {imgs.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {imgs.map((u, i) => (
              <button key={i} onClick={() => setImg(i)} className={'shrink-0 rounded overflow-hidden border ' + (i === img ? 'border-amber-400' : 'border-neutral-800')}>
                <img src={u} alt="" className="w-24 h-16 object-cover" />
              </button>
            ))}
          </div>
        )}
        <div>
          <div className="text-amber-400 font-serif text-4xl mb-2">{property.price > 0 ? formatPrice(property.price) : 'Цена по запросу'}</div>
          <div className="text-neutral-300">{property.address}</div>
          <div className="text-neutral-500 text-sm mt-1">{property.feedName} · {property.seller}</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Комнат" value={property.rooms === 0 ? 'Студия' : String(property.rooms)} />
          <Stat label="Площадь" value={property.area > 0 ? property.area + ' м²' : '—'} />
          <Stat label="Этаж" value={property.floor ? property.floor + (property.totalFloors ? '/' + property.totalFloors : '') : '—'} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <a href={'tel:' + phone.replace(/[^+0-9]/g, '')} className="bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-center py-4 rounded-lg transition">
            Позвонить: {phone}
          </a>
          <a href={'https://coastal-estate.flexbe.ru/?property_id=' + property.id + '&price=' + property.price + '&address=' + encodeURIComponent(property.address)} target="_blank" rel="noopener" className="border border-amber-500 text-amber-400 hover:bg-amber-500/10 font-semibold text-center py-4 rounded-lg transition">
            Оставить заявку на просмотр
          </a>
        </div>
        {property.description && (
          <div>
            <h3 className="text-sm uppercase tracking-wider text-neutral-500 mb-3">Описание</h3>
            <p className="text-neutral-300 leading-relaxed whitespace-pre-line">{property.description}</p>
          </div>
        )}
      </main>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-3">
      <div className="text-xs text-neutral-500 uppercase tracking-wide">{label}</div>
      <div className="text-neutral-100 font-medium mt-1">{value}</div>
    </div>
  );
}

function AddressCards({ group, onClose }: { group: Group; onClose: () => void }) {
  const sorted = [...group.items].sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <button onClick={onClose} className="text-neutral-400 hover:text-amber-400 transition text-sm">← Все адреса</button>
        <span className="text-xs text-neutral-500">{group.items.length} квартир</span>
      </div>
      <div className="px-5 py-3 border-b border-neutral-800 bg-neutral-900/50">
        <div className="text-amber-400 font-serif text-xl">{group.address}</div>
        <div className="text-sm text-neutral-400 mt-1">{priceSuffix(group.minPrice)} · {group.feedName}</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((p) => (
          <a key={p.id} href={propertyUrl(p)} target="_blank" rel="noopener" className="block w-full text-left px-5 py-4 border-b border-neutral-900 hover:bg-neutral-900 transition">
            <div className="flex gap-3">
              {p.images[0] ? (
                <img src={p.images[0]} alt="" className="w-24 h-20 object-cover rounded-lg shrink-0" />
              ) : (
                <div className="w-24 h-20 bg-neutral-900 rounded-lg shrink-0 flex items-center justify-center text-neutral-600 text-xs">нет фото</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-amber-400 font-medium">{p.price > 0 ? formatPrice(p.price) : 'Цена по запросу'}</div>
                <div className="text-sm text-neutral-300 mt-0.5">{p.rooms === 0 ? 'Студия' : p.rooms + '-комн.'} · {p.area > 0 ? p.area + ' м²' : ''} {p.floor ? '· эт. ' + p.floor : ''}</div>
                <div className="text-xs text-neutral-500 mt-1 truncate">{p.title}</div>
              </div>
              <span className="text-neutral-600">↗</span>
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
      <div className="px-5 py-4 border-b border-neutral-800">
        <h2 className="text-lg font-serif">Все адреса</h2>
        <p className="text-xs text-neutral-500 mt-1">{groups.length} адресов</p>
      </div>
      <div className="px-5 py-3 border-b border-neutral-800">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по адресу или ЖК..." className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((g) => (
          <button key={g.address} onClick={() => onSelect(g.address)} className="w-full text-left px-5 py-4 border-b border-neutral-900 hover:bg-neutral-900 transition group">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-amber-400 font-medium">{g.items.length} кв. · {priceSuffix(g.minPrice)}</div>
                <div className="text-sm text-neutral-300 truncate mt-0.5">{g.address}</div>
                <div className="text-xs text-neutral-500 mt-1">{g.feedName}</div>
              </div>
              <span className="text-neutral-600 group-hover:text-amber-400 transition">→</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
