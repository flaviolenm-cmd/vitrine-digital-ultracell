export const mockProducts = [
  { id:'p1', brand:'Samsung', category:'Módulo', model:'A10', name:'Módulo Samsung A10', price:179.9, image:'', active:true, availabilityStatus:'available', code:'SAM-MOD-A10' },
  { id:'p2', brand:'Motorola', category:'Bateria', model:'G8', name:'Bateria Motorola G8', price:89.9, image:'', active:true, availabilityStatus:'available', code:'MOT-BAT-G8' },
  { id:'p3', brand:'iPhone', category:'Placa de carga', model:'11', name:'Placa de Carga iPhone 11', price:129.9, image:'', active:true, availabilityStatus:'available', code:'IPH-PC-11' },
  { id:'p4', brand:'Xiaomi', category:'Flex power', model:'Redmi Note 10', name:'Flex Power Redmi Note 10', price:59.9, image:'', active:true, availabilityStatus:'available', code:'XIA-FP-RN10' },
  { id:'p5', brand:'LG', category:'Botões externos', model:'K41', name:'Botões Externos LG K41', price:34.9, image:'', active:true, availabilityStatus:'out_of_stock', code:'LG-BTN-K41' },
  { id:'p6', brand:'Realme', category:'Tampa', model:'C25', name:'Tampa Realme C25', price:69.9, image:'', active:true, availabilityStatus:'available', code:'REA-TMP-C25' },
  { id:'p7', brand:'Samsung', category:'Bateria', model:'A20', name:'Bateria Samsung A20', price:95.5, image:'', active:true, availabilityStatus:'available', code:'SAM-BAT-A20' },
  { id:'p8', brand:'iPhone', category:'Módulo', model:'XR', name:'Módulo iPhone XR', price:329.9, image:'', active:true, availabilityStatus:'available', code:'IPH-MOD-XR' }
];

export const mockUsers = [
  { id:'u1', type:'user', role:'user', cpf:'12345678900', systemNumber:'1001', fullName:'Carlos Souza', storeName:'CS Assistência', address:'Rua A, 123', contact:'94991234567', active:true, creditEnabled:true, creditLimit:1500, creditUsed:250, login:'12345678900', password:'4567' },
  { id:'u2', type:'user', role:'user', cpf:'98765432100', systemNumber:'1002', fullName:'Marina Lopes', storeName:'Loja Marina Cell', address:'Av. Central, 45', contact:'94998887766', active:true, creditEnabled:false, creditLimit:0, creditUsed:0, login:'98765432100', password:'7766' },
  { id:'u3', type:'user', role:'user', cpf:'11122233344', systemNumber:'1003', fullName:'Paulo Nunes', storeName:'Nunes Peças', address:'Travessa Bela Vista, 9', contact:'94990001122', active:false, creditEnabled:true, creditLimit:800, creditUsed:150, login:'11122233344', password:'1122' }
,
  { id:'u4', type:'deliverer', role:'deliverer', cpf:'22233344455', systemNumber:'1004', fullName:'Rafael Entregas', storeName:'Equipe Entrega', address:'Base Ultracell', contact:'94997776655', active:true, creditEnabled:false, creditLimit:0, creditUsed:0, login:'22233344455', password:'6655' }
];

export const mockAdmins = [
  { id:'a1', type:'admin', name:'Administrador Ultra', login:'admin', password:'1234', active:true },
  { id:'a2', type:'admin', name:'Flavio ADM', login:'Flavioadm', password:'573284', active:true }
];

export const mockOrders = [
  { id:'o1', userId:'u1', customerName:'Carlos Souza', storeName:'CS Assistência', address:'Rua A, 123', items:[{ productId:'p1', name:'Módulo Samsung A10', quantity:1, unitPrice:179.9, subtotal:179.9 }], total:179.9, deliveryType:'retirada', paymentMethod:'pix', paid:true, needChange:false, changeFor:0, changeValue:0, creditUsed:0, notes:'Cliente pediu urgência.', status:'pronto_retirada', createdAt:new Date().toISOString() },
  { id:'o2', userId:'u2', customerName:'Marina Lopes', storeName:'Loja Marina Cell', address:'Av. Central, 45', items:[{ productId:'p2', name:'Bateria Motorola G8', quantity:2, unitPrice:89.9, subtotal:179.8 }], total:179.8, deliveryType:'entrega', paymentMethod:'dinheiro', paid:false, needChange:true, changeFor:200, changeValue:20.2, creditUsed:0, notes:'Entregar até as 16h.', status:'em_separacao', createdAt:new Date().toISOString() }
];

export const mockReturns = [];
export const defaultPixKey = 'ultracellpecas@pix.com';
