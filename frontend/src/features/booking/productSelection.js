// Keep withdrawn selections visible until the customer explicitly removes them.
export function productChoices(catalog, saved, metadata, draft, catalogKnown) {
  const all = new Map(catalog.map(product => [String(product.id), product]));
  for (const item of saved) {
    const id = String(item.productId);
    if (!all.has(id)) all.set(id, { id: item.productId, name: item.productName, price: item.unitPrice, isAvailable: !catalogKnown });
  }
  for (const [id, product] of Object.entries(metadata)) {
    if (draft[id] > 0 && !all.has(id)) all.set(id, { ...product, isAvailable: !catalogKnown });
  }
  return [...all.values()];
}
