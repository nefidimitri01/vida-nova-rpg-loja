# Loja Discord SA-MP

Bot de compras com atendimento privado, PIX manual e aprovação pela equipe.

## Produtos de exemplo
- 1.000 Moedas VIP — R$ 10,00
- 5.000 Moedas VIP — R$ 40,00
- VIP Bronze — R$ 20,00
- VIP Ouro — R$ 50,00
- Sultan Personalizado — R$ 80,00

Edite `config.js` para alterar produtos.

## Configuração
1. Instale Node.js 20 ou superior.
2. Rode `npm install`.
3. Copie `.env.example` para `.env`.
4. Preencha:
   - DISCORD_TOKEN
   - GUILD_ID
   - SHOP_CHANNEL_ID
   - STAFF_ROLE_ID
   - CATEGORY_ID (opcional)
   - PIX_KEY
   - PIX_NAME
   - PIX_CITY
5. Rode `npm start`.

O bot envia o painel da loja ao iniciar no canal configurado.

## Permissões
O bot precisa, no mínimo, de:
- View Channels
- Send Messages
- Read Message History
- Manage Channels
- Embed Links

## Segurança
- Nunca publique o token do bot.
- A confirmação "Já paguei" NÃO aprova automaticamente.
- O administrador deve conferir o pagamento antes de clicar em Aprovar.
- O bot não acessa o banco do SA-MP nem faz setagem automática; a entrega é manual, conforme solicitado.

## Observação sobre 24h úteis
O bot informa "até 24 horas úteis", mas não calcula feriados nem inicia um cronômetro de prazo. O administrador decide a análise dentro do prazo informado.
