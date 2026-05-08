# Skill: Create a Sapphire Command

## Objective
Generate a new Discord slash command using `@sapphire/framework` and `tsyringe` for Dependency Injection.

## Guidelines
1. The command should be placed in `src/modules/<module_name>/commands/`.
2. It must extend the `Command` class from `@sapphire/framework`.
3. Do **not** inject dependencies in the constructor of the Command. Instead, use `container.resolve<IServiceType>('IServiceType')` inside the `chatInputRun` method.
4. Keep the command logic lightweight. All business logic must be delegated to the Service layer.

## Template Example

```typescript
import { Command } from '@sapphire/framework';
import { container } from 'tsyringe';
import { IMyService } from '../services/IMyService';

export class MyNewCommand extends Command {
    public constructor(context: Command.Context, options: Command.Options) {
        super(context, {
            ...options,
            name: 'mycommand',
            description: 'Does a cool thing'
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
        // Resolve the service
        const myService = container.resolve<IMyService>('IMyService');
        
        await interaction.deferReply();
        
        try {
            await myService.doCoolThing(interaction.user.id);
            await interaction.editReply('Success!');
        } catch (error) {
            await interaction.editReply('An error occurred.');
        }
    }
}
```
