// --- إعدادات الوضع الليلي ---
function initializeTheme() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');

  // التحقق من حالة الوضع الليلي المحفوظة
  if (localStorage.getItem('theme') === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
      document.documentElement.classList.add('dark');
      if (themeIcon) themeIcon.textContent = '☀️';
  } else {
      document.documentElement.classList.remove('dark');
      if (themeIcon) themeIcon.textContent = '🌙';
  }

  // وظيفة زر التبديل (إذا كان الزر موجوداً في الصفحة)
  if (themeToggleBtn) {
      themeToggleBtn.addEventListener('click', function() {
          document.documentElement.classList.toggle('dark');
          if (document.documentElement.classList.contains('dark')) {
              localStorage.setItem('theme', 'dark');
              themeIcon.textContent = '☀️';
          } else {
              localStorage.setItem('theme', 'light');
              themeIcon.textContent = '🌙';
          }
      });
  }
}

// --- 1. حارس البوابة (التحقق من تسجيل الدخول) ---
const currentUser = JSON.parse(localStorage.getItem('currentUser'));

// إذا لم يكن هناك مستخدم مسجل، اطرده لصفحة الدخول فوراً
if (!currentUser) {
  window.location.replace('login.html');
}

// المتغير الأساسي للاشتراكات
let subscriptions = [];

// --- 2. جلب بيانات المستخدم من الخادم ---
async function fetchMySubscriptions() {
  try {
    const response = await fetch(`http://localhost:8000/api/subscriptions/${currentUser.id}`);
    if (response.ok) {
      subscriptions = await response.json();
      renderSubscriptions();
    }
  } catch (error) {
    console.error("خطأ في الاتصال بالخادم:", error);
  }
}

// --- دالة تسجيل الخروج ---
function logout() {
  localStorage.removeItem('currentUser');
  window.location.href = 'login.html';
}

function calculateDaysRemaining(targetDateStr) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(targetDateStr);
  target.setHours(0, 0, 0, 0);
  const diffTime = target - today;
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function updateKPIs() {
  let monthlyTotal = 0;
  let annualTotal = 0;
  let trialCount = 0;
  let urgentCount = 0;

  subscriptions.forEach(sub => {
    const price = parseFloat(sub.price) || 0;
    if (sub.cycle === 'monthly') {
      monthlyTotal += price;
      annualTotal += price * 12;
    } else {
      monthlyTotal += price / 12;
      annualTotal += price;
    }

    if (sub.isTrial) trialCount++;

    const days = calculateDaysRemaining(sub.nextDate);
    if (days >= 0 && days <= 3) {
      urgentCount++;
    }
  });

  document.getElementById('monthlyTotal').innerText = monthlyTotal.toFixed(2);
  document.getElementById('annualTotal').innerText = annualTotal.toFixed(2);
  document.getElementById('trialCount').innerText = trialCount;
  document.getElementById('urgentCount').innerText = urgentCount;
}

