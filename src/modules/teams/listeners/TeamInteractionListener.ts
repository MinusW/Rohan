import { Listener } from '@sapphire/framework';
import { Interaction, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle, ActionRowBuilder } from 'discord.js';
import { container } from 'tsyringe';
import { ITicketService } from '@/modules/tickets/services/ITicketService';
import { ITicketRepository } from '@/modules/tickets/repositories/ITicketRepository';
import { ILogger } from '@/common/utils/logger/ILogger';

export class TeamInteractionListener extends Listener {
    public constructor(context: Listener.LoaderContext, options: Listener.Options) {
        super(context, {
            ...options,
            event: 'interactionCreate'
        });
    }

    public async run(interaction: Interaction) {
        const logger = container.resolve<ILogger>('ILogger');

        try {
            if (interaction.isButton() && interaction.customId === 'team_create_start') {
                await this.handleStartButton(interaction);
            }

            if (interaction.isModalSubmit() && interaction.customId === 'team_create_modal') {
                await this.handleModalSubmit(interaction, logger);
            }
        } catch (error) {
            logger.error('Error in TeamInteractionListener:', error);
        }
    }

    private async handleStartButton(interaction: any) {
        const modal = new ModalBuilder()
            .setCustomId('team_create_modal')
            .setTitle('Create Your Team');

        const teamNameInput = new TextInputBuilder()
            .setCustomId('team_name')
            .setLabel('What is the name of your team?')
            .setStyle(TextInputStyle.Short)
            .setPlaceholder('Enter team name here...')
            .setRequired(true)
            .setMaxLength(50);

        const row = new ActionRowBuilder<TextInputBuilder>().addComponents(teamNameInput);
        modal.addComponents(row);

        await interaction.showModal(modal);
    }

    private async handleModalSubmit(interaction: any, logger: ILogger) {
        const ticketService = container.resolve<ITicketService>('ITicketService');
        const ticketRepo = container.resolve<ITicketRepository>('ITicketRepository');

        if (!interaction.guild) return;

        await interaction.reply({ content: 'Creating your team registration ticket...', flags: MessageFlags.Ephemeral });

        try {
            const teamName = interaction.fields.getTextInputValue('team_name');
            const existingTickets = await ticketRepo.countOpenTickets(interaction.guild.id, interaction.user.id);

            if (existingTickets >= 1) {
                await interaction.editReply({ content: 'You already have an open ticket. Please close it before starting a new team registration.' });
                return;
            }

            const ticketType = 'Team Creation';
            const title = `Team: ${teamName}`;
            const desc = `User ${interaction.user.tag} has requested to create a team named: **${teamName}**.`;

            const channel = await ticketService.createTicketChannel(interaction.guild, interaction.user, ticketType, title, desc);
            
            if (channel) {
                await interaction.editReply({ content: `Team creation ticket created successfully! Please head over to ${channel.toString()}` });
            } else {
                await interaction.editReply({ content: 'Failed to create ticket channel. An administrator may not have configured the ticket system correctly.' });
            }
        } catch (error) {
            logger.error('Error handling team creation modal submit:', error);
            await interaction.editReply({ content: 'An error occurred while processing your team creation request.' });
        }
    }
}
