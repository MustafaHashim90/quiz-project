// الخادم الأساسي لنظام مسابقة الطلاب - الكلية التقنية الهندسية كركوك
// تصميم و برمجة: المبرمج مصطفى هاشم قاسم
// ============================================================================
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const { Request, Connection, TYPES } = require('tedious');
const crypto = require('crypto');

const app = express();
// ✅ استخدام PORT من البيئة (مطلوب لـ SmarterASP.NET)
const PORT = process.env.PORT || 3000;

// ========== إعدادات الخادم ==========
// ✅ السماح بجميع المصادر مؤقتًا (يمكنك تقييدها لاحقًا)
app.use(cors({
  origin: true, // يُعيد أصل الطلب الأصلي (Origin)
  credentials: true
}));
app.use(bodyParser.json());
// ✅ تغيير مسار frontend إلى مجلد 'public' (مهم للنشر)
app.use(express.static('public'));

// ========== بيانات الاتصال بقاعدة البيانات ==========
const sqlConfig = {
  server: 'sql6031.site4now.net',
  authentication: {
    type: 'default',
    options: {
      userName: 'db_ac2415_dbarshif_admin',
      password: 'DBArshif34'
    }
  },
  options: {
    database: 'db_ac2415_dbarshif',
    encrypt: true,
    rowCollectionOnRequestCompletion: true
  }
};

// ========== إعدادات المعلم ==========
const ADMIN_PASSWORD_HASH = '6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b'; // كلمة المرور: "1"
function hashPassword(password) {
  return crypto.createHash('sha256').update(password, 'utf8').digest('hex');
}
let quizActive = true; // حالة المسابقة (مفتوحة/مغلقة)

// ========== دالة التحقق من المصادقة ==========
function requireAuth(req, res, next) {
  const sessionId = req.headers['x-session-id'];
  if (!sessionId || sessionId !== 'admin_session_123') {
    return res.status(401).json({ error: 'غير مصرح لك بالدخول' });
  }
  next();
}

// ========== API: تسجيل دخول المعلم ==========
app.post('/api/admin-login', (req, res) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({ error: 'يرجى إدخال كلمة المرور' });
  }
  if (hashPassword(password) === ADMIN_PASSWORD_HASH) {
    return res.json({ success: true, sessionId: 'admin_session_123' });
  } else {
    return res.status(401).json({ error: 'كلمة المرور غير صحيحة' });
  }
});

// ========== API: جلب حالة المسابقة ==========
app.get('/api/quiz-status', (req, res) => {
  res.json({ active: quizActive });
});

// ========== API: تبديل حالة المسابقة ==========
app.post('/api/toggle-quiz', requireAuth, (req, res) => {
  quizActive = !quizActive;
  res.json({ success: true, active: quizActive });
});

// ========== API: حفظ نتيجة الطالب ==========
app.post('/api/save-result', (req, res) => {
  if (!quizActive) {
    return res.status(400).json({ success: false, error: 'المسابقة مغلقة حاليًا' });
  }

  const { fullName, department, grade, score, totalPossible, totalTime } = req.body;

  if (!fullName || !department || !grade || score == null || totalPossible == null || totalTime == null) {
    return res.status(400).json({ success: false, error: 'جميع الحقول مطلوبة' });
  }

  const connection = new Connection(sqlConfig);
  connection.on('connect', (err) => {
    if (err) {
      console.error('❌ فشل الاتصال بقاعدة البيانات:', err);
      return res.status(500).json({ success: false, error: 'فشل الاتصال بقاعدة البيانات' });
    }

    const sql = `
      INSERT INTO dbo.Results (FullName, Department, Grade, Score, TotalPossible, TotalTime, SubmissionDate)
      VALUES (@fullName, @department, @grade, @score, @totalPossible, @totalTime, GETDATE())
    `;

    const request = new Request(sql, (err) => {
      if (err) {
        console.error('❌ خطأ أثناء الحفظ:', err);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'فشل حفظ النتيجة' });
        }
      } else {
        if (!res.headersSent) {
          res.json({ success: true });
        }
      }
      connection.close();
    });

    request.addParameter('fullName', TYPES.NVarChar, fullName);
    request.addParameter('department', TYPES.NVarChar, department);
    request.addParameter('grade', TYPES.NVarChar, grade);
    request.addParameter('score', TYPES.Int, score);
    request.addParameter('totalPossible', TYPES.Int, totalPossible);
    request.addParameter('totalTime', TYPES.Int, totalTime);

    connection.execSql(request);
  });

  connection.connect();
});

