import { readFileSync } from 'fs';
import { createRequire } from 'module';
import pg from 'pg';

const require = createRequire(import.meta.url);
const XLSX = require('xlsx');

const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const wb = XLSX.readFile('attached_assets/2025_Kocham_KJH_1786963239997.xlsx');
const ws = wb.Sheets['콜드메일 발송용 KOCHAM 주소록 정리'];
const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });

// Skip header row
const companies = [];
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  if (!row || !row[1]) continue;

  const name = String(row[1]).trim();
  const address = row[2] ? String(row[2]).trim() : '';
  const province = row[3] ? String(row[3]).trim() : '';
  const tel = row[4] ? String(row[4]).trim() : '';
  const website = row[5] ? String(row[5]).trim() : '';
  const mobile = row[7] ? String(row[7]).trim() : '';
  const email = row[8] ? String(row[8]).trim() : '';
  const category = row[9] ? String(row[9]).trim() : '';

  const type = category === 'Manufacturing' ? 'customer' : 'supplier';
  const location = province ? (address ? `${province} — ${address}` : province) : address;
  const phone = tel || mobile || '';
  const description = category;

  companies.push({ name, type, location, phone, contact_email: email, description });
}

console.log(`Total companies to import: ${companies.length}`);
console.log(`  - 고객사 (Manufacturing): ${companies.filter(c => c.type === 'customer').length}`);
console.log(`  - 공급사 (Others):        ${companies.filter(c => c.type === 'supplier').length}`);

const client = await pool.connect();
try {
  await client.query('BEGIN');

  // Delete existing companies
  const del = await client.query('DELETE FROM companies');
  console.log(`\nDeleted ${del.rowCount} existing companies`);

  // Insert in batches of 100
  const BATCH = 100;
  let inserted = 0;
  for (let i = 0; i < companies.length; i += BATCH) {
    const batch = companies.slice(i, i + BATCH);
    const values = [];
    const params = [];
    let idx = 1;
    for (const c of batch) {
      values.push(`($${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++}, $${idx++})`);
      params.push(c.name, c.type, c.location, c.phone, c.contact_email, c.description);
    }
    await client.query(
      `INSERT INTO companies (name, type, location, phone, contact_email, description)
       VALUES ${values.join(', ')}`,
      params
    );
    inserted += batch.length;
    if (inserted % 500 === 0 || inserted === companies.length) {
      process.stdout.write(`  Inserted ${inserted}/${companies.length}\r`);
    }
  }

  await client.query('COMMIT');
  console.log(`\n\nDone! ${inserted} companies imported successfully.`);

  // Summary
  const summary = await client.query(
    "SELECT type, COUNT(*) FROM companies GROUP BY type ORDER BY type"
  );
  console.log('\nFinal DB count:');
  summary.rows.forEach(r => console.log(`  ${r.type}: ${r.count}`));
} catch (err) {
  await client.query('ROLLBACK');
  console.error('Import failed, rolled back:', err.message);
  process.exit(1);
} finally {
  client.release();
  await pool.end();
}
