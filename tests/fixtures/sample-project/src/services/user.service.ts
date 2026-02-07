export class UserService {
  async getUser(id: string): Promise<{ id: string; name: string }> {
    return { id, name: 'Test User' };
  }

  async listUsers(): Promise<Array<{ id: string; name: string }>> {
    return [{ id: '1', name: 'User 1' }];
  }
}
