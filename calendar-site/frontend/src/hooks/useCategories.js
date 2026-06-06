import { useState, useEffect, useCallback } from 'react';
import { fetchCategories, createCategory, updateCategory, deleteCategory } from '../api';

export function useCategories() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try { setCategories(await fetchCategories()); }
    finally { setLoading(false); }
  }, []);

  const handleCreate = useCallback(async (data) => {
    const cat = await createCategory(data);
    setCategories(prev => [...prev, cat]);
    return cat;
  }, []);

  const handleUpdate = useCallback(async (id, data) => {
    const cat = await updateCategory(id, data);
    setCategories(prev => prev.map(c => c.id === id ? cat : c));
    return cat;
  }, []);

  const handleDelete = useCallback(async (id) => {
    await deleteCategory(id);
    setCategories(prev => prev.filter(c => c.id !== id));
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return { categories, loading, refresh, createCategory: handleCreate, updateCategory: handleUpdate, deleteCategory: handleDelete };
}
