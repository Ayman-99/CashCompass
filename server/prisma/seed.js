const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

// Hardcoded accounts from CSV
const accounts = [
  { name: 'Reflect', currency: 'ILS' },
  { name: 'Arab ILS', currency: 'ILS' },
  { name: 'Arab JD', currency: 'JOD' },
  { name: 'BOP ILS', currency: 'ILS' },
  { name: 'BOP USD', currency: 'USD' },
  { name: 'BOP JD', currency: 'JOD' },
  { name: 'Cash', currency: 'ILS' },
];

// Hardcoded categories from CSV
const categories = [
  { name: 'General Income', type: 'Income', subcategory: null },
  { name: 'Debt', type: 'Expense', subcategory: null },
  { name: 'Debt', type: 'Income', subcategory: null },
  { name: 'Wheels', type: 'Expense', subcategory: null },
  { name: 'Utilities', type: 'Expense', subcategory: null },
  { name: 'Food', type: 'Expense', subcategory: null },
  { name: 'Withdraw', type: 'Expense', subcategory: null },
  { name: 'Shopping', type: 'Expense', subcategory: null },
  { name: 'Personal', type: 'Expense', subcategory: 'Cosmetics' },
  { name: 'Salary', type: 'Income', subcategory: null },
  { name: 'Entertainment', type: 'Expense', subcategory: null },
  { name: 'Business', type: 'Income', subcategory: null },
  { name: 'Business', type: 'Expense', subcategory: null },
  { name: 'General', type: 'Income', subcategory: null },
  { name: 'General', type: 'Expense', subcategory: null },
  { name: 'Gifts', type: 'Expense', subcategory: null },
  { name: 'Rent', type: 'Expense', subcategory: null },
  { name: 'Transport', type: 'Expense', subcategory: null },
  { name: 'Health', type: 'Expense', subcategory: 'Medications' },
];

// Default currencies (rates can be updated via the currency API)
const currencies = [
  { code: 'ILS', name: 'Israeli Shekel', rateToILS: 1.0, isBase: true, isActive: true },
  { code: 'USD', name: 'US Dollar', rateToILS: 3.5, isBase: false, isActive: true },
  { code: 'JOD', name: 'Jordanian Dinar', rateToILS: 4.6, isBase: false, isActive: true },
];

async function main() {
  console.log('🌱 Starting database seed...');

  // Find or create admin user
  let user = await prisma.user.findUnique({
    where: { username: 'admin' }
  });

  if (!user) {
    console.log('👤 Creating admin user...');
    const passwordHash = await bcrypt.hash('admin', 10);
    user = await prisma.user.create({
      data: {
        username: 'admin',
        email: 'admin@example.com',
        passwordHash,
        canAccessWeb: true,
        allowedIps: null // Allow from any IP for admin
      }
    });
    console.log('✅ Admin user created');
    console.log('   Username: admin');
    console.log('   Password: admin');
  } else {
    console.log('✅ Admin user already exists');
  }

  // Clear existing accounts, categories, and currencies for this user (but keep transactions)
  console.log('🗑️  Clearing existing accounts, categories, and currencies for user...');
  await prisma.category.deleteMany({ where: { userId: user.id } });
  await prisma.account.deleteMany({ where: { userId: user.id } });
  await prisma.currency.deleteMany({ where: { userId: user.id } });
  console.log('✅ Cleared existing accounts, categories, and currencies');

  // Create accounts
  if (accounts.length > 0) {
    console.log('💼 Creating accounts...');
    for (const account of accounts) {
      await prisma.account.create({
        data: {
          userId: user.id,
          name: account.name,
          currency: account.currency,
          balance: 0
        }
      });
      console.log(`  ✅ Account: ${account.name} (${account.currency})`);
    }
  }

  // Create categories
  if (categories.length > 0) {
    console.log('📂 Creating categories...');
    for (const category of categories) {
      await prisma.category.create({
        data: {
          userId: user.id,
          name: category.name,
          type: category.type,
          subcategory: category.subcategory || null
        }
      });
      console.log(`  ✅ Category: ${category.name} (${category.type})${category.subcategory ? ` - ${category.subcategory}` : ''}`);
    }
  }

  // Create currencies
  if (currencies.length > 0) {
    console.log('💱 Creating currencies...');
    for (const currency of currencies) {
      await prisma.currency.create({
        data: {
          userId: user.id,
          code: currency.code,
          name: currency.name,
          rateToILS: currency.rateToILS,
          isBase: currency.isBase,
          isActive: currency.isActive
        }
      });
      console.log(`  ✅ Currency: ${currency.code} - ${currency.name} (Rate: ${currency.rateToILS} ILS)${currency.isBase ? ' [BASE]' : ''}`);
    }
  }

  console.log(`✅ Created ${accounts.length} account(s), ${categories.length} category(ies), and ${currencies.length} currency(ies)`);
  console.log('🎉 Seed completed successfully!');
  console.log('📝 Note: Admin user, accounts, categories, and currencies have been created.');
  console.log('   Use the web interface to fetch latest exchange rates and create transactions.');
}

main()
  .catch((e) => {
    console.error('❌ Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
