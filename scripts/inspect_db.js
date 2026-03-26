const Database = require('better-sqlite3');

// Update this path if needed.
const DB_PATH = 'C:/Users/Saji/AppData/Roaming/oliyaruvi-printers/oliyaruvi_1.0.2.db';

const db = new Database(DB_PATH);

function rows(sql, params = []) {
  return db.prepare(sql).all(...params);
}

console.log('DB:', DB_PATH);

const bannerMats = rows(
  'SELECT id, material_name, price_per_sqft, pricing_type, is_active FROM banner_materials ORDER BY material_name'
);
console.log('\n[banner_materials] total:', bannerMats.length);
console.log(
  bannerMats.map((r) => `${r.material_name}${r.is_active === 1 ? '' : ' (inactive)'}`).join('\n')
);

const bannerStock = rows(
  'SELECT id, size_name, stock_qty, low_stock_threshold, stock_type, print_type, feet_remaining FROM banner_stock ORDER BY print_type, stock_type, size_name'
);
console.log('\n[banner_stock] total:', bannerStock.length);
console.log(bannerStock.map((r) => `${r.size_name} | stock_type=${r.stock_type} | print_type=${r.print_type} | qty=${r.stock_qty}`).join('\n'));

const serviceItems = rows(
  'SELECT id, name, item_type, qty_type, unit_price FROM service_items ORDER BY name'
);
console.log('\n[service_items] total:', serviceItems.length);
console.log(serviceItems.map((r) => `${r.name} (${r.item_type || ''})`).join('\n'));

