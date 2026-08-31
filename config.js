module.exports = {
  products: [
    { id: "moedas1000", name: "1.000 Moedas VIP", price: 10.00, description: "1.000 moedas para usar no servidor." },
    { id: "moedas5000", name: "5.000 Moedas VIP", price: 40.00, description: "Pacote com 5.000 moedas." },
    { id: "vipbronze", name: "VIP Bronze", price: 20.00, description: "VIP Bronze para o personagem." },
    { id: "vipouro", name: "VIP Ouro", price: 50.00, description: "VIP Ouro para o personagem." },
    { id: "veiculosultan", name: "Sultan Personalizado", price: 80.00, description: "Exemplo de veículo para entrega manual." }
  ],
  statusNames: {
    awaiting_payment: "Aguardando pagamento",
    awaiting_review: "Aguardando análise",
    approved: "Aprovado",
    rejected: "Recusado",
    cancelled: "Cancelado"
  }
};
