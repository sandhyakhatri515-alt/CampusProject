import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/client';
import ResourceCard from '../components/ResourceCard';
import { Empty, Loader, PageHead } from '../components/ui';
import { toggleSaved } from '../utils/actions';

export default function Saved() {
  const [items, setItems] = useState(null);
  useEffect(() => { api.get('/wishlist').then((r) => setItems(r.data.resources)).catch(() => setItems([])); }, []);

  const onSave = async (r) => {
    const saved = await toggleSaved(r);
    if (!saved) setItems((cur) => cur.filter((x) => x.id !== r.id));
  };

  return (
    <>
      <PageHead title="Saved items" subtitle="Things you want to borrow later." />
      {!items ? <Loader /> : items.length === 0 ? (
        <Empty emoji="💜" title="Nothing saved yet" text="Tap the heart on any item to keep it here.">
          <Link to="/browse" className="btn">Browse items</Link>
        </Empty>
      ) : (
        <div className="grid">{items.map((r) => <ResourceCard key={r.id} resource={r} onToggleSave={onSave} />)}</div>
      )}
    </>
  );
}
