require('dotenv').config();

const fs = require('fs');
const path = require('path');
const db = require('./db');

const dataDir = path.join(__dirname, 'data');

const readJson = (name) =>
  JSON.parse(fs.readFileSync(path.join(dataDir, name), 'utf8'));

async function migrate() {
  const news = readJson('news.json');
  const services = readJson('services.json');
  const exchange = readJson('exchange.json');
  const profile = readJson('profile.json');

  const client = await db.connect();

  try {
    await client.query('BEGIN');

    // News
    for (const item of news) {
      await client.query(
        `INSERT INTO news
          (id, title, description, image_name, video_url, published, date)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           image_name = EXCLUDED.image_name,
           video_url = EXCLUDED.video_url,
           published = EXCLUDED.published,
           date = EXCLUDED.date`,
        [
          item.id,
          item.title,
          item.description || '',
          item.image || '',
          item.video || '',
          item.published !== false,
          item.date || ''
        ]
      );
    }

    // Services
    for (const item of services) {
      await client.query(
        `INSERT INTO services
          (id, title, description, icon, details, contact, location,
           opening_hours, website, published, date, image_name, phone)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
         ON CONFLICT (id) DO UPDATE SET
           title = EXCLUDED.title,
           description = EXCLUDED.description,
           icon = EXCLUDED.icon,
           details = EXCLUDED.details,
           contact = EXCLUDED.contact,
           location = EXCLUDED.location,
           opening_hours = EXCLUDED.opening_hours,
           website = EXCLUDED.website,
           published = EXCLUDED.published,
           date = EXCLUDED.date,
           image_name = EXCLUDED.image_name,
           phone = EXCLUDED.phone`,
        [
          item.id,
          item.title,
          item.description || '',
          item.icon || '',
          item.details || '',
          item.contact || '',
          item.location || '',
          item.openingHours || '',
          item.website || '',
          item.published !== false,
          item.date || '',
          item.imageName || '',
          item.phone || ''
        ]
      );
    }

    // Exchange rate
    await client.query('DELETE FROM exchange_rates');
    await client.query(
      `INSERT INTO exchange_rates (rate, updated_at)
       VALUES ($1, $2)`,
      [
        Number(exchange.rate),
        exchange.updatedAt || new Date().toISOString()
      ]
    );

    // Profile
    await client.query('DELETE FROM profiles');
    await client.query(
      `INSERT INTO profiles
        (name, phone_number, address, profile_image, updated_at)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        profile.name || '',
        profile.phoneNumber || '',
        profile.address || '',
        profile.profileImage || '',
        profile.updatedAt || new Date().toISOString()
      ]
    );

    await client.query('COMMIT');

    console.log('Migration completed successfully.');
    console.log(`News: ${news.length}`);
    console.log(`Services: ${services.length}`);
    console.log('Exchange: 1');
    console.log('Profile: 1');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await db.end();
  }
}

migrate();
