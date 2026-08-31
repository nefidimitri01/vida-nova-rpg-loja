require("dotenv").config();
const fs = require("fs");
const path = require("path");
const {
  Client, GatewayIntentBits, Partials, ChannelType, PermissionFlagsBits,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder,
  EmbedBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");
const { products, statusNames } = require("./config");

const DATA = path.join(__dirname, "data.json");
let db = { nextOrder: 1000, orders: [] };
if (fs.existsSync(DATA)) {
  try { db = JSON.parse(fs.readFileSync(DATA, "utf8")); } catch {}
}
function save() { fs.writeFileSync(DATA, JSON.stringify(db, null, 2)); }
function money(v) { return `R$ ${v.toFixed(2).replace(".", ",")}`; }
function safeName(s) { return (s || "cliente").toLowerCase().replace(/[^a-z0-9-_]/g, "-").slice(0, 20); }

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
  partials: [Partials.Channel]
});

function shopPanel() {
  const embed = new EmbedBuilder()
    .setTitle("🛒 Loja do Servidor")
    .setDescription("Escolha um produto para iniciar seu pedido. O pagamento é feito manualmente via PIX e a equipe analisa o pedido em até **24 horas úteis**.")
    .addFields(products.map(p => ({ name: `${p.name} — ${money(p.price)}`, value: p.description })));
  const menu = new StringSelectMenuBuilder()
    .setCustomId("buy_product")
    .setPlaceholder("🛒 Escolha um produto")
    .addOptions(products.map(p => ({ label: p.name, description: money(p.price), value: p.id })));
  return { embeds: [embed], components: [new ActionRowBuilder().addComponents(menu)] };
}

async function createOrder(interaction, product) {
  const open = db.orders.find(o => o.userId === interaction.user.id && ["awaiting_payment","awaiting_review"].includes(o.status));
  if (open) {
    return interaction.reply({ content: `❌ Você já possui o pedido **#${open.id}** em aberto.`, ephemeral: true });
  }

  const modal = new ModalBuilder().setCustomId(`order_modal:${product.id}`).setTitle("Dados da compra");
  const nick = new TextInputBuilder().setCustomId("nick").setLabel("Nick do SA-MP").setStyle(TextInputStyle.Short).setRequired(true).setMaxLength(32);
  const account = new TextInputBuilder().setCustomId("account").setLabel("ID/ID da conta (opcional)").setStyle(TextInputStyle.Short).setRequired(false).setMaxLength(30);
  modal.addComponents(new ActionRowBuilder().addComponents(nick), new ActionRowBuilder().addComponents(account));
  return interaction.showModal(modal);
}

client.once("ready", async () => {
  console.log(`Online como ${client.user.tag}`);
  const guild = await client.guilds.fetch(process.env.GUILD_ID).catch(() => null);
  if (!guild) return console.log("GUILD_ID inválido ou bot não está no servidor.");
  const ch = await guild.channels.fetch(process.env.SHOP_CHANNEL_ID).catch(() => null);
  if (ch && ch.isTextBased()) {
    await ch.send(shopPanel()).catch(() => {});
  }
});

