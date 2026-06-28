import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL must be set to seed the database.');
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

/**
 * An empty ProseMirror/Tiptap document: a single empty paragraph. This is the
 * minimal valid editor state, so the seeded workbook opens cleanly in the UI.
 */
const EMPTY_DOCUMENT: Prisma.InputJsonValue = {
  type: 'doc',
  content: [{ type: 'paragraph' }],
};

const SEED_USER_EMAIL = 'demo@workbook.dev';

async function main(): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: SEED_USER_EMAIL },
    update: {},
    create: {
      name: 'Demo User',
      email: SEED_USER_EMAIL,
      phone: '+1-555-0100',
      address: '123 Workbook Lane, San Francisco, CA',
    },
  });

  const existingProject = await prisma.project.findFirst({
    where: { userId: user.id, name: 'Demo Project' },
  });

  const project =
    existingProject ??
    (await prisma.project.create({
      data: { userId: user.id, name: 'Demo Project' },
    }));

  await prisma.workbook.upsert({
    where: { projectId: project.id },
    update: {},
    create: {
      projectId: project.id,
      content: EMPTY_DOCUMENT,
    },
  });

  console.log(`Seeded user "${user.email}" with project "${project.name}" and an empty workbook.`);
}

main()
  .catch((error: unknown) => {
    console.error('Seeding failed:', error);
    process.exitCode = 1;
  })
  .finally(() => {
    void prisma.$disconnect();
  });
