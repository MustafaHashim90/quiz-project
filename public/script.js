// ============================================================================
// نظام مسابقة الطلاب - الكلية التقنية الهندسية كركوك
// تصميم و برمجة: المبرمج مصطفى هاشم قاسم
// ============================================================================
// ✅ الأسئلة: من Google Sheets
// ✅ النتائج: تُرسل إلى SQL Server عبر Backend
// ============================================================================

// ==================== المتغيرات العامة ====================
let questions = [];
let currentQuestion = 0;
let userAnswers = [];
let score = 0;
let totalTime = 0;
let timerInterval = null;
const QUESTION_TIME = 60; // 60 ثانية لكل سؤال

// بيانات الطالب
let studentInfo = {
  fullName: '',
  department: '',
  grade: ''
};

// ==================== روابط النظام ====================
// 🔗 رابط جلب الأسئلة من Google Sheets (Web App)
const QUESTIONS_SHEET_URL = 'https://script.google.com/macros/s/AKfycbwQpiwiWKg-qZ93Oj1mRNeLW-S7EJ74loleSAk0BY4Q7qKW6iG5SOhM3bqzlpZ2ZOJKrw/exec';

// 🔗 رابط حفظ النتائج في SQL Server (Backend)
//const SAVE_RESULT_API = 'http://localhost:3000/api/save-result';
const SAVE_RESULT_API = 'https://quiz-project.up.railway.app/api/save-result';
// ==================== تهيئة النظام عند تحميل الصفحة ====================
document.addEventListener('DOMContentLoaded', () => {
  // ربط أحداث النماذج والأزرار
  document.getElementById('login-form')?.addEventListener('submit', handleLogin);
  document.getElementById('next-btn')?.addEventListener('click', goToNext);
  document.getElementById('prev-btn')?.addEventListener('click', handlePrev);
  document.getElementById('export-btn')?.addEventListener('click', showResultsInfo);
});

// ==================== 1. معالجة تسجيل الدخول ====================


function handleLogin(e) {

// التحقق من حالة النظام قبل بدء المسابقة
fetch('https://quiz-project.up.railway.app/api/save-result')
  .then(res => res.json())
  .then(data => {
    if (!data.active) {
      alert('المسابقة غير مفعلة حاليًا. يرجى المحاولة لاحقًا.');
      return;
    }
    // ... بقية كود تسجيل الدخول
  });

  e.preventDefault();
  
  studentInfo.fullName = document.getElementById('full-name').value.trim();
  studentInfo.department = document.getElementById('department').value.trim();
  studentInfo.grade = document.getElementById('grade').value;

  if (!studentInfo.fullName || !studentInfo.department || !studentInfo.grade) {
    alert('يرجى ملء جميع الحقول.');
    return;
  }

  // إخفاء شاشة الدخول وعرض شاشة التحميل
  document.getElementById('login-screen').classList.add('d-none');
  document.getElementById('load-screen').classList.remove('d-none');

  // جلب الأسئلة من Google Sheets
  fetchQuestions();
}

// ==================== 2. جلب الأسئلة من Google Sheets ====================
function fetchQuestions() {
  fetch(QUESTIONS_SHEET_URL)
    .then(response => {
      if (!response.ok) throw new Error('فشل الاتصال بخادم الأسئلة.');
      return response.json();
    })
    .then(data => {
      if (!Array.isArray(data) || data.length === 0) {
        showError('لا توجد أسئلة متاحة في Google Sheets.');
        return;
      }
      questions = data;
      document.getElementById('load-screen').classList.add('d-none');
      document.getElementById('quiz-container').classList.remove('d-none');
      document.getElementById('q-total').textContent = questions.length;
      showQuestion();
    })
    .catch(err => {
      console.error('❌ خطأ في جلب الأسئلة:', err);
      showError('فشل تحميل الأسئلة. تأكد من رابط .');
    });
}

// ==================== 3. عرض السؤال الحالي ====================
function showQuestion() {
  const q = questions[currentQuestion];
  document.getElementById('q-number').textContent = currentQuestion + 1;
  document.getElementById('question').textContent = q.question;

  const optionsDiv = document.getElementById('options');
  optionsDiv.innerHTML = '';

  q.options.forEach((opt, idx) => {
    const btn = document.createElement('button');
    btn.className = `btn option-btn ${userAnswers[currentQuestion] === idx ? 'selected' : ''}`;
    btn.textContent = opt;
    btn.onclick = () => selectAnswer(idx);
    optionsDiv.appendChild(btn);
  });

  // تحديث أزرار التنقل
  document.getElementById('prev-btn').disabled = currentQuestion === 0;
  document.getElementById('next-btn').textContent = 
    currentQuestion === questions.length - 1 ? 'إنهاء' : 'التالي';

  // بدء العد التنازلي
  startTimer();
}