client.on("interactionCreate", async interaction => {
  try {
    if (interaction.isStringSelectMenu() && interaction.customId === "buy_product") {
      const product = products.find(p => p.id === interaction.values[0]);
      if (!product) return interaction.reply({ content: "Produto inválido.", ephemeral: true });
      return createOrder(interaction, product);
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("order_modal:")) {
      const product = products.find(p => p.id === interaction.customId.split(":")[1]);
      if (!product) return interaction.reply({ content: "Produto inválido.", ephemeral: true });

      const nick = interaction.fields.getTextInputValue("nick");
      const account = interaction.fields.getTextInputValue("account") || "Não informado";
      const id = db.nextOrder++;
      const order = {
        id, userId: interaction.user.id, username: interaction.user.tag,
        nick, account, productId: product.id, product: product.name, price: product.price,
        status: "awaiting_payment", createdAt: new Date().toISOString(), reviewedAt: null, reviewedBy: null
      };
      db.orders.push(order); save();

      const guild = interaction.guild;
      const category = process.env.CATEGORY_ID || null;
      const channel = await guild.channels.create({
        name: `pedido-${id}-${safeName(interaction.user.username)}`,
        type: ChannelType.GuildText,
        parent: category || undefined,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
          { id: process.env.STAFF_ROLE_ID, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
        ]
      });

      const embed = new EmbedBuilder().setTitle(`📦 Pedido #${id}`)
        .setDescription("Faça o PIX e depois clique em **Já paguei**. O botão apenas informa a equipe; a aprovação é manual.")
        .addFields(
          { name: "Produto", value: product.name, inline: true },
          { name: "Valor", value: money(product.price), inline: true },
          { name: "Nick", value: nick, inline: true },
          { name: "ID/Conta", value: account, inline: true },
          { name: "Chave PIX", value: `\`${process.env.PIX_KEY || "CONFIGURE_PIX_KEY"}\``, inline: false },
          { name: "Recebedor", value: `${process.env.PIX_NAME || "Configure PIX_NAME"} — ${process.env.PIX_CITY || "Configure PIX_CITY"}`, inline: false }
        )
        .setFooter({ text: "Prazo de análise: até 24 horas úteis após informar o pagamento." });

      const buttons = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`paid:${id}`).setLabel("✅ Já paguei").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`cancel:${id}`).setLabel("❌ Cancelar").setStyle(ButtonStyle.Danger)
      );
      await channel.send({ content: `<@${interaction.user.id}> <@&${process.env.STAFF_ROLE_ID}>`, embeds: [embed], components: [buttons] });
      await interaction.reply({ content: `✅ Pedido **#${id}** criado: ${channel}`, ephemeral: true });
    }

    if (interaction.isButton()) {
      const [action, idText] = interaction.customId.split(":");
      const id = Number(idText);
      const order = db.orders.find(o => o.id === id);
      if (!order) return interaction.reply({ content: "Pedido não encontrado.", ephemeral: true });

      const isStaff = interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);

      if (action === "paid") {
        if (interaction.user.id !== order.userId) return interaction.reply({ content: "Apenas o comprador pode usar este botão.", ephemeral: true });
        if (order.status !== "awaiting_payment") return interaction.reply({ content: "Este pedido já foi atualizado.", ephemeral: true });
        order.status = "awaiting_review"; order.paidReportedAt = new Date().toISOString(); save();

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(`approve:${id}`).setLabel("✅ Aprovar").setStyle(ButtonStyle.Success),
          new ButtonBuilder().setCustomId(`reject:${id}`).setLabel("❌ Recusar").setStyle(ButtonStyle.Danger)
        );
        await interaction.channel.send({ content: `📥 **Pedido #${id}** marcado como **Aguardando análise**.\nEquipe: verifique o pagamento antes de aprovar.`, components: [row] });
        return interaction.reply({ content: "✅ Pagamento informado. Aguarde a análise da equipe em até 24 horas úteis.", ephemeral: true });
      }

      if (action === "cancel") {
        if (interaction.user.id !== order.userId && !isStaff) return interaction.reply({ content: "Sem permissão.", ephemeral: true });
        order.status = "cancelled"; save();
        return interaction.reply({ content: "❌ Pedido cancelado. A equipe pode fechar este atendimento.", ephemeral: true });
      }

      if (action === "approve") {
        if (!isStaff) return interaction.reply({ content: "❌ Apenas a equipe pode aprovar.", ephemeral: true });
        if (order.status !== "awaiting_review") return interaction.reply({ content: "O pedido não está aguardando análise.", ephemeral: true });
        order.status = "approved"; order.reviewedAt = new Date().toISOString(); order.reviewedBy = interaction.user.id; save();
        await interaction.channel.send(`🎉 <@${order.userId}> **Compra aprovada!**\n\nPedido **#${id}**: **${order.product}**.\nA administração realizará a entrega/setagem dentro do SA-MP.`);
        const user = await client.users.fetch(order.userId).catch(() => null);
        if (user) await user.send(`🎉 Sua compra **#${id}** foi **aprovada**!\nProduto: **${order.product}**\nA administração realizará a entrega no SA-MP.`).catch(() => {});
        return interaction.reply({ content: "✅ Pedido aprovado e comprador notificado.", ephemeral: true });
      }

      if (action === "reject") {
        if (!isStaff) return interaction.reply({ content: "❌ Apenas a equipe pode recusar.", ephemeral: true });
        const modal = new ModalBuilder().setCustomId(`reject_modal:${id}`).setTitle("Motivo da recusa");
        const reason = new TextInputBuilder().setCustomId("reason").setLabel("Motivo").setStyle(TextInputStyle.Paragraph).setRequired(true).setMaxLength(500);
        modal.addComponents(new ActionRowBuilder().addComponents(reason));
        return interaction.showModal(modal);
      }
    }

    if (interaction.isModalSubmit() && interaction.customId.startsWith("reject_modal:")) {
      const id = Number(interaction.customId.split(":")[1]);
      const order = db.orders.find(o => o.id === id);
      const isStaff = interaction.member.roles.cache.has(process.env.STAFF_ROLE_ID) || interaction.member.permissions.has(PermissionFlagsBits.Administrator);
      if (!order || !isStaff) return interaction.reply({ content: "Sem permissão/pedido inválido.", ephemeral: true });
      const reason = interaction.fields.getTextInputValue("reason");
      order.status = "rejected"; order.reviewedAt = new Date().toISOString(); order.reviewedBy = interaction.user.id; order.rejectionReason = reason; save();
      await interaction.channel.send(`❌ <@${order.userId}> **Compra recusada.**\nMotivo: ${reason}`);
      const user = await client.users.fetch(order.userId).catch(() => null);
      if (user) await user.send(`❌ Sua compra **#${id}** foi recusada.\nMotivo: ${reason}`).catch(() => {});
      return interaction.reply({ content: "❌ Pedido recusado e comprador notificado.", ephemeral: true });
    }
  } catch (e) {
    console.error(e);
    if (!interaction.replied && !interaction.deferred) interaction.reply({ content: "Ocorreu um erro no bot.", ephemeral: true }).catch(() => {});
  }
});

client.login(process.env.DISCORD_TOKEN);
