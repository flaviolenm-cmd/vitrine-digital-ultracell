import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const input = process.argv[2] || './backup.json';
const output = process.argv[3] || './migrations/9999_import_from_backup.sql';

if (!fs.existsSync(input)) {
  console.error(`Arquivo não encontrado: ${input}`);
  process.exit(1);
}

const raw = fs.readFileSync(input, 'utf8');
const data = JSON.parse(raw);
const sql = [];

const esc = (value) => {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replaceAll("'", "''")}'`;
};

const hash = (value) => crypto.createHash('sha256').update(String(value)).digest('hex');

sql.push('PRAGMA foreign_keys = OFF;');

for (const user of data.users || []) {
  sql.push(`INSERT OR REPLACE INTO users (id, role, cpf, system_number, full_name, store_name, address, contact, login, password_hash, active, credit_enabled, credit_limit, credit_used, photo_url, created_at, updated_at) VALUES (${esc(user.id)}, ${esc(user.role || user.type || 'user')}, ${esc(user.cpf)}, ${esc(user.systemNumber)}, ${esc(user.fullName)}, ${esc(user.storeName)}, ${esc(user.address)}, ${esc(user.contact)}, ${esc(user.login || user.cpf)}, ${esc(hash(user.password || '1234'))}, ${user.active ? 1 : 0}, ${user.creditEnabled ? 1 : 0}, ${Number(user.creditLimit || 0)}, ${Number(user.creditUsed || 0)}, ${esc(user.photo)}, ${esc(user.createdAt || new Date().toISOString())}, ${esc(new Date().toISOString())});`);
}

for (const admin of data.admins || []) {
  sql.push(`INSERT OR REPLACE INTO users (id, role, cpf, system_number, full_name, store_name, address, contact, login, password_hash, active, credit_enabled, credit_limit, credit_used, photo_url, created_at, updated_at) VALUES (${esc(admin.id || crypto.randomUUID())}, 'admin', NULL, NULL, ${esc(admin.name || 'Administrador')}, 'Ultracell Peças', NULL, NULL, ${esc(admin.login || 'admin')}, ${esc(hash(admin.password || '1234'))}, 1, 0, 0, 0, NULL, ${esc(admin.createdAt || new Date().toISOString())}, ${esc(new Date().toISOString())});`);
}

for (const product of data.products || []) {
  sql.push(`INSERT OR REPLACE INTO products (id, brand, category, model, name, price, internal_code, image_url, availability_status, created_at, updated_at) VALUES (${esc(product.id)}, ${esc(product.brand)}, ${esc(product.category)}, ${esc(product.model)}, ${esc(product.name)}, ${Number(product.price || 0)}, ${esc(product.code || product.internal_code)}, ${esc(product.image)}, ${esc(product.availabilityStatus || 'available')}, ${esc(product.createdAt || new Date().toISOString())}, ${esc(new Date().toISOString())});`);
}

for (const order of data.orders || []) {
  sql.push(`INSERT OR REPLACE INTO orders (id, user_id, customer_name, store_name, delivery_type, payment_method, payment_status, order_status, total, need_change, change_for, credit_used, notes, created_at, updated_at) VALUES (${esc(order.id)}, ${esc(order.userId)}, ${esc(order.customerName)}, ${esc(order.storeName)}, ${esc(order.deliveryType)}, ${esc(order.paymentMethod)}, ${esc(order.paid ? 'paid' : 'pending')}, ${esc(order.status)}, ${Number(order.total || 0)}, ${order.needChange ? 1 : 0}, ${Number(order.changeFor || 0)}, ${Number(order.creditUsed || 0)}, ${esc(order.notes)}, ${esc(order.createdAt || new Date().toISOString())}, ${esc(new Date().toISOString())});`);
  for (const item of order.items || []) {
    sql.push(`INSERT OR REPLACE INTO order_items (id, order_id, product_id, name, quantity, unit_price, subtotal, created_at) VALUES (${esc(item.id || crypto.randomUUID())}, ${esc(order.id)}, ${esc(item.productId)}, ${esc(item.name)}, ${Number(item.quantity || 1)}, ${Number(item.unitPrice || 0)}, ${Number(item.subtotal || 0)}, ${esc(order.createdAt || new Date().toISOString())});`);
  }
}

for (const item of data.returns || []) {
  sql.push(`INSERT OR REPLACE INTO returns (id, order_id, user_id, customer_name, product_name, reason, notes, photos_json, status, created_at, updated_at) VALUES (${esc(item.id)}, ${esc(item.orderId)}, ${esc(item.userId)}, ${esc(item.customerName)}, ${esc(item.productName)}, ${esc(item.reason)}, ${esc(item.notes)}, ${esc(JSON.stringify(item.photos || []))}, ${esc(item.status || 'registrada')}, ${esc(item.createdAt || new Date().toISOString())}, ${esc(new Date().toISOString())});`);
}

sql.push('PRAGMA foreign_keys = ON;');
fs.writeFileSync(output, `${sql.join('\n')}\n`, 'utf8');
console.log(`SQL gerado em: ${path.resolve(output)}`);
