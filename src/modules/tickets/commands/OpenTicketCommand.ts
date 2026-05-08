import { Command } from '@sapphire/framework';
import { container } from 'tsyringe';
import { ITicketService } from '../services/ITicketService';

export class OpenTicketCommand extends Command {
    public constructor(context: Command.Context, options: Command.Options) {
        super(context, {
            ...options,
            name: 'ticket',
            description: 'Open a new support ticket'
        });
    }

    public override registerApplicationCommands(registry: Command.Registry) {
        registry.registerChatInputCommand((builder) =>
            builder
                .setName(this.name)
                .setDescription(this.description)
        );
    }

    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const ticketService = container.resolve<ITicketService>('ITicketService');
        
        await interaction.deferReply({ ephemeral: true });
        
        try {
            await ticketService.createTicket(interaction.user.id);
            await interaction.editReply('Your ticket has been created successfully!');
        } catch (error) {
            console.error(error);
            await interaction.editReply('An error occurred while creating your ticket.');
        }
    }
}
