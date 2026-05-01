const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

async function importCards() {
  const client = await pool.connect();
  
  try {
    // Path to card4.csv in parent directory
    const csvPath = path.join(__dirname, '../../card4.csv');
    
    if (!fs.existsSync(csvPath)) {
      console.error('❌ card4.csv not found at:', csvPath);
      console.log('\nPlease make sure card4.csv is in the project root directory');
      process.exit(1);
    }

    console.log('📂 Reading card4.csv...');
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.trim().split('\n');
    
    // Skip header
    const dataLines = lines.slice(1);
    
    console.log(`📊 Found ${dataLines.length} cards to import`);
    console.log('🔄 Importing cards...\n');

    let imported = 0;
    let skipped = 0;

    for (const line of dataLines) {
      const parts = line.split(',');
      
      if (parts.length < 26) {
        console.log(`⚠️  Skipping invalid line: ${line.substring(0, 50)}...`);
        skipped++;
        continue;
      }

      const cardName = parts[0].trim();
      const cardNumber = parseInt(cardName.split(' ')[1]) || imported + 1;
      
      // Extract columns (B, I, N, G, O)
      const bColumn = parts.slice(1, 6).map(n => parseInt(n));
      const iColumn = parts.slice(6, 11).map(n => parseInt(n));
      const nColumn = parts.slice(11, 16).map(n => parseInt(n));
      const gColumn = parts.slice(16, 21).map(n => parseInt(n));
      const oColumn = parts.slice(21, 26).map(n => parseInt(n));

      try {
        await client.query(
          `INSERT INTO bingo_cards (card_number, b_column, i_column, n_column, g_column, o_column)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (card_number) DO NOTHING`,
          [cardNumber, bColumn, iColumn, nColumn, gColumn, oColumn]
        );
        
        imported++;
        if (imported % 100 === 0) {
          console.log(`✅ Imported ${imported} cards...`);
        }
      } catch (error) {
        console.error(`❌ Error importing card ${cardNumber}:`, error.message);
        skipped++;
      }
    }

    console.log('\n🎉 Import completed!');
    console.log(`✅ Successfully imported: ${imported} cards`);
    if (skipped > 0) {
      console.log(`⚠️  Skipped: ${skipped} cards`);
    }

    // Show sample cards
    const sampleResult = await client.query(
      'SELECT card_number, b_column, i_column FROM bingo_cards ORDER BY card_number LIMIT 3'
    );
    
    console.log('\n📋 Sample cards:');
    sampleResult.rows.forEach(card => {
      console.log(`  Card #${card.card_number}: B=${card.b_column.join(',')}`);
    });

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

// Run import
importCards()
  .then(() => {
    console.log('\n✅ Import script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Import script failed:', error);
    process.exit(1);
  });