function createGoogleCalendarUrl(sub) {
  const title = encodeURIComponent(`تذكير بإلغاء أو تجديد: ${sub.name}`);
  const details = encodeURIComponent(`اشتراك ${sub.name} بمبلغ ${sub.price} ريال (${sub.cycle === 'monthly' ? 'شهري' : 'سنوي'}). تأكد من إلغائه إذا لم تعد بحاجة إليه قبل الخصم!`);
  
  const dateParts = sub.nextDate.split('-');
  const formattedDate = `${dateParts[0]}${dateParts[1]}${dateParts[2]}`;
  
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${formattedDate}/${formattedDate}&details=${details}`;
}

function renderSubscriptions() {
  const container = document.getElementById('subscriptionsContainer');
  const emptyState = document.getElementById('emptyState');
  const selectedCategory = document.getElementById('filterCategory').value;

  let filtered = subscriptions;
  if (selectedCategory !== 'all') {
    filtered = subscriptions.filter(s => s.category === selectedCategory);
  }

  if (filtered.length === 0) {
    container.innerHTML = '';
    emptyState.classList.remove('hidden');
    updateKPIs();
    return;
  }

  emptyState.classList.add('hidden');
  filtered.sort((a, b) => new Date(a.nextDate) - new Date(b.nextDate));

  container.innerHTML = filtered.map(sub => {
    const daysLeft = calculateDaysRemaining(sub.nextDate);
    let badgeHtml = '';
    let cardBg = '';

    if (daysLeft < 0) {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">انتهى / تجدد مؤخراً</span>`;
    } else if (daysLeft <= 3) {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-400 animate-pulse flex items-center gap-1">
                    <i class="fa-solid fa-triangle-exclamation"></i> باقي ${daysLeft === 0 ? 'اليوم!' : daysLeft + ' أيام'}
                   </span>`;
      cardBg = 'bg-rose-50/30 dark:bg-rose-900/20 border-rose-100 dark:border-rose-800';
    } else if (daysLeft <= 7) {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">باقي ${daysLeft} أيام</span>`;
    } else {
      badgeHtml = `<span class="px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">باقي ${daysLeft} يوم</span>`;
    }

    const trialBadge = sub.isTrial 
      ? `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500 text-white mr-1.5">فترة تجريبية</span>` 
      : '';

    const calUrl = createGoogleCalendarUrl(sub);

    // تم إضافة transition-colors لضمان ثبات ألوان النصوص وعدم اختفائها عند التمرير
    return `
      <div class="p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-colors duration-300 hover:bg-slate-50 dark:hover:bg-slate-700 bg-white dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 ${cardBg}">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center text-lg font-bold transition-colors">
            ${sub.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div class="flex items-center gap-1">
              <h4 class="text-sm font-bold text-slate-900 dark:text-white transition-colors">${sub.name}</h4>
              ${trialBadge}
            </div>
            <div class="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400 transition-colors">
              <span class="bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded transition-colors">${sub.category}</span>
              <span>•</span>
              <span>الخصم القادم: <strong class="text-slate-700 dark:text-slate-300 transition-colors">${sub.nextDate}</strong></span>
            </div>
          </div>
        </div>

        <div class="flex items-center justify-between sm:justify-end w-full sm:w-auto gap-4">
          <div class="text-right">
            <div class="text-base font-bold text-slate-900 dark:text-white transition-colors">${parseFloat(sub.price).toFixed(2)} <span class="text-xs font-normal text-slate-500 dark:text-slate-400 transition-colors">ريال</span></div>
            <div class="text-[11px] text-slate-400 dark:text-slate-500 transition-colors">${sub.cycle === 'monthly' ? 'شهرياً' : 'سنوياً'}</div>
          </div>

          <div>
            ${badgeHtml}
          </div>

          <a href="${calUrl}" target="_blank" title="أضف تذكير لتقويم Google" class="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:border-indigo-200 dark:hover:border-indigo-800 hover:bg-indigo-50/50 dark:hover:bg-slate-600 flex items-center justify-center transition-all">
            <i class="fa-regular fa-calendar-plus text-sm"></i>
          </a>

          <button onclick="deleteSubscription('${sub.id}')" title="حذف الاشتراك" class="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:border-rose-200 dark:hover:border-rose-800 hover:bg-rose-50 dark:hover:bg-slate-600 flex items-center justify-center transition-all">
            <i class="fa-solid fa-trash-can text-sm"></i>
          </button>
        </div>
      </div>
    `;
  }).join('');

  updateKPIs();
}

function openModal() {
  document.getElementById('subForm').reset();
  document.getElementById('subId').value = '';
  document.getElementById('modalTitle').innerText = 'إضافة اشتراك جديد';
  document.getElementById('subscriptionModal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('subscriptionModal').classList.add('hidden');
}

// --- 3. إرسال الاشتراك مع رقم المستخدم للخادم ---
async function saveSubscription(e) {
  e.preventDefault();
  
  const submitBtn = e.target.querySelector('button[type="submit"]');
  const originalText = submitBtn.innerText;
  submitBtn.innerText = "جاري الإرسال للخادم...";
  
  const newSub = {
    id: Date.now().toString(),
    name: document.getElementById('subName').value.trim(),
    price: parseFloat(document.getElementById('subPrice').value),
    cycle: document.getElementById('subCycle').value,
    nextDate: document.getElementById('subNextDate').value,
    category: document.getElementById('subCategory').value,
    isTrial: document.getElementById('subIsTrial').checked,
    user_id: String(currentUser.id) // ربط الاشتراك بصاحبه
  };

  try {
    const response = await fetch('http://localhost:8000/api/add-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSub)
    });

    if (response.ok) {
        fetchMySubscriptions(); // تحديث القائمة من السيرفر مباشرة
        closeModal();
    } else {
        alert("حدث خطأ أثناء الحفظ في الخادم.");
    }
  } catch (error) {
    console.error(error);
    alert("لا يمكن الاتصال بالخادم! تأكد من تشغيل كود البايثون.");
  } finally {
    submitBtn.innerText = originalText;
  }
}

// --- 4. دالة الحذف المحدثة لتمسح من قاعدة البيانات نهائياً ---
async function deleteSubscription(id) {
  if (confirm('هل أنت متأكد من رغبتك في حذف هذا الاشتراك من القائمة نهائياً؟')) {
    try {
      const response = await fetch(`http://localhost:8000/api/delete-subscription/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        subscriptions = subscriptions.filter(sub => sub.id !== id);
        renderSubscriptions();
      } else {
        alert("حدث خطأ أثناء الحذف من الخادم.");
      }
    } catch (error) {
      console.error(error);
      alert("لا يمكن الاتصال بالخادم لإتمام الحذف.");
    }
  }
}

// عند تحميل الصفحة، اجلب البيانات الخاصة بالمستخدم وشغل إعدادات الوضع الليلي
document.addEventListener('DOMContentLoaded', () => {
  initializeTheme();
  fetchMySubscriptions();
});