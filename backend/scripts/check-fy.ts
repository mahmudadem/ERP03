
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  const fv = await prisma.fiscalYear.findMany({
    include: {
      periods: true
    }
  });
  console.log(JSON.stringify(fv, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
  });
