const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

require('dotenv').config({ path: path.resolve(__dirname, '..', '..', '.env') });

// Use a pooled runtime URL when available, while Prisma CLI can keep using DATABASE_URL for migrations.
const connectionString = process.env.POOLED_DATABASE_URL || process.env.DATABASE_URL;

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

module.exports = prisma;
