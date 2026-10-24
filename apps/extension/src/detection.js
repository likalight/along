// Shared by the isolated content script and Node tests. No remote code or page JS access.
globalThis.AlongDetection = Object.freeze({
  productFromJsonLd(value) {
    const queue = Array.isArray(value) ? [...value] : [value];
    let inspected = 0;
    while (queue.length && inspected++ < 100) {
      const item = queue.shift();
      if (!item || typeof item !== 'object') continue;
      const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
      if (types.some(type => type === 'Product' || type === 'https://schema.org/Product') && typeof item.name === 'string' && item.name.trim().length > 2) {
        const brand = typeof item.brand === 'string' ? item.brand : item.brand?.name;
        const offers = Array.isArray(item.offers) ? item.offers[0] : item.offers;
        const details = [brand, item.model, item.sku, item.description, offers?.priceCurrency, offers?.price].filter(v => typeof v === 'string' || typeof v === 'number');
        return { title: item.name.trim().slice(0, 240), text: details.join(' · ').replace(/<[^>]*>/g, '').slice(0, 1800), kind: 'product' };
      }
      if (Array.isArray(item['@graph'])) queue.push(...item['@graph']);
      if (item.mainEntity && typeof item.mainEntity === 'object') queue.push(item.mainEntity);
    }
    return null;
  },
  visibleArea(rect, viewport) {
    if (!rect || !viewport) return 0;
    return Math.max(0, Math.min(rect.right, viewport.width) - Math.max(rect.left, 0)) * Math.max(0, Math.min(rect.bottom, viewport.height) - Math.max(rect.top, 0));
  },
  text(value, max = 1800) { return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : ''; },
  intersects(a, b) { return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top; },
  sameObservation(a, b) { return Boolean(a && b && ['pageUrl', 'title', 'kind'].every(key => a[key] === b[key]) && (a.text || '') === (b.text || '')); },
});
