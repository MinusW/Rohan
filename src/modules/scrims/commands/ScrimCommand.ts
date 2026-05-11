import { Command } from '@sapphire/framework';
import { container } from 'tsyringe';
import { ChannelType, PermissionFlagsBits, EmbedBuilder, MessageFlags } from 'discord.js';
import { IScrimConfigService } from '@/modules/scrims/services/IScrimConfigService';
import { ILogger } from '@/common/utils/logger/ILogger';

export class ScrimCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'scrim',
            description: 'Manage the scrim scheduling system'
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
                        .setDescription('Configure the scrim system (Admin only)')
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('set-channel')
                                .setDescription('Designate the current channel as a scrim channel and deploy the panel')
                        )
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('remove-channel')
                                .setDescription('Remove the current channel as a scrim channel')
                        )
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('set-log-channel')
                                .setDescription('Set the channel where archived scrims are logged')
                                .addChannelOption(option =>
                                    option.setName('channel')
                                        .setDescription('The log channel')
                                        .setRequired(true)
                                        .addChannelTypes(ChannelType.GuildText)
                                )
                        )
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('set-schedule-channel')
                                .setDescription('Set the channel where scrim starts are announced')
                                .addChannelOption(option =>
                                    option.setName('channel')
                                        .setDescription('The schedule channel')
                                        .setRequired(true)
                                        .addChannelTypes(ChannelType.GuildText)
                                )
                        )
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('add-tier')
                                .setDescription('Add a scrim tier')
                                .addStringOption(option => option.setName('name').setDescription('Name of the tier').setRequired(true))
                                .addStringOption(option => option.setName('description').setDescription('Description of the tier').setRequired(true))
                        )
                        .addSubcommand(subcommand =>
                            subcommand
                                .setName('remove-tier')
                                .setDescription('Remove a scrim tier')
                                .addStringOption(option => option.setName('name').setDescription('Name of the tier').setRequired(true).setAutocomplete(true))
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('help')
                        .setDescription('View all scrim commands and how the system works')
                )
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(true);

        const configService = container.resolve<IScrimConfigService>('IScrimConfigService');
        const logger = container.resolve<ILogger>('ILogger');

        if (!interaction.guild) {
            return interaction.reply({ content: 'This command can only be used in a server.', flags: MessageFlags.Ephemeral });
        }

        try {
            if (subcommand === 'help') {
                return this.handleHelp(interaction, configService);
            }

            if (subcommandGroup === 'config') {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return interaction.reply({ content: 'You do not have permission to use config commands.', flags: MessageFlags.Ephemeral });
                }

                if (subcommand === 'set-channel') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    await configService.addScrimChannel(interaction.guild.id, interaction.channelId);
                    await configService.updatePanel(interaction.guild, interaction.channelId);
                    return interaction.editReply({ content: 'This channel has been set up as a scrim channel. Panel deployed!' });
                }

                if (subcommand === 'remove-channel') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const config = await configService.getConfig(interaction.guild.id);
                    if (!config.scrimChannelIds.includes(interaction.channelId)) {
                        return interaction.editReply({ content: 'This channel is not configured as a scrim channel.' });
                    }

                    // Remove the panel message
                    const panelMsgId = config.panelMessageIds.get(interaction.channelId);
                    if (panelMsgId && interaction.channel) {
                        const msg = await interaction.channel.messages.fetch(panelMsgId).catch(() => null);
                        if (msg) await msg.delete().catch(() => null);
                    }

                    await configService.removeScrimChannel(interaction.guild.id, interaction.channelId);
                    return interaction.editReply({ content: 'This channel has been removed as a scrim channel.' });
                }

                if (subcommand === 'set-log-channel') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const channel = interaction.options.getChannel('channel', true);
                    await configService.setLogChannel(interaction.guild.id, channel.id);
                    return interaction.editReply({ content: `Scrim log channel set to ${channel.toString()}` });
                }

                if (subcommand === 'set-schedule-channel') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const channel = interaction.options.getChannel('channel', true);
                    await configService.setScheduleChannel(interaction.guild.id, channel.id);
                    return interaction.editReply({ content: `Scrim schedule channel set to ${channel.toString()}` });
                }

                if (subcommand === 'add-tier') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const name = interaction.options.getString('name', true);
                    const description = interaction.options.getString('description', true);

                    const config = await configService.getConfig(interaction.guild.id);
                    const exists = config.tiers.some(t => t.name.toLowerCase() === name.toLowerCase());
                    if (exists) {
                        return interaction.editReply({ content: `A tier named **${name}** already exists.` });
                    }

                    await configService.addTier(interaction.guild.id, name, description, interaction.guild);
                    return interaction.editReply({ content: `Added scrim tier **${name}**. Panels updated!` });
                }

                if (subcommand === 'remove-tier') {
                    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                    const name = interaction.options.getString('name', true);
                    await configService.removeTier(interaction.guild.id, name, interaction.guild);
                    return interaction.editReply({ content: `Removed scrim tier **${name}**. Panels updated!` });
                }
            }
        } catch (error) {
            logger.error('Error in /scrim command:', error);
            const msg = 'An error occurred while executing the command.';
            if (interaction.deferred || interaction.replied) await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
            else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
        }
    }

    private async handleHelp(interaction: Command.ChatInputCommandInteraction, configService: IScrimConfigService) {
        const config = await configService.getConfig(interaction.guild!.id);

        const scrimChannels = config.scrimChannelIds.length > 0
            ? config.scrimChannelIds.map(id => `<#${id}>`).join(', ')
            : '`Not set`';
        const logChannel = config.logChannelId ? `<#${config.logChannelId}>` : '`Not set`';
        const scheduleChannel = config.scheduleChannelId ? `<#${config.scheduleChannelId}>` : '`Not set`';
        const tierList = config.tiers.length > 0
            ? config.tiers.map(t => `\`${t.name}\` — ${t.description}`).join('\n')
            : '`None configured`';

        const overviewEmbed = new EmbedBuilder()
            .setTitle('Scrim Scheduling System')
            .setDescription(
                'A system for scheduling and managing competitive scrimmages. ' +
                'Users create scrim requests via the panel, other teams apply, and organizers accept or decline.'
            )
            .addFields(
                { name: 'Scrim Channels', value: scrimChannels, inline: false },
                { name: 'Log Channel', value: logChannel, inline: true },
                { name: 'Schedule Channel', value: scheduleChannel, inline: true }
            )
            .setColor(0x2B2D31);

        const workflowEmbed = new EmbedBuilder()
            .setTitle('How It Works')
            .setDescription(
                '```\n' +
                '1. Click a tier button on the scrim panel\n' +
                '2. Fill in date, time, match count, and details\n' +
                '3. Your scrim request appears in the channel\n' +
                '4. A discussion thread is created underneath\n' +
                '5. Other teams apply via the Apply button\n' +
                '6. You accept or decline in the thread\n' +
                '7. Once the date passes, the scrim is archived\n' +
                '```'
            )
            .addFields(
                { name: 'Green', value: 'Open — accepting applications', inline: true },
                { name: 'Yellow', value: 'Has pending applicants', inline: true },
                { name: 'Purple', value: 'Confirmed — applicant accepted', inline: true }
            )
            .setColor(0x2B2D31);

        const commandsEmbed = new EmbedBuilder()
            .setTitle('Commands Reference')
            .addFields(
                {
                    name: 'Admin Configuration (Manage Server)',
                    value: [
                        '`/scrim config set-channel` — Set up the current channel for scrims',
                        '`/scrim config remove-channel` — Remove current channel',
                        '`/scrim config set-log-channel` — Set the archive channel',
                        '`/scrim config add-tier` — Add a scrim tier button',
                        '`/scrim config remove-tier` — Remove a scrim tier'
                    ].join('\n')
                },
                {
                    name: 'General',
                    value: '`/scrim help` — Show this help page'
                }
            )
            .setColor(0x2B2D31);

        const statusEmbed = new EmbedBuilder()
            .setTitle('Current Configuration')
            .addFields(
                { name: 'Scrim Channels', value: scrimChannels, inline: true },
                { name: 'Log Channel', value: logChannel, inline: true },
                { name: 'Tiers', value: tierList, inline: false }
            )
            .setColor(0x2B2D31)
            .setFooter({ text: 'TicketLock — Scrims' })
            .setTimestamp();

        return interaction.reply({
            embeds: [overviewEmbed, workflowEmbed, commandsEmbed, statusEmbed],
            flags: MessageFlags.Ephemeral
        });
    }

    public override async autocompleteRun(interaction: Command.AutocompleteInteraction) {
        const subcommandGroup = interaction.options.getSubcommandGroup(false);
        const subcommand = interaction.options.getSubcommand(true);

        if (subcommandGroup === 'config' && subcommand === 'remove-tier') {
            const focusedOption = interaction.options.getFocused(true);
            if (focusedOption.name === 'name') {
                const configService = container.resolve<IScrimConfigService>('IScrimConfigService');
                const config = await configService.getConfig(interaction.guildId!);
                const choices = config.tiers
                    .filter(t => t.name.toLowerCase().includes(focusedOption.value.toLowerCase()))
                    .map(t => ({ name: t.name, value: t.name }));
                return interaction.respond(choices.slice(0, 25));
            }
        }
    }
}
