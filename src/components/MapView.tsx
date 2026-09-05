import { useMemo, useState } from 'react';
import { YMaps, Map, Placemark } from '@pbe/react-yandex-maps';
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
};

type Group = {
  address: string;
  items: Property[];
  lat: number;
  lng: number;
  minPrice: number;
};

const formatPrice = (price: number) =>
  new Intl.NumberFormat('ru-RU').format(price) + ' ₽';

const formatMln = (price: number) =>
  (price / 1000000).toFixed(1).replace('.', ',') + ' млн';

function balloonHtml(g: Group) {
  const rows = g.items
    .slice(0, 5)
    .map(
      (p) =>
        '<div style="margin:6px 0;border-bottom:1px solid #eee;padding-bottom:6px"><b>' +
        formatPrice(p.price) +
        '</b><br/><span style="color:#888">' +
        (p.rooms === 0 ? 'Студия' : p.rooms + '-комн.') +
        ' · ' + p.area + ' м² · эт. ' + p.floor +
        '</span></div>'
    )
    .join('');
  const more =
    g.items.length > 5
      ? '<div style="color:#2563eb;margin-top:8px">ещё ' + (g.items.length - 5) + ' объявлений</div>'
      : '';
  return (
    '<div style="max-width:280px;font-family:sans-serif">' +
    '<div style="font-weight:700;font-size:16px;margin-bottom:4px">' +
    g.items.length + ' квартир · от ' + formatMln(g.minPrice) + '</div>' +
    '<div style="color:#555;margin-bottom:8px">' + g.address + '</div>' +
    rows + more + '</div>'
  );
}

export default function MapView() {
  const [selected, setSelected] = useState<Property | null>(null);

  const groups = useMemo<Group[]>(() => {
    const map = new Map<string, Property[]>();
    for (const p of properties as Property[]) {
      const arr = map.get(p.address);
      if (arr) arr.push(p);
      else map.set(p.address, [p]);
    }
    return Array.from(map.entries()).map(([address, items]) => ({
      address,
      items,
      lat: items.reduce((s, p) => s + p.lat, 0) / items.length,
      lng: items.reduce((s, p) => s + p.lng, 0) / items.length,
      minPrice: Math.min(...items.map((p) => p.price)),
    }));
  }, []);

  const center = useMemo(() => {
    if (groups.length === 0) return [54.9392, 20.1405] as [number, number];
    const lat = groups.reduce((s, g) => s + g.lat, 0) / groups.length;
    const lng = groups.reduce((s, g) => s + g.lng, 0) / groups.length;
    return [lat, lng] as [number, number];
  }, [groups]);

  return (
    <YMaps query={{ apikey: 'c3af7e4b-4ca3-4229-92c7-9ad4abd70c6a', lang: 'ru_RU' }}>
      <div className="flex h-screen bg-neutral-950 text-neutral-100">
        <div className="flex-1 relative">
          <Map
            defaultState={{ center, zoom: 11 }}
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
                  preset: 'islands#blueStretchyIcon',
                  balloonMaxWidth: 320,
                }}
              />
            ))}
          </Map>

          <div className="absolute top-4 left-4 bg-neutral-950/80 backdrop-blur-sm border border-neutral-800 rounded-lg px-4 py-3">
            <h1 className="text-xl font-serif tracking-wide">
              Coastal <span className="text-amber-400">Estate</span>
            </h1>
            <p className="text-xs text-neutral-400 mt-1">
              Элитная недвижимость на побережье · {properties.length} объектов · {groups.length} адресов
            </p>
          </div>
        </div>

        <aside className="w-[420px] bg-neutral-950 border-l border-neutral-800 flex flex-col">
          {selected ? (
            <PropertyDetail property={selected} onClose={() => setSelected(null)} />
          ) : (
            <PropertyList onSelect={setSelected} />
          )}
        </aside>
      </div>
    </YMaps>
  );
}

function PropertyDetail({ property, onClose }: { property: Property; onClose: () => void }) {
  return (
    <>
      <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-800">
        <button onClick={onClose} className="text-neutral-400 hover:text-amber-400 transition text-sm">
          ← Назад к списку
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {property.images[0] && (
          <img src={property.images[0]} alt={property.title} className="w-full h-64 object-cover rounded-lg" />
        )}
        <div>
          <div className="text-amber-400 font-serif text-3xl mb-2">{formatPrice(property.price)}</div>
          <div className="text-neutral-500 text-sm">{property.address}</div>
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Stat label="Комнат" value={property.rooms === 0 ? 'Студия' : String(property.rooms)} />
          <Stat label="Площадь" value={property.area + ' м²'} />
          <Stat label="Этаж" value={property.floor || '—'} />
        </div>
        <div>
          <h3 className="text-sm uppercase tracking-wider text-neutral-500 mb-2">Описание</h3>
          <p className="text-neutral-300 text-sm leading-relaxed whitespace-pre-line">
            {property.description || 'Описание недоступно'}
          </p>
        </div>
        <a
          href={'https://coastal-estate.flexbe.ru/?property_id=' + property.id + '&price=' + property.price}
          target="_blank"
          rel="noopener"
          className="block w-full bg-amber-500 hover:bg-amber-400 text-neutral-950 font-semibold text-center py-3 rounded-lg transition"
        >
          Оставить заявку
        </a>
      </div>
    </>
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

function PropertyList({ onSelect }: { onSelect: (p: Property) => void }) {
  const [query, setQuery] = useState('');
  const [minPrice, setMinPrice] = useState(0);
  const [maxPrice, setMaxPrice] = useState(100000000);

  const filtered = (properties as Property[]).filter((p) => {
    const matchesQuery = !query || p.address.toLowerCase().includes(query.toLowerCase());
    const matchesPrice = p.price >= minPrice && p.price <= maxPrice;
    return matchesQuery && matchesPrice;
  });

  return (
    <>
      <div className="px-5 py-4 border-b border-neutral-800">
        <h2 className="text-lg font-serif">Все объекты</h2>
        <p className="text-xs text-neutral-500 mt-1">{filtered.length} из {properties.length}</p>
      </div>
      <div className="px-5 py-3 border-b border-neutral-800 space-y-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по адресу..."
          className="w-full bg-neutral-900 border border-neutral-800 rounded px-3 py-2 text-sm focus:outline-none focus:border-amber-500"
        />
        <div className="flex gap-2 text-xs">
          <input
            type="number"
            placeholder="От"
            value={minPrice || ''}
            onChange={(e) => setMinPrice(Number(e.target.value) || 0)}
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5"
          />
          <input
            type="number"
            placeholder="До"
            value={maxPrice === 100000000 ? '' : maxPrice}
            onChange={(e) => setMaxPrice(Number(e.target.value) || 100000000)}
            className="flex-1 bg-neutral-900 border border-neutral-800 rounded px-2 py-1.5"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {filtered.slice(0, 100).map((p) => (
          <button
            key={p.id}
            onClick={() => onSelect(p)}
            className="w-full text-left px-5 py-4 border-b border-neutral-900 hover:bg-neutral-900 transition group"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-amber-400 font-medium">{formatPrice(p.price)}</div>
                <div className="text-sm text-neutral-300 truncate mt-0.5">{p.address}</div>
                <div className="text-xs text-neutral-500 mt-1">
                  {p.rooms === 0 ? 'Студия' : p.rooms + ' комн.'} · {p.area} м²
                </div>
              </div>
              <span className="text-neutral-600 group-hover:text-amber-400 transition">→</span>
            </div>
          </button>
        ))}
      </div>
    </>
  );
}
