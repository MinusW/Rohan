# Skill: Create a Feature Module

## Objective
Scaffold a new feature module following SOLID and layered architecture.

## Guidelines
When requested to create a new module (e.g., `tickets`, `teams`), generate the following structure:

1. **Commands** (`src/modules/<module>/commands/`)
2. **Services** (`src/modules/<module>/services/`):
   - Define an interface `IMyService.ts`
   - Implement it in `MyService.ts` using `@injectable()`
3. **Repositories** (`src/modules/<module>/repositories/`):
   - Define an interface `IMyRepository.ts`
   - Implement it in `MyRepository.ts` using `@injectable()`
4. **Models** (`src/modules/<module>/models/`):
   - Define Mongoose Schema and Model
5. **Registration**: Ensure that the AI remembers to tell the user to register the new Services and Repositories inside `src/core/Container.ts`.

## Rules
* Services must only rely on Repository interfaces or other Service interfaces, never directly on Mongoose Models.
* Use `tsyringe` for all Dependency Injection.
