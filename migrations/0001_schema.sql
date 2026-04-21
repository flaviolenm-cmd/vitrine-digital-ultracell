PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user', 'deliverer')),
  cpf TEXT,
  system_number TEXT,
  full_name TEXT NOT NULL,
  store_name TEXT,
  address TEXT,
  contact TEXT,
  login TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  credit_enabled INTEGER NOT NULL DEFAULT 0,
  credit_limit REAL NOT NULL DEFAULT 0,
  credit_used REAL NOT NULL DEFAULT 0,
  photo_url TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_login ON users(login);

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  brand TEXT NOT NULL,
  category TEXT NOT NULL,
  model TEXT NOT NULL,
  name TEXT NOT NULL,
  price REAL NOT NULL,
  internal_code TEXT,
  image_url TEXT,
  availability_status TEXT NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'out_of_stock')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_products_name ON products(name);
CREATE INDEX IF NOT EXISTS idx_products_status ON products(availability_status);

CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  customer_name TEXT,
  store_name TEXT,
  delivery_type TEXT NOT NULL CHECK (delivery_type IN ('delivery', 'pickup', 'entrega', 'retirada')),
  payment_method TEXT NOT NULL,
  payment_status TEXT NOT NULL DEFAULT 'pending',
  order_status TEXT NOT NULL DEFAULT 'aguardando_confirmacao',
  total REAL NOT NULL,
  need_change INTEGER NOT NULL DEFAULT 0,
  change_for REAL NOT NULL DEFAULT 0,
  credit_used REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_delivery_type ON orders(delivery_type);

CREATE TABLE IF NOT EXISTS order_items (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  name TEXT,
  quantity INTEGER NOT NULL,
  unit_price REAL NOT NULL,
  subtotal REAL NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
  FOREIGN KEY (product_id) REFERENCES products(id)
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS returns (
  id TEXT PRIMARY KEY,
  order_id TEXT,
  user_id TEXT,
  customer_name TEXT NOT NULL,
  product_name TEXT NOT NULL,
  reason TEXT,
  notes TEXT,
  photos_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'registrada',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_id) REFERENCES orders(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_returns_status ON returns(status);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  actor_user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  details_json TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (actor_user_id) REFERENCES users(id)
);