// ========== API: جلب النتائج (مرتبة حسب أعلى درجة وأقل وقت) ==========
app.get('/api/results', requireAuth, (req, res) => {
  const connection = new Connection(sqlConfig);
  connection.on('connect', (err) => {
    if (err) {
      console.error('❌ فشل الاتصال بـ SQL Server:', err);
      return res.status(500).json({ error: 'فشل الاتصال بقاعدة البيانات' });
    }

    const results = [];
    const request = new Request(
      'SELECT Id, FullName, Department, Grade, Score, TotalPossible, TotalTime, SubmissionDate FROM dbo.Results ORDER BY Score DESC, TotalTime ASC',
      (err) => {
        if (err) {
          console.error('❌ خطأ في الاستعلام:', err);
          if (!res.headersSent) {
            res.status(500).json({ error: 'خطا اثناء جلب البيانات' });
          }
        } else {
          if (!res.headersSent) {
            res.json(results);
          }
        }
        connection.close();
      }
    );

    request.on('row', columns => {
      results.push({
        id: columns[0].value,
        fullName: columns[1].value,
        department: columns[2].value,
        grade: columns[3].value,
        score: columns[4].value,
        totalPossible: columns[5].value,
        totalTime: columns[6].value,
        date: columns[7].value
      });
    });

    request.on('error', err => {
      console.error('❌ خطأ في تنفيذ الاستعلام:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'خطأ في جلب النتائج' });
      }
      connection.close();
    });

    connection.execSql(request);
  });

  connection.connect();
});

// ========== API: تصدير النتائج إلى CSV ==========
app.get('/api/export-csv', (req, res) => {
  const sessionId = req.query.sessionId;
  if (!sessionId || sessionId !== 'admin_session_123') {
    return res.status(401).send('غير مصرح لك بالدخول');
  }

  const connection = new Connection(sqlConfig);
  connection.on('connect', (err) => {
    if (err) {
      console.error('❌ فشل الاتصال بـ SQL Server:', err);
      return res.status(500).send('فشل الاتصال بقاعدة البيانات');
    }

    let csvData = '\uFEFF'; // BOM لدعم UTF-8 في Excel
    csvData += 'الاسم الكامل,القسم,المستوى,الدرجة,الحد الأقصى,الوقت المستغرق,تاريخ الإرسال\n';

    const request = new Request(
      'SELECT FullName, Department, Grade, Score, TotalPossible, TotalTime, SubmissionDate FROM dbo.Results ORDER BY Score DESC, TotalTime ASC',
      (err) => {
        connection.close();
      }
    );

    request.on('row', (columns) => {
      const escape = (val) => `"${(val || '').toString().replace(/"/g, '""')}"`;
      const row = [
        escape(columns[0].value),
        escape(columns[1].value),
        escape(columns[2].value),
        columns[3].value ?? '',
        columns[4].value ?? '',
        columns[5].value ?? '',
        escape(columns[6].value ? new Date(columns[6].value).toLocaleString('ar-EG') : '')
      ].join(',');
      csvData += row + '\n';
    });

    request.on('done', () => {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', 'attachment; filename="results.csv"');
        res.send(csvData);
      }
    });

    request.on('error', (err) => {
      console.error('❌ خطأ أثناء إنشاء CSV:', err);
      if (!res.headersSent) {
        res.status(500).send('خطأ أثناء إنشاء ملف CSV');
      }
      connection.close();
    });

    connection.execSql(request);
  });

  connection.connect();
});

// ========== تشغيل الخادم ==========
// ✅ لا تستخدم '0.0.0.0' مع iisnode
app.listen(PORT, () => {
  console.log(`✅ الخادم يعمل على المنفذ: ${PORT}`);
  console.log(`🔗 قاعدة البيانات: db_ac2415_dbarshif`);
});