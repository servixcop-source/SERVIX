require('dotenv').config();
const mongoose = require('mongoose');
const fs = require('fs');
const path = require('path');
const { Config, Service, Partner, Article } = require('./models');

async function migrateData() {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB.');

    // Read the current db.json
    const dbPath = path.join(__dirname, 'database', 'db.json');
    if (!fs.existsSync(dbPath)) {
      console.log('database/db.json not found! Exiting.');
      process.exit(0);
    }
    const data = JSON.parse(fs.readFileSync(dbPath, 'utf8'));

    // 1. Migrate Config (CMS + Admin)
    console.log('Migrating Config...');
    await Config.deleteMany({}); // Clear existing
    const configData = {
      type: 'main_config',
      admin: data.admin || { username: 'admin', password: '123' },
      cms: data.cms || {}
    };
    await Config.create(configData);

    // 2. Migrate Services
    if (data.services && data.services.length > 0) {
      console.log(`Migrating ${data.services.length} services...`);
      await Service.deleteMany({});
      await Service.insertMany(data.services);
    }

    // 3. Migrate Partners
    if (data.partners && data.partners.length > 0) {
      console.log(`Migrating ${data.partners.length} partners...`);
      await Partner.deleteMany({});
      await Partner.insertMany(data.partners);
    }

    // 4. Migrate Articles
    if (data.articles && data.articles.length > 0) {
      console.log(`Migrating ${data.articles.length} articles...`);
      await Article.deleteMany({});
      await Article.insertMany(data.articles);
    }

    console.log('Migration completed successfully! 🎉');
    process.exit(0);

  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migrateData();
