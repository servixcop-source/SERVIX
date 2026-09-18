require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

const { Config, Service, Partner, Article } = require('./models');

const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to MongoDB
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('Connected to MongoDB successfully!'))
  .catch(err => console.error('MongoDB connection error:', err));

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1y',
  setHeaders: (res, filePath) => {
    if (filePath.endsWith('.html')) {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
    } else {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
  }
}));

// ==========================================
// PUBLIC API ENDPOINTS
// ==========================================

// 1. Get Public Initial Data
app.get('/api/public/data', async (req, res) => {
  try {
    const config = await Config.findOne({ type: 'main_config' }) || {};
    const services = await Service.find({ active: true }).sort({ _id: -1 });
    const partners = await Partner.find({});
    
    res.json({
      success: true,
      services,
      hero: config.cms?.hero || {},
      about: config.cms?.about || {},
      logo: config.cms?.logo || {},
      contact: config.cms?.contact || {},
      seo: config.cms?.seo || {},
      socialLinks: config.cms?.socialLinks || {},
      partners
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// 2. Get Public Articles
app.get('/api/public/articles', async (req, res) => {
  try {
    const articles = await Article.find({ active: true }).sort({ _id: -1 });
    res.json({ success: true, articles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// 3. Get Public Article by Slug
app.get('/api/public/articles/:slug', async (req, res) => {
  try {
    const article = await Article.findOne({ slug: req.params.slug, active: true });
    if (article) {
      res.json({ success: true, article });
    } else {
      res.status(404).json({ success: false, message: 'المقال غير موجود' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// ==========================================
// ADMIN API ENDPOINTS (AUTHENTICATION & CMS)
// ==========================================

// --- Admin Login ---
app.post('/api/admin/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    let config = await Config.findOne({ type: 'main_config' });
    if (!config) {
       config = await Config.create({ type: 'main_config', admin: { username: 'admin', password: '123' }});
    }

    if (username === config.admin.username && password === config.admin.password) {
      const token = `srv_token_${Date.now()}_${Math.random().toString(36).substring(2)}`;
      return res.json({ success: true, message: 'تم تسجيل الدخول بنجاح!', token });
    }
    return res.status(401).json({ success: false, message: 'اسم المستخدم أو كلمة المرور غير صحيحة.' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// --- Change Credentials ---
app.post('/api/admin/change-credentials', async (req, res) => {
  try {
    const { currentPassword, newUsername, newPassword } = req.body;
    let config = await Config.findOne({ type: 'main_config' });
    
    if (currentPassword !== config.admin.password) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الحالية غير صحيحة.' });
    }
    if (!newPassword || newPassword.length < 3) {
      return res.status(400).json({ success: false, message: 'كلمة المرور الجديدة يجب أن تكون 3 أحرف على الأقل.' });
    }
    if (!newUsername || newUsername.length < 3) {
      return res.status(400).json({ success: false, message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل.' });
    }

    config.admin.username = newUsername;
    config.admin.password = newPassword;
    await config.save();
    res.json({ success: true, message: 'تم تغيير بيانات الدخول بنجاح!' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// --- Local Image Upload Endpoint ---
app.post('/api/admin/upload', (req, res) => {
  try {
    const { imageBase64 } = req.body;
    if (!imageBase64) {
      return res.status(400).json({ success: false, message: 'بيانات الصورة غير موجودة.' });
    }

    let buffer;
    let ext = '.jpg';

    if (imageBase64.startsWith('data:')) {
      const parts = imageBase64.split(',');
      const metadata = parts[0];
      if (metadata.includes('png')) ext = '.png';
      else if (metadata.includes('svg')) ext = '.svg';
      else if (metadata.includes('webp')) ext = '.webp';
      else if (metadata.includes('gif')) ext = '.gif';
      
      buffer = Buffer.from(parts[1], 'base64');
    } else {
      buffer = Buffer.from(imageBase64, 'base64');
    }

    const cleanName = `upload_${Date.now()}_${Math.floor(Math.random() * 1000)}${ext}`;
    const filePath = path.join(uploadsDir, cleanName);
    fs.writeFileSync(filePath, buffer);

    const fileUrl = `/uploads/${cleanName}`;
    res.json({ success: true, url: fileUrl, message: 'تم رفع الصورة بنجاح!' });
  } catch (err) {
    console.error('Upload error:', err);
    res.status(500).json({ success: false, message: 'حدث خطأ أثناء رفع الصورة.' });
  }
});

// --- Admin Articles Management ---
app.get('/api/admin/articles', async (req, res) => {
  try {
    const articles = await Article.find({}).sort({ _id: -1 });
    res.json({ success: true, articles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.post('/api/admin/articles', async (req, res) => {
  try {
    const newArticle = new Article({ ...req.body, id: `art-${Date.now()}` });
    await newArticle.save();
    res.json({ success: true, message: 'تم إضافة المقال بنجاح!', article: newArticle });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.put('/api/admin/articles/:id', async (req, res) => {
  try {
    const updated = await Article.findOneAndUpdate({ id: req.params.id }, req.body, { new: true });
    if (updated) {
      res.json({ success: true, message: 'تم تحديث المقال بنجاح!' });
    } else {
      res.status(404).json({ success: false, message: 'المقال غير موجود' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.delete('/api/admin/articles/:id', async (req, res) => {
  try {
    const deleted = await Article.findOneAndDelete({ id: req.params.id });
    if (deleted) {
      res.json({ success: true, message: 'تم حذف المقال بنجاح!' });
    } else {
      res.status(404).json({ success: false, message: 'المقال غير موجود' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// --- Services CRUD Management ---
app.get('/api/admin/services', async (req, res) => {
  try {
    const data = await Service.find({}).sort({ _id: -1 });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.post('/api/admin/services', async (req, res) => {
  try {
    const { title, shortDesc, features, featuresEn } = req.body;
    if (!title || !shortDesc) {
      return res.status(400).json({ success: false, message: 'اسم الخدمة والوصف المختصر مطلوبان.' });
    }

    const newService = new Service({
      ...req.body,
      id: `srv-${Date.now()}`,
      category: req.body.category || 'صيانة وتشغيل',
      icon: req.body.icon || 'home_repair_service',
      fullDesc: req.body.fullDesc || shortDesc,
      priceType: req.body.priceType || 'حسب الطلب',
      imageUrl: req.body.imageUrl || 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?auto=format&fit=crop&w=800&q=80',
      features: Array.isArray(features) ? features : (typeof features === 'string' ? features.split('\n').filter(Boolean) : []),
      featuresEn: Array.isArray(featuresEn) ? featuresEn : (typeof featuresEn === 'string' ? featuresEn.split('\n').filter(Boolean) : []),
      active: true
    });

    await newService.save();
    res.status(201).json({ success: true, message: 'تمت إضافة الخدمة بنجاح.', data: newService });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.put('/api/admin/services/:id', async (req, res) => {
  try {
    const features = Array.isArray(req.body.features)
      ? req.body.features
      : (typeof req.body.features === 'string' ? req.body.features.split('\n').filter(Boolean) : undefined);
    const featuresEn = Array.isArray(req.body.featuresEn)
      ? req.body.featuresEn
      : (typeof req.body.featuresEn === 'string' ? req.body.featuresEn.split('\n').filter(Boolean) : undefined);
    
    const updateData = { ...req.body };
    if (features !== undefined) updateData.features = features;
    if (featuresEn !== undefined) updateData.featuresEn = featuresEn;

    const updated = await Service.findOneAndUpdate({ id: req.params.id }, updateData, { new: true });
    if (updated) {
      res.json({ success: true, message: 'تم تحديث الخدمة بنجاح.', data: updated });
    } else {
      res.status(404).json({ success: false, message: 'الخدمة غير موجودة.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.delete('/api/admin/services/:id', async (req, res) => {
  try {
    const deleted = await Service.findOneAndDelete({ id: req.params.id });
    if (deleted) {
      res.json({ success: true, message: 'تم حذف الخدمة.' });
    } else {
      res.status(404).json({ success: false, message: 'الخدمة غير موجودة.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// --- CMS Settings Management ---
app.get('/api/admin/cms', async (req, res) => {
  try {
    const config = await Config.findOne({ type: 'main_config' });
    res.json({ success: true, data: config?.cms || {} });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.put('/api/admin/cms', async (req, res) => {
  try {
    const { hero, heroEn, about, aboutEn, contact, seo, socialLinks } = req.body;
    let config = await Config.findOne({ type: 'main_config' });
    if (!config) config = new Config({ type: 'main_config', cms: {} });

    if (hero) config.cms.hero = hero;
    if (heroEn) config.cms.heroEn = heroEn;
    if (about) config.cms.about = about;
    if (aboutEn) config.cms.aboutEn = aboutEn;
    if (contact) config.cms.contact = { ...config.cms.contact, ...contact };
    if (seo) config.cms.seo = { ...config.cms.seo, ...seo };
    if (socialLinks) config.cms.socialLinks = { ...config.cms.socialLinks, ...socialLinks };

    config.markModified('cms');
    await config.save();
    
    res.json({ success: true, message: 'تم حفظ إعدادات المحتوى والتواصل بنجاح.', data: config.cms });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// --- Partners CRUD Management ---
app.get('/api/admin/partners', async (req, res) => {
  try {
    const data = await Partner.find({}).sort({ _id: -1 });
    res.json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.post('/api/admin/partners', async (req, res) => {
  try {
    const { name, logo } = req.body;
    if (!name) return res.status(400).json({ success: false, message: 'اسم الشريك مطلوب.' });
    
    const newPartner = new Partner({ id: `p-${Date.now()}`, name, logo: logo || '' });
    await newPartner.save();
    
    res.status(201).json({ success: true, message: 'تمت إضافة الشريك بنجاح.', data: newPartner });
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

app.delete('/api/admin/partners/:id', async (req, res) => {
  try {
    const deleted = await Partner.findOneAndDelete({ id: req.params.id });
    if (deleted) {
      res.json({ success: true, message: 'تم حذف الشريك.' });
    } else {
      res.status(404).json({ success: false, message: 'الشريك غير موجود.' });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server Error' });
  }
});

// Serve frontend fallback
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`🚀 SERVIX Platform Server Running on http://localhost:${PORT}`);
  console.log(`🌐 Public Portal: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
