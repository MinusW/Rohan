# Skill: Create a Mongoose Schema and Repository

## Objective
Generate a Mongoose Schema/Model and its corresponding Repository for database access.

## Guidelines
1. **Model** (`src/modules/<module>/models/<Name>Model.ts`):
   - Define a TypeScript interface representing the document.
   - Create a Mongoose Schema.
   - Export the Mongoose Model.

2. **Repository Interface** (`src/modules/<module>/repositories/I<Name>Repository.ts`):
   - Define the contract for data access (e.g., `findById`, `create`, `update`).

3. **Repository Implementation** (`src/modules/<module>/repositories/<Name>Repository.ts`):
   - Implement the interface using `@injectable()` from `tsyringe`.
   - Use the Mongoose Model to perform database operations.

## Example Repository
```typescript
import { injectable } from 'tsyringe';
import { IUserRepository } from './IUserRepository';
import { UserModel, IUserDocument } from '../models/UserModel';

@injectable()
export class UserRepository implements IUserRepository {
    public async findById(id: string): Promise<IUserDocument | null> {
        return UserModel.findOne({ userId: id }).exec();
    }
    
    public async create(data: Partial<IUserDocument>): Promise<IUserDocument> {
        return UserModel.create(data);
    }
}
```
