// الخادم الأساسي لنظام مسابقة الطلاب - الكلية التقنية الهندسية كركوك
// تصميم و برمجة: المبرمج مصطفى هاشم قاسم
// ============================================================================
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const crypto = require('crypto');

const app = express();
const PORT = process.env.PORT || 3000;

// ========== إعدادات الخادم ==========
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json());
app.use(express.static('public'));

// ========== إعدادات قاعدة البيانات ==========
// ⚠️ استبدل هذا الرابط بـ Connection String الخاص بك من MongoDB Atlas
const MONGODB_URI = "mongodb+srv://kirkukmustafa10_db_user:ne0E3tyyHzNk8JNe@cluster0.lri2lhy.mongodb.net/quizdb?retryWrites=true&w=majority&appName=Cluster0";
                 //   const MONGODB_URI = "mongodb+srv://kirkukmustafa10_db_user:<db_password>@cluster0.lri2lhy.mongodb.net/?appName=Cluster0";
mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => {
  console.log('✅ متصل بقاعدة بيانات MongoDB Atlas');
}).catch(err => {
  console.error('❌ فشل الاتصال بقاعدة البيانات:', err);
});

// ========== نموذج النتيجة ==========
const ResultSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  department: { type: String, required: true },
  grade: { type: String, required: true },
  score: { type: Number, required: true },
  totalPossible: { type: Number, required: true },
  totalTime: { type: Number, required: true },
  date: { type: Date, default: Date.now }
});

const Result = mongoose.model('Result', ResultSchema);

// ========== إعدادات المعلم ==========
const ADMIN_PASSWORD_HASH = '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b'; // كلمة المرور: "1"
function hashPassword(password) {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
}
let quizActive = true;

function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || sessionId !== 'admin_session_123') {
    return res.status(401).json({ error: 'غير مصرح لك بالدخول' });
  }
  next();
}

// ========== APIs ==========

// تسجيل دخول المعلم
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body;
  if (!password) return res.status(400).json({ error: 'يرجى إدخال كلمة المرور' });
  if (hashPassword(password) === ADMIN_PASSWORD_HASH) {
    return res.json({ success: true, sessionId: 'admin_session_123' });
  } else {
    return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
  }
});

// جلب حالة المسابقة
app.get('/api/quiz-status', (req, res) => {
  res.json({ active: quizActive });
});

// تبديل حالة المسابقة
app.post('/api/toggle-quiz', requireAuth, (req, res) => {
  quizActive = !quizActive;
  res.json({ success: true, active: quizActive });
});

// حفظ نتيجة الطالب
app.post('/api/save-result', (req, res) => {
  if (!quizActive) {
    return res.status(400).json({ success: false, error: 'المسابقة مغلقة حاليًا' });
  }

  const { fullName, department, grade, score, totalPossible, totalTime } = req.body;
  if (!fullName || !department || !grade || score == null || totalPossible == null || totalTime == null) {
    return res.status(400).json({ success: false, error: 'جميع الحقول مطلوبة' });
  }

  const result = new Result({ fullName, department, grade, score, totalPossible, totalTime });
  result.save()
    .then(() => res.json({ success: true }))
    .catch(err => {
      console.error('❌ خطأ في الحفظ:', err);
      res.status(500).json({ success: false, error: 'فشل حفظ النتيجة' });
    });
});

// جلب النتائج (مرتبة حسب الدرجة والوقت)
app.get('/api/results', requireAuth, (req, res) => {
  Result.find()
    .sort({ score: -1, totalTime: 1 })
    .then(results => res.json(results))
    .catch(err => {
      console.error('❌ خطأ في جلب النتائج:', err);
      res.status(500).json({ error: 'خطأ في جلب النتائج' });
    });
});

// تصدير النتائج إلى CSV
app.get('/api/export-csv', (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId || sessionId !== 'admin_session_123') {
    return res.status(401).send('غير مصرح لك بالدخول');
  }

  Result.find().sort({ score: -1, totalTime: 1 })
    .then(results => {
      let csvData = '\uFEFF'; // BOM لدعم UTF-8 في Excel
      csvData += 'الاسم الكامل,القسم,المستوى,الدرجة,الحد الأقصى,الوقت المستغرق,تاريخ الإرسال\n';

      results.forEach(r => {
        const escape = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;
        const row = [
          escape(r.fullName),
          escape(r.department),
          escape(r.grade),
          r.score ?? '',
          r.totalPossible ?? '',
          r.totalTime ?? '',
          escape(new Date(r.date).toLocaleString('ar-EG'))
        ].join(',');
        csvData += row + '\n';
      });

      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
      res.send(csvData);
    })
    .catch(err => {
      console.error('❌ خطأ في تصدير CSV:', err);
      res.status(500).send('خطأ أثناء إنشاء ملف CSV');
    });
});

// ========== تشغيل الخادم ==========
app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على المنفذ: ${PORT}`);
});