# Discord Bot Architecture Design Notes

This document outlines the architecture for a general-purpose, highly modular Discord bot built with TypeScript, `@sapphire/framework` (Discord.js), `tsyringe` (Dependency Injection), and databases using Mongoose (MongoDB) and SQLite. The design adheres strictly to SOLID principles, DRY methodologies, Google TypeScript Style guidelines, and robust Object-Oriented Programming (OOP) paradigms.

## 1. Technology Stack
* **Language**: TypeScript (Strict mode enabled, adhering to Google TS Style Guide).
* **Framework**: `@sapphire/framework` (built on Discord.js) for structured command and event handling.
* **Dependency Injection**: `tsyringe` for managing class dependencies and enforcing inversion of control.
* **Database**: MongoDB with `mongoose` for schema validation and object modeling.
* **Environment**: Node.js.

## 2. Core Architectural Principles (SOLID & OOP)
The bot will be structured around a multi-tier architecture to ensure separation of concerns:

1. **Presentation Layer (Discord Interface)**: Discord events, slash commands, and interaction handlers managed by Sapphire.
2. **Application Layer (Services)**: Business logic, orchestrating data and bot actions, injected via `tsyringe`.
3. **Data Access Layer (Repositories)**: Abstraction over Mongoose models.

### SOLID Application
* **Single Responsibility Principle (SRP)**: Each class has one reason to change. A Sapphire Command class only handles parsing input, a Service class handles business logic, a Repository handles DB queries.
* **Open/Closed Principle (OCP)**: The module structure allows adding new features (commands/events/services) without modifying existing core logic.
* **Liskov Substitution Principle (LSP)**: Interfaces will be used for Services and Repositories. Any class implementing a repository interface can replace another without breaking the system.
* **Dependency Inversion Principle (DIP)**: High-level modules (Commands) depend on abstractions (Interfaces/Repositories) injected via `tsyringe`, not concrete implementations or database schemas.

## 3. Directory Structure

```text
/
├── skills/                 # Guidelines and prompts for LLMs to generate standard codebase components
│   ├── create_command.md   # Skill: Generates a new Sapphire command adhering to DI and OOP
│   ├── create_module.md    # Skill: Scaffolds a new feature module (Service + Repo + Model + Interfaces)
│   └── create_schema.md    # Skill: Generates a Mongoose schema and corresponding Repository
├── src/
│   ├── core/               # Core bot initialization and DI setup
│   │   ├── BotClient.ts    # Extended SapphireClient
│   │   ├── Database.ts     # MongoDB connection setup
│   │   ├── SqliteDatabase.ts # SQLite connection setup
│   │   └── Container.ts    # tsyringe container registration
│   ├── common/             # Shared resources
│   │   ├── exceptions/     # Custom error classes (e.g., DatabaseError)
│   │   ├── types/          # Global TS Types and Interfaces
│   │   └── utils/          # Helper functions (e.g., Logger, formatters)
│   ├── modules/            # Feature modules (Highly decoupled)
│   │   └── tickets/        # Support ticket system
│   └── index.ts            # Application entry point
```
*(Note: As requested, other features like moderation, team organization, scrim scheduling, PUGs, and Elo calculation are not listed here but will follow the exact same module pattern as `tickets` when they are requested in the future).*

## 4. Module Architecture (The "Feature" Pattern)
To ensure the bot remains modular, each feature will be self-contained within the `src/modules/` directory.

A standard module (e.g., `tickets`) will look like this:

```text
src/modules/tickets/
├── commands/               # Sapphire commands specific to tickets (/ticket open)
│   └── OpenTicketCommand.ts
├── listeners/              # Sapphire event listeners (e.g., interactionCreate for buttons)
│   └── TicketButtonListener.ts
├── models/                 # Mongoose schemas/models
│   └── TicketModel.ts
├── repositories/           # Data access layer
│   ├── ITicketRepository.ts
│   └── TicketRepository.ts
└── services/               # Business logic
    ├── ITicketService.ts
    └── TicketService.ts
```

## 5. Key Interfaces and Classes

### The Bot Client (Sapphire)
We extend `SapphireClient` to initialize our DI container and database before logging in.
```typescript
import { SapphireClient } from '@sapphire/framework';
import { container } from 'tsyringe';

export class BotClient extends SapphireClient {
    // ... setup and login logic ...
}
```

### Dependency Injection (tsyringe)
Services and Repositories are registered and injected using `tsyringe` decorators.
```typescript
import { injectable, inject } from 'tsyringe';
import { ITicketRepository } from '../repositories/ITicketRepository';
import { ITicketService } from './ITicketService';

@injectable()
export class TicketService implements ITicketService {
    constructor(
        @inject('ITicketRepository') private readonly ticketRepository: ITicketRepository
    ) {}

    public async createTicket(userId: string): Promise<void> {
        // ... business logic ...
        await this.ticketRepository.create({ ownerId: userId });
    }
}
```

### Sapphire Command
Commands resolve dependencies from the globally accessible `tsyringe` container to perform actions, keeping the command purely focused on parsing the interaction.
```typescript
import { Command } from '@sapphire/framework';
import { container } from 'tsyringe';
import { ITicketService } from '../services/ITicketService';

export class OpenTicketCommand extends Command {
    public override async chatInputRun(interaction: Command.ChatInputCommandInteraction) {
        const ticketService = container.resolve<ITicketService>('ITicketService');
        await ticketService.createTicket(interaction.user.id);
        
        await interaction.reply('Ticket created!');
    }
}
```
```
