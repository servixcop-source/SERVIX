const mongoose = require('mongoose');

// ==========================================
// Mongoose Schemas & Models
// ==========================================

const configSchema = new mongoose.Schema({
  type: { type: String, required: true, unique: true }, // e.g., 'main_config'
  admin: {
    username: { type: String, default: 'admin' },
    password: { type: String, default: '123' }
  },
  cms: {
    hero: { type: Object, default: {} },
    heroEn: { type: Object, default: {} }, // English hero texts
    about: { type: Object, default: {} },
    aboutEn: { type: Object, default: {} }, // English about
    logo: { type: Object, default: {} },
    contact: { type: Object, default: {} },
    seo: { type: Object, default: {} },
    socialLinks: { type: Object, default: {} }
  }
});

const serviceSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  titleEn: { type: String }, // English
  category: { type: String },
  categoryEn: { type: String }, // English
  icon: { type: String },
  shortDesc: { type: String },
  shortDescEn: { type: String }, // English
  fullDesc: { type: String },
  fullDescEn: { type: String }, // English
  priceType: { type: String },
  priceTypeEn: { type: String }, // English
  imageUrl: { type: String },
  features: { type: Array, default: [] },
  featuresEn: { type: Array, default: [] }, // English
  active: { type: Boolean, default: true }
});

const partnerSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  name: { type: String },
  logo: { type: String }
});

const articleSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  titleEn: { type: String }, // English
  slug: { type: String, required: true },
  shortDesc: { type: String },
  shortDescEn: { type: String }, // English
  content: { type: String },
  contentEn: { type: String }, // English
  imageUrl: { type: String },
  metaTitle: { type: String },
  metaDescription: { type: String },
  keywords: { type: String },
  date: { type: String },
  active: { type: Boolean, default: true }
});

module.exports = {
  Config: mongoose.model('Config', configSchema),
  Service: mongoose.model('Service', serviceSchema),
  Partner: mongoose.model('Partner', partnerSchema),
  Article: mongoose.model('Article', articleSchema)
};
