import { UserService } from '../src/services/UserService';
import { AppDataSource } from '../src/data-source';
import { User } from '../src/models/User';

beforeAll(async () => {
    await AppDataSource.initialize();
});

afterAll(async () => {
    await AppDataSource.destroy();
});

describe('UserService', () => {
    const userService = new UserService();

    it('should register a new user', async () => {
        const username = 'testuser';
        const password = 'password123';
        const role = 'user';

        const user = await userService.register(username, password, role);

        expect(user).toBeDefined();
        expect(user.username).toBe(username);
        expect(user.role).toBe(role);
    });

    it('should hash passwords', async () => {
        const username = 'testuser2';
        const password = 'password123';
        const role = 'user';

        const user = await userService.register(username, password, role);

        expect(user.password).not.toBe(password);
    });

    it('should not allow duplicate usernames', async () => {
        const username = 'duplicateuser';
        const password = 'password123';
        const role = 'user';

        await userService.register(username, password, role);

        await expect(userService.register(username, password, role)).rejects.toThrow();
    });
});