// ==================== 4. اختيار إجابة الطالب ====================
function selectAnswer(index) {
  userAnswers[currentQuestion] = index;
  document.querySelectorAll('.option-btn').forEach((btn, i) => {
    btn.classList.toggle('selected', i === index);
  });
}

// ==================== 5. العد التنازلي ====================
function startTimer() {
  clearInterval(timerInterval);
  let timeLeft = QUESTION_TIME;
  document.getElementById('time-left').textContent = timeLeft;

  timerInterval = setInterval(() => {
    if (--timeLeft < 0) {
      clearInterval(timerInterval);
      goToNext();
    } else {
      document.getElementById('time-left').textContent = timeLeft;
    }
  }, 1000);
}

// ==================== 6. الانتقال للسؤال التالي أو إنهاء ====================
function goToNext() {
  totalTime += QUESTION_TIME - parseInt(document.getElementById('time-left').textContent);
  
  if (currentQuestion < questions.length - 1) {
    currentQuestion++;
    showQuestion();
  } else {
    finishQuiz();
  }
}

// ==================== 7. التنقل للسؤال السابق ====================
function handlePrev() {
  if (currentQuestion > 0) {
    currentQuestion--;
    showQuestion();
  }
}

// ==================== 8. إنهاء المسابقة وحساب النتيجة ====================
function finishQuiz() {
  clearInterval(timerInterval);

  // حساب المجموع
  score = questions.reduce((sum, q, i) => {
    return sum + (userAnswers[i] === q.correct ? q.points : 0);
  }, 0);

  const totalPossible = questions.reduce((sum, q) => sum + q.points, 0);
  const gradeMap = {
    '1': 'المرحلة الأولى',
    '2': 'المرحلة الثانية',
    '3': 'المرحلة الثالثة',
    '4': 'المرحلة الرابعة'
  };
  const gradeText = gradeMap[studentInfo.grade] || 'غير محدد';

  // عرض النتيجة
  document.getElementById('result-name').textContent = studentInfo.fullName;
  document.getElementById('result-dept').textContent = studentInfo.department;
  document.getElementById('result-grade').textContent = gradeText;
  document.getElementById('result-score').textContent = score;
  document.getElementById('total-possible').textContent = totalPossible;
  document.getElementById('result-time').textContent = totalTime;

  document.getElementById('quiz-container').classList.add('d-none');
  document.getElementById('final-result').classList.remove('d-none');

  // ✅ إرسال النتيجة إلى قاعدة بيانات SQL Server
  sendResultToDatabase(studentInfo.fullName, studentInfo.department, gradeText, score, totalPossible, totalTime);
}

// ==================== 9. إرسال النتيجة إلى Backend (SQL Server) ====================
function sendResultToDatabase(fullName, department, grade, score, totalPossible, totalTime) {
  fetch(SAVE_RESULT_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      fullName,
      department,
      grade,
      score,
      totalPossible,
      totalTime
    })
  })
  .then(response => response.json())
  .then(data => {
    if (data.success) {
      console.log('✅ تم حفظ النتيجة في قاعدة البيانات');
    } else {
      console.warn('⚠️ تم العرض لكن الحفظ فشل:', data.error);
    }
  })
  .catch(err => {
    console.error('❌ فشل الاتصال بخادم الحفظ:', err);
    // لا نُظهر تنبيهًا — النتيجة تظهر دائمًا للطالب
  });
}

// ==================== 10. زر عرض النتائج (إرشاد للمستخدم) ====================
/* function showResultsInfo() {
  alert('تم إرسال النتيجة تلقائيًا إلى قاعدة بيانات الكلية!\nيمكن للمشرف عرض جميع النتائج عبر نظام الإدارة.');
}*/
function showResultsInfo() {
  const confirmExit = confirm(
    'تم إرسال إجابتك بنجاح ✅\n\n' +
    'هل تريد إنهاء الاختبار والخروج؟'
  );

  if (!confirmExit) return;

  alert('شكرًا لمشاركتك في المسابقة.\nسيتم الخروج الآن.');

  // محاولة إغلاق النافذة
  window.open('', '_self');
  window.close();

  // في حال رفض المتصفح الإغلاق
  setTimeout(() => {
    document.body.innerHTML = `
      <div style="
        display:flex;
        align-items:center;
        justify-content:center;
        height:100vh;
        font-family:Cairo;
        text-align:center;
      ">
        <div>
          <h3>تم إنهاء الاختبار بنجاح ✅</h3>
          <p>يمكنك الآن إغلاق الصفحة بأمان.</p>
        </div>
      </div>
    `;
  }, 500);
}
// ==================== 11. عرض رسالة خطأ ====================
function showError(message) {
  document.getElementById('load-screen').innerHTML = `
    <div class="alert alert-danger m-3 p-3 rounded">${message}</div>
  `;
}