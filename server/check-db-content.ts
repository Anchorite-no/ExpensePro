
import { db } from './src/db/index';
import { expenses } from './src/db/schema';

async function check() {
  try {
    const allExpenses = await db.select().from(expenses);
    console.log(`Found ${allExpenses.length} expenses in the database.`);
    if (allExpenses.length > 0) {
      console.log('First expense:', allExpenses[0]);
    }
  } catch (error) {
    console.error('Error querying database:', error);
  }
  process.exit(0);
}

check();
