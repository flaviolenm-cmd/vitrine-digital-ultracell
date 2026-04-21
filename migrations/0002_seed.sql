INSERT OR IGNORE INTO users (
  id, role, cpf, system_number, full_name, store_name, address, contact, login, password_hash,
  active, credit_enabled, credit_limit, credit_used, photo_url
) VALUES
(
  'admin-seed-001', 'admin', NULL, 'ADM-001', 'Administrador Ultracell', 'Ultracell Peças',
  'Painel administrativo', '11999990000', 'admin',
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  1, 0, 0, 0, NULL
),
(
  'user-seed-001', 'user', '12345678900', 'CLI-001', 'João da Silva', 'Loja Exemplo',
  'Rua Exemplo, 123', '94991234567', '12345678900',
  '8bb0cf6eb9b17d0f7d22af49c89a3c49e6344f97f242bb435ec8c89f8b0250d0',
  1, 1, 1500, 300, NULL
),
(
  'deliverer-seed-001', 'deliverer', NULL, 'ENT-001', 'Entregador Demo', 'Ultracell Peças',
  'Rota principal', '11988887777', 'entregador',
  '03ac674216f3e15c761ee1a5e255f067953623c8b388b4459e13f978d7c846f4',
  1, 0, 0, 0, NULL
);

INSERT OR IGNORE INTO products (
  id, brand, category, model, name, price, internal_code, image_url, availability_status
) VALUES
('prod-seed-001', 'Samsung', 'Módulo', 'A10', 'Módulo Samsung A10', 180.00, 'SAM-MOD-A10', NULL, 'available'),
('prod-seed-002', 'Motorola', 'Conector', 'G8', 'Conector de Carga Motorola G8', 45.00, 'MOT-CON-G8', NULL, 'available'),
('prod-seed-003', 'Xiaomi', 'Bateria', 'Redmi Note 8', 'Bateria Xiaomi Redmi Note 8', 95.00, 'XIA-BAT-RN8', NULL, 'out_of_stock');

INSERT OR IGNORE INTO orders (
  id, user_id, customer_name, store_name, delivery_type, payment_method, payment_status, order_status,
  total, need_change, change_for, credit_used, notes
) VALUES
('ord-seed-001', 'user-seed-001', 'João da Silva', 'Loja Exemplo', 'delivery', 'pix', 'pending', 'aguardando_confirmacao', 180.00, 0, 0, 0, 'Pedido inicial de demonstração');

INSERT OR IGNORE INTO order_items (
  id, order_id, product_id, name, quantity, unit_price, subtotal
) VALUES
('item-seed-001', 'ord-seed-001', 'prod-seed-001', 'Módulo Samsung A10', 1, 180.00, 180.00);
