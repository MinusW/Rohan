import { Command } from '@sapphire/framework';
import { PermissionFlagsBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel, MessageFlags } from 'discord.js';

export class TeamCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'team',
            description: 'Manage team related functionality'
        });
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
                .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('send-panel')
                        .setDescription('Sends the interactive team creation panel to the current channel')
                )
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand(true);

        if (!interaction.guild || !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            return interaction.reply({ content: 'This command can only be used by admins in a server.', flags: MessageFlags.Ephemeral });
        }

        try {
            if (subcommand === 'send-panel') {
                const embed = new EmbedBuilder()
                    .setTitle('Team Creation')
                    .setDescription('Click the button below to start the process of creating a new team.')
                    .setColor('Green');

                const button = new ButtonBuilder()
                    .setCustomId('team_create_start')
                    .setLabel('Create Team')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji('👥');

                const row = new ActionRowBuilder<ButtonBuilder>().addComponents(button);

                if (interaction.channel && interaction.guild) {
                    const channel = interaction.channel as TextChannel;
                    await channel.send({ embeds: [embed], components: [row] });
                    return interaction.reply({ content: 'Team creation panel sent successfully!', flags: MessageFlags.Ephemeral });
                }
                return interaction.reply({ content: 'Failed to send panel here.', flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            const msg = 'An error occurred while executing the command.';
            if (interaction.deferred || interaction.replied) await interaction.followUp({ content: msg, flags: MessageFlags.Ephemeral });
            else await interaction.reply({ content: msg, flags: MessageFlags.Ephemeral });
        }
    }
}
