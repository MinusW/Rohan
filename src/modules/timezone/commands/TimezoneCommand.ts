import { Command } from '@sapphire/framework';
import { container } from 'tsyringe';
import { EmbedBuilder, MessageFlags } from 'discord.js';
import { ITimezoneService } from '../services/ITimezoneService';
import { ILogger } from '@/common/utils/logger/ILogger';
import { DateTime } from 'luxon';

export class TimezoneCommand extends Command {
    public constructor(context: Command.LoaderContext, options: Command.Options) {
        super(context, {
            ...options,
            name: 'timezone',
            description: 'Manage your personal timezone settings'
        });
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('set')
                        .setDescription('Set your local timezone')
                        .addStringOption(option =>
                            option
                                .setName('timezone')
                                .setDescription('Your IANA timezone (e.g. America/New_York)')
                                .setRequired(true)
                                .setAutocomplete(true)
                        )
                )
                .addSubcommand(subcommand =>
                    subcommand
                        .setName('view')
                        .setDescription('View your current timezone settings')
                )
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const subcommand = interaction.options.getSubcommand(true);
        const timezoneService = container.resolve<ITimezoneService>('ITimezoneService');
        const logger = container.resolve<ILogger>('ILogger');

        try {
            if (subcommand === 'set') {
                const tz = interaction.options.getString('timezone', true);
                
                if (!timezoneService.isValidTimezone(tz)) {
                    return interaction.reply({
                        content: `**${tz}** is not a valid IANA timezone identifier. Please select an option from the list.`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                await timezoneService.setUserTimezone(interaction.user.id, tz);
                
                const now = DateTime.now().setZone(tz);
                const embed = new EmbedBuilder()
                    .setTitle('Timezone Updated')
                    .setDescription(`Your timezone has been set to \`${tz}\`.`)
                    .addFields({
                        name: 'Local Time',
                        value: now.toLocaleString(DateTime.DATETIME_MED)
                    })
                    .setColor(0x2B2D31);

                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }

            if (subcommand === 'view') {
                const userTz = await timezoneService.getUserTimezone(interaction.user.id);

                if (!userTz) {
                    return interaction.reply({
                        content: 'No timezone configured. Use `/timezone set` to establish your local time.',
                        flags: MessageFlags.Ephemeral
                    });
                }

                const now = DateTime.now().setZone(userTz.timezone);
                const embed = new EmbedBuilder()
                    .setTitle('Timezone Configuration')
                    .addFields(
                        { name: 'Timezone', value: userTz.timezone, inline: true },
                        { name: 'Current Time', value: now.toLocaleString(DateTime.DATETIME_MED), inline: true }
                    )
                    .setColor(0x2B2D31);

                return interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
            }
        } catch (error) {
            logger.error(`Error in /timezone command:`, error);
            return interaction.reply({
                content: 'An error occurred while managing your timezone settings.',
                flags: MessageFlags.Ephemeral
            });
        }
    }

    public override async autocompleteRun(interaction: Command.AutocompleteInteraction) {
        const focusedOption = interaction.options.getFocused(true);
        
        if (focusedOption.name === 'timezone') {
            const timezoneService = container.resolve<ITimezoneService>('ITimezoneService');
            const allTimezones = timezoneService.getAllTimezones();
            
            const filtered = allTimezones
                .filter(tz => tz.toLowerCase().includes(focusedOption.value.toLowerCase()))
                .slice(0, 25)
                .map(tz => ({ name: tz, value: tz }));

            return interaction.respond(filtered);
        }
    }
}
