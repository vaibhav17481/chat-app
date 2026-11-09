/**
 * Wipes the tables the test suite works with.
 *
 * The friendship table uses a restrictive foreign key, so it has to be emptied
 * before the users - otherwise the cleanup of the next test file fails.
 */
export const resetDatabase = async () => {
  const { default: prisma } = await import("../src/lib/prisma.js");

  await prisma.reaction.deleteMany();
  await prisma.message.deleteMany();
  await prisma.friend.deleteMany();
  await prisma.user.deleteMany();
};
