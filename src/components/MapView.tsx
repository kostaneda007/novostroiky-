import { useMemo, useState } from 'react';
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
  feedId: string;
};

type Group = {
  address: string;
  items: Property[];
  lat: number;
  lng: number;
  minPrice: number;
  feedId: string;
};

const formatPrice = (price: number) => new Intl.NumberFormat('ru-RU').format(price) + ' ₽';
const formatMln = (price: number) => (price / 1000000).toFixed(1).replace('.', ',') + ' млн';

function balloonHtml(g: Group) {
  const rows = g.items.slice(0, 5).map((p) =>
    '<div style="margin:6px 0;border-bottom:1px solid #eee;padding-bottom:6px"><b>' +
    formatPrice(p.price) +
    '</b><br/><span style="color:#888">' +
    (p.rooms === 0 ? 'Студия' : p.rooms + '-комн.') +
    ' · ' + p.area + ' м² · эт. ' + p.floor +
    '</span></div>'
  ).join('');
  const more = g.items.length > 5
    ? '<div style="color:#2563eb;margin-top:8px">ещё ' + (g.items.length - 5) + ' объявлений</div>'
    : '';
  return '<div style="max-width:280px;font-family:sans-serif">' +
    '<div style="font-weight:700;font-size:16px;margin-bottom:4px">' +
    g.items.length + ' квартир · от ' + formatMln(g.minPrice) + '</div>' +
    '<div style="color:#555;margin-bottom:8px">' + g.address + '</div>' +
    rows + more + '</div>';
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
    return Object.entries(grouped).map(([address, items]) => ({
      address,
      items,
      lat: items.reduce((s, p) => s + p.lat, 0) / items.length,
      lng: items.reduce((s, p) => s + p.lng, 0) / items.length,
      minPrice: Math.min(...items.map((p) => p.price)),
      feedId: items[0].feedId,
    }));
  }, []);

  const selectedGroup = useMemo(() => 
    groups.find((g) => g.address === selectedAddress) || null,
    [groups, selectedAddress]
  );

  const center = useMemo(() => {
    if (groups.length === 0) return [54.9392, 20.1405] as [number, number];
    const lat = groups.reduce((s, g) => s + g.lat, 0) / groups.length;
    const lng = groups.reduce((s, g) => s + g.lng, 0) / groups.length;
    return [lat, lng] as [number, number];
  }, [groups]);

  const filteredAddresses = useMemo(() => {
    if (!query) return groups;
    const q = query.toLowerCase();
    return groups.filter((g) => 
      g.address.toLowerCase().includes(q) || 
      g.items.some((i) => i.feedName.toLowerCase().includes(q))
    );
  }, [groups, query]);

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
                  iconContent: g.items.length + ' · от ' + formatMln(g.minPrice),
                  hintContent: g.address,
                  balloonContent: balloonHtml(g),
                }}
                options={{
                  preset: selectedAddress === g.address 
                    ? 'islands#redStretchyIcon' 
                    : 'islands#blueStretchyIcon',
                  balloonMaxWidth: 320,
                }}
                onClick={() => setSelectedAddress(g.address)}
              />
            ))}
          </YMap>

          <div className="absolute top-4 left-4 bg-neutral-950/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-4 py-3">
            <h1 className="text-xl font-serif tracking-wide">
              Coastal <span className="text-amber-400">Estate</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              {(properties as Property[]).length} объектов · {groups.length} адресов
            </p>
          </div>
        </div>

        <aside className="w-[480px] bg-neutral-950 border-l border-neutral-800 flex flex-col">
          {selectedGroup ? (
            <AddressCards 
              group={selectedGroup} 
              onClose={() => setSelectedAddress(null)} 
            />
          ) : (
            <AddressList 
              groups={filteredAddresses}
              query={query}
              setQuery={setQuery}
              onSelect={setSelectedAddress}
            />
          )}
        </aside>
      </div>
    </YMaps>
  );
}

function AddressCards({ group, onClose }: { group: Group; onClose: () => void }) {
  const sorted = [...group.items].sort((a, b) => a.price - b.price);
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <button onClick={onClose} className="text-neutral-400 hover:text-amber-400 transition text-sm">
          ← Все адреса
        </button>
        <span className="text-xs text-neutral-500">{group.items.length} квартир</span>
      </div>
      <div className="px-5 py-3 border-b border-neutral-800 bg-neutral-900/50">
        <div className="text-amber-400 font-serif text-2xl">
          {group.address}
        </div>
        <div className="text-sm text-neutral-400 mt-1">
          от {formatPrice(group.minPrice)}
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((p) => (
          <div key={p.id} className="px-5 py-4 border-b border-neutral-900 hover:bg-neutral-900/50 transition">
            {p.images[0] && (
              <img 
                src={p.images[0]} 
                alt={p.title} 
                className="w-full h-48 object-cover rounded-lg mb-3" 
              />
            )}
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex-1">
                <div className="text-amber-400 font-serif text-xl">
                  {formatPrice(p.price)}
                </div>
                <div className="text-sm text-neutral-300 mt-1">
                  {p.rooms === 0 ? 'Студия' : p.rooms + '-комн.'} · {p.area} м²
                  {p.floor && ` · эт. ${p.floor}${p.totalFloors ? '/' + p.totalFloors : ''}`}
                </div>
              </div>
            </div>
            {p.description && (
              <p className="text-xs text-neutral-500 line-clamp-3 mt-2">
                {p.description.replace(/\s+/g, ' ')}
              </p>
            )}
            {p.images.length > 1 && (
              <div className="flex gap-1 mt-2 flex-wrap">
                {p.images.slice(0, 4).map((img, idx) => (
                  <img 
                    key={idx} 
                    src={img} 
                    alt="" 
                    className="w-12 h-12 object-cover rounded" 
                  />
                ))}
                {p.images.length > 4 && (
                  <div className="w-12 h-12 bg-neutral-800 rounded flex items-center justify-center text-xs text-neutral-400">
                    +{p.images.length - 4}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </>
  );
}

function AddressList({ 
  groups, 
  query, 
  setQuery, 
  onSelect 
}: { 
  groups: Group[]; 
  query: string; 
  setQuery: (v: string) => void; 
  onSelect: (addr: string) => void;
}) {
  const sorted = [...groups].sort((a, b) => a.minPrice - b.minPrice);
  return (
    <>
      <div className="px-5 py-4 border-b border-neutral-800">
        <h2 className="text-lg font-serif">Все адреса</h2>
        <p className="text-xs text-neutral-500 mt-1">{groups.length} адресов</p>
      </div>
      <div className="px-5 py-3 border-b border-neutral-800">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по адресу или ЖК..."
          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        />
      </div>
      <div className="flex-1 overflow-y-auto">
        {sorted.map((g) => (
          <button
            key={g.address}
            onClick={() => onSelect(g.address)}
            className="w-full text-left px-5 py-4 border-b border-neutral-900 hover:bg-neutral-900 transition group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-amber-400 font-medium">
                  {g.items.length} кв. · от {formatMln(g.minPrice)}
                </div>
                <div className="text-sm text-neutral-300 truncate mt-0.5">
                  {g.address}
                </div>
                <div className="text-xs text-neutral-500 mt-1">
                  {g.feedName}
                </div>
              </div>
              <span className="text-neutral-600 group-hover:text-amber-400 transition">
                →
              </span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
