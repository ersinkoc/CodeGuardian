const db = {
  query: (sql: string) => Promise.resolve([]),
};

export async function getUser(id: string) {
  const result = await db.query(`SELECT * FROM users WHERE id = ${id}`);
  return result;
}
