import { Listener } from '@sapphire/framework';
import { Interaction, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder } from 'discord.js';
import { container } from 'tsyringe';
import { ITicketService } from '@/modules/tickets/services/ITicketService';
import { ITicketRepository } from '@/modules/tickets/repositories/ITicketRepository';
import { ISupportConfigService } from '@/modules/tickets/services/ISupportConfigService';
import { ILogger } from '@/common/utils/logger/ILogger';

export class TicketInteractionListener extends Listener {
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
            logger.error('Error in TicketInteractionListener:', error);
        }
    }

    private async hasSupportPermission(interaction: any, configService: ISupportConfigService): Promise<boolean> {
        if (!interaction.guild) return false;

        const config = await configService.getConfig(interaction.guild.id);
        if (config.supportRoleId) {
            const member = await interaction.guild.members.fetch(interaction.user.id).catch(() => null);
            if (!member || !member.roles.cache.has(config.supportRoleId)) {
                if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                    return false;
                }
            }
        }
        return true;
    }

    private async handleButton(interaction: any, logger: ILogger) {
        const ticketService = container.resolve<ITicketService>('ITicketService');
        const configService = container.resolve<ISupportConfigService>('ISupportConfigService');

        // ── Ticket Creation Buttons (from the panel) ──
        if (interaction.customId.startsWith('ticket_create_')) {
            const ticketType = interaction.customId.replace('ticket_create_', '');

            const modal = new ModalBuilder()
                .setCustomId(`ticket_modal_${ticketType}`)
                .setTitle(`Create ${ticketType} Ticket`);

            const titleInput = new TextInputBuilder()
                .setCustomId('ticket_title')
                .setLabel('Brief title for your issue')
                .setStyle(TextInputStyle.Short)
                .setRequired(true)
                .setMaxLength(100);

            const descInput = new TextInputBuilder()
                .setCustomId('ticket_desc')
                .setLabel('Detailed description')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000);

            const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(titleInput);
            const secondActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(descInput);

            modal.addComponents(firstActionRow, secondActionRow);
            await interaction.showModal(modal);
            return;
        }

        // ── Claim Button (inside ticket channel) ──
        if (interaction.customId === 'ticket_claim') {
            if (!interaction.guild) return;

            if (!(await this.hasSupportPermission(interaction, configService))) {
                return interaction.reply({ content: 'You do not have permission to claim tickets.', flags: MessageFlags.Ephemeral });
            }

            const success = await ticketService.claimTicket(interaction.guild, interaction.channelId, interaction.user);
            if (success) {
                return interaction.reply({ content: `${interaction.user.toString()} will take charge of this ticket.` });
            } else {
                return interaction.reply({ content: 'Failed to claim ticket.', flags: MessageFlags.Ephemeral });
            }
        }

        // ── Close Button (inside ticket channel) ──
        if (interaction.customId === 'ticket_close') {
            const modal = new ModalBuilder()
                .setCustomId('ticket_close_modal')
                .setTitle('Close Ticket');

            const summaryInput = new TextInputBuilder()
                .setCustomId('close_summary')
                .setLabel('Resolution summary')
                .setStyle(TextInputStyle.Paragraph)
                .setRequired(true)
                .setMaxLength(1000)
                .setPlaceholder('Describe how the issue was resolved...');

            const row = new ActionRowBuilder<TextInputBuilder>().addComponents(summaryInput);
            modal.addComponents(row);

            await interaction.showModal(modal);
            return;
        }

        // ── Reopen Button (after ticket is closed) ──
        if (interaction.customId === 'ticket_reopen') {
            if (!interaction.guild) return;

            if (!(await this.hasSupportPermission(interaction, configService))) {
                return interaction.reply({ content: 'You do not have permission to reopen tickets.', flags: MessageFlags.Ephemeral });
            }

            const success = await ticketService.reopenTicket(interaction.guild, interaction.channelId, interaction.user);
            if (success) {
                try {
                    await interaction.message.edit({ components: [] });
                } catch { /* message may be ephemeral or deleted */ }

                const reopenEmbed = new EmbedBuilder()
                    .setTitle('🔓 Ticket Reopened')
                    .setDescription(`This ticket has been reopened by ${interaction.user.toString()}.`)
                    .setColor('Green')
                    .setTimestamp();

                return interaction.reply({ embeds: [reopenEmbed] });
            } else {
                return interaction.reply({ content: 'Failed to reopen ticket.', flags: MessageFlags.Ephemeral });
            }
        }

        // ── Delete Button (after ticket is closed) ──
        if (interaction.customId === 'ticket_delete') {
            if (!interaction.guild) return;

            if (!(await this.hasSupportPermission(interaction, configService))) {
                return interaction.reply({ content: 'You do not have permission to delete ticket channels.', flags: MessageFlags.Ephemeral });
            }

            await interaction.reply({ content: 'Deleting channel...', flags: MessageFlags.Ephemeral });
            await ticketService.deleteTicketChannel(interaction.guild, interaction.channelId);
            return;
        }
    }

    private async handleModal(interaction: any, logger: ILogger) {
        const ticketService = container.resolve<ITicketService>('ITicketService');

        // ── Ticket Creation Modal ──
        if (interaction.customId.startsWith('ticket_modal_')) {
            const ticketType = interaction.customId.replace('ticket_modal_', '');
            const title = interaction.fields.getTextInputValue('ticket_title');
            const desc = interaction.fields.getTextInputValue('ticket_desc');

            await interaction.reply({ content: 'Creating your ticket...', flags: MessageFlags.Ephemeral });

            if (!interaction.guild) {
                await interaction.editReply({ content: 'This can only be used in a server.' });
                return;
            }

            try {
                const ticketRepo = container.resolve<ITicketRepository>('ITicketRepository');
                const existingTickets = await ticketRepo.countOpenTickets(interaction.guild.id, interaction.user.id);

                if (existingTickets >= 1) {
                    await interaction.editReply({ content: 'You already have an open ticket. Please close it before creating a new one.' });
                    return;
                }

                const channel = await ticketService.createTicketChannel(interaction.guild, interaction.user, ticketType, title, desc);
                if (channel) {
                    await interaction.editReply({ content: `Ticket created successfully! Please head over to ${channel.toString()}` });
                } else {
                    await interaction.editReply({ content: 'Failed to create ticket channel. An administrator may not have configured the ticket category correctly.' });
                }
            } catch (error) {
                logger.error('Error handling ticket modal submit:', error);
                await interaction.editReply({ content: 'An error occurred while creating your ticket.' });
            }
            return;
        }

        // ── Close Ticket Modal ──
        if (interaction.customId === 'ticket_close_modal') {
            if (!interaction.guild) return;

            const summary = interaction.fields.getTextInputValue('close_summary');
            const success = await ticketService.closeTicket(interaction.guild, interaction.channelId, interaction.user, summary);

            if (success) {
                return interaction.reply({ content: '🔒 Ticket has been closed.', flags: MessageFlags.Ephemeral });
            } else {
                return interaction.reply({ content: 'Failed to close ticket.', flags: MessageFlags.Ephemeral });
            }
        }
    }
}
