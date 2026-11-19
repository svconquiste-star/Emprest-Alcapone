// Cria a tabela "Contact_ALCAPONE" no schema Dados_Cliente_Emprest (idempotente).
// Uso: node --env-file=.env.local scripts/init-db.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
const T = '"Dados_Cliente_Emprest"."Contact_ALCAPONE"';

async function main() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS ${T} (
      "id"              TEXT PRIMARY KEY,
      "nomeEmpresa"     VARCHAR(255) NOT NULL,
      "nome"            VARCHAR(255) NOT NULL,
      "telefone"        VARCHAR(20)  NOT NULL,
      "email"           VARCHAR(255),
      "cidade"          VARCHAR(255) NOT NULL,
      "deviceType"      VARCHAR(50),
      "operatingSystem" VARCHAR(50),
      "whatsappLink"    TEXT,
      "createdAt"       TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt"       TIMESTAMPTZ(3) NOT NULL,
      "ipAddress"       VARCHAR(45),
      "userAgent"       TEXT
    )`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Contact_ALCAPONE_telefone_idx"  ON ${T}("telefone")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Contact_ALCAPONE_email_idx"     ON ${T}("email")`);
  await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "Contact_ALCAPONE_createdAt_idx" ON ${T}("createdAt")`);

  const cols = await prisma.$queryRawUnsafe(`
    SELECT column_name, data_type FROM information_schema.columns
    WHERE table_schema = 'Dados_Cliente_Emprest' AND table_name = 'Contact_ALCAPONE'
    ORDER BY ordinal_position`);
  console.log('✓ Tabela Contact_ALCAPONE pronta:');
  cols.forEach((c) => console.log(`  - ${c.column_name} (${c.data_type})`));
}

main()
  .catch((e) => { console.error('❌', e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
