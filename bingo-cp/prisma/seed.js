const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');
  
  try {
    const seedDataPath = path.join(__dirname, 'seed-data.json');
    if (!fs.existsSync(seedDataPath)) {
      console.warn('seed-data.json not found in prisma folder, skipping map seeding.');
      return;
    }
    
    const seedDataRaw = fs.readFileSync(seedDataPath, 'utf8');
    const mapData = JSON.parse(seedDataRaw);
    
    // Check if the Europe map already exists
    const existing = await prisma.ttrMap.findFirst({
      where: { name: mapData.name }
    });
    
    if (!existing) {
      console.log(`Seeding map: ${mapData.name}`);
      await prisma.ttrMap.create({
        data: {
          name: mapData.name,
          width: mapData.width,
          height: mapData.height,
          data: mapData.data
        }
      });
      console.log(`Seeded map: ${mapData.name} successfully.`);
    } else {
      console.log(`Map "${mapData.name}" already exists in the database. Skipping.`);
    }
  } catch (error) {
    console.error('Error during seeding:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
