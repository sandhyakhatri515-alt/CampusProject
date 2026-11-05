import { Link } from 'react-router-dom';
import { FiHeart, FiMapPin } from 'react-icons/fi';
import { CategoryChip, StatusPill, Thumb, Stars, thumbBackground } from './ui';
import { priceLabel } from '../utils/format';

export default function ResourceCard({ resource: r, onToggleSave }) {
  return (
    <Link to={`/resources/${r.id}`} className="card card-flush res-card">
      <div className="res-thumb" style={{ background: thumbBackground(r.category_color) }}>
        <Thumb src={r.image_url} icon={r.category_icon} alt={r.title} />
        <StatusPill status={r.availability_status} />
        <span className={`price-tag ${Number(r.price_per_day) > 0 ? '' : 'free'}`}>{priceLabel(r.price_per_day)}</span>
        {onToggleSave && (
          <button
            type="button"
            className={`res-heart ${r.is_saved ? 'on' : ''}`}
            aria-label={r.is_saved ? 'Remove from saved' : 'Save for later'}
            aria-pressed={r.is_saved}
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); onToggleSave(r); }}
          >
            <FiHeart />
          </button>
        )}
      </div>
      <div className="res-body">
        <CategoryChip name={r.category_name} color={r.category_color} icon={r.category_icon} />
        <div className="res-title">{r.title}</div>
        <div className="res-meta">
          <span className="grow" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {r.location ? <><FiMapPin size={13} /> {r.location}</> : r.owner_name}
          </span>
          {r.owner_avg_rating ? <span title="Owner rating"><Stars value={r.owner_avg_rating} size={12} /></span> : null}
        </div>
      </div>
    </Link>
  );
}
