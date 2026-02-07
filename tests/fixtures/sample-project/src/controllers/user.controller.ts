import { UserService } from '../services/user.service';

const userService = new UserService();

export async function getUser(id: string) {
  return userService.getUser(id);
}

export async function listUsers() {
  return userService.listUsers();
}
