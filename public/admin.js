// ============================================================================
// لوحة تحكم المعلم - الكلية التقنية الهندسية كركوك
// تصميم و برمجة: المبرمج مصطفى هاشم قاسم
// ============================================================================

// ============== الإعدادات ==============
// const API_BASE = 'http://localhost:3000';
const API_BASE ='https://quiz-project.up.railway.app/api/save-result';
let results = [];

// ============== التهيئة عند تحميل الصفحة ==============
document.addEventListener('DOMContentLoaded', () => {
  // التحقق من وجود جلسة
  const sessionId = localStorage.getItem('adminSessionId');
  if (!sessionId) {
    window.location.href = 'admin-login.html';
    return;
  }

  // تحميل البيانات
  loadQuizStatus();
  loadResults();

  // ربط الأحداث
  document.getElementById('toggle-btn')?.addEventListener('click', toggleQuizStatus);
  document.getElementById('refresh-btn')?.addEventListener('click', loadResults);
  document.getElementById('export-csv-btn')?.addEventListener('click', exportToCsv);
  document.getElementById('logout-btn')?.addEventListener('click', logout);
});

// ============== وظيفة مساعدة للطلبات الآمنة ==============
function secureFetch(url, options = {}) {
  const sessionId = localStorage.getItem('adminSessionId');
  if (!sessionId) {
    alert('الجلسة منتهية. يرجى تسجيل الدخول مرة أخرى.');
    window.location.href = 'admin-login.html';
    return Promise.reject('No session');
  }

  return fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'X-Session-Id': sessionId
    }
  });
}

// ============== تسجيل الخروج ==============
function logout() {
  localStorage.removeItem('adminSessionId');
  window.location.href = 'admin-login.html';
}

// ============== جلب حالة النظام (مفتوح/مغلق) ==============
function loadQuizStatus() {
  secureFetch(`${API_BASE}/api/quiz-status`)
    .then(handleAuthError)
    .then(response => response.json())
    .then(data => {
      const statusText = document.getElementById('status-text');
      const toggleBtn = document.getElementById('toggle-btn');

      if (data.active) {
        statusText.textContent = 'مفتوحة';
        statusText.className = 'text-success fw-bold';
        toggleBtn.textContent = 'إيقاف';
        toggleBtn.className = 'btn btn-danger';
      } else {
        statusText.textContent = 'مغلقة';
        statusText.className = 'text-danger fw-bold';
        toggleBtn.textContent = 'تشغيل';
        toggleBtn.className = 'btn btn-success';
      }
    })
    .catch(err => {
      console.error('فشل تحميل حالة النظام:', err);
      document.getElementById('status-text').textContent = 'خطأ في التحميل';
    });
}

// ============== تبديل حالة النظام ==============
function toggleQuizStatus() {
  secureFetch(`${API_BASE}/api/toggle-quiz`, { method: 'POST' })
    .then(handleAuthError)
    .then(response => response.json())
    .then(() => loadQuizStatus())
    .catch(err => {
      console.error('فشل تغيير حالة النظام:', err);
      alert('فشل تغيير حالة النظام. تحقق من الاتصال.');
    });
}

// ============== جلب النتائج من قاعدة البيانات ==============
function loadResults() {
  const tableBody = document.getElementById('results-body');
  const countSpan = document.getElementById('results-count');

  // عرض حالة التحميل
  tableBody.innerHTML = '<tr><td colspan="8" class="text-center">جارٍ تحميل النتائج...</td></tr>';
  countSpan.textContent = '0';

  secureFetch(`${API_BASE}/api/results`)
    .then(handleAuthError)
    .then(response => response.json())
    .then(data => {
      results = data;
      renderResultsTable();
    })
    .catch(err => {
      console.error('فشل تحميل النتائج:', err);
      tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">فشل تحميل النتائج</td></tr>';
    });
}

// ============== عرض النتائج في الجدول ==============
function renderResultsTable() {
  const tableBody = document.getElementById('results-body');
  const countSpan = document.getElementById('results-count');

  if (results.length === 0) {
    tableBody.innerHTML = '<tr><td colspan="8" class="text-center">لا توجد نتائج بعد</td></tr>';
    countSpan.textContent = '0';
    return;
  }

  countSpan.textContent = results.length;
  tableBody.innerHTML = results.map((row, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>${escapeHtml(row.fullName)}</td>
      <td>${escapeHtml(row.department)}</td>
      <td>${escapeHtml(row.grade)}</td>
      <td>${row.score}</td>
      <td>${row.totalPossible}</td>
      <td>${row.totalTime} ثانية</td>
      <td>${formatDate(row.date)}</td>
    </tr>
  `).join('');
}

// ============== تصدير إلى CSV ==============
function exportToCsv() {
  const sessionId = localStorage.getItem('adminSessionId');
  if (!sessionId) {
    window.location.href = 'admin-login.html';
    return;
  }
  // فتح نافذة جديدة لتنزيل الملف
  window.open(`${API_BASE}/api/export-csv?sessionId=${sessionId}`, '_blank');
}

// ============== دوال مساعدة ==============

// منع حقن HTML (أمان)
function escapeHtml(text) {
  if (typeof text !== 'string') return text;
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// تنسيق التاريخ العربي
function formatDate(dateString) {
  if (!dateString) return 'غير متوفر';
  const date = new Date(dateString);
  return date.toLocaleString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

// معالجة أخطاء المصادقة
function handleAuthError(response) {
  if (response.status === 401) {
    localStorage.removeItem('adminSessionId');
    window.location.href = 'admin-login.html';
    return Promise.reject('Unauthorized');
  }
  return response;
}