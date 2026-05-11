import { Listener } from '@sapphire/framework';
import {
    Interaction, ModalBuilder, TextInputBuilder, TextInputStyle,
    ActionRowBuilder, MessageFlags
} from 'discord.js';
import { container } from 'tsyringe';
import { IScrimService } from '@/modules/scrims/services/IScrimService';
import { IScrimConfigService } from '@/modules/scrims/services/IScrimConfigService';
import { ITimezoneService } from '@/modules/timezone/services/ITimezoneService';
import { ILogger } from '@/common/utils/logger/ILogger';
import { DateTime } from 'luxon';

export class ScrimInteractionListener extends Listener {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: 'interactionCreate'
        });
    }

    public async run(interaction: Interaction) {
        const logger = container.resolve<ILogger>('ILogger');

        try {
            if (interaction.isButton()) {
                await this.handleButton(interaction, logger);
            }

            if (interaction.isModalSubmit()) {
                await this.handleModal(interaction, logger);
            }
        } catch (error) {
            logger.error('Error in ScrimInteractionListener:', error);
        }
    }

    private async handleButton(interaction: any, logger: ILogger) {
        const customId: string = interaction.customId;

        // Only handle scrim-related buttons
        if (!customId.startsWith('scrim_')) return;

        const scrimService = container.resolve<IScrimService>('IScrimService');
        const configService = container.resolve<IScrimConfigService>('IScrimConfigService');
        const timezoneService = container.resolve<ITimezoneService>('ITimezoneService');

        // ── Create Scrim Button (from the panel) ──
        if (customId.startsWith('scrim_create_')) {
            const tier = customId.replace('scrim_create_', '');

            // Check if user has timezone set
            const userTz = await timezoneService.getUserTimezone(interaction.user.id);
            if (!userTz) {
                return interaction.reply({
                    content: 'You need to set your timezone before creating a scrim. Use `/timezone set` first.',
                    flags: MessageFlags.Ephemeral
                });
            }

            // Open the creation modal
            const modal = new ModalBuilder()
                .setCustomId(`scrim_modal_${tier}`)
                .setTitle(`Create Scrim — ${tier}`);

            const dateInput = new TextInputBuilder()
                .setCustomId('scrim_date')
                .setLabel('Date (e.g. 31.08)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('31.08')
                .setMinLength(5)
                .setMaxLength(5);

            const timeInput = new TextInputBuilder()
                .setCustomId('scrim_time')
                .setLabel('Time (HH:MM — 24h format)')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('18:30')
                .setMinLength(3)
                .setMaxLength(5);

            const matchCountInput = new TextInputBuilder()
                .setCustomId('scrim_match_count')
                .setLabel('Number of matches')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setPlaceholder('3')
                .setMaxLength(2);

            const extraInfoInput = new TextInputBuilder()
                .setCustomId('scrim_extra_info')
                .setLabel('Extra information (optional)')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(false)
                .setPlaceholder('Any additional details about the scrim...')
                .setMaxLength(500);

            modal.addComponents(
                new ActionRowBuilder<TextInputBuilder>().addComponents(dateInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(timeInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(matchCountInput),
                new ActionRowBuilder<TextInputBuilder>().addComponents(extraInfoInput)
            );

            await interaction.showModal(modal);
            return;
        }

        // ── Apply Button ──
        if (customId.startsWith('scrim_apply_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const scrimId = customId.replace('scrim_apply_', '');

            const success = await scrimService.applyToScrim(interaction.guild, scrimId, interaction.user.id);
            if (success) {
                return interaction.editReply({
                    content: 'Your application has been submitted. The organizer will be notified in the discussion thread.'
                });
            } else {
                return interaction.editReply({
                    content: 'Unable to apply. You may have already applied, be the creator, or the scrim may already be confirmed.'
                });
            }
        }

        // ── Withdraw Button ──
        if (customId.startsWith('scrim_withdraw_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const scrimId = customId.replace('scrim_withdraw_', '');

            const success = await scrimService.withdrawApplication(interaction.guild, scrimId, interaction.user.id);
            if (success) {
                return interaction.editReply({
                    content: 'Your application has been withdrawn.'
                });
            } else {
                return interaction.editReply({
                    content: 'You don\'t have an active application on this scrim.'
                });
            }
        }

        // ── Cancel Button ──
        if (customId.startsWith('scrim_cancel_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const scrimId = customId.replace('scrim_cancel_', '');

            const success = await scrimService.cancelScrim(interaction.guild, scrimId, interaction.user.id);
            if (success) {
                return interaction.editReply({
                    content: 'The scrim has been cancelled and archived.'
                });
            } else {
                return interaction.editReply({
                    content: 'Unable to cancel. Only the organizer, accepted applicant, or an administrator can cancel.'
                });
            }
        }

        // ── Conclude Button ──
        if (customId.startsWith('scrim_conclude_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const scrimId = customId.replace('scrim_conclude_', '');

            const success = await scrimService.concludeScrim(interaction.guild, scrimId, interaction.user.id);
            if (success) {
                return interaction.editReply({
                    content: 'The scrim has been concluded and archived.'
                });
            } else {
                return interaction.editReply({
                    content: 'Unable to conclude. Only the organizer or the accepted applicant can conclude a confirmed scrim.'
                });
            }
        }

        // ── Accept Applicant Button (in thread) ──
        if (customId.startsWith('scrim_accept_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const parts = customId.replace('scrim_accept_', '').split('_');
            const scrimId = parts[0];
            const applicantId = parts[1];

            const success = await scrimService.acceptApplicant(interaction.guild, scrimId, interaction.user.id, applicantId);
            if (success) {
                // Disable the buttons on this message
                try {
                    await interaction.message.edit({ components: [] });
                } catch { /* message may be deleted */ }

                return interaction.editReply({
                    content: `Accepted <@${applicantId}>. The scrim is now confirmed!`
                });
            } else {
                return interaction.editReply({
                    content: 'Unable to accept. You may not be the organizer, or someone has already been accepted.'
                });
            }
        }

        // ── Decline Applicant Button (in thread) ──
        if (customId.startsWith('scrim_decline_')) {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const parts = customId.replace('scrim_decline_', '').split('_');
            const scrimId = parts[0];
            const applicantId = parts[1];

            const success = await scrimService.declineApplicant(interaction.guild, scrimId, interaction.user.id, applicantId);
            if (success) {
                // Disable the buttons on this message
                try {
                    await interaction.message.edit({ components: [] });
                } catch { /* message may be deleted */ }

                return interaction.editReply({
                    content: `Declined <@${applicantId}>.`
                });
            } else {
                return interaction.editReply({
                    content: 'Unable to decline. You may not be the organizer.'
                });
            }
        }
    }

    private async handleModal(interaction: any, logger: ILogger) {
        // ── Scrim Creation Modal ──
        if (!interaction.customId.startsWith('scrim_modal_')) return;

        await interaction.deferReply({ flags: MessageFlags.Ephemeral });

        const tier = interaction.customId.replace('scrim_modal_', '');
        const dateStr = interaction.fields.getTextInputValue('scrim_date');
        const timeStr = interaction.fields.getTextInputValue('scrim_time');
        const matchCountStr = interaction.fields.getTextInputValue('scrim_match_count');
        const extraInfo = interaction.fields.getTextInputValue('scrim_extra_info') || undefined;

        // Validate date format (supports separators: . / : , - or space)
        const dateRegex = /^(\d{1,2})[.\/\\:, \-](\d{1,2})$/;
        const dateMatch = dateStr.match(dateRegex);
        if (!dateMatch) {
            return interaction.editReply({
                content: 'Invalid date format. Please use DD.MM (e.g. 31.08). You can use any separator like . / , or :'
            });
        }

        const day = parseInt(dateMatch[1], 10);
        const month = parseInt(dateMatch[2], 10);

        // Validate time format (supports separators: . / : , - or space)
        const timeRegex = /^(\d{1,2})[.\/\\:, \-](\d{1,2})$/;
        const timeMatch = timeStr.match(timeRegex);
        if (!timeMatch) {
            return interaction.editReply({
                content: 'Invalid time format. Please use HH:MM (e.g. 18:30). You can use any separator like : . or ,'
            });
        }

        const hour = parseInt(timeMatch[1], 10);
        const minute = parseInt(timeMatch[2], 10);

        if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
            return interaction.editReply({
                content: 'Invalid time. Hour must be 0-23 and minute 0-59.'
            });
        }

        // Validate match count
        const matchCount = parseInt(matchCountStr, 10);
        if (isNaN(matchCount) || matchCount < 1 || matchCount > 99) {
            return interaction.editReply({
                content: 'Match count must be a number between 1 and 99.'
            });
        }

        // Get user timezone and parse datetime
        const timezoneService = container.resolve<ITimezoneService>('ITimezoneService');
        const userTz = await timezoneService.getUserTimezone(interaction.user.id);

        if (!userTz) {
            return interaction.editReply({
                content: 'You need to set your timezone first. Use `/timezone set`.'
            });
        }



        let parsed = DateTime.now().setZone(userTz.timezone).set({
            day,
            month,
            hour,
            minute,
            second: 0,
            millisecond: 0
        });

        // If the date is in the past, move to next year
        if (parsed.toMillis() <= Date.now()) {
            parsed = parsed.plus({ years: 1 });
        }

        if (!parsed.isValid) {
            return interaction.editReply({
                content: `Invalid date or time. Please check your input. (${parsed.invalidExplanation})`
            });
        }

        // Validate future date
        if (parsed.toMillis() <= Date.now()) {
            return interaction.editReply({
                content: 'The scrim date must be in the future.'
            });
        }

        // Convert to UTC Date object
        const scheduledAt = parsed.toJSDate();

        if (!interaction.guild) {
            await interaction.editReply({ content: 'This can only be used in a server.' });
            return;
        }

        try {
            const scrimService = container.resolve<IScrimService>('IScrimService');

            // Determine the correct channel — the scrim channel, not the thread
            const configService = container.resolve<IScrimConfigService>('IScrimConfigService');
            const config = await configService.getConfig(interaction.guild.id);

            // Find which scrim channel this interaction came from
            let scrimChannelId = interaction.channelId;
            if (!config.scrimChannelIds.includes(scrimChannelId)) {
                // Might be interacting from a thread — check parent
                const ch = interaction.channel;
                if (ch?.isThread() && ch.parentId && config.scrimChannelIds.includes(ch.parentId)) {
                    scrimChannelId = ch.parentId;
                } else {
                    await interaction.editReply({ content: 'This channel is not configured as a scrim channel.' });
                    return;
                }
            }

            const scrim = await scrimService.createScrim(
                interaction.guild,
                scrimChannelId,
                interaction.user.id,
                scheduledAt,
                tier,
                matchCount,
                extraInfo
            );

            if (scrim) {
                await interaction.editReply({ content: 'Scrim created successfully! Check the channel for your request and discussion thread.' });
            } else {
                await interaction.editReply({ content: 'Failed to create scrim. You may have reached the limit of 5 active scrims, or there was a system error.' });
            }
        } catch (error) {
            logger.error('Error handling scrim modal submit:', error);
            await interaction.editReply({ content: 'An error occurred while creating your scrim.' });
        }
    }
}
