export class CleanService {
  async getItem(id: string): Promise<{ id: string }> {
    try {
      return { id };
    } catch (error) {
      throw new Error(`Failed to get item: ${error}`);
    }
  }
}
