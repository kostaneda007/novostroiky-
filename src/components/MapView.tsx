import { useMemo, useState } from 'react';
import { YMaps, Map as YMap, Placemark } from '@pbe/react-yandex-maps';
import properties from '../data/properties.json';

type Property = {
  id: string; price: number; title: string; description: string; address: string;
  lat: number; lng: number; rooms: number; area: number; floor: string; totalFloors: string;
  feedName: string; images: string[]; phone: string; url: string; seller: string;
};

type Group = { address: string; items: Property[]; lat: number; lng: number; minPrice: number; feedName: string };

const BASE = import.meta.env.BASE_URL;
const formatPrice = (price: number) => new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
const formatMln = (price: number) => (price / 1000000).toFixed(1).replace('.', ',') + ' млн';
const priceSuffix = (min: number) => (min > 0 ? 'от ' + formatMln(min) : 'цена по запросу');
const propertyHref = (p: Property) => BASE + 'property/' + p.id + '.html';

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
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [query, setQuery] = useState('');

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

  return (
    <YMaps query={{ apikey: 'c3af7e4b-4ca3-4229-92c7-9ad4abd70c6a', lang: 'ru_RU' }}>
      <div className="flex h-screen bg-neutral-100 text-neutral-900">
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
          <div className="absolute top-4 left-4 bg-white/90 backdrop-blur border border-neutral-200 shadow-sm rounded-lg px-4 py-3">
            <h1 className="text-xl font-serif tracking-wide">Новостройки <span className="text-amber-600">39</span></h1>
            <p className="text-xs text-neutral-500 mt-1">{(properties as Property[]).length} объектов · {groups.length} адресов</p>
          </div>
        </div>

        <aside className="w-[480px] bg-white border-l border-neutral-200 flex flex-col">
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

function AddressCards({ group, onClose }: { group: Group; onClose: () => void }) {
  const sorted = [...group.items].sort((a, b) => (a.price || Infinity) - (b.price || Infinity));
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-200">
        <button onClick={onClose} className="text-neutral-500 hover:text-amber-600 transition text-sm">← Все адреса</button>
        <span className="text-xs text-neutral-400">{group.items.length} квартир</span>
      </div>
      <div className="px-5 py-3 border-b border-neutral-200 bg-neutral-50">
        <div className="text-amber-600 font-serif text-xl">{group.address}</div>
        <div className="text-sm text-neutral-500 mt-1">{priceSuffix(group.minPrice)} · {group.feedName}</div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((p) => (
          <a key={p.id} href={propertyHref(p)} target="_blank" rel="noopener" className="block w-full text-left px-5 py-4 border-b border-neutral-100 hover:bg-neutral-50 transition">
            <div className="flex gap-3">
              {p.images[0] ? (
                <img src={p.images[0]} alt="" className="w-24 h-20 object-cover rounded-lg shrink-0 border border-neutral-200" />
              ) : (
                <div className="w-24 h-20 bg-neutral-100 rounded-lg shrink-0 flex items-center justify-center text-neutral-400 text-xs">нет фото</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-amber-600 font-semibold">{p.price > 0 ? formatPrice(p.price) : 'Цена по запросу'}</div>
                <div className="text-sm text-neutral-700 mt-0.5">{p.rooms === 0 ? 'Студия' : p.rooms + '-комн.'} · {p.area > 0 ? p.area + ' м²' : ''} {p.floor ? '· эт. ' + p.floor : ''}</div>
                <div className="text-xs text-neutral-400 mt-1 truncate">{p.title}</div>
              </div>
              <span className="text-neutral-300">↗</span>
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
      <div className="px-5 py-4 border-b border-neutral-200">
        <h2 className="text-lg font-serif">Все адреса</h2>
        <p className="text-xs text-neutral-400 mt-1">{groups.length} адресов</p>
      </div>
      <div className="px-5 py-3 border-b border-neutral-200">
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Поиск по адресу или ЖК..." className="w-full bg-white border border-neutral-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500" />
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((g) => (
          <button key={g.address} onClick={() => onSelect(g.address)} className="w-full text-left px-5 py-4 border-b border-neutral-100 hover:bg-neutral-50 transition group">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-amber-600 font-semibold">{g.items.length} кв. · {priceSuffix(g.minPrice)}</div>
                <div className="text-sm text-neutral-700 truncate mt-0.5">{g.address}</div>
                <div className="text-xs text-neutral-400 mt-1">{g.feedName}</div>
              </div>
              <span className="text-neutral-300 group-hover:text-amber-600 transition">→</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
