import toast from 'react-hot-toast';
import api, { errorMessage } from '../api/client';

// Toggles a saved item and returns the new saved state (or the old one on failure).
export async function toggleSaved(resource) {
  try {
    const { data } = await api.post(`/wishlist/${resource.id}`);
    toast.success(data.message);
    return data.saved;
  } catch (err) {
    toast.error(errorMessage(err));
    return resource.is_saved;
  }
}
