import React, { useEffect, useMemo, useState } from 'react';
import { Card } from '../../../components/ui/Card';
import { InventoryCategoryDTO, inventoryApi } from '../../../api/inventoryApi';

const unwrap = <T,>(payload: any): T => (payload?.data ?? payload) as T;
const ROOT_KEY = '__ROOT__';

const CategoriesPage: React.FC = () => {
  const [categories, setCategories] = useState<InventoryCategoryDTO[]>([]);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');

  const load = async () => {
    try {
      const result = await inventoryApi.listCategories();
      setCategories(unwrap<InventoryCategoryDTO[]>(result) || []);
    } catch (error) {
      console.error('Failed to load categories', error);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const childrenByParent = useMemo(() => {
    const map = new Map<string, InventoryCategoryDTO[]>();
    for (const category of categories) {
      const key = category.parentId || ROOT_KEY;
      const current = map.get(key) || [];
      current.push(category);
      map.set(key, current);
    }
    for (const value of map.values()) {
      value.sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
    }
    return map;
  }, [categories]);

  const renderTree = (currentParentId: string, depth: number): React.ReactNode => {
    const nodes = childrenByParent.get(currentParentId) || [];
    return nodes.map((category) => (
      <React.Fragment key={category.id}>
        <div
          className="grid grid-cols-12 border-b border-slate-100 py-2 text-sm"
          style={{ paddingLeft: `${depth * 20}px` }}
        >
          <div className="col-span-7 font-medium">{category.name}</div>
          <div className="col-span-2">{category.sortOrder}</div>
          <div className="col-span-3">{category.active ? 'ACTIVE' : 'INACTIVE'}</div>
        </div>
        {renderTree(category.id, depth + 1)}
      </React.Fragment>
    ));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await inventoryApi.createCategory({
        name,
        parentId: parentId || undefined,
        sortOrder: 0,
      });
      setName('');
      setParentId('');
      await load();
    } catch (error) {
      console.error('Failed to create category', error);
    }
  };

  return (
    <div className="space-y-6 p-4">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Categories</h1>

      <Card className="p-6">
        <form className="grid gap-3 md:grid-cols-3" onSubmit={handleCreate}>
          <input
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            placeholder="Category name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <select
            className="rounded border border-slate-300 px-3 py-2 text-sm"
            value={parentId}
            onChange={(e) => setParentId(e.target.value)}
          >
            <option value="">Root Category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
          <button className="rounded bg-slate-900 px-4 py-2 text-sm font-medium text-white" type="submit">
            Add Category
          </button>
        </form>
      </Card>

      <Card className="p-6">
        <div className="grid grid-cols-12 border-b border-slate-200 pb-2 text-sm font-semibold">
          <div className="col-span-7">Name</div>
          <div className="col-span-2">Sort</div>
          <div className="col-span-3">Status</div>
        </div>
        <div className="pt-2">{renderTree(ROOT_KEY, 0)}</div>
      </Card>
    </div>
  );
};

export default CategoriesPage;
