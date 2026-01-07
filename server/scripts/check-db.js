require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkDatabase() {
  console.log('🔍 Checking database connection...\n');
  
  // Check DATABASE_URL
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set in .env file');
    console.log('📝 Make sure you have a .env file in the server/ directory');
    process.exit(1);
  }
  
  console.log('✅ DATABASE_URL is set');
  console.log(`   Database: ${process.env.DATABASE_URL.replace(/:[^:@]+@/, ':****@')}\n`);
  
  // Test connection
  try {
    await prisma.$connect();
    console.log('✅ Database connection successful\n');
  } catch (error) {
    console.error('❌ Database connection failed:');
    console.error(`   ${error.message}\n`);
    console.log('📝 Troubleshooting:');
    console.log('   1. Check if MySQL is running');
    console.log('   2. Verify DATABASE_URL in .env is correct');
    console.log('   3. Ensure the database exists');
    console.log('   4. Check network/firewall settings');
    process.exit(1);
  }
  
  // Check if users table exists and has data
  try {
    const userCount = await prisma.user.count();
    console.log(`📊 Users in database: ${userCount}`);
    
    if (userCount === 0) {
      console.log('\n⚠️  No users found in database!');
      console.log('📝 You need to create a user. Options:');
      console.log('   1. Run: npm run prisma:seed (creates admin/admin user)');
      console.log('   2. Or use: node scripts/setup-web-user.js <username>');
    } else {
      console.log('\n👥 Users:');
      const users = await prisma.user.findMany({
        select: {
          id: true,
          username: true,
          email: true,
          canAccessWeb: true
        }
      });
      
      users.forEach(user => {
        const webAccess = user.canAccessWeb ? '✅' : '❌';
        console.log(`   ${webAccess} ${user.username} (${user.email}) - Web Access: ${user.canAccessWeb ? 'Yes' : 'No'}`);
      });
      
      const usersWithWebAccess = users.filter(u => u.canAccessWeb).length;
      if (usersWithWebAccess === 0) {
        console.log('\n⚠️  No users have web access enabled!');
        console.log('📝 Enable web access with: node scripts/setup-web-user.js <username>');
      }
    }
  } catch (error) {
    console.error('❌ Error querying users:', error.message);
    console.log('📝 You may need to run: npm run prisma:migrate');
  }
  
  await prisma.$disconnect();
  console.log('\n✅ Database check complete');
}

checkDatabase().catch(console.error);

