import { Command } from '@sapphire/framework';
import { container } from 'tsyringe';
import { ChannelType, PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, TextChannel, MessageFlags } from 'discord.js';
import { ISupportConfigService } from '@/modules/tickets/services/ISupportConfigService';
import { ITicketService } from '@/modules/tickets/services/ITicketService';
import { ILogger } from '@/common/utils/logger/ILogger';

export class SupportCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'support',
            description: 'Manage the support ticketing system'
        });
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
                .setDefaultMemberPermissions(PermissionFlagsBits.SendMessages)
                .addSubcommandGroup(group =>
                    group
                        .setName('config')
                        .setDescription('Configure the support system (Admin only)')
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('send-panel')
                                .setDescription('Sends the interactive ticket creation panel to the current channel')
                        )
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('set-discord-category')
                                .setDescription('Set the Discord category where new ticket channels will be created')
                                .addChannelOption(option =>
                                    option.setName('category')
                                        .setDescription('The category channel')
                                        .setRequired(true)
                                        .addChannelTypes(ChannelType.GuildCategory)
                                )
                        )
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('set-log-channel')
                                .setDescription('Set the text channel where closed tickets are logged')
                                .addChannelOption(option =>
                                    option.setName('channel')
                                        .setDescription('The log channel')
                                        .setRequired(true)
                                        .addChannelTypes(ChannelType.GuildText)
                                )
                        )
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('set-support-role')
                                .setDescription('Set the role that can claim and close tickets')
                                .addRoleOption(option => 
                                    option.setName('role')
                                        .setDescription('The support role')
                                        .setRequired(true)
                                )
                        )
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('type-add')
                                .setDescription('Add a new ticket type (button)')
                                .addStringOption(option => option.setName('name').setDescription('Name of the ticket type').setRequired(true))
                                .addStringOption(option => option.setName('description').setDescription('Description shown when selecting').setRequired(true))
                                .addStringOption(option => 
                                    option.setName('color')
                                        .setDescription('Color of the ticket embed')
                                        .setRequired(true)
                                        .addChoices(
                                            { name: 'Blurple (Blue)', value: 'Blurple' },
                                            { name: 'Green (Success)', value: 'Green' },
                                            { name: 'Red (Danger)', value: 'Red' },
                                            { name: 'Grey (Secondary)', value: 'Grey' }
                                        )
                                )
                                .addStringOption(option => option.setName('emoji').setDescription('Optional emoji for the button').setRequired(false))
                        )
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('type-remove')
                                .setDescription('Remove a ticket type')
                                .addStringOption(option => option.setName('name').setDescription('Name of the ticket type').setRequired(true).setAutocomplete(true))
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('claim')
                        .setDescription('Claim the current ticket (Support only)')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('unclaim')
                        .setDescription('Unclaim the current ticket (Support only)')
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('transfer')
                        .setDescription('Transfer the current ticket to another colleague (Support only)')
                        .addUserOption(option => option.setName('user').setDescription('The colleague to transfer to').setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('close')
                        .setDescription('Close the current ticket (Support only)')
                        .addStringOption(option => option.setName('summary').setDescription('Resolution summary').setRequired(true))
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('help')
                        .setDescription('View all support commands and how the ticketing system works')
                )
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(true);

        const configService = container.resolve<ISupportConfigService>('ISupportConfigService');
        const ticketService = container.resolve<ITicketService>('ITicketService');
        const logger = container.resolve<ILogger>('ILogger');

        if (!interaction.guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        }

        try {
            if (subcommand === 'help') {
                const config = await configService.getConfig(interaction.guild.id);

                const categoryStatus = config.discordCategoryId ? `<#${config.discordCategoryId}>` : '`Not set`';
                const logChannelStatus = config.logChannelId ? `<#${config.logChannelId}>` : '`Not set`';
                const supportRoleStatus = config.supportRoleId ? `<@&${config.supportRoleId}>` : '`Not set`';
                const typesList = config.ticketTypes.length > 0
                    ? config.ticketTypes.map(t => `\`${t.name}\` (${t.color}) — ${t.description}`).join('\n')
                    : '`None configured`';

                const overviewEmbed = new EmbedBuilder()
                    .setTitle('🎫  TicketLock — Support System')
                    .setDescription(
                        'A fully automated ticketing system. Users create tickets via interactive buttons, ' +
                        'support staff claim and resolve them, and everything is logged for accountability.'
                    )
                    .setColor(0x5865F2);

                const workflowEmbed = new EmbedBuilder()
                    .setTitle('📋  Ticket Lifecycle')
                    .setDescription(
                        '```\n' +
                        '① User clicks a button on the Support Panel\n' +
                        '② Modal opens → User fills in Title & Description\n' +
                        '③ Private channel is created for the ticket\n' +
                        '④ Support staff runs /support claim\n' +
                        '⑤ Staff resolves the issue\n' +
                        '⑥ Staff runs /support close <summary>\n' +
                        '⑦ Channel is deleted & log is updated\n' +
                        '```'
                    )
                    .addFields(
                        { name: '🟢 Created', value: 'Green log embed posted in logs.', inline: true },
                        { name: '🟡 Claimed', value: 'Log turns yellow with claimer info.', inline: true },
                        { name: '🟣 Transferred', value: 'Log turns purple with transfer info.', inline: true },
                        { name: '🔴 Closed', value: 'Log turns red with resolution summary.', inline: true }
                    )
                    .setColor(0x5865F2);

                const commandsEmbed = new EmbedBuilder()
                    .setTitle('⚙️  Commands Reference')
                    .addFields(
                        {
                            name: '__Admin Configuration__  *(Manage Server)*',
                            value: [
                                '`/support config set-discord-category` — Set the category for ticket channels',
                                '`/support config set-log-channel` — Set the channel for ticket logs',
                                '`/support config set-support-role` — Set the role allowed to manage tickets',
                                '`/support config type-add` — Add a ticket type button',
                                '`/support config type-remove` — Remove a ticket type button',
                                '`/support config send-panel` — Deploy the ticket panel'
                            ].join('\n')
                        },
                        {
                            name: '__Support Staff__  *(Support Role)*',
                            value: [
                                '`/support claim` — Claim the current ticket',
                                '`/support unclaim` — Return ticket to unclaimed state',
                                '`/support transfer @user` — Hand off ticket to colleague',
                                '`/support close <summary>` — Close & log the ticket'
                            ].join('\n')
                        },
                        {
                            name: '__General__',
                            value: '`/support help` — Show this help page'
                        }
                    )
                    .setColor(0x5865F2);

                const statusEmbed = new EmbedBuilder()
                    .setTitle('📊  Current Configuration')
                    .addFields(
                        { name: 'Ticket Category', value: categoryStatus, inline: true },
                        { name: 'Log Channel', value: logChannelStatus, inline: true },
                        { name: 'Support Role', value: supportRoleStatus, inline: true },
                        { name: 'Ticket Types', value: typesList, inline: false }
                    )
                    .setColor(0x5865F2)
                    .setFooter({ text: 'TicketLock' })
                    .setTimestamp();

                return interaction.reply({
                    embeds: [overviewEmbed, workflowEmbed, commandsEmbed, statusEmbed],
                    flags: MessageFlags.Ephemeral
                });
            }

            if (subcommandGroup === 'config') {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: 'You do not have permission to use config commands.', flags: MessageFlags.Ephemeral });
                }

                if (subcommand === 'send-panel') {
                    const config = await configService.getConfig(interaction.guild.id);
                    if (!config.ticketTypes || config.ticketTypes.length === 0) {
                        return interaction.reply({ content: 'You have not configured any ticket types.', flags: MessageFlags.Ephemeral });
                    }

                    const embed = new EmbedBuilder()
                        .setTitle('Support Tickets')
                        .setDescription('Need help? Click the appropriate button below to open a ticket.')
                        .setColor('Blurple');

                    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
                    let currentRow = new ActionRowBuilder<ButtonBuilder>();

                    for (const type of config.ticketTypes) {
                        if (currentRow.components.length === 5) {
                            rows.push(currentRow);
                            currentRow = new ActionRowBuilder<ButtonBuilder>();
                        }

                        let style = ButtonStyle.Primary;
                        if (type.color === 'Green') style = ButtonStyle.Success;
                        else if (type.color === 'Red') style = ButtonStyle.Danger;
                        else if (type.color === 'Grey') style = ButtonStyle.Secondary;

                        const button = new ButtonBuilder()
                            .setCustomId(`ticket_create_${type.name}`)
                            .setLabel(type.name)
                            .setStyle(style);

                        if (type.emoji) {
                            button.setEmoji(type.emoji);
                        }

                        currentRow.addComponents(button);
                    }
                    if (currentRow.components.length > 0) rows.push(currentRow);

                    if (interaction.channel && interaction.guild) {
                        const channel = interaction.channel as TextChannel;
                        const panelMsg = await channel.send({ embeds: [embed], components: rows });
                        await configService.setPanelInfo(interaction.guild.id, channel.id, panelMsg.id);
                        return interaction.reply({ content: 'Panel sent successfully!', flags: MessageFlags.Ephemeral });
                    }
                    return interaction.reply({ content: 'Failed to send panel here.', flags: MessageFlags.Ephemeral });
                }

                if (subcommand === 'set-discord-category') {
                    const category = interaction.options.getChannel('category', true);
                    await configService.setDiscordCategory(interaction.guild.id, category.id);
                    return interaction.reply({ content: `Ticket category set to ${category.toString()}`, flags: MessageFlags.Ephemeral });
                }

                if (subcommand === 'set-log-channel') {
                    const channel = interaction.options.getChannel('channel', true);
                    await configService.setLogChannel(interaction.guild.id, channel.id);
                    return interaction.reply({ content: `Log channel set to ${channel.toString()}`, flags: MessageFlags.Ephemeral });
                }

                if (subcommand === 'set-support-role') {
                    const role = interaction.options.getRole('role', true);
                    await configService.setSupportRole(interaction.guild.id, role.id);
                    return interaction.reply({ content: `Support role set to ${role.toString()}`, flags: MessageFlags.Ephemeral });
                }

                if (subcommand === 'type-add') {
                    const name = interaction.options.getString('name', true);
                    const desc = interaction.options.getString('description', true);
                    const color = interaction.options.getString('color', true);
                    const emoji = interaction.options.getString('emoji') ?? undefined;
                    await configService.addTicketType(interaction.guild.id, name, desc, color, emoji, interaction.guild);
                    return interaction.reply({ content: `Added ticket type **${name}**. Panel updated!`, flags: MessageFlags.Ephemeral });
                }

                if (subcommand === 'type-remove') {
                    const name = interaction.options.getString('name', true);
                    await configService.removeTicketType(interaction.guild.id, name, interaction.guild);
                    return interaction.reply({ content: `Removed ticket type **${name}**. Panel updated!`, flags: MessageFlags.Ephemeral });
                }
            }

            if (['claim', 'unclaim', 'transfer', 'close'].includes(subcommand)) {
                // Remove redundant deferReply({ flags: MessageFlags.Ephemeral })

                const config = await configService.getConfig(interaction.guild.id);
                if (config.supportRoleId) {
                    const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
                    if (!member || !member.roles.cache.has(config.supportRoleId)) {
                        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                            return interaction.reply({ content: 'You do not have permission to manage tickets.', flags: MessageFlags.Ephemeral });
                        }
                    }
                }

                if (subcommand === 'claim') {
                    const success = await ticketService.claimTicket(interaction.guild, interaction.channelId, interaction.user);
                    if (success) {
                        return interaction.reply({ content: `✋ Ticket has been claimed by ${interaction.user.toString()}.` });
                    } else {
                        return interaction.reply({ content: 'Failed to claim ticket.', flags: MessageFlags.Ephemeral });
                    }
                }

                if (subcommand === 'unclaim') {
                    const success = await ticketService.unclaimTicket(interaction.guild, interaction.channelId, interaction.user);
                    if (success) {
                        return interaction.reply({ content: `✋ This ticket has been unclaimed by ${interaction.user.toString()} and is now available for other staff.` });
                    } else {
                        return interaction.reply({ content: 'Failed to unclaim ticket. It may not be claimed.', flags: MessageFlags.Ephemeral });
                    }
                }

                if (subcommand === 'transfer') {
                    const targetUser = interaction.options.getUser('user', true);
                    const success = await ticketService.transferTicket(interaction.guild, interaction.channelId, interaction.user, targetUser);
                    if (success) {
                        return interaction.reply({ content: `🎫 This ticket has been transferred to ${targetUser.toString()} by ${interaction.user.toString()}.` });
                    } else {
                        return interaction.reply({ content: 'Failed to transfer ticket. It may not be claimed.', flags: MessageFlags.Ephemeral });
                    }
                }

                if (subcommand === 'close') {
                    const summary = interaction.options.getString('summary', true);
                    const success = await ticketService.closeTicket(interaction.guild, interaction.channelId, interaction.user, summary);
                    if (success) {
                        return interaction.reply({ content: '🔒 Ticket has been closed.', flags: MessageFlags.Ephemeral });
                    } else {
                        return interaction.reply({ content: 'Failed to close ticket.', flags: MessageFlags.Ephemeral });
                    }
                }
            }

        } catch (error) {
            logger.error(`Error in /support command:`, error);
            const msg = 'An error occurred while executing the command.';
            if (interaction.deferred || interaction.replied) await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
            else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
        }
    }

    public override async autocompleteRun(interaction: Command.AutocompleteInteraction) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(true);

        if (subcommandGroup === 'config' && subcommand === 'type-remove') {
            const focusedOption = interaction.options.getFocused(true);
            if (focusedOption.name === 'name') {
                const configService = container.resolve<ISupportConfigService>('ISupportConfigService');
                const config = await configService.getConfig(interaction.guildId!);
                const choices = config.ticketTypes
                    .filter(t => t.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .map(t => ({ name: t.name, value: t.name }));
                return interaction.respond(choices.slice(0, 25));
            }
        }
    }
}
