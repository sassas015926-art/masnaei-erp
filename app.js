/* ================= نظام إدارة مخزون المصنع — المنطق الرئيسي ================= */

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/* ---------------- تحديد المصنع (Tenant) — نظام SaaS متعدد المصانع ---------------- */
// الأولوية: سبدومين الرابط (masna1.yourdomain.com) → آخر مصنع محفوظ محليًا → خانة يدوية
let TENANT_SLUG = null;
let TENANT_ID = null;
let TENANT_NAME = null;

// دومينات الاستضافة المجانية الشائعة (Netlify/Vercel/GitHub Pages/Cloudflare
// Pages) — لو الموقع لسه شغال على رابطها المجاني (قبل ربط دومين مخصص)، متنفعش
// الجزء الأول من الرابط كأنه كود مصنع، لازم نرجع للخانة اليدوية بدل كده
const FREE_HOSTING_DOMAINS = ["netlify.app", "vercel.app", "pages.dev", "github.io", "web.app", "firebaseapp.com"];

function detectSlugFromHostname() {
  const host = window.location.hostname;
  if (host === "localhost" || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return null;
  if (FREE_HOSTING_DOMAINS.some(d => host === d || host.endsWith("." + d))) return null;
  const parts = host.split(".");
  // لازم 3 أجزاء على الأقل (مصنع.دومين.نطاق)، ومش www
  if (parts.length >= 3 && parts[0] !== "www") return parts[0];
  return null;
}

function emailSuffix() {
  return "@" + (TENANT_SLUG || "tenant") + ".local";
}

// بيحاول يحدد المصنع ويتأكد من وجوده الفعلي في القاعدة. برجع true/false.
// (بيستخدم RPC آمن resolve_tenant_public بدل قراءة جدول tenants مباشرة —
// الجدول نفسه فيه بيانات اشتراك ودفع حساسة، ومينفعش يبقى قابل للقراءة من
// أي حد بمفتاح anon قبل ما يسجّل دخوله. الـ RPC ده بيرجّع بس الأعمدة الآمنة.)
async function resolveTenant(slugInput) {
  const slug = (slugInput || TENANT_SLUG || "").trim().toLowerCase();
  if (!slug) return false;

  const { data, error } = await sb.rpc("resolve_tenant_public", { p_slug: slug });
  const row = Array.isArray(data) ? data[0] : data;

  if (error || !row || row.is_active === false) {
    TENANT_ID = null; TENANT_NAME = null;
    return false;
  }

  TENANT_SLUG = row.slug;
  TENANT_ID = row.id;
  TENANT_NAME = row.name;
  localStorage.setItem("tenant_slug", TENANT_SLUG);
  return true;
}

const ICONS = {
  package: '<path d="M21 8 12 3 3 8v8l9 5 9-5V8Z"/><path d="M3 8l9 5 9-5"/><path d="M12 13v8"/>',
  alert: '<path d="M12 2 1 21h22L12 2Z"/><path d="M12 9v5"/><path d="M12 17.5h.01"/>',
  down: '<circle cx="12" cy="12" r="10"/><path d="M12 7v6l4 2"/>',
  in: '<circle cx="12" cy="12" r="10"/><path d="M12 7v7M9 11l3 3 3-3"/>',
  out: '<circle cx="12" cy="12" r="10"/><path d="M12 17V10M9 13l3-3 3 3"/>',
  grid: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
  chart: '<path d="M3 3v18h18"/><rect x="7" y="12" width="3" height="6"/><rect x="12" y="8" width="3" height="10"/><rect x="17" y="5" width="3" height="13"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 0 1-4 0v-.09A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 0 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 0 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 0 1 0 4h-.09a1.7 1.7 0 0 0-1.51 1Z"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>',
  pencil: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  download: '<path d="M12 3v12"/><path d="m7 10 5 5 5-5"/><path d="M5 21h14"/>',
  minus: '<path d="M5 12h14"/>',
  history: '<path d="M3 3v5h5"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"/><path d="M12 7v5l4 2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  scissors: '<circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><path d="M20 4 8.12 15.88M14.47 14.48 20 20M8.12 8.12 12 12"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/>',
  chevronDown: '<path d="m6 9 6 6 6-6"/>',
  key: '<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  truck: '<path d="M1 3h13v13H1z"/><path d="M14 8h4l4 4v4h-8V8z"/><circle cx="6" cy="18.5" r="2.5"/><circle cx="17.5" cy="18.5" r="2.5"/>',
  tag: '<path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L3 3v6.59a2 2 0 0 0 .59 1.41l9.58 9.59a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83Z"/><circle cx="7.5" cy="7.5" r="1.2"/>',
  send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
  mail: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-10 5L2 7"/>',
  warehouse: '<path d="M2 21V9l10-6 10 6v12"/><path d="M2 21h20"/><path d="M8 21v-6h8v6"/><path d="M2 9l10 6 10-6"/>',
  transfer: '<path d="M17 3 21 7l-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><path d="M7 21 3 17l4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/>',
};
function icon(name, size = 16) {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ""}</svg>`;
}

/* ---------------- تحميل المكتبات الثقيلة عند الحاجة فقط (يقلل وقت فتح البرنامج) ---------------- */
function loadScriptOnce(src) {
  return new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[src="${src}"]`);
    if (existing) {
      if (existing.dataset.loaded === "1") return resolve();
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("تعذر تحميل المكتبة: " + src)));
      return;
    }
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => { s.dataset.loaded = "1"; resolve(); };
    s.onerror = () => reject(new Error("تعذر تحميل المكتبة: " + src));
    document.head.appendChild(s);
  });
}
function ensureXLSX() {
  if (typeof XLSX !== "undefined") return Promise.resolve();
  return loadScriptOnce("https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js");
}
function ensureBarcodeLib() {
  if (typeof JsBarcode !== "undefined") return Promise.resolve();
  return loadScriptOnce("https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js");
}
function ensureScannerLib() {
  if (window.Html5Qrcode) return Promise.resolve();
  return loadScriptOnce("https://cdn.jsdelivr.net/npm/html5-qrcode/minified/html5-qrcode.min.js");
}

// ============================================================
// نظام مسح الباركود بالكاميرا — نقطة دخول واحدة تُستخدم من شاشة إدارة
// الأصناف (لتسجيل باركود على صنف) ومن شاشتي الإدخال/السحب (لتحديد الصنف
// مباشرة بالمسح). بيفتح نافذة كاميرا حية، وبرضه بيدّي اختيار الكتابة
// اليدوية دايمًا كبديل — عشان لو الكاميرا مش شغالة أو الجهاز مالوش كاميرا،
// المستخدم يقدر يكمل عادي من غير ما يتقفل عليه.
// onDetected(code): بتتنده مرة واحدة لما كود يتقرا أو يتكتب يدويًا.
// ============================================================
function openBarcodeScanner(onDetected, { title = "امسح الباركود" } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.style.zIndex = "9999";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:420px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div style="font-weight:800; font-size:16px;">${icon("search", 17)} ${title}</div>
        <button class="close-x" id="scan-close">${icon("x", 16)}</button>
      </div>
      <div id="scan-video-wrap" style="position:relative; background:#000; border-radius:12px; overflow:hidden; aspect-ratio:4/3; display:flex; align-items:center; justify-content:center;">
        <div id="scan-video-target" style="width:100%; height:100%;"></div>
        <div id="scan-status" style="position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#fff; font-size:13px; text-align:center; padding:20px; background:rgba(0,0,0,.55); pointer-events:none;">...جارِ تشغيل الكاميرا</div>
      </div>
      <div style="font-size:11.5px; color:var(--ink70); margin:10px 0; text-align:center;">وجّه الكاميرا ناحية الباركود — هيتقرا تلقائيًا</div>
      <div style="border-top:1px solid var(--line); padding-top:12px; margin-top:4px;">
        <label style="font-size:12px; color:var(--ink70); display:block; margin-bottom:6px;">أو اكتب الكود يدويًا (لو مفيش كاميرا أو الكود متلخبط)</label>
        <div style="display:flex; gap:8px;">
          <input id="scan-manual-input" class="input mono" style="flex:1;" placeholder="اكتب الكود هنا">
          <button class="btn-dark" id="scan-manual-submit" type="button">تأكيد</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(overlay);

  let stopped = false;
  let scanner = null;

  function finish(code) {
    if (stopped) return;
    stopped = true;
    if (scanner) { scanner.stop().then(() => scanner.clear()).catch(() => {}); }
    overlay.remove();
    onDetected(String(code).trim());
  }
  function close() {
    if (stopped) return;
    stopped = true;
    if (scanner) { scanner.stop().then(() => scanner.clear()).catch(() => {}); }
    overlay.remove();
  }

  overlay.addEventListener("click", (e) => { if (e.target === overlay) close(); });
  $("#scan-close", overlay).onclick = close;
  $("#scan-manual-submit", overlay).onclick = () => {
    const v = $("#scan-manual-input", overlay).value.trim();
    if (v) finish(v);
  };
  $("#scan-manual-input", overlay).onkeydown = (e) => { if (e.key === "Enter") $("#scan-manual-submit", overlay).click(); };

  ensureScannerLib().then(() => {
    if (stopped) return;
    const statusEl = $("#scan-status", overlay);
    scanner = new window.Html5Qrcode("scan-video-target");
    scanner.start(
      { facingMode: "environment" },
      { fps: 10, qrbox: { width: 240, height: 140 } },
      (decodedText) => finish(decodedText),
      () => { /* بيتنده كل فريم مفيهوش كود — بنتجاهله، ده طبيعي أثناء البحث */ }
    ).then(() => {
      if (statusEl) statusEl.style.display = "none";
    }).catch(() => {
      if (statusEl) statusEl.innerHTML = "تعذّر الوصول للكاميرا — تأكد من السماح بصلاحية الكاميرا للمتصفح، أو استخدم الكتابة اليدوية تحت.";
    });
  }).catch(() => {
    const statusEl = $("#scan-status", overlay);
    if (statusEl) statusEl.innerHTML = "تعذّر تحميل مكتبة المسح (تأكد من الاتصال بالإنترنت) — استخدم الكتابة اليدوية تحت.";
  });
}

const CATS_FALLBACK = ["أقمشة", "خيوط", "أزرار وسحابات", "بطانات", "إكسسوارات", "أخرى"];

const state = {
  user: null, profile: null,
  settings: { workshop_name: "مصنع نسيج", logo_base64: null, alert_threshold_percent: 15, warning_threshold_percent: 30 },
  plan: null, // { key, name, max_users, allow_email, allow_telegram } — يتحمّل مع loadAll()
  categories: [], items: [], transactions: [], profiles: [], auditLog: [], backups: [], suppliers: [], telegramUsers: [], emailRecipients: [],
  telegramGroups: [], notificationsLog: [],
  stockTakes: [], openStockTake: null, openStockTakeLines: [],
  sites: [], warehouses: [],
  stockCountSessions: [], stockCountSessionMembers: [], stockCountPathSettings: [],
  scDetail: null, // { session, items, transit } — الجلسة المفتوحة حاليًا في شاشة التفاصيل
  stockViewMode: "grouped", itemsViewMode: "grouped",
  tab: "dashboard", selectedItem: null, pollTimer: null, lang: (localStorage.getItem("lang") || "ar"), reportItemFocus: null,
  _alertOpen: false,
};

const I18N = {
  ar: {
    dir: "rtl", loginTitle: "تسجيل الدخول لإدارة المخازن", loginUser: "اسم المستخدم", loginPass: "كلمة المرور",
    loginBtn: "تسجيل الدخول", loginLoading: "...جارِ الدخول", loginError: "اسم المستخدم أو كلمة المرور غير صحيحة",
    brandSub: "إدارة المخازن",
    navDashboard: "لوحة التحكم", navIn: "إدخال مخزون", navOut: "سحب من المخزن", navStock: "المخزون الحالي",
    navReports: "التقارير", navStockTake: "الجرد", navAudit: "سجل العمليات", navUsers: "إدارة المستخدمين", navSettings: "الإعدادات",
    navNotificationsLog: "سجل الإشعارات",
    navItems: "إدارة الأصناف", navSuppliers: "الموردون", navTelegram: "مستخدمو تيليجرام", navEmailRecipients: "مستلمو الإيميل",
    navWarehouses: "المخازن", logout: "خروج",
    // المخازن
    warehousesTitle: "المواقع والمخازن", warehousesSub: "إدارة مواقع المصنع والمخازن التابعة لكل موقع",
    newSiteBtn: "+ موقع جديد", newWarehouseBtn: "+ مخزن جديد", siteName: "اسم الموقع", siteAddress: "العنوان (اختياري)",
    warehouseName: "اسم المخزن", warehouseCode: "كود المخزن (اختياري)", warehouseType: "نوع المخزن",
    warehouseAllowNegative: "السماح برصيد سالب (حالات خاصة)", defaultTag: "افتراضي", inactiveTag: "معطّل",
    noSites: "لسه مفيش مواقع مسجّلة", noWarehousesInSite: "لسه مفيش مخازن في الموقع ده",
    deactivateWarehouse: "تعطيل المخزن", activateWarehouse: "تفعيل المخزن", deactivateSite: "تعطيل الموقع", activateSite: "تفعيل الموقع",
    whTypeRaw: "خامات", whTypeTools: "أدوات/قطع غيار", whTypeFinished: "منتجات تامة", whTypeWip: "تحت التشغيل", whTypeGeneral: "عام",
    // الجرد ثلاثي المراحل
    navStockCount: "الجرد", stockCountTitle: "جلسات الجرد", stockCountSub: "جرد المخازن — مرحلة أولية، مراجعة لجنة، واعتماد نهائي",
    newStockCountBtn: "+ جرد جديد", myApprovalsTitle: "بانتظار اعتمادي", noStockCountSessions: "لسه مفيش جلسات جرد",
    scWarehouse: "المخزن", scCountType: "نوع الجرد", scRecurrence: "التكرار", scScope: "النطاق", scApprovalPath: "مسار الاعتماد",
    scTypeSurprise: "مفاجئ", scTypeScheduled: "دوري", scRecurMonthly: "شهري", scRecurQuarterly: "ربع سنوي", scRecurSemiAnnual: "نصف سنوي", scRecurAnnual: "سنوي",
    scScopeFull: "شامل (كل الأصناف)", scScopeSpecific: "أصناف محددة",
    scPathPrimaryOnly: "مرحلة واحدة (أمين المخزن فقط)", scPathCommitteeOnly: "اللجنة فقط", scPathFull: "المسار الكامل (أمين مخزن ← لجنة ← اعتماد)",
    scPrimaryCounters: "أمناء المخزن المكلَّفون", scCommitteeMembers: "أعضاء اللجنة", scHideBookQty: "إخفاء الرصيد الدفتري عن أمين المخزن أثناء العدّ",
    scStatusDraft: "مسودة", scStatusPrimary: "جرد أولي جارٍ", scStatusCommittee: "مراجعة اللجنة جارية", scStatusPending: "بانتظار الاعتماد", scStatusApproved: "معتمَد", scStatusCancelled: "ملغي",
    scStartBtn: "بدء الجرد", scSubmitPrimaryBtn: "إقفال الجرد الأولي وإرسال للمراجعة التالية", scSubmitCommitteeBtn: "إقفال مراجعة اللجنة",
    scApproveBtn: "اعتماد", scRejectBtn: "رفض وإعادة", scRejectReasonPrompt: "اكتب سبب الرفض:",
    scColItem: "الصنف", scColSystem: "الرصيد الدفتري", scColPrimary: "الجرد الأولي", scColCommittee: "جرد اللجنة", scColVariance: "الفرق", scColMethod: "طريقة الإدخال",
    scEntryManual: "يدوي", scEntryBarcode: "باركود", scHiddenQty: "مخفي أثناء العدّ",
    scInTransitTitle: "كميات قيد النقل (لا تدخل في الرصيد الحالي)", scInTransitOut: "خارجة إلى", scInTransitIn: "داخلة من", noInTransit: "لا يوجد تحويلات معلّقة على هذا المخزن حاليًا",
    scNotAllCounted: "فيه أصناف لسه ما اتعدتش", scBackToList: "رجوع لقائمة الجلسات", scSessionInfo: "بيانات الجلسة",
    // عام
    save: "حفظ", add: "إضافة", delete: "حذف", edit: "تعديل", cancel: "إلغاء", search: "بحث", confirmBtn: "تأكيد",
    print: "طباعة / PDF", exportExcelBtn: "تصدير Excel", all: "الكل", unit: "الوحدة", category: "الفئة",
    quantity: "الكمية", status: "الحالة", code: "الكود", itemName: "الصنف", worker: "العامل", note: "ملاحظة",
    date: "التاريخ", dateTime: "التاريخ والساعة",
    statusCritical: "حرج", statusWarning: "منخفض", statusOk: "جيد",
    // تنبيهات وإشعارات الاشتراك (نصوص ديناميكية عبر tf())
    lowStockAlertMsg: "تنبيه: {count} صنف وصل إلى أقل من {percent}% من الحد الأقصى للمخزون",
    readOnlyExpiredMsg: "انتهى اشتراكك في {date}، والنظام الآن في وضع \"قراءة فقط\" — تقدر تشوف بياناتك وتطبع تقارير، لكن مش هتقدر تسجّل حركات أو تعديلات جديدة. برجاء سداد الاشتراك لاستكمال الاستخدام العادي.",
    readOnlySuspendedMsg: "تم إيقاف اشتراك مصنعك — النظام الآن في وضع \"قراءة فقط\" فقط. تواصل مع الدعم لاستكمال الاستخدام العادي.",
    readOnlyBlockedToast: "المصنع في وضع \"قراءة فقط\" حاليًا بسبب انتهاء الاشتراك — سدّد الاشتراك لاستكمال الاستخدام العادي",
    subTrialLabel: "نسخة تجريبية", subActiveLabel: "اشتراك مفعّل", subOverdueLabel: "الدفع متأخر", subSuspendedLabel: "الاشتراك موقوف",
    subRenewalSoonLabel: "الاشتراك هينتهي قريبًا",
    subExpiresIn: "ينتهي بعد {days} يوم ({date})", subExpiredSince: "انتهى منذ {days} يوم",
    subAmountDue: "المبلغ المطلوب: {amount} {currency}",
    // لوحة التحكم
    dashboardTitle: "لوحة التحكم", dashboardSub: "نظرة سريعة على حالة المخزن اليوم",
    statTotalItems: "إجمالي الأصناف", statCritical: "أصناف حرجة", statTodayIn: "عمليات إدخال اليوم", statTodayOut: "عمليات سحب اليوم",
    sectionUrgent: "أصناف تحتاج انتباه فوري", sectionRecentTx: "آخر الحركات",
    viewAllStock: "عرض كل المخزون", allReports: "كل التقارير", noLowStock: "لا توجد أصناف منخفضة حاليًا.", noTx: "لا توجد حركات مسجّلة بعد.",
    chartMovement: "حركة المخزون — آخر 7 أيام", chartTopConsumed: "الأصناف الأكثر استهلاكًا",
    legendIn: "إدخال", legendOut: "سحب", noData: "لا توجد بيانات كافية بعد.",
    // المخزون
    stockTitle: "المخزون الحالي", itemsRegistered: "صنف مسجّل بالمخزن", searchByNameCode: "ابحث بالاسم أو الكود...",
    // الإدخال/السحب
    inTitle: "إدخال مخزون", inSub: "أضف كمية جديدة وصلت للمصنع",
    outTitle: "سحب من المخزن", outSub: "اسحب المواد التي تحتاجها للعمل مباشرة",
    searchItem: "ابحث عن الصنف بالاسم أو الفئة...", confirmIn: "تأكيد الإدخال", confirmOut: "تأكيد السحب",
    qtyLabel: "الكمية", workerLabel: "اسم العامل *", noteLabel: "ملاحظة (اختياري)", available: "المتوفر حاليًا",
    // التقارير
    reportsTitle: "التقارير", reportsSub: "تغطية كاملة لحركة المخزن والأصناف المنخفضة",
    lowStockSection: "تقرير الأصناف المنخفضة والحرجة", consumptionSection: "الأصناف الأكثر سحبًا (إجمالي الاستهلاك)",
    dailySection: "الملخص اليومي (الإدخال والسحب لكل يوم)", txLogSection: "سجل الحركات (بالتاريخ والساعة)",
    printSectionsTitle: "أقسام التقرير المطلوب طباعتها/تصديرها", quickRange: "فترة سريعة", dateFrom: "من تاريخ", dateTo: "إلى تاريخ",
    typeAll: "الكل", typeIn: "إدخال فقط", typeOut: "سحب فقط", allItems: "كل الأصناف", clearFilters: "مسح الفلاتر",
    voucherBtn: "طباعة إذن",
    // الإعدادات
    settingsTitle: "الإعدادات", settingsSub: "اسم المصنع، الشعار، بيانات الاتصال، ونسب التنبيه",
    factoryInfo: "بيانات المصنع", factoryName: "اسم المصنع", factoryLogo: "شعار المصنع",
    factoryAddress: "عنوان المصنع", factoryPhone: "رقم الهاتف",
    criticalPct: "نسبة التنبيه الحرج %", warningPct: 'نسبة تنبيه "منخفض" %', saveFactoryInfo: "حفظ بيانات المصنع",
    itemsAdminTitle: "إدارة الأصناف", itemsAdminSub: "أنواع المنتجات (الفئات)، والأصناف تحت كل فئة",
    categoriesTitle: "أنواع المنتجات (الفئات)", newCategoryPlaceholder: "اسم فئة جديدة، مثال: خامات تطريز",
    itemsTitle: "الأصناف", newItemBtn: "صنف جديد", maxQty: "الحد الأقصى", currentQty: "الكمية الحالية",
    // المستخدمون
    usersTitle: "إدارة المستخدمين", usersSub: "إنشاء الحسابات، تحديد الصلاحيات، إيقاف أو حذف المستخدمين",
    newUserBtn: "مستخدم جديد", fullNameLabel: "الاسم الكامل", roleLabel: "الدور",
    lastLogin: "آخر دخول", deviceLabel: "الجهاز", activeLabel: "نشط", suspendedLabel: "موقوف", youLabel: "(أنت)",
    // سجل العمليات
    auditTitle: "سجل العمليات (Audit Log)", auditSub: "من قام بالعملية، وقتها، الجهاز، والكمية قبل وبعد التعديل",
    actionCol: "العملية", entityCol: "الصنف / العنصر", beforeCol: "قبل", afterCol: "بعد", timeCol: "الوقت",
    noAudit: "لا توجد عمليات مسجّلة بعد.",
    usernameLabel: "اسم المستخدم (بالإنجليزي، بدون مسافات)", passwordLabel: "كلمة المرور", createAccountBtn: "إنشاء الحساب",
    // الموردون
    suppliersTitle: "الموردون", suppliersSub: "بيانات الموردين للتواصل السريع والربط بالأصناف",
    newSupplierBtn: "مورد جديد", supplierName: "اسم المورد", supplierPhone: "الهاتف", supplierEmail: "البريد الإلكتروني",
    supplierNotes: "ملاحظات", noSuppliers: "لا يوجد موردون مسجّلون بعد.",
    // حقول الصنف الموسّعة
    itemSupplier: "المورد", itemPrice: "سعر الوحدة", itemStorage: "مكان التخزين", itemImage: "صورة الصنف", noneOption: "بدون",
    // تيليجرام
    telegramTitle: "مستخدمو تيليجرام", telegramSub: "المستخدمون المسجَّلون تلقائيًا عبر بوت تيليجرام، وأدوارهم للإشعارات",
    telegramNoUsers: "لسه محدش سجّل في البوت. شارك رابط البوت مع الفريق واطلب منهم الضغط على Start.",
    telegramActive: "نشط", telegramBlocked: "محظور/موقف", telegramRole: "دور الإشعارات", telegramNoRole: "بدون دور محدد",
    telegramLastSeen: "آخر ظهور", telegramGenLink: "توليد رابط ربط لمستخدم", telegramGenLinkBtn: "توليد الرابط",
    telegramLinkGenerated: "انسخ الرابط وابعته للمستخدم — صالح لمدة 24 ساعة ولاستخدام واحد فقط",
    telegramSendTest: "إرسال رسالة تجريبية لكل المسجَّلين",
  },
  tr: {
    dir: "ltr", loginTitle: "Depo Yönetimi Girişi", loginUser: "Kullanıcı Adı", loginPass: "Şifre",
    loginBtn: "Giriş Yap", loginLoading: "...Giriş yapılıyor", loginError: "Kullanıcı adı veya şifre hatalı",
    brandSub: "Depo Yönetimi",
    navDashboard: "Kontrol Paneli", navIn: "Stok Girişi", navOut: "Depodan Çıkış", navStock: "Mevcut Stok",
    navReports: "Raporlar", navAudit: "İşlem Kaydı", navUsers: "Kullanıcı Yönetimi", navSettings: "Ayarlar",
    navItems: "Ürün Yönetimi", navSuppliers: "Tedarikçiler", navTelegram: "Telegram Kullanıcıları", navEmailRecipients: "E-posta Alıcıları",
    navWarehouses: "Depolar", logout: "Çıkış",
    // depolar
    warehousesTitle: "Şubeler ve Depolar", warehousesSub: "Fabrika şubelerini ve depolarını yönetin",
    newSiteBtn: "+ Yeni Şube", newWarehouseBtn: "+ Yeni Depo", siteName: "Şube Adı", siteAddress: "Adres (opsiyonel)",
    warehouseName: "Depo Adı", warehouseCode: "Depo Kodu (opsiyonel)", warehouseType: "Depo Türü",
    warehouseAllowNegative: "Negatif bakiyeye izin ver (özel durumlar)", defaultTag: "Varsayılan", inactiveTag: "Devre dışı",
    noSites: "Henüz şube kaydı yok", noWarehousesInSite: "Bu şubede henüz depo yok",
    deactivateWarehouse: "Depoyu Devre Dışı Bırak", activateWarehouse: "Depoyu Etkinleştir", deactivateSite: "Şubeyi Devre Dışı Bırak", activateSite: "Şubeyi Etkinleştir",
    whTypeRaw: "Hammadde", whTypeTools: "Alet/Yedek Parça", whTypeFinished: "Bitmiş Ürün", whTypeWip: "Yarı Mamul", whTypeGeneral: "Genel",
    // sayım
    navStockCount: "Sayım", stockCountTitle: "Sayım Oturumları", stockCountSub: "Depo sayımı — ilk aşama, komite incelemesi, nihai onay",
    newStockCountBtn: "+ Yeni Sayım", myApprovalsTitle: "Onayımı Bekleyenler", noStockCountSessions: "Henüz sayım oturumu yok",
    scWarehouse: "Depo", scCountType: "Sayım Türü", scRecurrence: "Tekrar", scScope: "Kapsam", scApprovalPath: "Onay Yolu",
    scTypeSurprise: "Ani", scTypeScheduled: "Periyodik", scRecurMonthly: "Aylık", scRecurQuarterly: "3 Aylık", scRecurSemiAnnual: "6 Aylık", scRecurAnnual: "Yıllık",
    scScopeFull: "Tam (Tüm Ürünler)", scScopeSpecific: "Belirli Ürünler",
    scPathPrimaryOnly: "Tek Aşama (Sadece Depo Sorumlusu)", scPathCommitteeOnly: "Sadece Komite", scPathFull: "Tam Süreç (Depo Sorumlusu ← Komite ← Onay)",
    scPrimaryCounters: "Görevli Depo Sorumluları", scCommitteeMembers: "Komite Üyeleri", scHideBookQty: "Sayım sırasında defter bakiyesini gizle",
    scStatusDraft: "Taslak", scStatusPrimary: "İlk Sayım Sürüyor", scStatusCommittee: "Komite İncelemesi Sürüyor", scStatusPending: "Onay Bekliyor", scStatusApproved: "Onaylandı", scStatusCancelled: "İptal Edildi",
    scStartBtn: "Sayımı Başlat", scSubmitPrimaryBtn: "İlk Sayımı Kapat ve Gönder", scSubmitCommitteeBtn: "Komite İncelemesini Kapat",
    scApproveBtn: "Onayla", scRejectBtn: "Reddet ve İade Et", scRejectReasonPrompt: "Red sebebini yazın:",
    scColItem: "Ürün", scColSystem: "Defter Bakiyesi", scColPrimary: "İlk Sayım", scColCommittee: "Komite Sayımı", scColVariance: "Fark", scColMethod: "Giriş Yöntemi",
    scEntryManual: "Manuel", scEntryBarcode: "Barkod", scHiddenQty: "Sayım sırasında gizli",
    scInTransitTitle: "Nakliyedeki Miktarlar (mevcut bakiyeye dahil değil)", scInTransitOut: "Giden:", scInTransitIn: "Gelen:", noInTransit: "Bu depoda şu anda bekleyen transfer yok",
    scNotAllCounted: "Sayılmamış ürünler var", scBackToList: "Oturum Listesine Dön", scSessionInfo: "Oturum Bilgisi",
    // genel
    save: "Kaydet", add: "Ekle", delete: "Sil", edit: "Düzenle", cancel: "İptal", search: "Ara", confirmBtn: "Onayla",
    print: "Yazdır / PDF", exportExcelBtn: "Excel'e Aktar", all: "Tümü", unit: "Birim", category: "Kategori",
    quantity: "Miktar", status: "Durum", code: "Kod", itemName: "Ürün", worker: "Çalışan", note: "Not",
    date: "Tarih", dateTime: "Tarih ve Saat",
    statusCritical: "Kritik", statusWarning: "Düşük", statusOk: "İyi",
    // Abonelik uyarıları ve bildirimleri (tf() ile dinamik metinler)
    lowStockAlertMsg: "Uyarı: {count} ürün maksimum stoğun %{percent} altına düştü",
    readOnlyExpiredMsg: "Aboneliğiniz {date} tarihinde sona erdi ve sistem şu anda \"salt okunur\" modda — verilerinizi görüntüleyebilir ve rapor yazdırabilirsiniz, ancak yeni işlem veya değişiklik kaydedemezsiniz. Normal kullanıma devam etmek için lütfen aboneliği ödeyin.",
    readOnlySuspendedMsg: "Fabrikanızın aboneliği durduruldu — sistem şu anda sadece \"salt okunur\" modda. Normal kullanıma devam etmek için destek ile iletişime geçin.",
    readOnlyBlockedToast: "Abonelik süresi dolduğu için fabrika şu anda \"salt okunur\" modda — normal kullanıma devam etmek için aboneliği ödeyin",
    subTrialLabel: "Deneme sürümü", subActiveLabel: "Abonelik aktif", subOverdueLabel: "Ödeme gecikti", subSuspendedLabel: "Abonelik durduruldu",
    subRenewalSoonLabel: "Abonelik yakında sona erecek",
    subExpiresIn: "{days} gün sonra sona eriyor ({date})", subExpiredSince: "{days} gün önce sona erdi",
    subAmountDue: "Ödenmesi gereken tutar: {amount} {currency}",
    // Kontrol paneli
    dashboardTitle: "Kontrol Paneli", dashboardSub: "Bugünkü depo durumuna hızlı bakış",
    statTotalItems: "Toplam Ürün", statCritical: "Kritik Ürünler", statTodayIn: "Bugünkü Girişler", statTodayOut: "Bugünkü Çıkışlar",
    sectionUrgent: "Acil Dikkat Gereken Ürünler", sectionRecentTx: "Son Hareketler",
    viewAllStock: "Tüm Stoku Görüntüle", allReports: "Tüm Raporlar", noLowStock: "Şu anda düşük stoklu ürün yok.", noTx: "Henüz kayıtlı hareket yok.",
    chartMovement: "Stok Hareketi — Son 7 Gün", chartTopConsumed: "En Çok Tüketilen Ürünler",
    legendIn: "Giriş", legendOut: "Çıkış", noData: "Henüz yeterli veri yok.",
    // Stok
    stockTitle: "Mevcut Stok", itemsRegistered: "kayıtlı ürün", searchByNameCode: "İsim veya kod ile ara...",
    // Giriş/Çıkış
    inTitle: "Stok Girişi", inSub: "Fabrikaya yeni gelen miktarı ekle",
    outTitle: "Depodan Çıkış", outSub: "İhtiyacın olan malzemeyi doğrudan çek",
    searchItem: "İsim veya kategoriye göre ürün ara...", confirmIn: "Girişi Onayla", confirmOut: "Çıkışı Onayla",
    qtyLabel: "Miktar", workerLabel: "Çalışan Adı *", noteLabel: "Not (isteğe bağlı)", available: "Mevcut miktar",
    // Raporlar
    reportsTitle: "Raporlar", reportsSub: "Depo hareketlerinin ve düşük stokların tam kapsamı",
    lowStockSection: "Düşük ve Kritik Stok Raporu", consumptionSection: "En Çok Çekilen Ürünler (Toplam Tüketim)",
    dailySection: "Günlük Özet (Her Gün Giriş ve Çıkış)", txLogSection: "Hareket Kaydı (Tarih ve Saat ile)",
    printSectionsTitle: "Yazdırılacak/Aktarılacak Rapor Bölümleri", quickRange: "Hızlı Aralık", dateFrom: "Başlangıç Tarihi", dateTo: "Bitiş Tarihi",
    typeAll: "Tümü", typeIn: "Sadece Giriş", typeOut: "Sadece Çıkış", allItems: "Tüm Ürünler", clearFilters: "Filtreleri Temizle",
    voucherBtn: "Fiş Yazdır",
    // Ayarlar
    settingsTitle: "Ayarlar", settingsSub: "Fabrika adı, logo, iletişim bilgileri ve uyarı oranları",
    factoryInfo: "Fabrika Bilgileri", factoryName: "Fabrika Adı", factoryLogo: "Fabrika Logosu",
    factoryAddress: "Fabrika Adresi", factoryPhone: "Telefon Numarası",
    criticalPct: "Kritik Uyarı Oranı %", warningPct: 'Düşük Uyarı Oranı %', saveFactoryInfo: "Fabrika Bilgilerini Kaydet",
    itemsAdminTitle: "Ürün Yönetimi", itemsAdminSub: "Ürün türleri (kategoriler) ve her kategori altındaki ürünler",
    categoriesTitle: "Ürün Türleri (Kategoriler)", newCategoryPlaceholder: "Yeni kategori adı, örn: Nakış Malzemeleri",
    itemsTitle: "Ürünler", newItemBtn: "Yeni Ürün", maxQty: "Maksimum", currentQty: "Mevcut Miktar",
    // Kullanıcılar
    usersTitle: "Kullanıcı Yönetimi", usersSub: "Hesap oluşturma, yetki belirleme, kullanıcıları durdurma veya silme",
    newUserBtn: "Yeni Kullanıcı", fullNameLabel: "Tam Ad", roleLabel: "Rol",
    lastLogin: "Son Giriş", deviceLabel: "Cihaz", activeLabel: "Aktif", suspendedLabel: "Durduruldu", youLabel: "(Siz)",
    // İşlem Kaydı
    auditTitle: "İşlem Kaydı (Audit Log)", auditSub: "İşlemi kim yaptı, ne zaman, hangi cihazda ve değişiklik öncesi/sonrası miktar",
    actionCol: "İşlem", entityCol: "Ürün / Öğe", beforeCol: "Önce", afterCol: "Sonra", timeCol: "Zaman",
    noAudit: "Henüz kayıtlı işlem yok.",
    usernameLabel: "Kullanıcı Adı (İngilizce, boşluksuz)", passwordLabel: "Şifre", createAccountBtn: "Hesap Oluştur",
    suppliersTitle: "Tedarikçiler", suppliersSub: "Hızlı iletişim ve ürünlerle ilişkilendirme için tedarikçi bilgileri",
    newSupplierBtn: "Yeni Tedarikçi", supplierName: "Tedarikçi Adı", supplierPhone: "Telefon", supplierEmail: "E-posta",
    supplierNotes: "Notlar", noSuppliers: "Henüz kayıtlı tedarikçi yok.",
    itemSupplier: "Tedarikçi", itemPrice: "Birim Fiyatı", itemStorage: "Depolama Yeri", itemImage: "Ürün Görseli", noneOption: "Yok",
    // Telegram
    telegramTitle: "Telegram Kullanıcıları", telegramSub: "Bot üzerinden otomatik kaydolan kullanıcılar ve bildirim rolleri",
    telegramNoUsers: "Henüz kimse bota kaydolmadı. Bot bağlantısını ekiple paylaşın ve Start'a basmalarını isteyin.",
    telegramActive: "Aktif", telegramBlocked: "Engelli/Durduruldu", telegramRole: "Bildirim Rolü", telegramNoRole: "Rol belirlenmedi",
    telegramLastSeen: "Son Görülme", telegramGenLink: "Kullanıcı için bağlantı oluştur", telegramGenLinkBtn: "Bağlantı Oluştur",
    telegramLinkGenerated: "Bağlantıyı kopyalayıp kullanıcıya gönderin — 24 saat ve tek kullanım için geçerli",
    telegramSendTest: "Tüm kayıtlı kullanıcılara test mesajı gönder",
  },
};
function t(key) { return (I18N[state.lang] && I18N[state.lang][key]) || I18N.ar[key] || key; }
// نسخة بديلة من t() بتقبل قيم متغيّرة جوه النص (زي عدد الأصناف أو النسبة)
// — القالب نفسه بيتحدد لكل لغة بترتيب كلامه الطبيعي (مش ترتيب ثابت)، عشان
// العربي والتركي بيختلفوا في ترتيب الجملة أحيانًا
function tf(key, vars) {
  let s = t(key);
  for (const k in vars) s = s.replaceAll(`{${k}}`, vars[k]);
  return s;
}
function setLang(lang) {
  state.lang = lang; localStorage.setItem("lang", lang);
  document.documentElement.dir = I18N[lang].dir;
  document.documentElement.lang = lang;
  applyLoginTexts();
  const logoutBtn = $("#logout-btn"); if (logoutBtn) logoutBtn.textContent = t("logout");
  const brandSubEl = $("#brand-sub"); if (brandSubEl) brandSubEl.textContent = t("brandSub");
  if (state.user) { document.title = (state.settings.workshop_name || "مصنع نسيج") + " — " + t("brandSub"); render(); }
}
function applyLoginTexts() {
  const subEl = $("#login-sub"); if (subEl) subEl.textContent = t("loginTitle");
  const uLbl = $("#login-user-label"); if (uLbl) uLbl.textContent = t("loginUser");
  const pLbl = $("#login-pass-label"); if (pLbl) pLbl.textContent = t("loginPass");
  const btn = $("#login-submit"); if (btn && !btn.disabled) btn.textContent = t("loginBtn");
  $$(".lang-btn").forEach(b => b.classList.toggle("active-lang", b.dataset.lang === state.lang));
}

const ROLE_LABELS = {
  admin: "مدير النظام",
  factory_manager: "مدير المصنع",
  keeper: "أمين مخزن",
  production_manager: "مدير الإنتاج",
  accountant: "المحاسب",
  quality: "مراقب الجودة",
  viewer: "للقراءة فقط",
};
// كل تبويب مسموح لمين — طبقًا لمصفوفة الصلاحيات المتفق عليها
const TAB_ROLES = {
  dashboard: ["admin", "factory_manager", "keeper", "production_manager", "quality", "viewer"],
  stock: ["admin", "factory_manager", "keeper", "production_manager", "accountant", "quality", "viewer"],
  in: ["admin", "keeper"],
  out: ["admin", "keeper"],
  reports: ["admin", "factory_manager", "keeper", "production_manager", "accountant", "quality", "viewer"],
  stockTake: ["admin", "keeper"],
  stockCount: ["admin", "factory_manager", "keeper", "production_manager", "accountant", "quality", "viewer"],
  audit: ["admin", "factory_manager", "keeper"],
  items: ["admin", "keeper"],
  warehouses: ["admin", "factory_manager", "keeper", "production_manager", "accountant", "quality", "viewer"],
  suppliers: ["admin", "keeper"],
  users: ["admin"],
  telegram: ["admin"],
  notificationsLog: ["admin"],
  emailRecipients: ["admin"],
  settings: ["admin"],
};
function myRole() { return state.profile?.role || "viewer"; }
function isAdmin() { return myRole() === "admin"; }
function canEdit() { return myRole() === "admin" || myRole() === "keeper"; }
function firstAllowedTab() { return Object.keys(TAB_ROLES).find(id => TAB_ROLES[id].includes(myRole())) || "stock"; }
function deviceInfo() {
  const ua = navigator.userAgent || "";
  let dev = "جهاز غير معروف";
  if (/Mobi|Android/i.test(ua)) dev = "موبايل";
  else if (/Tablet|iPad/i.test(ua)) dev = "تابلت";
  else dev = "كمبيوتر";
  const browser = /Chrome/i.test(ua) ? "Chrome" : /Firefox/i.test(ua) ? "Firefox" : /Safari/i.test(ua) ? "Safari" : /Edg/i.test(ua) ? "Edge" : "متصفح";
  return `${dev} · ${browser}`;
}
async function logAudit({ action, entity, entityName, qtyBefore, qtyAfter, details }) {
  try {
    await sb.from("audit_log").insert({
      tenant_id: TENANT_ID,
      actor_id: state.user?.id || null,
      actor_name: state.profile?.full_name || state.user?.email?.split("@")[0] || "غير معروف",
      action, entity: entity || null, entity_name: entityName || null,
      qty_before: qtyBefore ?? null, qty_after: qtyAfter ?? null,
      device: deviceInfo(), details: details || null,
    });
  } catch (e) { /* لا نوقف العملية الأساسية لو فشل تسجيل السجل */ }
}

/* ---------------- helpers ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function fmtDate(iso) {
  const d = new Date(iso);
  return d.toLocaleString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
}
// تنقية أي نص قبل حقنه داخل innerHTML — منع أساسي من XSS التخزيني
// (ملحوظة: باقي أماكن الاستخدام في الكود القديم لسه محتاجة نفس المعالجة،
// دي خطوة أولى بتغطي الجزء الجديد اللي أضفناه فقط، والباقي مرحلة منفصلة)
function escHtml(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

/* ============================================================
   أداة عامة: بحث + ترقيم صفحات + طباعة + تصدير Excel
   تُستخدم في كل الشاشات الطويلة (سجل العمليات، سجل الحركات، الجرد)
   ملحوظة مهمة: الطباعة والتصدير بياخدوا الصفحة المعروضة حاليًا بالظبط
   (لو مختار 50 صف، يطبع/يصدّر 50 بس مش كل البيانات)
   ============================================================ */
const PAGE_SIZE_OPTIONS = [50, 100, 200, 300, 400, 500, 1000, 2000];
const _pagerState = {};
function getPagerState(idPrefix, defaults) {
  if (!_pagerState[idPrefix]) _pagerState[idPrefix] = { page: 1, pageSize: 50, search: "", ...defaults };
  return _pagerState[idPrefix];
}

function printHeaderHtml(title) {
  return `<div class="print-only print-header">
    <div style="font-weight:800; font-size:18px;">${escHtml(state.settings.workshop_name || "مصنع")} — ${escHtml(title)}</div>
    <div style="font-size:12px; color:#555;">تم إنشاء التقرير في: ${fmtDate(new Date().toISOString())}</div>
  </div>`;
}

function pagerToolbarHtml(idPrefix, searchPlaceholder) {
  return `
    <div class="no-print" style="display:flex; flex-wrap:wrap; gap:10px; align-items:center; justify-content:space-between; margin-bottom:14px;">
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap; flex:1;">
        <div style="position:relative; max-width:260px; flex:1;">
          <span style="position:absolute; right:12px; top:11px; color:var(--ink50);">${icon("search", 15)}</span>
          <input id="${idPrefix}-search" class="input" style="width:100%; padding-right:34px;" placeholder="${searchPlaceholder}">
        </div>
        <span id="${idPrefix}-count" class="mono" style="font-size:12px; color:var(--ink70);"></span>
      </div>
      <div style="display:flex; align-items:center; gap:10px; flex-wrap:wrap;">
        <div style="display:flex; align-items:center; gap:6px; font-size:12.5px;">
          <label>عدد الصفوف:</label>
          <select id="${idPrefix}-pagesize" class="input" style="padding:6px 8px; font-size:12.5px;">
            ${PAGE_SIZE_OPTIONS.map(n => `<option value="${n}">${n}</option>`).join("")}
          </select>
        </div>
        <button class="btn-dark" id="${idPrefix}-print" style="padding:7px 12px; font-size:12.5px;">${icon("history", 14)} طباعة</button>
        <button class="btn-dark" id="${idPrefix}-export" style="padding:7px 12px; font-size:12.5px;">${icon("download", 14)} تصدير Excel</button>
      </div>
    </div>`;
}

function pagerBottomHtml(idPrefix) {
  return `<div class="no-print" id="${idPrefix}-pager-bottom" style="display:flex; align-items:center; gap:10px; justify-content:center; margin-top:14px;"></div>`;
}

/**
 * يشغّل جدول بحث+ترقيم صفحات+طباعة+تصدير كامل على بيانات محمّلة بالفعل في الذاكرة.
 * opts: { idPrefix, allRows, searchFields(row)=>array, renderRow(row)=>html, colCount,
 *         emptyMessage, excelRow(row)=>object, excelSheetName, tbodySelector }
 * بترجع دالة draw() يقدر المستخدم ينادّيها تاني لو اتغيّرت البيانات الأصلية.
 */
function mountPagedTable(opts) {
  const st = getPagerState(opts.idPrefix);
  const searchInput = $(`#${opts.idPrefix}-search`);
  const pageSizeSelect = $(`#${opts.idPrefix}-pagesize`);
  if (searchInput) searchInput.value = st.search;
  if (pageSizeSelect) pageSizeSelect.value = String(st.pageSize);

  const getFiltered = () => {
    const q = (st.search || "").trim().toLowerCase();
    if (!q) return opts.allRows;
    return opts.allRows.filter(row => opts.searchFields(row).some(f => (f ?? "").toString().toLowerCase().includes(q)));
  };

  const draw = () => {
    const filtered = getFiltered();
    const totalPages = Math.max(1, Math.ceil(filtered.length / st.pageSize));
    if (st.page > totalPages) st.page = totalPages;
    if (st.page < 1) st.page = 1;
    const start = (st.page - 1) * st.pageSize;
    const pageRows = filtered.slice(start, start + st.pageSize);

    const tbody = $(opts.tbodySelector);
    if (tbody) {
      tbody.innerHTML = pageRows.length
        ? pageRows.map(opts.renderRow).join("")
        : `<tr><td colspan="${opts.colCount}"><div class="empty-note">${opts.emptyMessage}</div></td></tr>`;
    }

    const countEl = $(`#${opts.idPrefix}-count`);
    if (countEl) countEl.textContent = `${filtered.length} سجل`;

    const bottomPager = $(`#${opts.idPrefix}-pager-bottom`);
    if (bottomPager) {
      bottomPager.innerHTML = `
        <button class="btn-dark" id="${opts.idPrefix}-prev" ${st.page <= 1 ? "disabled" : ""} style="padding:5px 12px; font-size:12.5px;">السابق</button>
        <span class="mono" style="font-size:12.5px;">صفحة ${st.page} من ${totalPages}</span>
        <button class="btn-dark" id="${opts.idPrefix}-next" ${st.page >= totalPages ? "disabled" : ""} style="padding:5px 12px; font-size:12.5px;">التالي</button>`;
      $(`#${opts.idPrefix}-prev`).onclick = () => { st.page--; draw(); };
      $(`#${opts.idPrefix}-next`).onclick = () => { st.page++; draw(); };
    }

    if (opts.onDrawn) opts.onDrawn(pageRows, filtered);
    return { filtered, pageRows, totalPages };
  };

  if (searchInput) searchInput.oninput = () => { st.search = searchInput.value; st.page = 1; draw(); };
  if (pageSizeSelect) pageSizeSelect.onchange = () => { st.pageSize = Number(pageSizeSelect.value); st.page = 1; draw(); };

  const printBtn = $(`#${opts.idPrefix}-print`);
  if (printBtn) printBtn.onclick = () => window.print();

  const exportBtn = $(`#${opts.idPrefix}-export`);
  if (exportBtn) exportBtn.onclick = async () => {
    const origText = exportBtn.innerHTML;
    try {
      exportBtn.disabled = true; exportBtn.innerHTML = "...جارِ التجهيز";
      await ensureXLSX();
      const { pageRows } = draw();
      const rows = pageRows.map(opts.excelRow);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ "ملاحظة": "لا توجد بيانات" }]), (opts.excelSheetName || "بيانات").slice(0, 31));
      XLSX.writeFile(wb, `${opts.excelSheetName || "تقرير"}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast("حدث خطأ أثناء تصدير Excel — " + (e && e.message ? e.message : ""), true);
    } finally {
      exportBtn.disabled = false; exportBtn.innerHTML = origText;
    }
  };

  return draw();
}

function pctOf(item) { if (!item.max_qty || item.max_qty <= 0) return 100; return Math.max(0, Math.min(100, (item.qty / item.max_qty) * 100)); }
function statusOf(item) {
  const p = pctOf(item);
  const critT = (state.settings && state.settings.alert_threshold_percent) || 15;
  const warnT = (state.settings && state.settings.warning_threshold_percent) || 30;
  if (p <= critT) return "critical";
  if (p <= warnT) return "warning";
  return "ok";
}
const STATUS_META = {
  critical: { label: "حرج", cls: "pill-critical", color: "#C85D51" },
  warning: { label: "منخفض", cls: "pill-warning", color: "#B87A28" },
  ok: { label: "جيد", cls: "pill-ok", color: "#2F8F5B" },
};
function pill(status) {
  const m = STATUS_META[status];
  return `<span class="pill ${m.cls}"><span class="pill-dot" style="background:${m.color}"></span>${m.label}</span>`;
}
function tape(item, sm = false) {
  const p = pctOf(item), st = statusOf(item);
  return `<div class="tape ${sm ? "sm" : ""}"><div class="tape-fill" style="width:${p}%;background:${STATUS_META[st].color}"></div></div>`;
}
function toast(msg, err = false) {
  const el = document.createElement("div");
  el.className = "toast" + (err ? " err" : "");
  // msg بينفع يحتوي على اسم صنف/مستخدم/مورد إلخ كتبه مستخدم آخر — لازم
  // تنقيته دايمًا هنا (مصدر واحد) بدل ما نطارد كل استخدام لـ toast() لوحده
  el.innerHTML = `${icon(err ? "alert" : "check", 16)}<span>${escHtml(msg)}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2600);
}

/* ---------------- auth ---------------- */
async function tryLogin(username, password) {
  // الطريقة الجديدة: تسجيل الدخول بيعدي عبر Edge Function آمنة (بدل نداء
  // مباشر لـ Supabase Auth)، عشان يبقى فيه قفل حقيقي على مستوى السيرفر
  // بعد محاولات فاشلة متكررة — مش قفل بـ localStorage سهل التجاوز
  const res = await fetch(`${SUPABASE_URL}/functions/v1/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
    body: JSON.stringify({ tenantSlug: TENANT_SLUG, username: username.trim().toLowerCase(), password }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "تعذر تسجيل الدخول");
  const { error: sessionErr } = await sb.auth.setSession({ access_token: data.access_token, refresh_token: data.refresh_token });
  if (sessionErr) throw sessionErr;
  return { user: data.user };
}
async function doLogout(reason) {
  await sb.auth.signOut();
  state.user = null; state.profile = null;
  clearInterval(state.pollTimer);
  clearInactivityTimer();
  showLogin();
  if (reason) { $("#login-error").textContent = reason; $("#login-error").classList.remove("hidden"); }
}

/* ---------------- تسجيل خروج تلقائي بعد عدم النشاط ---------------- */
const INACTIVITY_LIMIT_MS = 20 * 60 * 1000; // 20 دقيقة
let inactivityTimer = null;
function resetInactivityTimer() {
  clearTimeout(inactivityTimer);
  if (!state.user) return;
  inactivityTimer = setTimeout(() => {
    doLogout("تم تسجيل الخروج تلقائيًا بعد فترة من عدم النشاط. سجّل دخولك مرة أخرى للمتابعة.");
  }, INACTIVITY_LIMIT_MS);
}
function clearInactivityTimer() { clearTimeout(inactivityTimer); }
["mousemove", "keydown", "click", "touchstart", "scroll"].forEach(evt => {
  document.addEventListener(evt, () => { if (state.user) resetInactivityTimer(); }, { passive: true });
});

/* ---------------- data loading ---------------- */
async function loadSettings() {
  if (!TENANT_ID) return;
  const { data } = await sb.from("tenant_settings").select("*").eq("tenant_id", TENANT_ID).maybeSingle();
  if (data) state.settings = data;
}
async function loadPlan() {
  if (!TENANT_ID) return;
  const { data } = await sb.from("tenants").select("plans(key, name, max_users, allow_email, allow_telegram), subscription_status, subscription_expires_at").eq("id", TENANT_ID).maybeSingle();
  state.plan = data?.plans || null;

  // ⚠️ وضع "قراءة فقط" بعد انتهاء الاشتراك بمهلة سماح 3 أيام — قرار عمل
  // (مش قفل كامل فورًا) عشان مصنع بيشتغل يوميًا بمواد فعلية مايتوقفش فجأة
  // بسبب تأخير إداري بسيط في السداد. الفحص هنا في الواجهة (أول خط دفاع
  // للمستخدم العادي) + نفس الفحص مكرر في قاعدة البيانات كخط حماية حقيقي
  // (migration_subscription_readonly.sql) — الواجهة وحدها مش كافية لمنع حد
  // شاطر تقنيًا من الالتفاف عليها.
  const GRACE_DAYS = 3;
  state.readOnlyReason = null;
  if (data?.subscription_status === "active" && data?.subscription_expires_at) {
    const daysSinceExpiry = Math.floor((Date.now() - new Date(data.subscription_expires_at).getTime()) / 86400000);
    if (daysSinceExpiry > GRACE_DAYS) {
      state.readOnlyReason = tf("readOnlyExpiredMsg", { date: data.subscription_expires_at });
    }
  } else if (data?.subscription_status === "suspended") {
    state.readOnlyReason = t("readOnlySuspendedMsg");
  }
}
// دالة موحّدة تُستخدم قبل أي عملية إضافة/تعديل/حذف في كل الشاشات — بترجع
// true وتوقف العملية بتوست واضح لو المصنع في وضع "قراءة فقط"
function blockIfReadOnly() {
  if (!state.readOnlyReason) return false;
  toast(t("readOnlyBlockedToast"), true);
  return true;
}
async function loadCategories() {
  const { data } = await sb.from("categories").select("*").order("name");
  state.categories = (data && data.length) ? data.map(c => c.name) : CATS_FALLBACK;
}
async function loadItems() {
  const { data } = await sb.from("items").select("*").order("name");
  state.items = data || [];
}
async function loadTransactions() {
  const { data } = await sb.from("transactions").select("*").order("created_at", { ascending: false }).limit(2000);
  state.transactions = data || [];
}
async function loadProfile() {
  const { data } = await sb.from("profiles").select("*").eq("id", state.user.id).maybeSingle();
  state.profile = data;
}
async function loadProfiles() {
  const { data } = await sb.from("profiles").select("*").order("full_name");
  state.profiles = data || [];
}
async function loadAuditLog() {
  const { data } = await sb.from("audit_log").select("*").order("created_at", { ascending: false }).limit(2000);
  state.auditLog = data || [];
}
async function loadBackups() {
  const { data } = await sb.from("backups").select("id, created_at, created_by").order("created_at", { ascending: false }).limit(10);
  state.backups = data || [];
}
async function loadSuppliers() {
  const { data } = await sb.from("suppliers").select("*").order("name");
  state.suppliers = data || [];
}
// تحميل المواقع والمخازن مع بعض (شاشة واحدة محتاجة الاتنين دايمًا سوا)
async function loadWarehousesData() {
  const [{ data: sites }, { data: warehouses }] = await Promise.all([
    sb.from("sites").select("*").order("created_at"),
    sb.from("warehouses").select("*").order("created_at"),
  ]);
  state.sites = sites || [];
  state.warehouses = warehouses || [];
}
async function loadStockCountData() {
  if (!_warehousesLoaded) await ensureWarehouses();
  if (!_profilesLoaded) await ensureProfiles();
  const [{ data: sessions }, { data: members }, { data: pathSettings }] = await Promise.all([
    sb.from("stock_count_sessions").select("*").order("created_at", { ascending: false }),
    sb.from("stock_count_session_members").select("*"),
    sb.from("stock_count_path_settings").select("*"),
  ]);
  state.stockCountSessions = sessions || [];
  state.stockCountSessionMembers = members || [];
  state.stockCountPathSettings = pathSettings || [];
}
async function loadTelegramUsers() {
  const { data } = await sb.from("telegram_users").select("*").order("created_at", { ascending: false });
  state.telegramUsers = data || [];
}
async function loadTelegramGroups() {
  const { data: groups } = await sb.from("telegram_groups").select("*").order("created_at", { ascending: false });
  const { data: members } = await sb.from("telegram_group_members").select("group_id, telegram_user_id");
  state.telegramGroups = (groups || []).map(g => ({
    ...g,
    member_ids: (members || []).filter(m => m.group_id === g.id).map(m => m.telegram_user_id),
  }));
}
async function loadNotificationsLog() {
  const [{ data: emailRows }, { data: tgRows }] = await Promise.all([
    sb.from("email_send_log").select("*").order("created_at", { ascending: false }).limit(1000),
    sb.from("telegram_send_log").select("*").order("created_at", { ascending: false }).limit(1000),
  ]);
  const merged = [
    ...(emailRows || []).map(r => ({
      channel: "email", recipient: r.recipient_email, status: r.status,
      notification_type: r.notification_type, error_message: r.error_message,
      message_preview: r.message_preview, created_at: r.created_at,
    })),
    ...(tgRows || []).map(r => ({
      channel: "telegram", recipient: r.chat_id ? String(r.chat_id) : "—", status: r.status,
      notification_type: r.notification_type, error_message: r.error_message,
      message_preview: r.message_preview, created_at: r.created_at,
    })),
  ];
  merged.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  state.notificationsLog = merged;
}
async function loadAll() {
  await Promise.all([loadSettings(), loadPlan(), loadCategories(), loadItems(), loadTransactions(), loadProfile()]);
}
// تحميل كسول (lazy load): البيانات دي مش لازمة فورًا وقت الدخول، بنجيبها بس أول ما المستخدم
// يفتح التبويب اللي محتاجها فعليًا — ده بيقلل وقت انتظار تسجيل الدخول بشكل كبير.
let _profilesLoaded = false, _suppliersLoaded = false, _auditLoaded = false, _emailRecipientsLoaded = false, _warehousesLoaded = false, _stockCountLoaded = false;
async function ensureProfiles() { if (!_profilesLoaded) { await loadProfiles(); _profilesLoaded = true; } }
async function ensureSuppliers() { if (!_suppliersLoaded) { await loadSuppliers(); _suppliersLoaded = true; } }
async function ensureWarehouses() { if (!_warehousesLoaded) { await loadWarehousesData(); _warehousesLoaded = true; } }
async function ensureStockCount() { if (!_stockCountLoaded) { await loadStockCountData(); _stockCountLoaded = true; } }
async function ensureAuditLog() { if (!_auditLoaded) { await loadAuditLog(); _auditLoaded = true; } }
async function loadEmailRecipients() {
  const { data } = await sb.from("email_recipients").select("*").order("created_at");
  state.emailRecipients = data || [];
}
async function ensureEmailRecipients() { if (!_emailRecipientsLoaded) { await loadEmailRecipients(); _emailRecipientsLoaded = true; } }

/* ---------------- app boot ---------------- */
// لما يكون فيه جلسة دخول قائمة بالفعل (المستخدم مسجل دخوله من قبل)، بنعتمد
// على tenant_id المسجّل فعليًا في حساب المستخدم نفسه (المصدر الموثوق الوحيد)
// بدل تخمين الـ slug من الرابط — عشان لو الجهاز مشترك بين مصانع مختلفة
// أو الرابط مش دقيق، البيانات الصحيحة تتحمل صح برضو.
async function resolveTenantById(tenantId) {
  const { data } = await sb.from("tenants").select("id, name, slug").eq("id", tenantId).maybeSingle();
  if (data) {
    TENANT_ID = data.id; TENANT_SLUG = data.slug; TENANT_NAME = data.name;
    localStorage.setItem("tenant_slug", TENANT_SLUG);
  }
}

async function boot() {
  // ملحوظة مهمة: مبنعرضش شاشة تسجيل الدخول فورًا هنا زي الأول — بنسيب شاشة
  // التحميل الأولية (boot-loader) شغالة لحد ما نتأكد فعليًا لو فيه جلسة
  // دخول سليمة أو لأ. لو عرضنا شاشة الدخول فورًا وبعدين قفلناها لما نلاقي
  // جلسة سليمة، بتظهر "ومضة" مزعجة لشاشة الدخول قبل الداشبورد مع كل تحديث
  // للصفحة — وده بالظبط اللي كان بيحصل قبل الإصلاح ده.
  try {
    // نحاول نحدد المصنع من سبدومين الرابط، أو آخر مصنع اتسجل دخوله من نفس الجهاز
    // الأولوية: سبدومين الرابط → كود مصنع موجود صراحةً في الرابط (?tenant=..
    // مفيد لروابط التسليم من لوحة تحكم المنصة) → آخر مصنع محفوظ محليًا
    const urlTenantParam = new URLSearchParams(window.location.search).get("tenant");
    const guessedSlug = detectSlugFromHostname() || urlTenantParam || localStorage.getItem("tenant_slug");
    if (guessedSlug) {
      await resolveTenant(guessedSlug);
    }

    const { data: { session } } = await sb.auth.getSession();

    if (session) {
      state.user = session.user;
      await loadProfile();
      if (state.profile && state.profile.tenant_id) {
        await resolveTenantById(state.profile.tenant_id);
      }
      // فشل مؤقت في تحميل البيانات (شبكة بطيئة، استعلام فشل مرة واحدة، إلخ)
      // لازم ما يوديش لتسجيل خروج المستخدم — الجلسة نفسها سليمة، بس البيانات
      // ممكن تكون ناقصة مؤقتًا. هنعرض التطبيق برضه ونعرض تنبيه بسيط بدل ما نطرده لشاشة الدخول.
      try {
        await loadAll();
      } catch (loadErr) {
        console.error("boot: فشل تحميل بعض البيانات، لكن الجلسة سليمة:", loadErr);
        toast("تعذّر تحميل بعض البيانات — جرّب تحديث الصفحة لو حسّيت بنقص", true);
      }

      if (state.profile && state.profile.is_active === false) {
        await sb.auth.signOut();
        state.user = null;
        state.profile = null;
        showLogin();
        prefillTenantField(guessedSlug);
        $("#login-error").textContent = "هذا الحساب موقوف حاليًا. تواصل مع مدير النظام.";
        $("#login-error").classList.remove("hidden");
      } else {
        showApp();
      }
    } else {
      // مفيش جلسة أصلاً (أول زيارة، أو الجلسة انتهت فعلاً) — دلوقتي بس
      // نظهر شاشة الدخول، ونجهّز خانة كود المصنع بأفضل تخمين متاح
      showLogin();
      prefillTenantField(guessedSlug);
      if (TENANT_ID) await loadSettingsForLogin();
    }
  } catch (e) {
    console.error("boot error:", e);
    showLogin();
  }

  sb.auth.onAuthStateChange(async (event, session) => {
    if (event === "SIGNED_OUT") {
      // إشعار "SIGNED_OUT" ممكن يكون مؤقت/كاذب لو فيه أكتر من تبويب أو جهاز
      // مسجّل بنفس الحساب (تجديد المفتاح في تبويب تاني بيبعت الإشعار ده للكل
      // لحظيًا حتى لو الجلسة سليمة فعليًا). قبل ما نطرد المستخدم فعليًا، نتأكد
      // بشكل مباشر من قاعدة الجلسة إن مفيش جلسة سليمة فعلًا.
      const { data: { session: recheck } } = await sb.auth.getSession();
      if (!recheck) {
        state.user = null; state.profile = null;
        showLogin();
      }
    }
  });
}
async function loadSettingsForLogin() {
  try { await loadSettings(); } catch (e) {}
  applyBranding();
}
function applyBranding() {
  const name = state.settings.workshop_name || "مصنع نسيج";
  const logo = state.settings.logo_base64;
  $("#login-name").textContent = name;
  $("#brand-name").textContent = name;
  document.title = name + " — " + t("brandSub");
  const brandSubEl = $("#brand-sub"); if (brandSubEl) brandSubEl.textContent = t("brandSub");
  const loginLogo = $("#login-logo"), sideLogo = $("#side-logo");
  loginLogo.innerHTML = logo ? `<img src="${logo}">` : icon("scissors", 30);
  sideLogo.innerHTML = logo ? `<img src="${logo}">` : icon("scissors", 19);
}

function hideBootLoader() {
  const el = document.getElementById("boot-loader");
  if (el) { el.classList.add("boot-loader-hidden"); setTimeout(() => el.remove(), 300); }
}
function showLogin() {
  $("#login-screen").classList.remove("hidden");
  $("#app-shell").classList.add("hidden");
  $("#login-error").classList.add("hidden");
  hideBootLoader();
}
// تعبئة خانة كود المصنع بأفضل تخمين متاح (سبدومين الرابط أو آخر قيمة
// محفوظة محليًا)، وإخفاء الخانة تمامًا لو السبدومين نفسه بيحدد المصنع
// (مش لازم المستخدم يكتبها يدوي في الحالة دي)
// تعبئة خانة كود المصنع بأفضل تخمين متاح (سبدومين الرابط، أو رابط خاص فيه
// ?tenant=..، أو آخر قيمة محفوظة محليًا)، وإخفاء الخانة تمامًا لو المصنع
// اتحدد بثقة من الرابط نفسه (مش لازم المستخدم يكتبها يدوي في الحالة دي) —
// ده بالظبط اللي بيسمح بمشاركة رابط خاص لكل مصنع (masnak.app/?tenant=xxx)
// يفتح للمستخدم شاشة الدخول باسم المستخدم وكلمة المرور بس، من غير ما
// يحتاج يعرف أو يكتب كود المصنع بنفسه — وبرضه من غير ما ده يأثر على عزل
// البيانات بين المصانع، لأن العزل الفعلي مفروض بالكامل من RLS على مستوى
// قاعدة البيانات (tenant_id لكل صف)، مش من شاشة الدخول ولا من الرابط نفسه.
function prefillTenantField(guessedSlug) {
  const slugField = $("#login-tenant-slug");
  if (slugField && guessedSlug && !slugField.value) slugField.value = guessedSlug;

  const urlTenantParam = new URLSearchParams(window.location.search).get("tenant");
  const tenantConfidentlyKnown = detectSlugFromHostname() || (urlTenantParam && TENANT_ID);
  if (tenantConfidentlyKnown) {
    const tf = $("#login-tenant-field"); if (tf) tf.classList.add("hidden");
  }
}
function showApp() {
  $("#login-screen").classList.add("hidden");
  $("#app-shell").classList.remove("hidden");
  hideBootLoader();
  applyBranding();
  const wname = state.profile?.full_name || state.user.email.split("@")[0];
  $("#who-name").textContent = wname;
  $("#logout-btn").textContent = t("logout");
  $$(".lang-btn").forEach(b => b.classList.toggle("active-lang", b.dataset.lang === state.lang));
  render();
  loadAndRenderSubscriptionCard();
  resetInactivityTimer();
  clearInterval(state.pollTimer);
  state.pollTimer = setInterval(async () => {
    if (document.querySelector(".modal-overlay")) return;
    // لو المستخدم بيكتب دلوقتي في أي حقل (مثال: بيضيف إيميل إشعارات جديد)، منعملش
    // أي إعادة رسم في الجولة دي، عشان منمسحش اللي لسه بيكتبه قبل ما يحفظه
    const active = document.activeElement;
    if (active && ["INPUT", "TEXTAREA", "SELECT"].includes(active.tagName)) return;
    await Promise.all([loadItems(), loadTransactions()]);
    render();
  }, 25000);
}

// إيقاف مؤقت لميزة "الجرد" (stock take) — بناءً على طلب صاحب المنصة، لحد ما
// نظبط دوال قاعدة البيانات (approve_stock_take وغيرها) بحيث محدش يقدر يعتمد
// جرد هو نفسه اللي عمله (ثغرة تلاعب محتملة: أمين مخزن يسرق ويعدّل الأرقام
// بنفسه). عشان نرجّعها تاني بعد التصحيح، خليك بس غيّر السطر ده لـ true.
const STOCK_TAKE_ENABLED = false;

/* ---------------- nav ---------------- */
const NAV = [
  { id: "dashboard", labelKey: "navDashboard", icon: "grid" },
  { id: "in", labelKey: "navIn", icon: "in" },
  { id: "out", labelKey: "navOut", icon: "out" },
  { id: "stock", labelKey: "navStock", icon: "package" },
  { id: "reports", labelKey: "navReports", icon: "chart" },
  ...(STOCK_TAKE_ENABLED ? [{ id: "stockTake", labelKey: "navStockTake", icon: "check" }] : []),
  { id: "stockCount", labelKey: "navStockCount", icon: "check" },
  { id: "audit", labelKey: "navAudit", icon: "history" },
  { id: "items", labelKey: "navItems", icon: "tag" },
  { id: "warehouses", labelKey: "navWarehouses", icon: "warehouse" },
  { id: "suppliers", labelKey: "navSuppliers", icon: "truck" },
  { id: "users", labelKey: "navUsers", icon: "users" },
  { id: "telegram", labelKey: "navTelegram", icon: "send" },
  { id: "notificationsLog", labelKey: "navNotificationsLog", icon: "alert" },
  { id: "emailRecipients", labelKey: "navEmailRecipients", icon: "mail" },
  { id: "settings", labelKey: "navSettings", icon: "gear" },
];
function renderNav() {
  const critical = state.items.filter(i => statusOf(i) === "critical").length;
  const visible = NAV.filter(n => (TAB_ROLES[n.id] || []).includes(myRole()));
  $("#nav-list").innerHTML = visible.map(n => `
    <button class="nav-btn ${state.tab === n.id ? "active" : ""}" data-tab="${n.id}">
      ${icon(n.icon, 18)}<span>${t(n.labelKey)}</span>
      ${n.id === "dashboard" && critical ? `<span class="badge">${critical}</span>` : ""}
    </button>`).join("");
  $$(".nav-btn").forEach(b => b.onclick = async () => {
    state.tab = b.dataset.tab; state.selectedItem = null;
    if (state.tab === "audit") await loadAuditLog();
    if (state.tab === "users") await loadProfiles();
    if (state.tab === "suppliers") await loadSuppliers();
    if (state.tab === "telegram") { await loadTelegramUsers(); await loadTelegramGroups(); }
    if (state.tab === "notificationsLog") await loadNotificationsLog();
    if (state.tab === "emailRecipients") await ensureEmailRecipients();
    $("#nav-list").classList.remove("mobile-open");
    $("#mobile-extra-controls").classList.remove("mobile-open");
    render();
  });
  const roleTag = $("#who-role"); if (roleTag) roleTag.textContent = ROLE_LABELS[myRole()] || "";
}

/* ---------------- render dispatcher ---------------- */
function render() {
  renderNav();
  renderBell();
  const critItems = state.items.filter(i => statusOf(i) === "critical");
  const banner = $("#alert-banner");
  if (critItems.length) {
    banner.classList.remove("hidden");
    const isOpen = state._alertOpen;
    banner.innerHTML = `
      <div class="alert-banner-row">
        ${icon("alert", 16)}
        <span class="alert-msg">${tf("lowStockAlertMsg", { count: critItems.length, percent: state.settings.alert_threshold_percent || 15 })}</span>
        <button id="alert-toggle-btn" class="alert-toggle-btn ${isOpen ? "open" : ""}">${isOpen ? "إخفاء" : "عرض التفاصيل"} ${icon("chevronDown", 13)}</button>
      </div>
      <div class="alert-details ${isOpen ? "open" : ""}"><div class="alert-details-inner">
        ${critItems.map(i => `<span class="alert-chip" data-alert-item="${escHtml(i.name)}">${icon("alert", 12)} ${escHtml(i.name)} — ${Math.round(pctOf(i))}%</span>`).join("")}
      </div></div>`;
    const toggleBtn = $("#alert-toggle-btn");
    if (toggleBtn) toggleBtn.onclick = () => { state._alertOpen = !state._alertOpen; render(); };
    $$("[data-alert-item]").forEach(chip => chip.onclick = () => { state.tab = "stock"; render(); });
  } else banner.classList.add("hidden");

  const main = $("#main");
  if (!TAB_ROLES[state.tab] || !TAB_ROLES[state.tab].includes(myRole()) || (state.tab === "stockTake" && !STOCK_TAKE_ENABLED)) state.tab = firstAllowedTab();
  if (state.tab === "dashboard") renderDashboard(main);
  else if (state.tab === "in") renderMove(main, "in");
  else if (state.tab === "out") renderMove(main, "out");
  else if (state.tab === "stock") renderStock(main);
  else if (state.tab === "reports") renderReports(main);
  else if (state.tab === "stockTake" && STOCK_TAKE_ENABLED) renderStockTake(main);
  else if (state.tab === "notificationsLog") renderNotificationsLog(main);
  else if (state.tab === "audit") renderAudit(main);
  else if (state.tab === "items") renderItemsAdmin(main);
  else if (state.tab === "warehouses") renderWarehouses(main);
  else if (state.tab === "stockCount") renderStockCount(main);
  else if (state.tab === "suppliers") renderSuppliers(main);
  else if (state.tab === "users") renderUsers(main);
  else if (state.tab === "telegram") renderTelegramUsers(main);
  else if (state.tab === "emailRecipients") renderEmailRecipients(main);
  else if (state.tab === "settings") renderSettings(main);
}

/* ---------------- جرس الإشعارات ---------------- */
function renderBell() {
  const needsAttention = state.items.filter(i => statusOf(i) !== "ok").sort((a, b) => pctOf(a) - pctOf(b));
  const badge = $("#bell-badge");
  if (needsAttention.length) { badge.textContent = needsAttention.length; badge.classList.remove("hidden"); }
  else badge.classList.add("hidden");

  const dd = $("#bell-dropdown");
  dd.innerHTML = `
    <div class="bell-title">${needsAttention.length ? `🔔 يوجد ${needsAttention.length} صنف يحتاج شراء` : "لا توجد تنبيهات حاليًا"}</div>
    ${needsAttention.length ? needsAttention.slice(0, 8).map(it => `
      <div class="bell-item">
        <span style="width:8px; height:8px; border-radius:50%; background:${STATUS_META[statusOf(it)].color}; flex-shrink:0;"></span>
        <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(it.name)}</span>
        <span class="mono" style="color:var(--ink70);">${Math.round(pctOf(it))}%</span>
      </div>`).join("") : `<div class="bell-empty">كل الأصناف ضمن الحدود الآمنة.</div>`}
    ${needsAttention.length > 8 ? `<div class="bell-empty">و${needsAttention.length - 8} أصناف أخرى...</div>` : ""}`;
}
document.addEventListener("click", (e) => {
  const btn = document.getElementById("bell-btn"), dd = document.getElementById("bell-dropdown");
  if (!btn || !dd) return;
  if (btn.contains(e.target)) { dd.classList.toggle("hidden"); return; }
  if (!dd.contains(e.target)) dd.classList.add("hidden");
});

// مستمع عام لزر "طباعة إذن" — مستقل عن أي إعادة رسم للجدول، عشان يشتغل دايمًا مهما اتغيّر الفلتر
document.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-voucher]");
  if (!btn) return;
  const tx = state.transactions.find(x => x.id === btn.dataset.voucher);
  if (!tx) { toast("تعذر إيجاد بيانات هذه الحركة", true); return; }
  printVoucher(tx);
});

/* ---------------- dashboard ---------------- */
function renderDashboard(main) {
  const items = state.items, tx = state.transactions;
  const critical = items.filter(i => statusOf(i) === "critical");
  const warning = items.filter(i => statusOf(i) === "warning");
  const todayStr = new Date().toDateString();
  const todayTx = tx.filter(t => new Date(t.created_at).toDateString() === todayStr);
  const todayIn = todayTx.filter(t => t.type === "in").length;
  const todayOut = todayTx.filter(t => t.type === "out").length;

  const stats = [
    { label: t("statTotalItems"), value: items.length, icon: "package", color: "var(--ink)" },
    { label: `${t("statCritical")} (< ${state.settings.alert_threshold_percent || 15}%)`, value: critical.length, icon: "alert", color: "var(--red)" },
    { label: t("statTodayIn"), value: todayIn, icon: "in", color: "var(--green)" },
    { label: t("statTodayOut"), value: todayOut, icon: "out", color: "#B87A28" },
  ];
  const totalValue = items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const itemsWithPrice = items.filter(it => it.price != null).length;

  main.innerHTML = `
    <div class="section-header"><div><div class="section-title">${t("dashboardTitle")}</div><div class="section-sub">${t("dashboardSub")}</div></div></div>
    <div class="stats-grid">
      ${stats.map(s => `<div class="card"><div style="color:${s.color}">${icon(s.icon, 20)}</div><div class="stat-value" style="color:${s.color}">${s.value}</div><div class="stat-label">${s.label}</div></div>`).join("")}
    </div>
    ${itemsWithPrice > 0 ? `
    <div class="card" style="margin-bottom:20px; background:linear-gradient(155deg, #0A2E36 0%, #123E48 100%); color:#fff;">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:10px;">
        <div>
          <div style="font-size:12.5px; color:rgba(255,255,255,.6);">إجمالي قيمة المخزون الحالي</div>
          <div style="font-size:26px; font-weight:800;">${totalValue.toLocaleString("ar-EG", { maximumFractionDigits: 2 })}</div>
        </div>
        <div style="font-size:11.5px; color:rgba(255,255,255,.5); text-align:left;">
          محسوبة من ${itemsWithPrice} صنف له سعر مسجّل${itemsWithPrice < items.length ? `<br>(${items.length - itemsWithPrice} صنف لسه بدون سعر)` : ""}
        </div>
      </div>
    </div>` : ""}
    <div class="dash-grid-main">
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="font-weight:800; font-size:15px;">${t("sectionUrgent")}</div>
          <button class="link-btn" data-goto="stock">${t("viewAllStock")}</button>
        </div>
        ${critical.length === 0 && warning.length === 0 ? `<div class="empty-note">${t("noLowStock")}</div>` :
      `<div style="display:flex; flex-direction:column; gap:10px;">
          ${[...critical, ...warning].slice(0, 7).map(it => `
            <div style="display:flex; align-items:center; gap:12px;">
              <div style="width:130px; font-size:13.5px; font-weight:700; flex-shrink:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(it.name)}</div>
              <div style="flex:1;">${tape(it, true)}</div>
              <div class="mono" style="width:70px; font-size:12px; color:var(--ink70);">${it.qty}/${it.max_qty}</div>
              ${pill(statusOf(it))}
            </div>`).join("")}
        </div>`}
      </div>
      <div class="card">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="font-weight:800; font-size:15px;">${t("sectionRecentTx")}</div>
          <button class="link-btn" data-goto="reports">${t("allReports")}</button>
        </div>
        ${tx.length === 0 ? `<div class="empty-note">${t("noTx")}</div>` :
      `<div style="display:flex; flex-direction:column; gap:9px;">
          ${tx.slice(0, 8).map(t => `
            <div style="display:flex; align-items:center; gap:9px; font-size:12.8px;">
              <span style="color:${t.type === "in" ? "var(--green)" : "var(--red)"}; display:flex; align-items:center;">${icon(t.type === "in" ? "in" : "out", 15)}</span>
              <span style="font-weight:700; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escHtml(t.item_name)}</span>
              <span class="mono" style="color:${t.type === "in" ? "var(--green)" : "var(--red)"}; font-weight:700;">${t.type === "in" ? "+" : "-"}${t.qty} ${escHtml(t.unit) || ""}</span>
            </div>`).join("")}
        </div>`}
      </div>
    </div>

    <div class="dash-grid-charts">
      <div class="card">
        <div style="font-weight:800; font-size:15px; margin-bottom:14px;">${t("chartMovement")}</div>
        <div id="movement-chart"></div>
      </div>
      <div class="card">
        <div style="font-weight:800; font-size:15px; margin-bottom:14px;">${t("chartTopConsumed")}</div>
        <div id="top-consumed-chart"></div>
      </div>
    </div>`;
  $$("[data-goto]").forEach(b => b.onclick = () => { state.tab = b.dataset.goto; render(); });

  // حركة المخزون آخر 7 أيام
  const days = [];
  for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); d.setHours(0, 0, 0, 0); days.push(d); }
  const dayTotals = days.map(d => {
    const next = new Date(d); next.setDate(next.getDate() + 1);
    const dayTx = tx.filter(x => { const dt = new Date(x.created_at); return dt >= d && dt < next; });
    return {
      label: d.toLocaleDateString("ar-EG", { weekday: "short" }),
      inQty: dayTx.filter(x => x.type === "in").reduce((s, x) => s + Number(x.qty), 0),
      outQty: dayTx.filter(x => x.type === "out").reduce((s, x) => s + Number(x.qty), 0),
    };
  });
  const maxDay = Math.max(1, ...dayTotals.map(d => Math.max(d.inQty, d.outQty)));
  $("#movement-chart").innerHTML = `
    <div style="display:flex; align-items:flex-end; gap:8px; height:120px; margin-bottom:8px;">
      ${dayTotals.map(d => `
        <div style="flex:1; display:flex; flex-direction:column; align-items:center; gap:2px; height:100%; justify-content:flex-end;">
          <div style="display:flex; align-items:flex-end; gap:2px; height:100%;">
            <div style="width:9px; background:var(--green); border-radius:3px 3px 0 0; height:${Math.max(3, (d.inQty / maxDay) * 100)}%;" title="${t("legendIn")}: ${d.inQty}"></div>
            <div style="width:9px; background:var(--red); border-radius:3px 3px 0 0; height:${Math.max(3, (d.outQty / maxDay) * 100)}%;" title="${t("legendOut")}: ${d.outQty}"></div>
          </div>
          <div style="font-size:10px; color:var(--ink50);">${d.label}</div>
        </div>`).join("")}
    </div>
    <div style="display:flex; gap:14px; font-size:11.5px; color:var(--ink70);">
      <span style="display:flex; align-items:center; gap:5px;"><span style="width:9px; height:9px; border-radius:3px; background:var(--green); display:inline-block;"></span>${t("legendIn")}</span>
      <span style="display:flex; align-items:center; gap:5px;"><span style="width:9px; height:9px; border-radius:3px; background:var(--red); display:inline-block;"></span>${t("legendOut")}</span>
    </div>`;

  // الأصناف الأكثر استهلاكًا (أعلى 5)
  const consMap = {};
  tx.filter(x => x.type === "out").forEach(x => { consMap[x.item_name] = (consMap[x.item_name] || 0) + Number(x.qty); });
  const topCons = Object.entries(consMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxCons = Math.max(1, ...topCons.map(c => c[1]));
  $("#top-consumed-chart").innerHTML = topCons.length ? `
    <div style="display:flex; flex-direction:column; gap:10px;">
      ${topCons.map(([name, val]) => `
        <div style="display:flex; align-items:center; gap:10px;">
          <div style="width:110px; font-size:12.5px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</div>
          <div style="flex:1; background:var(--paper-deep); border-radius:8px; height:14px; position:relative; overflow:hidden;">
            <div style="position:absolute; inset:0; width:${(val / maxCons) * 100}%; background:var(--mustard); border-radius:8px;"></div>
          </div>
          <div class="mono" style="width:40px; font-size:12px; font-weight:700;">${val}</div>
        </div>`).join("")}
    </div>` : `<div class="empty-note">${t("noData")}</div>`;
}

function openBarcodeHelpModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:560px; max-height:80vh; overflow:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:17px;">${icon("search", 18)} دليل استخدام الباركود</div>
        <button class="close-x" id="bh-close">${icon("x", 16)}</button>
      </div>

      <div style="font-weight:800; font-size:13.5px; margin-bottom:6px;">📋 المتطلبات</div>
      <ul style="font-size:12.5px; color:var(--ink70); line-height:1.9; margin:0 0 16px; padding-inline-start:20px;">
        <li>جهاز فيه كاميرا (موبايل أو تابلت أو لابتوب بكاميرا) ومتصفح حديث (Chrome, Safari, Edge).</li>
        <li>موافقة على صلاحية الكاميرا لما المتصفح يطلبها أول مرة.</li>
        <li>لو مفيش كاميرا متاحة، ممكن تكتب الكود يدويًا في أي مكان فيه زرار "مسح" — مفيش أي وظيفة مقفولة على الكاميرا وحدها.</li>
        <li><strong>عندك مسدس باركود فعلي (USB أو Bluetooth)؟</strong> يشتغل من غير أي إعداد إضافي — دوس جوه خانة البحث في شاشة الإدخال/السحب، امسح بيه، وهيتعرف على الكود تلقائيًا زي ما لو مسحته بالكاميرا بالظبط.</li>
      </ul>

      <div style="font-weight:800; font-size:13.5px; margin-bottom:6px;">📦 المنتج وصل ومعاه باركود مطبوع من المصنّع</div>
      <div style="font-size:12.5px; color:var(--ink70); margin-bottom:16px; line-height:1.8;">
        روح "إدارة الأصناف" ← أضف الصنف (أو افتحه لو موجود) ← دوس زرار "مسح" جنب حقل الباركود وامسح الكود المطبوع على العبوة ← احفظ. من هنا وطالع، أي عملية إدخال/سحب لنفس الصنف تقدر تتم بمسح نفس الباركود ده.
      </div>

      <div style="font-weight:800; font-size:13.5px; margin-bottom:6px;">📦 المنتج وصل من غير باركود خالص</div>
      <div style="font-size:12.5px; color:var(--ink70); margin-bottom:16px; line-height:1.8;">
        من نفس شاشة إضافة الصنف، دوس زرار "توليد" بدل "مسح" — النظام هيعمّلك كود داخلي فريد خاص بالصنف ده، ويطلعلك رسمة الباركود جاهزة بزرار "طباعة ملصق". اطبع الملصق وحطه على الصنف/العبوة بنفسك، وبعدها يبقى قابل للمسح تمامًا زي أي باركود حقيقي.
      </div>

      <div style="font-weight:800; font-size:13.5px; margin-bottom:6px;">🔗 الصنف موجود عندك بالفعل بس مالوش باركود متسجّل</div>
      <div style="font-size:12.5px; color:var(--ink70); margin-bottom:16px; line-height:1.8;">
        امسح الباركود عادي من شاشة "إدخال مخزون" أو "سحب من المخزن" — النظام هيقولّك إن الكود ده مش متسجّل ويدّيك اختيارين: "ربط الكود بصنف موجود" (تختار الصنف من القائمة ويتسجّل عليه الكود ده للمرات الجاية) أو "إضافة صنف جديد بهذا الكود".
      </div>

      <div style="font-weight:800; font-size:13.5px; margin-bottom:6px;">➡️ تسجيل عملية إدخال أو سحب بالباركود</div>
      <div style="font-size:12.5px; color:var(--ink70); margin-bottom:4px; line-height:1.8;">
        من شاشة "إدخال مخزون" أو "سحب من المخزن"، دوس "مسح باركود" وامسح كود الصنف — لو الكود متسجّل، الصنف هيتحدد تلقائيًا والمؤشر هيروح لخانة الكمية على طول عشان تكتب الرقم وتأكّد. الكمية مش بتتحدد تلقائيًا عمدًا (بتفضل 1 كبداية تقدر تغيّرها) — عشان مسحة غلط أو مزدوجة متعملش حركة مخزون بكمية غلط من غير ما حد ياخد باله.
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  $("#bh-close", overlay).onclick = () => overlay.remove();
}

// ============================================================
// استلام/سحب دفعة بالباركود — امسح صنف ورا صنف من غير ما تأكّد كل واحد
// لوحده، وفي الآخر تأكيد واحد بيسجّل كل الحركات دفعة واحدة. مفيد جدًا وقت
// استلام شحنة فيها منتجات مختلفة كتير. بتستخدم نفس دالة move_stock الذرية
// اللي العملية الفردية بتستخدمها بالظبط (نفس الحماية من التعارض والكمية
// السالبة)، وبتسجّل كل حركة في سجل العمليات + تنبيهات المخزون زي العادي —
// الفرق الوحيد إنك بتراجع كل حاجة مرة واحدة في الآخر قبل ما تأكّد.
// ============================================================
function openBatchScanModal(mode, onDone) {
  const isIn = mode === "in";
  const cart = []; // { item, qty }

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:480px; max-height:85vh; overflow:auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div style="font-weight:800; font-size:16px;">${icon("plus", 17)} ${isIn ? "استلام دفعة بالباركود" : "سحب دفعة بالباركود"}</div>
        <button class="close-x" id="batch-close">${icon("x", 16)}</button>
      </div>
      <button class="btn-primary" id="batch-scan-item" style="width:100%; margin-bottom:14px;">${icon("search", 15)} امسح صنف عشان تضيفه للدفعة</button>
      <div id="batch-scan-result"></div>
      <div id="batch-cart" style="margin-bottom:14px;"></div>
      ${!isIn ? `<div class="field"><label>${t("workerLabel")}</label><input id="batch-worker" class="input" style="width:100%;" value="${escHtml(state.profile?.full_name || state.profile?.username) || ""}" placeholder="مثال: أحمد محمد"></div>` : ""}
      <div class="field"><label>ملاحظة على الدفعة كلها (اختياري)</label><input id="batch-note" class="input" style="width:100%;"></div>
      <button class="btn-primary" id="batch-confirm-all" style="width:100%;" disabled>${icon("check", 15)} تأكيد كل الدفعة (0 صنف)</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
  $("#batch-close", overlay).onclick = () => overlay.remove();

  function renderCart() {
    const cartEl = $("#batch-cart", overlay);
    cartEl.innerHTML = cart.length ? `
      <table style="width:100%; margin-bottom:4px;"><thead><tr><th style="text-align:right; font-size:11.5px; color:var(--ink70);">الصنف</th><th style="width:90px; font-size:11.5px; color:var(--ink70);">الكمية</th><th style="width:36px;"></th></tr></thead>
      <tbody>${cart.map((c, idx) => `
        <tr><td style="font-weight:700; font-size:13px;">${escHtml(c.item.name)}</td>
        <td><input type="number" min="0.01" step="any" class="input mono batch-qty-input" data-idx="${idx}" value="${c.qty}" style="width:80px; padding:4px 6px;"></td>
        <td><button class="icon-btn" data-remove-cart="${idx}" title="حذف من الدفعة">${icon("x", 13)}</button></td></tr>`).join("")}
      </tbody></table>` : `<div style="font-size:12px; color:var(--ink50); text-align:center; padding:14px;">لسه مفيش أصناف في الدفعة — ابدأ بالمسح فوق</div>`;

    $$(".batch-qty-input", cartEl).forEach(inp => inp.onchange = () => { cart[Number(inp.dataset.idx)].qty = Number(inp.value) || 0; });
    $$("[data-remove-cart]", cartEl).forEach(btn => btn.onclick = () => { cart.splice(Number(btn.dataset.removeCart), 1); renderCart(); });

    const confirmBtn = $("#batch-confirm-all", overlay);
    confirmBtn.textContent = `${icon("check", 15).replace(/<[^>]+>/g, "")} تأكيد كل الدفعة (${cart.length} صنف)`;
    confirmBtn.innerHTML = `${icon("check", 15)} تأكيد كل الدفعة (${cart.length} صنف)`;
    confirmBtn.disabled = cart.length === 0;
  }

  function addToCart(item) {
    const existing = cart.find(c => c.item.id === item.id);
    if (existing) existing.qty += 1;
    else cart.push({ item, qty: 1 });
    renderCart();
    toast(`تم إضافة "${item.name}" للدفعة`);
  }

  $("#batch-scan-item", overlay).onclick = () => {
    openBarcodeScanner((code) => {
      const found = state.items.find(i => i.barcode === code);
      const resultEl = $("#batch-scan-result", overlay);
      if (found) { resultEl.innerHTML = ""; addToCart(found); return; }
      resultEl.innerHTML = `
        <div class="card" style="margin-bottom:14px; background:#fff4e5;">
          <div style="font-weight:800; font-size:13px; margin-bottom:8px;">${icon("alert", 14)} الباركود "${escHtml(code)}" مش متسجّل</div>
          <select id="batch-link-select" class="input" style="width:100%; margin-bottom:8px;">
            <option value="">-- اختَر صنف لربط الكود بيه --</option>
            ${state.items.map(i => `<option value="${i.id}">${escHtml(i.name)}</option>`).join("")}
          </select>
          <button class="btn-dark" id="batch-link-confirm" style="width:100%;">ربط وإضافة للدفعة</button>
        </div>`;
      $("#batch-link-confirm", overlay).onclick = async () => {
        const itemId = $("#batch-link-select", overlay).value;
        if (!itemId) return;
        const { error } = await sb.from("items").update({ barcode: code }).eq("id", itemId);
        if (error) { toast("تعذر الربط — " + error.message, true); return; }
        await loadItems();
        resultEl.innerHTML = "";
        const linkedItem = state.items.find(i => i.id === itemId);
        if (linkedItem) addToCart(linkedItem);
      };
    }, { title: "امسح باركود الصنف اللي عايز تضيفه" });
  };

  $("#batch-confirm-all", overlay).onclick = async () => {
    if (blockIfReadOnly()) return;
    if (!cart.length) return;
    const worker = !isIn ? ($("#batch-worker", overlay)?.value || "").trim() : "";
    const note = ($("#batch-note", overlay)?.value || "").trim();
    if (!isIn && !worker) { toast("يرجى إدخال اسم العامل الذي يسحب المادة", true); return; }
    if (cart.some(c => !c.qty || c.qty <= 0)) { toast("كل صنف في الدفعة لازم تكون كميته أكبر من صفر", true); return; }
    if (!isIn) {
      const insufficientItem = cart.find(c => c.qty > c.item.qty);
      if (insufficientItem) { toast(`الكمية المطلوبة من "${insufficientItem.item.name}" أكبر من المتوفر بالمخزن`, true); return; }
    }

    const btn = $("#batch-confirm-all", overlay);
    btn.disabled = true; btn.textContent = "...جارِ تسجيل الدفعة";
    let successCount = 0;
    for (const { item, qty } of cart) {
      const { data: moveData, error } = await sb.rpc("move_stock", { p_item_id: item.id, p_type: mode, p_qty: qty, p_worker: worker, p_note: note || null });
      if (error) { toast(`تعذر تسجيل "${item.name}" — ${error.message}`, true); continue; }
      const newQty = (moveData && moveData[0] && moveData[0].new_qty != null) ? moveData[0].new_qty : (isIn ? item.qty + qty : Math.max(0, item.qty - qty));
      logAudit({ action: isIn ? "إدخال (دفعة بالباركود)" : "صرف (دفعة بالباركود)", entity: "item", entityName: item.name, qtyBefore: item.qty, qtyAfter: newQty, details: worker ? `بمعرفة: ${worker}${note ? " — " + note : ""}` : (note || null) });
      if (!isIn) {
        const wasCritical = statusOf(item) === "critical", nowCritical = statusOf({ ...item, qty: newQty }) === "critical";
        if (!wasCritical && nowCritical) notifyStockAlert(item.name, newQty, item.max_qty, item.unit, item.max_qty ? (newQty / item.max_qty) * 100 : 0, "critical");
        const wasLow = statusOf(item) !== "ok", nowLow = statusOf({ ...item, qty: newQty }) === "warning";
        if (!wasLow && nowLow) notifyStockAlert(item.name, newQty, item.max_qty, item.unit, item.max_qty ? (newQty / item.max_qty) * 100 : 0, "low");
      }
      successCount++;
    }
    await Promise.all([loadItems(), loadTransactions()]);
    toast(`تم تسجيل ${successCount} من ${cart.length} حركة بنجاح`);
    overlay.remove();
    if (onDone) onDone();
  };

  renderCart();
}

function renderMove(main, mode) {
  const isIn = mode === "in";
  main.innerHTML = `
    <div class="section-header"><div><div class="section-title">${isIn ? t("inTitle") : t("outTitle")}</div>
    <div class="section-sub">${isIn ? t("inSub") : t("outSub")}</div></div></div>
    <div id="move-body"></div>`;
  renderMoveBody(mode);
}
function renderMoveBody(mode) {
  const body = $("#move-body");
  const isIn = mode === "in";
  if (!state.selectedItem) {
    body.innerHTML = `
      <div style="display:flex; gap:8px; margin-bottom:16px; max-width:420px;">
        <div style="position:relative; flex:1;">
          <span style="position:absolute; right:14px; top:11px; color:var(--ink50);">${icon("search", 16)}</span>
          <input id="move-search" class="input" style="width:100%; padding-right:38px;" placeholder="${t("searchItem")}">
        </div>
        <button class="btn-dark" id="move-scan-btn" type="button" style="flex-shrink:0;">${icon("search", 15)} مسح باركود</button>
        <button class="btn-primary" id="move-batch-scan-btn" type="button" style="flex-shrink:0;">${icon("plus", 15)} استلام دفعة بالباركود</button>
        <button class="icon-btn" id="move-scan-help" type="button" title="طريقة استخدام الباركود" style="flex-shrink:0;">${icon("alert", 15)}</button>
      </div>
      <div id="move-scan-result"></div>
      <div id="move-groups"></div>`;
    const renderTiles = () => {
      const q = ($("#move-search").value || "").toLowerCase();
      const filtered = state.items.filter(i => i.name.toLowerCase().includes(q) || (i.category || "").includes(q) || (i.code || "").toLowerCase().includes(q));
      if (!filtered.length) {
        $("#move-groups").innerHTML = `
          <div class="empty-note">لا توجد أصناف مطابقة لـ "${$("#move-search").value}".</div>
          <button class="btn-dark" id="quick-add-item">${icon("plus", 14)} إضافة صنف جديد باسم "${$("#move-search").value}"</button>`;
        const qa = $("#quick-add-item");
        if (qa) qa.onclick = async () => { await ensureSuppliers(); openItemModal(null, $("#move-search").value, () => renderMoveBody(mode)); };
        return;
      }
      // تجميع الأصناف تحت عناوين الفئات (مثال: خيوط -> كل أنواع الخيوط تحتها)
      const groups = {};
      filtered.forEach(it => { const c = it.category || "بدون فئة"; (groups[c] = groups[c] || []).push(it); });
      $("#move-groups").innerHTML = Object.entries(groups).map(([cat, catItems]) => `
        <div style="margin-bottom:22px;">
          <div style="font-weight:800; font-size:14px; color:var(--ink); margin-bottom:10px; padding-bottom:6px; border-bottom:2px solid var(--mustard); display:inline-block;">${cat} <span style="color:var(--ink50); font-weight:600; font-size:12px;">(${catItems.length})</span></div>
          <div class="tile-grid">
            ${catItems.map(it => `
              <button class="tile" data-id="${it.id}">
                <div class="tile-head"><div style="font-weight:700; font-size:13.8px;">${escHtml(it.name)}</div>${pill(statusOf(it))}</div>
                ${tape(it, true)}
                <div class="tile-qty mono">${it.qty} / ${it.max_qty} ${escHtml(it.unit)}</div>
              </button>`).join("")}
          </div>
        </div>`).join("");
      $$(".tile", $("#move-groups")).forEach(t => t.onclick = () => { state.selectedItem = { ...state.items.find(i => i.id === t.dataset.id), qty_input: 1 }; renderMoveBody(mode); });
    };
    $("#move-search").oninput = renderTiles;
    // ⭐ دعم مسدسات الباركود الفعلية (USB/Bluetooth): المسدس ده بيتصرف كأنه
    // لوحة مفاتيح بتكتب رقم الباركود بسرعة في أي خانة مركّز عليها ثم Enter —
    // مش محتاج أي كود خاص بيه، بس نتأكد إن دوس Enter هنا بيتحقق الأول هل
    // النص المكتوب مطابق لباركود حقيقي (مسدس) قبل ما يعامله كبحث نصي عادي
    $("#move-search").addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      const val = $("#move-search").value.trim();
      if (!val) return;
      const found = state.items.find(i => i.barcode === val);
      if (found) {
        $("#move-search").value = "";
        state.selectedItem = { ...found, qty_input: 1 };
        renderMoveBody(mode);
        setTimeout(() => { const q = $("#qty-input"); if (q) { q.focus(); q.select(); } }, 30);
      }
    });
    renderTiles();
    $("#move-scan-help").onclick = () => openBarcodeHelpModal();
    $("#move-batch-scan-btn").onclick = () => openBatchScanModal(mode, () => renderMoveBody(mode));

    $("#move-scan-btn").onclick = () => {
      openBarcodeScanner((code) => {
        const found = state.items.find(i => i.barcode === code);
        const resultEl = $("#move-scan-result");
        if (found) {
          state.selectedItem = { ...found, qty_input: 1 };
          renderMoveBody(mode);
          // بعد ما الصنف يتحدد تلقائيًا، ركّز على خانة الكمية على طول —
          // المستخدم يكتب الكمية بس ويأكّد، بدل ما يدوّر عليه يدويًا
          setTimeout(() => { const q = $("#qty-input"); if (q) { q.focus(); q.select(); } }, 30);
          return;
        }
        // الباركود ده مش معروف — نعرض خيارين واضحين بدل ما نتجاهله بصمت
        if (!resultEl) return;
        resultEl.innerHTML = `
          <div class="card" style="margin-bottom:16px; max-width:520px; background:#fff4e5;">
            <div style="font-weight:800; font-size:13.5px; margin-bottom:4px;">${icon("alert", 15)} الباركود "${escHtml(code)}" مش متسجّل لأي صنف عندك</div>
            <div style="font-size:12px; color:var(--ink70); margin-bottom:12px;">إما إنه باركود صنف موجود بس متسجّلش عليه لسه، أو صنف جديد لسه معملوش خالص.</div>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
              <button class="btn-dark" id="scan-link-existing" style="font-size:12.5px;">${icon("check", 13)} ربط الكود ده بصنف موجود</button>
              <button class="btn-primary" id="scan-add-new" style="font-size:12.5px;">${icon("plus", 13)} إضافة صنف جديد بهذا الكود</button>
              <button class="btn-dark" id="scan-result-dismiss" style="font-size:12.5px;">إلغاء</button>
            </div>
          </div>`;
        $("#scan-result-dismiss").onclick = () => { resultEl.innerHTML = ""; };
        $("#scan-add-new").onclick = async () => {
          resultEl.innerHTML = "";
          await ensureSuppliers();
          openItemModal(null, "", () => renderMoveBody(mode));
          setTimeout(() => { const bc = $("#f-barcode"); if (bc) bc.value = code; }, 50);
        };
        $("#scan-link-existing").onclick = () => {
          resultEl.innerHTML = `
            <div class="card" style="margin-bottom:16px; max-width:420px;">
              <div style="font-weight:700; font-size:13px; margin-bottom:8px;">اختَر الصنف اللي عايز تربط الكود ده بيه:</div>
              <select id="scan-link-select" class="input" style="width:100%; margin-bottom:10px;">
                ${state.items.map(i => `<option value="${i.id}">${escHtml(i.name)}${i.barcode ? " (له باركود بالفعل — هيتستبدل)" : ""}</option>`).join("")}
              </select>
              <button class="btn-primary" id="scan-link-confirm" style="width:100%;">ربط وحفظ</button>
            </div>`;
          $("#scan-link-confirm").onclick = async () => {
            const itemId = $("#scan-link-select").value;
            const { error } = await sb.from("items").update({ barcode: code }).eq("id", itemId);
            if (error) { toast("تعذر الربط — " + error.message, true); return; }
            await loadItems();
            toast("تم ربط الباركود بالصنف بنجاح");
            const linkedItem = state.items.find(i => i.id === itemId);
            if (linkedItem) { state.selectedItem = { ...linkedItem, qty_input: 1 }; renderMoveBody(mode); }
          };
        };
      }, { title: isIn ? "امسح باركود الصنف للإدخال" : "امسح باركود الصنف للسحب" });
    };
    return;
  }

  const sel = state.selectedItem;
  const moveWarnHtml = () => {
    const resultQty = isIn ? sel.qty + sel.qty_input : Math.max(0, sel.qty - sel.qty_input);
    const willCrit = sel.max_qty > 0 && (resultQty / sel.max_qty) * 100 <= (state.settings.alert_threshold_percent || 15);
    return willCrit ? `<div style="display:flex; gap:8px; align-items:center; background:var(--red-soft); color:var(--red); padding:9px 12px; border-radius:10px; font-size:12.5px; font-weight:700; margin-bottom:14px;">${icon("alert", 15)} بعد هذه العملية سيصبح الصنف ضمن المستوى الحرج (أقل من ${state.settings.alert_threshold_percent || 15}%)</div>` : "";
  };
  body.innerHTML = `
    <div class="card move-panel">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div><div style="font-weight:800; font-size:17px;">${escHtml(sel.name)}</div><div style="font-size:12.5px; color:var(--ink70);">${escHtml(sel.category) || "—"} · ${t("available")}: ${sel.qty} ${escHtml(sel.unit)}</div></div>
        <button class="close-x" id="move-cancel">${icon("x", 16)}</button>
      </div>
      ${tape(sel)}
      <div style="margin:18px 0;">
        <label style="display:block; font-size:12.5px; font-weight:700; color:var(--ink70); margin-bottom:6px;">${t("qtyLabel")}</label>
        <div class="step-row">
          <button class="step-btn" id="qty-minus">${icon("minus", 16)}</button>
          <input id="qty-input" type="number" min="1" value="${sel.qty_input}" class="input mono" style="width:90px; text-align:center;">
          <button class="step-btn" id="qty-plus">${icon("plus", 16)}</button>
          <span style="color:var(--ink70); font-size:13px;">${escHtml(sel.unit)}</span>
        </div>
      </div>
      ${!isIn ? `<div class="field"><label>${t("workerLabel")}</label><input id="worker-input" class="input" style="width:100%;" value="${escHtml(state.profile?.full_name || state.profile?.username) || ""}" placeholder="مثال: أحمد محمد"></div>` : ""}
      <div class="field"><label>${t("noteLabel")}</label><input id="note-input" class="input" style="width:100%;" placeholder="${isIn ? "مثال: توريد جديد من المورد" : "مثال: لتفصيلة قميص رجالي"}"></div>
      <div id="move-warn">${moveWarnHtml()}</div>
      <button class="btn-primary" id="move-submit" style="background:${isIn ? "var(--green)" : "var(--ink)"}; display:flex; align-items:center; justify-content:center; gap:8px;">
        ${icon(isIn ? "in" : "out", 18)} ${isIn ? t("confirmIn") : t("confirmOut")}
      </button>
    </div>`;

  // تحديث جزئي فقط (بدون إعادة رسم الشاشة بالكامل) عند تغيير الكمية،
  // حتى لا يُعاد إنشاء زر "تأكيد" ويُفقد الضغط عليه (كان هذا سبب الحاجة لضغطتين)
  const refreshWarn = () => { const w = $("#move-warn"); if (w) w.innerHTML = moveWarnHtml(); };
  $("#move-cancel").onclick = () => { state.selectedItem = null; renderMoveBody(mode); };
  $("#qty-minus").onclick = () => { sel.qty_input = Math.max(1, sel.qty_input - 1); $("#qty-input").value = sel.qty_input; refreshWarn(); };
  $("#qty-plus").onclick = () => { sel.qty_input = sel.qty_input + 1; $("#qty-input").value = sel.qty_input; refreshWarn(); };
  $("#qty-input").oninput = (e) => { sel.qty_input = Math.max(1, Number(e.target.value) || 1); refreshWarn(); };

  let moveSubmitting = false;
  const submitMove = async () => {
    if (moveSubmitting) return;
    if (blockIfReadOnly()) return;
    moveSubmitting = true;
    const btn = $("#move-submit");
    if (btn) btn.disabled = true;
    try {
    const qty = sel.qty_input;
    const worker = isIn ? "" : ($("#worker-input")?.value || "").trim();
    const note = ($("#note-input")?.value || "").trim();
    if (qty <= 0) { toast("أدخل كمية أكبر من صفر", true); return; }
    if (!isIn && qty > sel.qty) { toast("الكمية المطلوبة أكبر من المتوفر بالمخزن", true); return; }
    if (!isIn && !worker) { toast("يرجى إدخال اسم العامل الذي يسحب المادة", true); return; }
    // تنبيه التكرار: هل تم بالفعل تنفيذ نفس نوع العملية (إدخال/سحب) على نفس الصنف اليوم؟
    const todayStr = new Date().toDateString();
    const dupToday = state.transactions.find(t => t.item_id === sel.id && t.type === mode && new Date(t.created_at).toDateString() === todayStr);
    if (dupToday) {
      const proceed = confirm(`⚠️ تم بالفعل تنفيذ عملية "${isIn ? "إدخال" : "سحب"}" على صنف "${sel.name}" اليوم الساعة ${new Date(dupToday.created_at).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })} بكمية ${dupToday.qty} ${dupToday.unit}.\n\nهل ده تكرار بالغلط؟\n\nاضغط "موافق" للاستمرار وتنفيذ العملية دي كمان (لو فعلاً حصلت مرتين اليوم)، أو "إلغاء" لإلغاء هذه العملية المكررة.`);
      if (!proceed) return;
    }
    const newQtyClientEstimate = isIn ? sel.qty + qty : Math.max(0, sel.qty - qty);
    // الاستدعاء الوحيد المسؤول عن تحديث الكمية وتسجيل الحركة — دالة قاعدة
    // بيانات ذرية (move_stock) بتقفل الصف وتمنع أي تعارض بين عمليتين
    // متزامنتين على نفس الصنف، وبتمنع الكمية السالبة على مستوى القاعدة نفسها
    const { data: moveData, error: e1 } = await sb.rpc("move_stock", {
      p_item_id: sel.id, p_type: mode, p_qty: qty, p_worker: worker, p_note: note || null,
    });
    if (e1) { toast(e1.message || "حدث خطأ أثناء الحفظ", true); return; }
    const newQty = (moveData && moveData[0] && moveData[0].new_qty != null) ? moveData[0].new_qty : newQtyClientEstimate;
    logAudit({
      action: isIn ? "إدخال" : "صرف", entity: "item", entityName: sel.name,
      qtyBefore: sel.qty, qtyAfter: newQty,
      details: worker ? `بمعرفة: ${worker}${note ? " — " + note : ""}` : (note || null),
    });
    // إشعارات تلقائية عند عبور الصنف لحالة أسوأ بسبب عملية سحب (مرة واحدة بس وقت العبور،
    // مش مع كل عملية سحب بعد كده لتجنّب الإغراق بالإشعارات) — عبر Email و Telegram معًا،
    // كل قناة مستقلة عن التانية (لو Telegram معطّل أو مش متظبط، الإيميل يفضل يشتغل والعكس)
    if (!isIn) {
      // منطق الحالة الحرجة الأصلي — لم يتغيّر
      const wasCritical = statusOf(sel) === "critical";
      const nowCritical = statusOf({ ...sel, qty: newQty }) === "critical";
      if (!wasCritical && nowCritical) {
        notifyStockAlert(sel.name, newQty, sel.max_qty, sel.unit, sel.max_qty ? (newQty / sel.max_qty) * 100 : 0, "critical");
      }
      // تنبيه المخزون المنخفض الجديد: بس أول ما الصنف يعدّي من "جيد" لـ"منخفض"
      const wasLow = statusOf(sel) !== "ok";
      const nowLow = statusOf({ ...sel, qty: newQty }) === "warning";
      if (!wasLow && nowLow) {
        notifyStockAlert(sel.name, newQty, sel.max_qty, sel.unit, sel.max_qty ? (newQty / sel.max_qty) * 100 : 0, "low");
      }
    }
    toast(isIn ? `تم إدخال ${qty} ${sel.unit} إلى "${sel.name}"` : `تم سحب ${qty} ${sel.unit} من "${sel.name}"`);
    state.selectedItem = null;
    await Promise.all([loadItems(), loadTransactions()]);
    render();
    } finally {
      moveSubmitting = false;
      if (btn) btn.disabled = false;
    }
  };

  $("#move-submit").onclick = submitMove;
  // دعم الحفظ بالضغط على Enter من أي حقل في شاشة الإدخال/السحب
  const onEnterSave = (e) => { if (e.key === "Enter") { e.preventDefault(); submitMove(); } };
  $("#qty-input").addEventListener("keydown", onEnterSave);
  $("#note-input")?.addEventListener("keydown", onEnterSave);
  if (!isIn) $("#worker-input")?.addEventListener("keydown", onEnterSave);
}

/* ---------------- stock table ---------------- */
function renderStock(main) {
  const collapsedCats = new Set();
  const isFlat = state.stockViewMode === "flat";
  main.innerHTML = `
    <div class="section-header no-print"><div><div class="section-title">${t("stockTitle")}</div><div class="section-sub">${state.items.length} ${t("itemsRegistered")}</div></div>
      <div style="display:flex; gap:8px;">
        <button class="btn-dark" id="stock-scan-lookup">${icon("search", 14)} مسح للاستعلام</button>
        <button class="btn-dark" id="stock-view-toggle">${icon("grid", 14)} ${isFlat ? "عرض حسب الفئة" : "عرض كقائمة"}</button>
        ${isFlat ? "" : `<button class="btn-dark" id="stock-print">${icon("history", 14)} طباعة</button><button class="btn-dark" id="stock-export">${icon("download", 14)} تصدير Excel</button>`}
      </div>
    </div>
    <div class="toolbar no-print" style="${isFlat ? "display:none;" : ""}">
      <div style="position:relative;"><span style="position:absolute; right:12px; top:11px; color:var(--ink50);">${icon("search", 15)}</span>
        <input id="stock-search" class="input" style="width:240px; padding-right:34px;" placeholder="${t("searchByNameCode")}"></div>
      <select id="stock-cat" class="input"><option value="__all__">${t("all")}</option>${state.categories.map(c => `<option value="${c}">${c}</option>`).join("")}</select>
      <button class="icon-btn" id="stock-toggle-all" style="width:auto; padding:0 12px; gap:6px; display:inline-flex; align-items:center; font-size:12.5px; font-weight:700;" title="طي/فرد كل الفئات">${icon("grid", 14)} طي الكل</button>
    </div>
    ${isFlat ? pagerToolbarHtml("stockflat", "ابحث بالاسم أو الكود...") : ""}
    ${printHeaderHtml("المخزون الحالي")}
    <div class="card" style="padding:0; overflow:hidden;">
      <table><thead><tr><th>${t("code")}</th><th>${t("itemName")}</th><th>${t("category")}</th><th>${t("quantity")}</th><th>%</th><th>${t("status")}</th><th class="no-print"></th></tr></thead><tbody id="stock-body"></tbody></table>
    </div>
    ${isFlat ? pagerBottomHtml("stockflat") : ""}`;

  $("#stock-view-toggle").onclick = () => { state.stockViewMode = isFlat ? "grouped" : "flat"; renderStock(main); };
  $("#stock-scan-lookup").onclick = () => {
    openBarcodeScanner((code) => {
      const found = state.items.find(i => i.barcode === code);
      if (!found) { toast(`لا يوجد صنف مرتبط بالباركود "${code}"`, true); return; }
      const st = statusOf(found);
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      overlay.innerHTML = `
        <div class="modal-box" style="max-width:360px; text-align:center;">
          <div style="font-weight:800; font-size:17px; margin-bottom:4px;">${escHtml(found.name)}</div>
          <div style="font-size:12px; color:var(--ink70); margin-bottom:14px;">${escHtml(found.category) || "—"} · كود: ${escHtml(found.code) || "—"}</div>
          <div style="font-size:32px; font-weight:800; margin-bottom:6px;">${found.qty} <span style="font-size:15px; font-weight:600; color:var(--ink70);">${escHtml(found.unit)}</span></div>
          <div style="margin-bottom:16px;">${pill(st)}</div>
          <div style="width:100%; margin-bottom:16px;">${tape(found)}</div>
          <button class="btn-dark" id="scan-lookup-close" style="width:100%;">إغلاق</button>
        </div>`;
      document.body.appendChild(overlay);
      overlay.addEventListener("click", (e) => { if (e.target === overlay) overlay.remove(); });
      $("#scan-lookup-close", overlay).onclick = () => overlay.remove();
    }, { title: "مسح باركود للاستعلام (بدون تسجيل حركة)" });
  };

  if (isFlat) {
    mountPagedTable({
      idPrefix: "stockflat",
      allRows: state.items,
      tbodySelector: "#stock-body",
      colCount: 7,
      emptyMessage: "لا توجد أصناف مطابقة",
      searchFields: (it) => [it.name, it.code, it.category],
      renderRow: (it) => `
        <tr><td class="mono" style="color:var(--mustard); font-weight:700;">${escHtml(it.code) || "—"}</td><td style="font-weight:700;">${escHtml(it.name)}</td><td style="color:var(--ink70);">${escHtml(it.category) || "—"}</td>
        <td class="mono">${it.qty} / ${it.max_qty} ${escHtml(it.unit)}</td><td style="width:200px;">${tape(it, true)}</td><td>${pill(statusOf(it))}</td>
        <td class="no-print"><button class="icon-btn" data-movement="${escHtml(it.name)}" title="عرض حركة هذا الصنف">${icon("history", 13)}</button></td></tr>`,
      excelSheetName: "المخزون الحالي",
      excelRow: (it) => ({
        "الكود": it.code || "", "الصنف": it.name, "الفئة": it.category || "", "الوحدة": it.unit,
        "الكمية الحالية": it.qty, "الحد الأقصى": it.max_qty, "النسبة %": Math.round(pctOf(it)), "الحالة": STATUS_META[statusOf(it)].label,
      }),
      onDrawn: () => { $$("[data-movement]").forEach(b => b.onclick = () => { state.pendingItemFilter = b.dataset.movement; state.tab = "reports"; render(); }); },
    });
    return;
  }

  let lastFiltered = [];
  const draw = () => {
    const q = ($("#stock-search").value || "").toLowerCase();
    const cat = $("#stock-cat").value;
    const filtered = state.items.filter(i => (cat === "__all__" || i.category === cat) && (i.name.toLowerCase().includes(q) || (i.code || "").toLowerCase().includes(q)));
    lastFiltered = filtered;
    if (!filtered.length) { $("#stock-body").innerHTML = `<tr><td colspan="7"><div class="empty-note">لا توجد نتائج مطابقة.</div></td></tr>`; return; }
    const groups = {};
    filtered.forEach(it => { const c = it.category || "بدون فئة"; (groups[c] = groups[c] || []).push(it); });
    $("#stock-body").innerHTML = Object.entries(groups).map(([catName, catItems]) => {
      const isCollapsed = collapsedCats.has(catName);
      return `
      <tr class="cat-row ${isCollapsed ? "is-collapsed" : ""}" data-cat-toggle="${escHtml(catName)}"><td colspan="7" style="background:var(--paper-deep); font-weight:800; font-size:12.5px; padding:8px 16px; border-top:2px solid var(--mustard);"><span class="cat-chevron">${icon("chevronDown", 13)}</span>${escHtml(catName)} <span style="font-weight:600; color:var(--ink50); font-size:11.5px;">(${catItems.length} صنف)</span></td></tr>
      ${catItems.map(it => `
        <tr data-cat-row="${escHtml(catName)}" style="${isCollapsed ? "display:none;" : ""}"><td class="mono" style="color:var(--mustard); font-weight:700;">${escHtml(it.code) || "—"}</td><td style="font-weight:700; padding-right:26px;">${escHtml(it.name)}</td><td style="color:var(--ink70);">${escHtml(it.category) || "—"}</td>
        <td class="mono">${it.qty} / ${it.max_qty} ${escHtml(it.unit)}</td><td style="width:200px;">${tape(it, true)}</td><td>${pill(statusOf(it))}</td>
        <td class="no-print"><button class="icon-btn" data-movement="${escHtml(it.name)}" title="عرض حركة هذا الصنف">${icon("history", 13)}</button></td></tr>`).join("")}
    `}).join("");
    $$("[data-movement]").forEach(b => b.onclick = () => { state.pendingItemFilter = b.dataset.movement; state.tab = "reports"; render(); });
    $$("[data-cat-toggle]").forEach(row => row.onclick = () => {
      const cat = row.dataset.catToggle;
      if (collapsedCats.has(cat)) collapsedCats.delete(cat); else collapsedCats.add(cat);
      row.classList.toggle("is-collapsed");
      $$(`[data-cat-row="${cat}"]`).forEach(r => r.style.display = collapsedCats.has(cat) ? "none" : "");
    });
  };
  $("#stock-search").oninput = draw; $("#stock-cat").onchange = draw;
  $("#stock-toggle-all").onclick = () => {
    const allCats = state.categories.length ? state.categories : [...new Set(state.items.map(i => i.category || "بدون فئة"))];
    const collapsingAll = collapsedCats.size < allCats.length;
    collapsedCats.clear();
    if (collapsingAll) allCats.forEach(c => collapsedCats.add(c));
    draw();
  };
  draw();

  $("#stock-print").onclick = () => window.print();
  $("#stock-export").onclick = async () => {
    const btn = $("#stock-export"); const origText = btn.innerHTML;
    try {
      btn.disabled = true; btn.innerHTML = "...جارِ التجهيز";
      await ensureXLSX();
      const rows = lastFiltered.map(it => ({
        "الكود": it.code || "", "الصنف": it.name, "الفئة": it.category || "", "الوحدة": it.unit,
        "الكمية الحالية": it.qty, "الحد الأقصى": it.max_qty, "النسبة %": Math.round(pctOf(it)), "الحالة": STATUS_META[statusOf(it)].label,
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ "ملاحظة": "لا توجد بيانات" }]), "المخزون الحالي");
      XLSX.writeFile(wb, `المخزون_الحالي_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast("حدث خطأ أثناء تصدير Excel — " + (e && e.message ? e.message : ""), true);
    } finally {
      btn.disabled = false; btn.innerHTML = origText;
    }
  };
}

/* ---------------- reports ---------------- */
/* ---------------- الجرد الفعلي (Physical Stock Take) ---------------- */
async function loadStockTakes() {
  const { data } = await sb.from("stock_takes").select("*").order("started_at", { ascending: false }).limit(20);
  state.stockTakes = data || [];
}
async function loadStockTakeLines(stockTakeId) {
  const { data } = await sb.from("stock_take_lines").select("*").eq("stock_take_id", stockTakeId).order("item_name");
  state.openStockTakeLines = data || [];
}

/* ---------------- سجل الإشعارات (إيميل + تيليجرام موحّد) ---------------- */
function renderNotificationsLog(main) {
  main.innerHTML = `
    <div class="section-header no-print"><div><div class="section-title">سجل الإشعارات</div><div class="section-sub">كل محاولات إرسال الإيميل والتيليجرام — نجحت أو فشلت</div></div></div>
    ${pagerToolbarHtml("nlog", "ابحث بالمستلم أو نوع الإشعار...")}
    ${printHeaderHtml("سجل الإشعارات")}
    <div class="card" style="padding:0; overflow:hidden;">
      <table><thead><tr><th>القناة</th><th>المستلم</th><th>النوع</th><th>الحالة</th><th>السبب (لو فشل)</th><th>التاريخ والساعة</th></tr></thead><tbody id="nlog-body"></tbody></table>
    </div>
    ${pagerBottomHtml("nlog")}`;

  const typeLabels = { critical: "مخزون حرج", low: "مخزون منخفض", daily_report: "التقرير اليومي", welcome: "ترحيب بمستخدم جديد", manual: "بث يدوي" };
  const statusPill = (s) => s === "sent" ? `<span class="chip chip-ok">نجح</span>` : s === "blocked" ? `<span class="chip chip-warning">محظور</span>` : `<span class="chip chip-critical">فشل</span>`;

  mountPagedTable({
    idPrefix: "nlog",
    allRows: state.notificationsLog,
    tbodySelector: "#nlog-body",
    colCount: 6,
    emptyMessage: "لا توجد محاولات إرسال مسجّلة بعد",
    searchFields: (r) => [r.recipient, r.notification_type, r.message_preview],
    renderRow: (r) => `
      <tr>
        <td>${r.channel === "email" ? "📧 إيميل" : "✈️ تيليجرام"}</td>
        <td class="mono" style="font-size:12.5px;">${escHtml(r.recipient)}</td>
        <td>${escHtml(typeLabels[r.notification_type] || r.notification_type || "—")}</td>
        <td>${statusPill(r.status)}</td>
        <td style="color:var(--red); font-size:12px;">${escHtml(r.error_message) || "—"}</td>
        <td class="mono" style="color:var(--ink70); font-size:12px;">${fmtDate(r.created_at)}</td>
      </tr>`,
    excelSheetName: "سجل الإشعارات",
    excelRow: (r) => ({
      "القناة": r.channel === "email" ? "إيميل" : "تيليجرام", "المستلم": r.recipient,
      "النوع": typeLabels[r.notification_type] || r.notification_type || "", "الحالة": r.status,
      "السبب": r.error_message || "", "التاريخ والساعة": fmtDate(r.created_at),
    }),
  });
}

function renderStockTake(main) {
  main.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">الجرد الفعلي</div><div class="section-sub">مقارنة الكمية المعدودة فعليًا بالكمية المسجّلة، وتصحيح أي فروقات دفعة واحدة</div></div>
    </div>
    <div id="stocktake-body"><div class="card">...جارِ التحميل</div></div>`;

  (async () => {
    await loadStockTakes();
    drawStockTakeBody(main);
  })();
}

function drawStockTakeBody(main) {
  const body = $("#stocktake-body", main);
  if (!body) return;
  const open = state.stockTakes.find(s => s.status === "open");

  if (open) {
    state.openStockTake = open;
    drawOpenStockTake(main, body, open);
    return;
  }

  body.innerHTML = `
    <div class="card" style="margin-bottom:18px; max-width:460px;">
      <div style="font-weight:800; font-size:14px; margin-bottom:10px;">بدء جلسة جرد جديدة</div>
      <div class="field"><label>ملاحظة (اختياري)</label><input id="st-note" class="input" placeholder="مثال: جرد شهري - أغسطس"></div>
      <button class="btn-primary" id="st-start">${icon("plus", 16)} بدء الجرد</button>
    </div>
    <div class="card">
      <div style="font-weight:800; font-size:14px; margin-bottom:10px;">جلسات سابقة</div>
      ${state.stockTakes.length ? `
        <table class="table"><thead><tr><th>التاريخ</th><th>الحالة</th><th>بدأها</th><th>ملاحظة</th></tr></thead>
        <tbody>${state.stockTakes.map(s => `
          <tr><td>${fmtDate(s.started_at)}</td>
          <td>${s.status === "completed" ? "مكتملة" : s.status === "cancelled" ? "ملغاة" : "مفتوحة"}</td>
          <td>${escHtml(s.started_by_name) || "—"}</td><td>${escHtml(s.note) || "—"}</td></tr>`).join("")}
        </tbody></table>` : `<div style="color:var(--ink50); font-size:13px;">لا يوجد جلسات جرد سابقة</div>`}
    </div>`;

  $("#st-start", body).onclick = async () => {
    const note = $("#st-note", body).value.trim();
    const btn = $("#st-start", body); btn.disabled = true;
    const { data, error } = await sb.rpc("start_stock_take", { p_note: note || null });
    if (error) { toast(error.message || "تعذر بدء الجرد", true); btn.disabled = false; return; }
    logAudit({ action: "بدء جرد", entity: "stock_take", details: note || null });
    await loadStockTakes();
    drawStockTakeBody(main);
  };
}

function drawOpenStockTake(main, body, take) {
  (async () => {
    await loadStockTakeLines(take.id);
    const lines = state.openStockTakeLines;
    const countedCount = lines.filter(l => l.counted_qty != null).length;
    const diffs = lines.filter(l => l.counted_qty != null && Number(l.counted_qty) !== Number(l.system_qty));

    const isSameAsCounter = state.user?.id && take.started_by && state.user.id === take.started_by;
    body.innerHTML = `
      <div class="card" style="margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
          <div>
            <div style="font-weight:800; font-size:14px;">جلسة جرد مفتوحة${take.note ? " — " + escHtml(take.note) : ""}</div>
            <div style="font-size:12px; color:var(--ink70);">بدأت في ${fmtDate(take.started_at)} بمعرفة ${escHtml(take.started_by_name) || "—"} · تم عدّ ${countedCount} من ${lines.length} صنف</div>
          </div>
          <div style="display:flex; gap:8px;" class="no-print">
            ${isAdmin() && isSameAsCounter ? `<span style="align-self:center; font-size:11.5px; color:#8A5A1E; background:#FBF1E2; padding:6px 10px; border-radius:8px;">${icon("alert", 12)} إنت اللي بدأت الجرد ده — لازم شخص تاني يراجع ويعتمده (لمنع تلاعب أي شخص بجرد نفسه)</span>` : ""}
            ${isAdmin() && !isSameAsCounter ? `<button class="btn-primary" id="st-approve" ${diffs.length === 0 ? "disabled" : ""}>${icon("check", 15)} اعتماد الجرد (${diffs.length} فرق)</button>` : ""}
            <button class="btn-dark" id="st-cancel">${icon("x", 14)} إلغاء الجلسة</button>
          </div>
        </div>
      </div>
      ${pagerToolbarHtml("stocktake", "ابحث عن صنف...")}
      ${printHeaderHtml("جرد فعلي" + (take.note ? " — " + take.note : ""))}
      <div class="card">
        <table class="table">
          <thead><tr><th>الصنف</th><th>الرصيد المسجّل</th><th>الكمية المعدودة</th><th>الفرق</th><th class="no-print"></th></tr></thead>
          <tbody id="stocktake-body"></tbody>
        </table>
      </div>
      ${pagerBottomHtml("stocktake")}`;

    const wireRowHandlers = () => {
      $$(".st-save-count", body).forEach(btn => {
        btn.onclick = async () => {
          const itemId = btn.dataset.item;
          const input = $(`.st-count-input[data-item="${itemId}"]`, body);
          const qty = Number(input.value);
          if (input.value === "" || Number.isNaN(qty) || qty < 0) { toast("أدخل كمية صحيحة", true); return; }
          btn.disabled = true;
          const { error } = await sb.rpc("submit_count", { p_stock_take_id: take.id, p_item_id: itemId, p_counted_qty: qty });
          btn.disabled = false;
          if (error) { toast(error.message || "تعذر حفظ العدّ", true); return; }
          toast("تم حفظ العدّ");
          drawOpenStockTake(main, body, take);
        };
      });
    };

    mountPagedTable({
      idPrefix: "stocktake",
      allRows: lines,
      tbodySelector: "#stocktake-body",
      colCount: 5,
      emptyMessage: "لا توجد أصناف في جلسة الجرد دي",
      searchFields: (l) => [l.item_name],
      renderRow: (l) => {
        const hasCounted = l.counted_qty != null;
        const diff = hasCounted ? Number(l.counted_qty) - Number(l.system_qty) : null;
        return `<tr>
          <td>${escHtml(l.item_name)}</td>
          <td class="mono">${l.system_qty} ${escHtml(l.unit) || ""}</td>
          <td><input type="number" class="input mono st-count-input" data-item="${l.item_id}" style="width:90px;" value="${hasCounted ? l.counted_qty : ""}" placeholder="—"></td>
          <td class="mono" style="color:${diff ? (diff > 0 ? "var(--green)" : "var(--red)") : "inherit"};">${diff != null ? (diff > 0 ? "+" : "") + diff : "—"}</td>
          <td class="no-print"><button class="btn-dark st-save-count" data-item="${l.item_id}" style="padding:5px 10px; font-size:11.5px;">حفظ</button></td>
        </tr>`;
      },
      excelSheetName: "جرد فعلي",
      excelRow: (l) => ({
        "الصنف": l.item_name, "الرصيد المسجّل": l.system_qty, "الوحدة": l.unit || "",
        "الكمية المعدودة": l.counted_qty ?? "", "الفرق": l.counted_qty != null ? Number(l.counted_qty) - Number(l.system_qty) : "",
      }),
      onDrawn: wireRowHandlers,
    });

    $("#st-cancel", body).onclick = async () => {
      if (!confirm("إلغاء جلسة الجرد دي؟ أي كميات اتسجلت هتتجاهل ومفيش أي تصحيح هيحصل.")) return;
      const { error } = await sb.rpc("cancel_stock_take", { p_stock_take_id: take.id });
      if (error) { toast(error.message || "تعذر الإلغاء", true); return; }
      logAudit({ action: "إلغاء جرد", entity: "stock_take" });
      state.openStockTake = null;
      await loadStockTakes();
      drawStockTakeBody(main);
    };

    const approveBtn = $("#st-approve", body);
    if (approveBtn) {
      approveBtn.onclick = async () => {
        if (!confirm(`هيتم تصحيح ${diffs.length} صنف تلقائيًا بناءً على الكميات المعدودة. متأكد؟`)) return;
        approveBtn.disabled = true;
        const { data, error } = await sb.rpc("approve_stock_take", { p_stock_take_id: take.id });
        if (error) { toast(error.message || "تعذر اعتماد الجرد", true); approveBtn.disabled = false; return; }
        logAudit({ action: "اعتماد جرد", entity: "stock_take", details: `عدد الأصناف المصححة: ${data}` });
        toast(`تم اعتماد الجرد وتصحيح ${data} صنف`);
        state.openStockTake = null;
        await Promise.all([loadItems(), loadTransactions(), loadStockTakes()]);
        drawStockTakeBody(main);
      };
    }
  })();
}


function renderReports(main) {
  const genTime = fmtDate(new Date().toISOString());
  const totalValue = state.items.reduce((sum, it) => sum + (Number(it.price) || 0) * (Number(it.qty) || 0), 0);
  const itemsWithPrice = state.items.filter(it => it.price != null).length;
  const lowStockCount = state.items.filter(it => statusOf(it) !== "ok").length;
  const criticalCount = state.items.filter(it => statusOf(it) === "critical").length;
  const txToday = state.transactions.filter(t => new Date(t.created_at).toDateString() === new Date().toDateString()).length;
  main.innerHTML = `
    <div class="section-header no-print">
      <div><div class="section-title">${t("reportsTitle")}</div><div class="section-sub">${t("reportsSub")}</div></div>
      <div style="display:flex; gap:8px;">
        <button class="btn-dark" id="print-report">${icon("history", 14)} ${t("print")}</button>
        <button class="btn-dark" id="export-excel">${icon("download", 14)} ${t("exportExcelBtn")}</button>
      </div>
    </div>

    <div class="no-print" style="display:grid; grid-template-columns:repeat(auto-fit, minmax(160px, 1fr)); gap:12px; margin-bottom:20px;">
      <div class="card" style="padding:16px 18px; border-inline-start:4px solid var(--mustard);">
        <div style="font-size:11.5px; color:var(--ink70); font-weight:700; margin-bottom:6px;">${icon("package", 13)} إجمالي الأصناف</div>
        <div style="font-size:24px; font-weight:800;">${state.items.length}</div>
      </div>
      <div class="card" style="padding:16px 18px; border-inline-start:4px solid ${criticalCount ? "var(--red)" : "var(--green)"};">
        <div style="font-size:11.5px; color:var(--ink70); font-weight:700; margin-bottom:6px;">${icon("alert", 13)} أصناف محتاجة انتباه</div>
        <div style="font-size:24px; font-weight:800; color:${lowStockCount ? "var(--red)" : "inherit"};">${lowStockCount}${criticalCount ? ` <span style="font-size:12px; font-weight:700; color:var(--red);">(${criticalCount} حرج)</span>` : ""}</div>
      </div>
      <div class="card" style="padding:16px 18px; border-inline-start:4px solid var(--ink70);">
        <div style="font-size:11.5px; color:var(--ink70); font-weight:700; margin-bottom:6px;">${icon("history", 13)} حركات اليوم</div>
        <div style="font-size:24px; font-weight:800;">${txToday}</div>
      </div>
      ${itemsWithPrice > 0 ? `
      <div class="card" style="padding:16px 18px; border-inline-start:4px solid var(--mustard);">
        <div style="font-size:11.5px; color:var(--ink70); font-weight:700; margin-bottom:6px;">${icon("chart", 13)} قيمة المخزون الحالي</div>
        <div style="font-size:22px; font-weight:800; color:var(--mustard);">${totalValue.toLocaleString("ar-EG", { maximumFractionDigits: 0 })}</div>
        <div style="font-size:10.5px; color:var(--ink50); margin-top:2px;">${itemsWithPrice}/${state.items.length} صنف له سعر مسجّل</div>
      </div>` : ""}
    </div>

    <div class="card no-print" style="margin-bottom:18px;">
      <div style="font-weight:800; font-size:14px; margin-bottom:12px; display:flex; align-items:center; gap:7px;">${icon("check", 15)} ${t("printSectionsTitle")}</div>
      <div style="display:flex; flex-wrap:wrap; gap:16px; margin-bottom:16px;">
        <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="inc-lowstock" checked> ${t("lowStockSection")}</label>
        <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="inc-consumption" checked> ${t("consumptionSection")}</label>
        <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="inc-daily" checked> ${t("dailySection")}</label>
        <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="inc-txlog" checked> ${t("txLogSection")}</label>
      </div>
      <div style="display:flex; flex-wrap:wrap; gap:10px; align-items:end; border-top:1px solid var(--line); padding-top:14px;">
        <div><label style="display:block; font-size:11.5px; color:var(--ink70); margin-bottom:4px;">${t("quickRange")}</label>
          <select id="range-filter" class="input" style="font-size:12.5px; padding:7px 10px;">
            <option value="all">${t("all")}</option><option value="today">اليوم</option><option value="week">آخر أسبوع</option><option value="month">آخر شهر</option>
          </select>
        </div>
        <button class="btn-dark" id="toggle-advanced-filters" type="button" style="padding:7px 12px; font-size:12.5px;">${icon("grid", 13)} فلاتر متقدمة (تاريخ محدد، صنف، عامل، فئات...) <span id="advanced-filters-chevron">▾</span></button>
        <button class="btn-dark" id="clear-filters" style="padding:7px 12px; font-size:12.5px;">${t("clearFilters")}</button>
      </div>
      <div id="advanced-filters-panel" class="hidden" style="margin-top:14px; border-top:1px solid var(--line); padding-top:14px;">
        <div style="margin-bottom:14px;">
          <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; font-size:12.5px; font-weight:800; color:var(--ink70);">${icon("grid", 14)} طباعة فئات معيّنة فقط <span style="font-weight:600; color:var(--ink50);">(اختَر الفئات اللي عايز تطبعها بس)</span></div>
          <div style="display:flex; flex-wrap:wrap; gap:8px;">
            <label class="chip" style="cursor:pointer; background:var(--mustard-soft); color:var(--mustard);"><input type="checkbox" id="cat-filter-all" checked style="accent-color:var(--mustard);"> الكل</label>
            ${state.categories.map(c => `<label class="chip" style="cursor:pointer;"><input type="checkbox" class="cat-filter-item" value="${c}" checked style="accent-color:var(--mustard);"> ${c}</label>`).join("")}
          </div>
        </div>
        <div style="display:flex; flex-wrap:wrap; gap:8px; align-items:end;">
          <div><label style="display:block; font-size:11.5px; color:var(--ink70); margin-bottom:4px;">${t("dateFrom")}</label><input type="date" id="date-from" class="input" style="font-size:12.5px; padding:7px 10px;"></div>
          <div><label style="display:block; font-size:11.5px; color:var(--ink70); margin-bottom:4px;">${t("dateTo")}</label><input type="date" id="date-to" class="input" style="font-size:12.5px; padding:7px 10px;"></div>
          <div><label style="display:block; font-size:11.5px; color:var(--ink70); margin-bottom:4px;">${t("status")}</label>
            <select id="type-filter" class="input" style="font-size:12.5px; padding:7px 10px;">
              <option value="all">${t("typeAll")}</option><option value="in">${t("typeIn")}</option><option value="out">${t("typeOut")}</option>
            </select>
          </div>
          <div><label style="display:block; font-size:11.5px; color:var(--ink70); margin-bottom:4px;">${t("itemName")}</label>
            <select id="item-filter" class="input" style="font-size:12.5px; padding:7px 10px; max-width:180px;">
              <option value="all">${t("allItems")}</option>
              ${[...new Set(state.items.map(i => i.name))].sort().map(n => `<option value="${n}">${n}</option>`).join("")}
            </select>
          </div>
          <div><label style="display:block; font-size:11.5px; color:var(--ink70); margin-bottom:4px;">${t("worker")}</label><input id="worker-filter" class="input" style="font-size:12.5px; padding:7px 10px; width:120px;" placeholder="${t("worker")}"></div>
        </div>
      </div>
    </div>

    <div id="report-print-area">
      <div class="print-only print-header">
        <div style="font-weight:800; font-size:18px;">${escHtml(state.settings.workshop_name) || "مصنع نسيج"} — تقرير المخزون</div>
        <div style="font-size:12px; color:#555;">تم إنشاء التقرير في: ${genTime}</div>
      </div>

      <div class="card" id="section-lowstock" style="margin-bottom:18px;">
        <div style="font-weight:800; font-size:15px; margin-bottom:12px; display:flex; align-items:center; gap:7px;">${icon("alert", 16)} ${t("lowStockSection")}</div>
        <div id="low-stock-list"></div>
      </div>

      <div class="card" id="section-consumption" style="margin-bottom:18px;">
        <div style="font-weight:800; font-size:15px; margin-bottom:14px; display:flex; align-items:center; gap:7px;">${icon("chart", 16)} ${t("consumptionSection")}</div>
        <div id="consumption-list"></div>
      </div>

      <div class="card" id="section-daily" style="margin-bottom:18px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
          <div style="font-weight:800; font-size:15px; display:flex; align-items:center; gap:7px;">${icon("grid", 16)} ${t("dailySection")} — <span id="daily-count" class="mono" style="font-weight:600; color:var(--ink70); font-size:12.5px;"></span></div>
          <div class="no-print" style="display:flex; align-items:center; gap:6px; font-size:12.5px;">
            <label>عدد الصفوف:</label>
            <select id="daily-pagesize" class="input" style="padding:6px 8px; font-size:12.5px;">
              ${PAGE_SIZE_OPTIONS.map(n => `<option value="${n}">${n}</option>`).join("")}
            </select>
          </div>
        </div>
        <div style="overflow:auto;"><table><thead><tr><th>اليوم</th><th>عدد عمليات الإدخال</th><th>إجمالي الكمية المُدخلة</th><th>عدد عمليات السحب</th><th>إجمالي الكمية المسحوبة</th></tr></thead><tbody id="daily-body"></tbody></table></div>
        ${pagerBottomHtml("daily")}
      </div>

      <div class="card" id="section-txlog">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px; flex-wrap:wrap; gap:10px;">
          <div style="font-weight:800; font-size:15px; display:flex; align-items:center; gap:7px;">${icon("history", 16)} ${t("txLogSection")} — <span id="tx-count" class="mono" style="font-weight:600; color:var(--ink70); font-size:12.5px;"></span></div>
          <div class="no-print" style="display:flex; align-items:center; gap:6px; font-size:12.5px;">
            <label>عدد الصفوف:</label>
            <select id="txlog-pagesize" class="input" style="padding:6px 8px; font-size:12.5px;">
              ${PAGE_SIZE_OPTIONS.map(n => `<option value="${n}">${n}</option>`).join("")}
            </select>
          </div>
        </div>
        <div style="max-height:340px; overflow:auto;" class="print-scroll">
          <table><thead><tr><th>${t("itemName")}</th><th>${t("status")}</th><th>${t("quantity")}</th><th>${t("worker")}</th><th>${t("note")}</th><th>${t("dateTime")}</th><th class="no-print"></th></tr></thead><tbody id="tx-body"></tbody></table>
        </div>
        ${pagerBottomHtml("txlog")}
      </div>
    </div>`;

  // خريطة اسم الصنف → الفئة، لاستخدامها في تصفية الحركات حسب الفئة المختارة للطباعة
  const nameToCat = {};
  state.items.forEach(i => { nameToCat[i.name] = i.category || "بدون فئة"; });
  const getAllowedCats = () => {
    const boxes = $$(".cat-filter-item");
    if (!boxes.length) return null;
    return new Set(boxes.filter(b => b.checked).map(b => b.value));
  };
  const updateMasterCatCheckbox = () => {
    const boxes = $$(".cat-filter-item"), allEl = $("#cat-filter-all");
    if (allEl && boxes.length) allEl.checked = boxes.every(b => b.checked);
  };

  let lowStock = [], cons = [], dailyRows = [];

  const drawDailySummary = () => {
    const dst = getPagerState("daily");
    const pageSizeSelect = $("#daily-pagesize");
    if (pageSizeSelect && !pageSizeSelect.dataset.wired) {
      pageSizeSelect.value = String(dst.pageSize);
      pageSizeSelect.onchange = () => { dst.pageSize = Number(pageSizeSelect.value); dst.page = 1; drawDailySummary(); };
      pageSizeSelect.dataset.wired = "1";
    }
    const totalPages = Math.max(1, Math.ceil(dailyRows.length / dst.pageSize));
    if (dst.page > totalPages) dst.page = totalPages;
    if (dst.page < 1) dst.page = 1;
    const start = (dst.page - 1) * dst.pageSize;
    const pageRows = dailyRows.slice(start, start + dst.pageSize);

    $("#daily-count").textContent = `${dailyRows.length} يوم (المعروض: ${pageRows.length})`;
    $("#daily-body").innerHTML = pageRows.length ? pageRows.map(([, d]) => `
      <tr><td style="font-weight:700;" class="mono">${d.label}</td><td class="mono">${d.inCount}</td><td class="mono" style="color:var(--green);">+${d.inQty}</td>
      <td class="mono">${d.outCount}</td><td class="mono" style="color:var(--red);">-${d.outQty}</td></tr>`).join("")
      : `<tr><td colspan="5"><div class="empty-note">لا توجد حركات مسجّلة بعد.</div></td></tr>`;

    const bottomPager = $("#daily-pager-bottom");
    if (bottomPager) {
      bottomPager.innerHTML = `
        <button class="btn-dark" id="daily-prev" ${dst.page <= 1 ? "disabled" : ""} style="padding:5px 12px; font-size:12.5px;">السابق</button>
        <span class="mono" style="font-size:12.5px;">صفحة ${dst.page} من ${totalPages}</span>
        <button class="btn-dark" id="daily-next" ${dst.page >= totalPages ? "disabled" : ""} style="padding:5px 12px; font-size:12.5px;">التالي</button>`;
      $("#daily-prev").onclick = () => { dst.page--; drawDailySummary(); };
      $("#daily-next").onclick = () => { dst.page++; drawDailySummary(); };
    }
  };

  const refreshScopedLists = () => {
    const allowed = getAllowedCats();
    const passCat = (c) => !allowed || allowed.has(c);

    // الملخص اليومي: تجميع الحركات حسب اليوم (الوقت الدقيق لكل حركة يظهر بسجل الحركات بالأسفل)
    const dailyMap = {};
    state.transactions.filter(tx => passCat(nameToCat[tx.item_name] || "بدون فئة")).forEach(tx => {
      const d = new Date(tx.created_at);
      // مفتاح ترتيب رقمي دقيق (YYYY-MM-DD) — منفصل عن شكل العرض، عشان الترتيب يكون صحيح
      // دايمًا بغض النظر عن صيغة عرض التاريخ العربية (اللي بتبدأ باليوم مش بالسنة)
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const label = d.toLocaleDateString("ar-EG", { year: "numeric", month: "2-digit", day: "2-digit" });
      if (!dailyMap[sortKey]) dailyMap[sortKey] = { label, inCount: 0, inQty: 0, outCount: 0, outQty: 0 };
      if (tx.type === "in") { dailyMap[sortKey].inCount++; dailyMap[sortKey].inQty += Number(tx.qty); }
      else { dailyMap[sortKey].outCount++; dailyMap[sortKey].outQty += Number(tx.qty); }
    });
    // الأحدث أولًا: ترتيب تنازلي على المفتاح الرقمي (يعمل صح دايمًا بعكس مقارنة النص العربي)
    dailyRows = Object.entries(dailyMap).sort((a, b) => b[0].localeCompare(a[0]));
    drawDailySummary();

    lowStock = state.items.filter(i => statusOf(i) !== "ok" && passCat(i.category || "بدون فئة")).sort((a, b) => pctOf(a) - pctOf(b));
    $("#low-stock-list").innerHTML = lowStock.length ? lowStock.map(it => `
      <div class="report-row" style="display:flex; align-items:center; gap:12px; margin-bottom:9px;">
        <div style="width:160px; font-size:13.3px; font-weight:700;">${escHtml(it.name)}</div>
        <div style="flex:1;">${tape(it, true)}</div>
        <div class="mono" style="width:110px; font-size:12px; color:var(--ink70);">${Math.round(pctOf(it))}% (${it.qty}/${it.max_qty})</div>
        ${pill(statusOf(it))}
      </div>`).join("") : `<div class="empty-note">لا توجد أصناف منخفضة ضمن الفئات المختارة.</div>`;

    const consMap = {};
    state.transactions.filter(tx => tx.type === "out" && passCat(nameToCat[tx.item_name] || "بدون فئة")).forEach(tx => { consMap[tx.item_name] = (consMap[tx.item_name] || 0) + Number(tx.qty); });
    cons = Object.entries(consMap).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCons = Math.max(1, ...cons.map(c => c[1]));
    $("#consumption-list").innerHTML = cons.length ? cons.map(([name, val]) => `
      <div class="report-row" style="display:flex; align-items:center; gap:12px; margin-bottom:10px;">
        <div style="width:160px; font-size:13px; font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${name}</div>
        <div style="flex:1; background:var(--paper-deep); border-radius:8px; height:16px; position:relative; overflow:hidden;">
          <div style="position:absolute; inset:0; width:${(val / maxCons) * 100}%; background:var(--mustard); border-radius:8px;"></div>
        </div>
        <div class="mono" style="width:46px; font-size:12.5px; font-weight:700;">${val}</div>
      </div>`).join("") : `<div class="empty-note">لا توجد عمليات سحب ضمن الفئات المختارة.</div>`;
  };
  refreshScopedLists();

  const drawTx = () => {
    const range = $("#range-filter").value, type = $("#type-filter").value;
    const itemFilter = $("#item-filter").value, workerFilter = ($("#worker-filter").value || "").trim().toLowerCase();
    const fromVal = $("#date-from").value, toVal = $("#date-to").value;
    const allowedCats = getAllowedCats();
    let cutoffFrom = null, cutoffTo = null;
    if (fromVal || toVal) {
      if (fromVal) cutoffFrom = new Date(fromVal + "T00:00:00");
      if (toVal) cutoffTo = new Date(toVal + "T23:59:59");
    } else if (range !== "all") {
      const d = new Date();
      if (range === "today") d.setHours(0, 0, 0, 0);
      else if (range === "week") d.setDate(d.getDate() - 7);
      else if (range === "month") d.setMonth(d.getMonth() - 1);
      cutoffFrom = d;
    }
    const filtered = state.transactions.filter(t => {
      const dt = new Date(t.created_at);
      if (cutoffFrom && dt < cutoffFrom) return false;
      if (cutoffTo && dt > cutoffTo) return false;
      if (type !== "all" && t.type !== type) return false;
      if (itemFilter !== "all" && t.item_name !== itemFilter) return false;
      if (workerFilter && !(t.worker || "").toLowerCase().includes(workerFilter)) return false;
      if (allowedCats && !allowedCats.has(nameToCat[t.item_name] || "بدون فئة")) return false;
      return true;
    });

    // ترقيم الصفحات: بنعرض وبنصدّر/بنطبع الصفحة الحالية بس (مش كل النتائج المفلترة دفعة واحدة)
    const pst = getPagerState("txlog");
    const pageSizeSelect = $("#txlog-pagesize");
    if (pageSizeSelect && !pageSizeSelect.dataset.wired) {
      pageSizeSelect.value = String(pst.pageSize);
      pageSizeSelect.onchange = () => { pst.pageSize = Number(pageSizeSelect.value); pst.page = 1; drawTx(); };
      pageSizeSelect.dataset.wired = "1";
    }
    const totalPages = Math.max(1, Math.ceil(filtered.length / pst.pageSize));
    if (pst.page > totalPages) pst.page = totalPages;
    if (pst.page < 1) pst.page = 1;
    const pageStart = (pst.page - 1) * pst.pageSize;
    const pageRows = filtered.slice(pageStart, pageStart + pst.pageSize);

    $("#tx-count").textContent = `${filtered.length} حركة (المعروض: ${pageRows.length})`;
    const bottomPager = $("#txlog-pager-bottom");
    if (bottomPager) {
      bottomPager.innerHTML = `
        <button class="btn-dark" id="txlog-prev" ${pst.page <= 1 ? "disabled" : ""} style="padding:5px 12px; font-size:12.5px;">السابق</button>
        <span class="mono" style="font-size:12.5px;">صفحة ${pst.page} من ${totalPages}</span>
        <button class="btn-dark" id="txlog-next" ${pst.page >= totalPages ? "disabled" : ""} style="padding:5px 12px; font-size:12.5px;">التالي</button>`;
      $("#txlog-prev").onclick = () => { pst.page--; drawTx(); };
      $("#txlog-next").onclick = () => { pst.page++; drawTx(); };
    }

    const voucherLabel = t("voucherBtn");
    $("#tx-body").innerHTML = pageRows.length ? pageRows.map(t => `
      <tr><td style="font-weight:700;">${escHtml(t.item_name)}</td>
      <td>${t.type === "in" ? '<span style="color:var(--green); font-weight:700;">إدخال</span>' : '<span style="color:var(--red); font-weight:700;">سحب</span>'}</td>
      <td class="mono">${t.qty} ${escHtml(t.unit) || ""}</td><td>${escHtml(t.worker) || "—"}</td><td style="color:var(--ink70);">${escHtml(t.note) || "—"}</td>
      <td class="mono" style="color:var(--ink70);">${fmtDate(t.created_at)}</td>
      <td class="no-print"><button class="icon-btn" data-voucher="${t.id}" title="${voucherLabel}">${icon("history", 13)}</button></td></tr>`).join("") : `<tr><td colspan="7"><div class="empty-note">لا توجد حركات ضمن هذا الفلتر.</div></td></tr>`;
    // ملحوظة: التعامل مع نقر زر الطباعة بيتم عن طريق مستمع عام (event delegation) في نهاية الملف
    return pageRows;
  };
  let currentFiltered = drawTx();
  $("#cat-filter-all").onchange = (e) => { $$(".cat-filter-item").forEach(cb => cb.checked = e.target.checked); refreshScopedLists(); currentFiltered = drawTx(); };
  $$(".cat-filter-item").forEach(cb => cb.onchange = () => { updateMasterCatCheckbox(); refreshScopedLists(); currentFiltered = drawTx(); });
  if (state.pendingItemFilter) {
    const itemSel = $("#item-filter");
    if ([...itemSel.options].some(o => o.value === state.pendingItemFilter)) {
      itemSel.value = state.pendingItemFilter;
      currentFiltered = drawTx();
      // اختصار مباشر لتقرير حركة الصنف: امسح باقي الفلاتر، واقفل الأقسام التانية مؤقتًا، وانزل على طول لسجل الحركات
      $("#range-filter").value = "all"; $("#type-filter").value = "all"; $("#date-from").value = ""; $("#date-to").value = ""; $("#worker-filter").value = "";
      ["inc-lowstock", "inc-consumption", "inc-daily"].forEach(id => { $(`#${id}`).checked = false; });
      $("#section-lowstock").classList.add("hidden"); $("#section-consumption").classList.add("hidden"); $("#section-daily").classList.add("hidden");
      setTimeout(() => $("#section-txlog").scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    }
    state.pendingItemFilter = null;
  }
  ["range-filter", "type-filter", "item-filter"].forEach(id => $(`#${id}`).onchange = () => { currentFiltered = drawTx(); });
  ["date-from", "date-to"].forEach(id => $(`#${id}`).onchange = () => { $("#range-filter").value = "all"; currentFiltered = drawTx(); });
  $("#worker-filter").oninput = () => { currentFiltered = drawTx(); };
  $("#clear-filters").onclick = () => {
    $("#range-filter").value = "all"; $("#type-filter").value = "all"; $("#item-filter").value = "all";
    $("#date-from").value = ""; $("#date-to").value = ""; $("#worker-filter").value = "";
    currentFiltered = drawTx();
  };
  $("#toggle-advanced-filters").onclick = () => {
    const panel = $("#advanced-filters-panel"), chevron = $("#advanced-filters-chevron");
    panel.classList.toggle("hidden");
    chevron.textContent = panel.classList.contains("hidden") ? "▾" : "▴";
  };

  $("#print-report").onclick = () => {
    const sections = { lowstock: "inc-lowstock", consumption: "inc-consumption", daily: "inc-daily", txlog: "inc-txlog" };
    Object.entries(sections).forEach(([key, chkId]) => {
      const el = $(`#section-${key}`);
      el.classList.toggle("print-exclude", !$(`#${chkId}`).checked);
    });
    window.print();
  };
  window.addEventListener("afterprint", () => $$(".print-exclude").forEach(el => el.classList.remove("print-exclude")), { once: true });

  $("#export-excel").onclick = async () => {
   const exportBtn = $("#export-excel"); const exportBtnOrigText = exportBtn.innerHTML;
   try {
    exportBtn.disabled = true; exportBtn.innerHTML = "...جارِ التجهيز";
    await ensureXLSX();
    const genTime2 = fmtDate(new Date().toISOString());
    const wb = XLSX.utils.book_new();

    if ($("#inc-lowstock").checked) {
      const lowRows = lowStock.map(it => ({
        "الصنف": it.name, "الكود": it.code || "", "الفئة": it.category || "",
        "الكمية": it.qty, "الحد الأقصى": it.max_qty, "النسبة %": Math.round(pctOf(it)), "الحالة": STATUS_META[statusOf(it)].label,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(lowRows.length ? lowRows : [{ "ملاحظة": "لا توجد أصناف منخفضة" }]), "الأصناف المنخفضة");
    }

    if ($("#inc-consumption").checked) {
      const consRows = cons.map(([name, val]) => ({ "الصنف": name, "إجمالي الكمية المسحوبة": val }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(consRows.length ? consRows : [{ "ملاحظة": "لا توجد عمليات سحب" }]), "الأكثر سحبًا");
    }

    // المخزون الحالي (مرجعي دايمًا)
    const stockRows = state.items.map(it => ({
      "الصنف": it.name, "الكود": it.code || "", "الفئة": it.category || "", "الوحدة": it.unit,
      "الكمية الحالية": it.qty, "الحد الأقصى": it.max_qty,
      "النسبة %": Math.round(pctOf(it)), "الحالة": STATUS_META[statusOf(it)].label,
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(stockRows), "المخزون الحالي");

    if ($("#inc-daily").checked) {
      const dailySheetRows = dailyRows.map(([, d]) => ({
        "اليوم": d.label, "عدد عمليات الإدخال": d.inCount, "إجمالي الكمية المُدخلة": d.inQty,
        "عدد عمليات السحب": d.outCount, "إجمالي الكمية المسحوبة": d.outQty,
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(dailySheetRows.length ? dailySheetRows : [{ "ملاحظة": "لا توجد بيانات" }]), "الملخص اليومي");
    }

    if ($("#inc-txlog").checked) {
      const txRows = currentFiltered.map(t => ({
        "الصنف": t.item_name, "النوع": t.type === "in" ? "إدخال" : "سحب", "الكمية": t.qty,
        "الوحدة": t.unit || "", "العامل": t.worker || "", "ملاحظة": t.note || "",
        "التاريخ والساعة": fmtDate(t.created_at),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(txRows.length ? txRows : [{ "ملاحظة": "لا توجد حركات ضمن هذا الفلتر" }]), "سجل الحركات");
    }

    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ "المصنع": state.settings.workshop_name || "", "تاريخ إنشاء التقرير": genTime2 }]), "معلومات التقرير");

    XLSX.writeFile(wb, `تقرير_المخزون_${new Date().toISOString().slice(0, 10)}.xlsx`);
   } catch (e) {
    console.error("export-excel error:", e);
    toast("حدث خطأ أثناء تصدير Excel — " + (e && e.message ? e.message : ""), true);
   } finally {
    exportBtn.disabled = false; exportBtn.innerHTML = exportBtnOrigText;
   }
  };
}

/* ---------------- settings (branding + categories + items) ---------------- */
function renderSettings(main) {
  const plan = state.plan;
  const planBadge = plan ? `
    <div class="card" style="margin-bottom:18px; max-width:560px; background:var(--paper);">
      <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:8px;">
        <div>
          <div style="font-size:12px; color:var(--ink70);">باقتك الحالية</div>
          <div style="font-weight:800; font-size:16px;">${escHtml(plan.name)}</div>
        </div>
        <div style="display:flex; gap:8px; flex-wrap:wrap; font-size:11.5px;">
          <span class="pf-chip pf-chip-on" style="padding:4px 10px;">👥 حتى ${plan.max_users} مستخدم</span>
          <span class="pf-chip ${plan.allow_email ? "pf-chip-on" : "pf-chip-off"}" style="padding:4px 10px;">✉️ إيميل ${plan.allow_email ? "متاح" : "غير متاح"}</span>
          <span class="pf-chip ${plan.allow_telegram ? "pf-chip-on" : "pf-chip-off"}" style="padding:4px 10px;">📨 تليجرام ${plan.allow_telegram ? "متاح" : "غير متاح"}</span>
        </div>
      </div>
    </div>` : "";

  main.innerHTML = `
    <div class="section-header"><div><div class="section-title">${t("settingsTitle")}</div><div class="section-sub">${t("settingsSub")}</div></div></div>
    <div id="subscription-status-card"></div>
    ${planBadge}
    <div class="card" style="margin-bottom:18px; max-width:480px;">
      <div class="card-title">${icon("gear", 17)} ${t("factoryInfo")}</div>
      <div class="field"><label>${t("factoryName")}</label><input id="ws-name" class="input" style="width:100%;" value="${escHtml(state.settings.workshop_name) || ""}"></div>
      <div class="field">
        <label>${t("factoryLogo")}</label>
        <div style="display:flex; align-items:center; gap:12px;">
          <div style="width:52px; height:52px; border-radius:12px; background:var(--mustard); display:flex; align-items:center; justify-content:center; overflow:hidden;">
            ${state.settings.logo_base64 ? `<img src="${state.settings.logo_base64}" style="width:100%; height:100%; object-fit:cover;">` : icon("scissors", 24)}
          </div>
          <input id="ws-logo" type="file" accept="image/*">
        </div>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1;"><label>${t("factoryAddress")}</label><input id="ws-address" class="input" style="width:100%;" value="${escHtml(state.settings.address) || ""}"></div>
        <div class="field" style="flex:1;"><label>${t("factoryPhone")}</label><input id="ws-phone" class="input" style="width:100%;" value="${escHtml(state.settings.phone) || ""}"></div>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1;"><label>${t("criticalPct")}</label><input id="ws-crit" type="number" min="1" max="90" class="input mono" style="width:100%;" value="${state.settings.alert_threshold_percent || 15}"></div>
        <div class="field" style="flex:1;"><label>${t("warningPct")}</label><input id="ws-warn" type="number" min="1" max="95" class="input mono" style="width:100%;" value="${state.settings.warning_threshold_percent || 30}"></div>
      </div>
      <button class="btn-primary" id="ws-save">${t("saveFactoryInfo")}</button>
    </div>

    <div class="card" style="margin-bottom:18px; max-width:560px;">
      <div class="card-title" style="margin-bottom:6px;">${icon("alert", 17)} إشعارات المخزون المنخفض (إيميل وتليجرام)</div>
      <div style="font-size:11.5px; color:var(--ink70); margin-bottom:14px;">لما أي صنف يوصل لمستوى منخفض أو حرج، النظام يبعت إشعار تلقائي فورًا. الخطوات الكاملة لإنشاء المفاتيح موجودة في ملف <code>migration_notifications.sql</code>.</div>
      <div class="field" style="background:var(--paper); border-radius:10px; padding:12px; font-size:12.5px; color:var(--ink70);">
        ${icon("check", 13)} إدارة مستلمي التنبيهات والتقرير اليومي بقت من تبويب "${t("navEmailRecipients")}" — تقدر تحدد فيه بالظبط أي نوع رسائل يوصل لكل إيميل.
      </div>
      ${!plan || plan.allow_email ? `
      <div class="field">
        <label>مفتاح Resend (لإرسال الإيميلات)</label>
        <input id="ws-resend" class="input" style="width:100%;" value="" placeholder="${state.settings.resend_configured ? "مفتاح محفوظ بالفعل — اتركه فارغًا للإبقاء عليه، أو اكتب مفتاح جديد لاستبداله" : "re_xxxxxxxx"}">
        <div id="resend-key-status" style="font-size:11.5px; margin-top:6px; min-height:16px;"></div>
      </div>
      <div class="field" style="background:var(--paper); border-radius:10px; padding:12px;">
        <label>اختبار إرسال بريد إلكتروني حقيقي</label>
        <div style="display:flex; gap:8px; flex-wrap:wrap; margin-top:6px;">
          <input id="ws-test-email-to" class="input" style="flex:1; min-width:200px;" placeholder="ابعت الاختبار على إيميل إيه؟ مثال: you@example.com">
          <button class="btn-dark" id="ws-test-email" type="button">${icon("alert", 14)} إرسال بريد اختباري</button>
        </div>
        <div id="test-email-status" style="font-size:12px; margin-top:8px; min-height:16px;"></div>
      </div>` : `
      <div class="field" style="background:#fff4e5; border-radius:10px; padding:14px; color:#8a5a00; font-size:12.5px;">
        ✉️ إشعارات الإيميل غير متاحة في باقتك الحالية (${escHtml(plan.name)}). قم بترقية الباقة لتفعيلها.
      </div>`}
      ${!plan || plan.allow_telegram ? `
      <div class="field"><label>توكن بوت تليجرام</label><input id="ws-tg-token" class="input" style="width:100%;" value="" placeholder="${state.settings.telegram_bot_username ? `متصل حاليًا بـ @${state.settings.telegram_bot_username} — اتركه فارغًا للإبقاء عليه` : "123456:ABC-..."}"></div>
      <div class="field">
        <label>سر التحقق من Webhook</label>
        <div style="display:flex; gap:6px;">
          <input id="ws-tg-webhook-secret" class="input" style="width:100%;" value="${escHtml(state.settings.telegram_webhook_secret) || ""}" placeholder="قيمة عشوائية طويلة من اختيارك">
          <button class="icon-btn" id="ws-tg-gen-secret" type="button" title="توليد قيمة عشوائية" style="flex-shrink:0; width:auto; padding:0 10px;">${icon("search", 13)}</button>
        </div>
        <div style="font-size:11px; color:var(--ink70); margin-top:4px;">لازم تحط نفس القيمة دي بالظبط كـ Supabase Secret باسم TELEGRAM_WEBHOOK_SECRET.</div>
      </div>` : `
      <div class="field" style="background:#fff4e5; border-radius:10px; padding:14px; color:#8a5a00; font-size:12.5px;">
        📨 إشعارات تليجرام غير متاحة في باقتك الحالية (${escHtml(plan?.name || "")}). قم بترقية الباقة لتفعيلها.
      </div>`}
      <div id="tg-key-status" style="font-size:11.5px; margin:-6px 0 8px; min-height:16px;"></div>
      ${!plan || plan.allow_telegram ? `
      <div class="field" style="background:var(--paper); border-radius:10px; padding:12px;">
        <label>تفعيل استقبال التسجيل التلقائي من تيليجرام</label>
        <div style="font-size:11.5px; color:var(--ink70); margin:4px 0 8px;">أي شخص يضغط Start على البوت يتسجل تلقائيًا ويوصله أي تنبيه — من غير أي إدخال Chat ID يدوي. راجع تبويب "${t("navTelegram")}" لإدارة المسجَّلين وأدوارهم.</div>
        <button class="btn-dark" id="ws-tg-webhook-activate" type="button">${icon("send", 14)} تفعيل / تحديث Webhook</button>
        <div id="webhook-status" style="font-size:12px; margin-top:8px; min-height:16px;"></div>
      </div>` : ""}
      ${(!plan || plan.allow_email || plan.allow_telegram) ? `
      <div class="field" style="background:var(--paper); border-radius:10px; padding:12px;">
        <div style="display:flex; align-items:center; justify-content:space-between; gap:12px; margin-bottom:10px;">
          <div>
            <label style="margin-bottom:2px;">تقرير المخزن اليومي</label>
            <div style="font-size:11.5px; color:var(--ink70);">لو مفعّل، هيتبعت تلقائيًا كل يوم عبر ${plan?.allow_email && plan?.allow_telegram ? "الإيميل وTelegram المتظبطين فوق" : plan?.allow_email ? "الإيميل المتظبط فوق (تليجرام غير متاح في باقتك)" : "Telegram المتظبط فوق (الإيميل غير متاح في باقتك)"}</div>
          </div>
          <button type="button" id="ws-daily-report-toggle" class="lang-btn ${state.settings.daily_report_enabled ? "active-lang" : ""}" style="flex-shrink:0; padding:8px 16px;" data-on="${state.settings.daily_report_enabled ? "1" : "0"}">${state.settings.daily_report_enabled ? "✓ مفعّل (ON)" : "متوقف (OFF)"}</button>
        </div>
        <div style="display:flex; align-items:center; gap:10px; margin-bottom:10px;">
          <label style="font-size:12.5px; font-weight:700; color:var(--ink70); margin:0;">موعد الإرسال اليومي (بتوقيت اسطنبول)</label>
          <input type="time" id="ws-daily-report-time" class="input mono" style="width:120px;" value="${state.settings.daily_report_time || "16:00"}">
        </div>
        <div style="font-size:11.5px; color:var(--ink70); margin-bottom:10px;">
          آخر تقرير أُرسل بنجاح: <strong>${state.settings.last_daily_report_sent_at ? new Date(state.settings.last_daily_report_sent_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" }) : "لم يُرسل أي تقرير بعد"}</strong>
        </div>
        ${(() => {
          if (!state.settings.daily_report_enabled) return "";
          const lastSent = state.settings.last_daily_report_sent_at;
          const sentToday = lastSent && new Date(lastSent).toDateString() === new Date().toDateString();
          const [th, tmn] = (state.settings.daily_report_time || "16:00").split(":").map(Number);
          const target = new Date(); target.setHours(th, tmn + 20, 0, 0);
          if (!sentToday && new Date() > target) {
            return `<div style="display:flex; gap:8px; align-items:center; background:var(--red-soft); color:var(--red); padding:8px 12px; border-radius:10px; font-size:12px; font-weight:700; margin-bottom:10px;">${icon("alert", 14)} لم يصل تقرير اليوم رغم مرور موعده — جرّب زر "إرسال تجريبي الآن" لمعرفة السبب بالتحديد</div>`;
          }
          return "";
        })()}
        <button type="button" class="btn-dark" id="ws-daily-report-test">${icon("send", 14)} إرسال تقرير تجريبي الآن</button>
        <div id="daily-report-test-status" style="font-size:12px; margin-top:8px; min-height:16px;"></div>
      </div>` : `
      <div class="field" style="background:#fff4e5; border-radius:10px; padding:14px; color:#8a5a00; font-size:12.5px;">
        📋 التقرير اليومي غير متاح في باقتك الحالية (${escHtml(plan?.name || "")}) — الخدمة دي بتعتمد على الإيميل أو تليجرام، والاتنين غير متاحين في باقتك. قم بترقية الباقة لتفعيلها.
      </div>`}
      <button class="btn-primary" id="ws-save-notify">حفظ إعدادات الإشعارات</button>
    </div>

    ${isAdmin() ? `
    <div class="card" style="margin-bottom:18px; max-width:560px;">
      <div class="card-title" style="margin-bottom:6px;">${icon("history", 17)} النسخ الاحتياطي</div>
      <div style="font-size:11.5px; color:var(--ink70); margin-bottom:14px;">نسخة تلقائية كل يوم + إمكانية إنشاء نسخة يدوية أو استعادة نسخة سابقة. الاستعادة ترجّع الأصناف والفئات وبيانات المصنع فقط، وسجل الحركات لا يتأثر أبدًا.</div>
      <button class="btn-dark" id="backup-now" style="margin-bottom:16px;">${icon("download", 14)} إنشاء نسخة احتياطية الآن</button>
      <div id="backups-list"></div>
    </div>` : ""}`;

  if (isAdmin()) loadAndDrawBackups(main);

  let logoData = state.settings.logo_base64 || null;
  $("#ws-logo").onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { logoData = reader.result; toast("تم اختيار الشعار — اضغط حفظ لتأكيده"); };
    reader.readAsDataURL(file);
  };
  $("#ws-save").onclick = async () => {
    const name = $("#ws-name").value.trim() || "مصنع نسيج";
    const payload = {
      workshop_name: name, logo_base64: logoData,
      address: $("#ws-address").value.trim(), phone: $("#ws-phone").value.trim(),
      alert_threshold_percent: Number($("#ws-crit").value) || 15,
      warning_threshold_percent: Number($("#ws-warn").value) || 30,
      updated_at: new Date().toISOString(),
    };
    const { error } = await sb.from("tenant_settings").update(payload).eq("tenant_id", TENANT_ID);
    if (error) { toast("تعذر حفظ الإعدادات — " + (error.message || ""), true); return; }
    await loadSettings(); applyBranding(); logAudit({ action: "تعديل إعدادات المصنع", entity: "settings" }); toast("تم حفظ بيانات المصنع");
  };

  $("#ws-save-notify").onclick = async () => {
    const saveBtn = $("#ws-save-notify");
    const statusEl = $("#resend-key-status");   // ممكن يكون null لو الباقة مبتسمحش بالإيميل
    const tgStatusEl = $("#tg-key-status");     // ده موجود دايمًا (خارج أي شرط باقة)
    const resendKey = $("#ws-resend")?.value.trim() || "";
    const tgToken = $("#ws-tg-token")?.value.trim() || "";
    const tgWebhookSecret = $("#ws-tg-webhook-secret")?.value.trim() || "";
    if (statusEl) { statusEl.textContent = ""; statusEl.style.color = ""; }
    tgStatusEl.textContent = ""; tgStatusEl.style.color = "";

    // لا نسمح بحفظ مفتاح Resend غير صحيح — نتحقق منه فعليًا مع Resend قبل أي حفظ
    if (resendKey) {
      saveBtn.disabled = true; saveBtn.textContent = "جاري التحقق من مفتاح Resend...";
      const check = await callEmailService({ action: "validate", apiKey: resendKey });
      saveBtn.disabled = false; saveBtn.textContent = "حفظ إعدادات الإشعارات";
      if (check.error || !check.valid) {
        if (statusEl) { statusEl.style.color = "var(--red)"; statusEl.textContent = "✗ " + (check.valid === false ? (check.reason || "مفتاح Resend غير صحيح") : check.error); }
        toast("لم يتم الحفظ — مفتاح Resend غير صحيح", true);
        return; // إيقاف الحفظ تمامًا — مفيش حفظ لمفتاح غلط
      }
      if (statusEl) { statusEl.style.color = "var(--green)"; statusEl.textContent = "✓ تم التحقق من المفتاح بنجاح"; }
    }

    // التحقق من صحة توكن Telegram Bot (Chat ID مالوش داعي دلوقتي — التسجيل بقى تلقائي بالكامل)
    if (tgToken) {
      saveBtn.disabled = true; saveBtn.textContent = "جاري التحقق من Telegram...";
      const tgCheck = await callTelegramService({ action: "validate", token: tgToken });
      saveBtn.disabled = false; saveBtn.textContent = "حفظ إعدادات الإشعارات";
      if (tgCheck.error || !tgCheck.valid) {
        tgStatusEl.style.color = "var(--red)";
        tgStatusEl.textContent = "✗ " + (tgCheck.valid === false ? (tgCheck.reason || "مفتاح Telegram Bot غير صحيح") : tgCheck.error);
        toast("لم يتم الحفظ — مفتاح Telegram Bot غير صحيح", true);
        return; // إيقاف الحفظ تمامًا — مفيش حفظ لتوكن غلط
      }
      tgStatusEl.style.color = "var(--green)";
      tgStatusEl.textContent = `✓ تم التحقق من البوت بنجاح${tgCheck.botUsername ? " (@" + tgCheck.botUsername + ")" : ""}`;
    }

    const payload = {
      daily_report_enabled: $("#ws-daily-report-toggle")?.dataset.on === "1",
      daily_report_time: $("#ws-daily-report-time")?.value || "16:00",
      updated_at: new Date().toISOString(),
    };
    const { error: settingsErr } = await sb.from("tenant_settings").update(payload).eq("tenant_id", TENANT_ID);
    if (settingsErr) { toast("تعذر حفظ إعدادات التقرير اليومي — " + (settingsErr.message || ""), true); return; }

    // المفاتيح السرية (Resend/Telegram) بتتحفظ عبر Edge Function آمنة بصلاحية
    // service_role (manage-secrets) — مش تحديث مباشر للجدول، لأن tenant_secrets
    // مقفول عمدًا من أي كتابة مباشرة من المتصفح (جزء من الإصلاح الأمني نفسه)
    if (resendKey || tgToken || tgWebhookSecret) {
      saveBtn.disabled = true; saveBtn.textContent = "...جارِ حفظ المفاتيح";
      const secretsPayload = {};
      if (resendKey) secretsPayload.resendApiKey = resendKey;
      if (tgToken) secretsPayload.telegramBotToken = tgToken;
      if (tgWebhookSecret) secretsPayload.telegramWebhookSecret = tgWebhookSecret;
      const secretsRes = await callManageSecrets(secretsPayload);
      saveBtn.disabled = false; saveBtn.textContent = "حفظ إعدادات الإشعارات";
      if (secretsRes.error) { toast("تم حفظ إعدادات التقرير اليومي، لكن تعذّر حفظ المفاتيح السرية — " + secretsRes.error, true); return; }
    }
    toast("تم حفظ إعدادات الإشعارات");
    await loadSettings();
    logAudit({ action: "تعديل إعدادات الإشعارات", entity: "settings" });
  };

  if ($("#ws-daily-report-test")) $("#ws-daily-report-test").onclick = async () => {
    const btn = $("#ws-daily-report-test");
    const statusEl = $("#daily-report-test-status");
    btn.disabled = true; btn.textContent = "جارِ الإرسال...";
    statusEl.style.color = "var(--ink70)";
    statusEl.textContent = "جارِ الاتصال بخدمة التقرير اليومي...";
    try {
      const { data: { session } } = await sb.auth.getSession();
      const r = await fetch(`${SUPABASE_URL}/functions/v1/daily-report-service`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session?.access_token || ""}`, "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({}),
      });
      const rb = await r.json().catch(() => ({}));
      if (!r.ok) {
        statusEl.style.color = "var(--red)";
        statusEl.textContent = "✗ " + (rb.error || "فشل الاتصال بخدمة التقرير اليومي");
        toast("فشل إرسال التقرير التجريبي", true);
        return;
      }
      // الرد الجديد مصفوفة نتائج (مصنع واحد بس في حالة الاختبار اليدوي)
      const tenantResult = Array.isArray(rb.results) ? rb.results[0] : null;
      if (!tenantResult || tenantResult.skipped) {
        statusEl.style.color = "var(--red)";
        statusEl.textContent = "✗ " + (tenantResult?.error || tenantResult?.reason || "لم يتم إرسال أي تقرير — تأكد من حفظ الإعدادات أولًا");
        toast("لم يتم إرسال التقرير التجريبي", true);
        return;
      }
      const emailMsg = tenantResult.results?.email
        ? (tenantResult.results.email.success ? "✅ الإيميل: تم الإرسال بنجاح" : `❌ الإيميل فشل: ${tenantResult.results.email.reason || "سبب غير معروف"}`)
        : "⚪ الإيميل: غير مُفعّل (لا يوجد مفتاح Resend أو مستلمين محفوظين)";
      const tgMsg = tenantResult.results?.telegram
        ? (tenantResult.results.telegram.success ? "✅ تيليجرام: تم الإرسال بنجاح" : `❌ تيليجرام فشل: ${tenantResult.results.telegram.reason || "سبب غير معروف"}`)
        : "⚪ تيليجرام: غير مُفعّل (لا يوجد Bot Token أو Chat ID محفوظين)";
      statusEl.style.color = tenantResult.fullySucceeded ? "var(--green)" : "var(--red)";
      statusEl.innerHTML = `${emailMsg}<br>${tgMsg}`;
      toast(tenantResult.fullySucceeded ? "تم إرسال التقرير التجريبي بنجاح" : "التقرير التجريبي واجه مشكلة — راجع التفاصيل أسفل الزر", !tenantResult.fullySucceeded);
    } catch (e) {
      statusEl.style.color = "var(--red)";
      statusEl.textContent = "✗ خطأ الاتصال: " + (e && e.message ? e.message : "تعذّر الاتصال بخدمة daily-report-service");
      console.error(e);
      toast("تعذّر الاتصال بخدمة التقرير اليومي", true);
    } finally {
      btn.disabled = false; btn.textContent = "📨 إرسال تقرير تجريبي الآن";
    }
  };

  if ($("#ws-daily-report-toggle")) $("#ws-daily-report-toggle").onclick = () => {
    const btn = $("#ws-daily-report-toggle");
    const isOn = btn.dataset.on === "1";
    btn.dataset.on = isOn ? "0" : "1";
    btn.classList.toggle("active-lang", !isOn);
    btn.textContent = !isOn ? "✓ مفعّل (ON)" : "متوقف (OFF)";
  };

  // الأزرار دي بتظهر بس لو باقة المصنع بتسمح بتليجرام/إيميل (راجع renderSettings) —
  // لو مش موجودة في الـ DOM، معناها الباقة الحالية ملغّياها، فمش محتاجين نربط أي حدث
  if ($("#ws-tg-gen-secret")) $("#ws-tg-gen-secret").onclick = () => {
    const bytes = crypto.getRandomValues(new Uint8Array(24));
    const secret = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    $("#ws-tg-webhook-secret").value = secret;
    toast("تم توليد سر جديد — لازم تحفظ الإعدادات، وتحط نفس القيمة كـ Supabase Secret، ثم تضغط تفعيل Webhook");
  };

  if ($("#ws-tg-webhook-activate")) $("#ws-tg-webhook-activate").onclick = async () => {
    const btn = $("#ws-tg-webhook-activate");
    const statusEl = $("#webhook-status");
    const tgToken = $("#ws-tg-token")?.value.trim() || "";
    const secret = $("#ws-tg-webhook-secret").value.trim();
    statusEl.textContent = ""; statusEl.style.color = "";

    if (!tgToken) { statusEl.style.color = "var(--red)"; statusEl.textContent = "✗ اكتب توكن البوت الأول"; return; }
    if (!secret) { statusEl.style.color = "var(--red)"; statusEl.textContent = "✗ اكتب أو ولّد سر Webhook الأول"; return; }

    btn.disabled = true; btn.textContent = "...جارِ التفعيل";
    try {
      const webhookUrl = `${SUPABASE_URL}/functions/v1/telegram-webhook-multi-factory?tenant=${encodeURIComponent(TENANT_SLUG)}`;
      const res = await fetch(`https://api.telegram.org/bot${tgToken}/setWebhook?url=${encodeURIComponent(webhookUrl)}&secret_token=${encodeURIComponent(secret)}`);
      const data = await res.json();
      if (data.ok) {
        statusEl.style.color = "var(--green)";
        statusEl.textContent = "✓ تم تفعيل الـ Webhook بنجاح — البرنامج جاهز يستقبل تسجيلات تلقائية";
        toast("تم تفعيل Webhook بنجاح");
      } else {
        statusEl.style.color = "var(--red)";
        statusEl.textContent = "✗ " + (data.description || "فشل التفعيل");
        toast("فشل تفعيل Webhook", true);
      }
    } catch (e) {
      statusEl.style.color = "var(--red)";
      statusEl.textContent = "✗ تعذر الاتصال بتيليجرام — تأكد من توكن البوت والاتصال بالإنترنت";
    } finally {
      btn.disabled = false; btn.innerHTML = `${icon("send", 14)} تفعيل / تحديث Webhook`;
    }
  };

  if ($("#ws-test-email")) $("#ws-test-email").onclick = async () => {
    const testBtn = $("#ws-test-email");
    const statusEl = $("#test-email-status");
    const resendKey = $("#ws-resend")?.value.trim() || "";
    const to = $("#ws-test-email-to").value.trim();
    statusEl.textContent = ""; statusEl.style.color = "";

    if (!resendKey) { statusEl.style.color = "var(--red)"; statusEl.textContent = "✗ اكتب مفتاح Resend الأول قبل الاختبار"; return; }
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { statusEl.style.color = "var(--red)"; statusEl.textContent = "✗ اكتب إيميل صحيح لاستقبال رسالة الاختبار"; return; }

    testBtn.disabled = true; testBtn.textContent = "جاري الإرسال...";
    const res = await callEmailService({ action: "sendTest", apiKey: resendKey, to });
    testBtn.disabled = false; testBtn.textContent = "إرسال بريد اختباري";

    if (res.error || res.success === false) {
      statusEl.style.color = "var(--red)";
      statusEl.textContent = "✗ فشل الإرسال — " + (res.reason || res.error || "خطأ غير معروف");
      toast("فشل إرسال البريد الاختباري", true);
    } else {
      statusEl.style.color = "var(--green)";
      statusEl.textContent = `✓ تم إرسال البريد بنجاح إلى ${to} — تأكد إنه وصل (وتحقق من مجلد Spam لو ملقيتوش)`;
      toast("تم إرسال البريد الاختباري بنجاح");
    }
  };
}

/* ---------------- النسخ الاحتياطي ---------------- */
async function loadAndDrawBackups(main) {
  await loadBackups();
  const list = $("#backups-list");
  if (!list) return;
  list.innerHTML = state.backups.length ? `
    <table><thead><tr><th>التاريخ والوقت</th><th>بواسطة</th><th></th></tr></thead><tbody>
      ${state.backups.map(b => `
        <tr>
          <td class="mono">${fmtDate(b.created_at)}</td>
          <td style="color:var(--ink70);">${b.created_by || "—"}</td>
          <td><div style="display:flex; gap:8px; justify-content:flex-end;">
            <button class="icon-btn" data-dl-backup="${b.id}" title="تنزيل كملف JSON">${icon("download", 13)}</button>
            <button class="icon-btn" style="color:var(--red);" data-restore-backup="${b.id}" title="استعادة هذه النسخة">${icon("history", 13)}</button>
          </div></td>
        </tr>`).join("")}
    </tbody></table>` : `<div class="empty-note">لا توجد نسخ احتياطية بعد — اضغط "إنشاء نسخة احتياطية الآن" لعمل أول نسخة.</div>`;

  $$("[data-dl-backup]").forEach(b => b.onclick = async () => {
    const { data } = await sb.from("backups").select("*").eq("id", b.dataset.dlBackup).maybeSingle();
    if (!data) { toast("تعذر تحميل النسخة", true); return; }
    const blob = new Blob([JSON.stringify(data.data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `نسخة_احتياطية_${data.created_at.slice(0, 10)}.json`; a.click();
    URL.revokeObjectURL(url);
  });

  $$("[data-restore-backup]").forEach(b => b.onclick = async () => {
    if (!confirm("هل أنت متأكد من استعادة هذه النسخة؟ سيتم استبدال الأصناف والفئات وبيانات المصنع الحالية بمحتوى هذه النسخة. سجل الحركات لن يتأثر. سيتم أخذ نسخة أمان تلقائية قبل الاستعادة.")) return;
    const { error } = await sb.rpc("restore_backup", { backup_id: b.dataset.restoreBackup });
    if (error) { toast("تعذر الاستعادة: " + error.message, true); return; }
    logAudit({ action: "استعادة نسخة احتياطية", entity: "backup", entityName: b.dataset.restoreBackup });
    await Promise.all([loadItems(), loadCategories(), loadSettings()]);
    applyBranding();
    toast("تمت الاستعادة بنجاح");
    renderSettings(main);
  });

  const btn = $("#backup-now");
  if (btn) btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "...جارِ الإنشاء";
    const { error } = await sb.rpc("create_backup", { actor: state.profile?.full_name || "يدوي" });
    btn.disabled = false; btn.innerHTML = `${icon("download", 14)} إنشاء نسخة احتياطية الآن`;
    if (error) { toast("تعذر إنشاء النسخة: " + error.message, true); return; }
    logAudit({ action: "إنشاء نسخة احتياطية يدوية", entity: "backup" });
    toast("تم إنشاء النسخة الاحتياطية");
    await loadAndDrawBackups(main);
  };

  loadAndRenderSubscriptionCard();
}

// الكارت ده بيظهر في الإعدادات (للأدمن) وكمان كشريط ثابت أعلى الصفحة (للأدمن +
// مدير المصنع + المحاسب — الأدوار الثلاثة اللي المفروض يعرفوا موعد التجديد
// والمبلغ المطلوب، حتى لو مالهومش صلاحية دخول تبويب الإعدادات نفسه)
async function loadAndRenderSubscriptionCard() {
  const settingsEl = $("#subscription-status-card"); // داخل تبويب الإعدادات (admin بس أصلاً)
  const bannerEl = $("#subscription-banner");         // شريط ثابت أعلى الصفحة (3 أدوار)
  if (!settingsEl && !bannerEl) return;

  const { data: tenantRow } = await sb.from("tenants").select("subscription_status, subscription_expires_at, subscription_note, subscription_amount, subscription_currency").eq("id", TENANT_ID).maybeSingle();
  if (!tenantRow) { if (settingsEl) settingsEl.innerHTML = ""; if (bannerEl) bannerEl.innerHTML = ""; return; }

  const map = {
    trial: { label: t("subTrialLabel"), bg: "#EAF1FB", color: "#2A5BA8", icon: "🧪" },
    active: { label: t("subActiveLabel"), bg: "#E6F4EA", color: "#1A7A3E", icon: "✅" },
    overdue: { label: t("subOverdueLabel"), bg: "#FBF1E2", color: "#8A5A1E", icon: "⏰" },
    suspended: { label: t("subSuspendedLabel"), bg: "#FBEAE9", color: "#C0392B", icon: "⛔" },
  };
  let s = map[tenantRow.subscription_status] || map.trial;
  const daysLeft = tenantRow.subscription_expires_at
    ? Math.ceil((new Date(tenantRow.subscription_expires_at).getTime() - Date.now()) / 86400000)
    : null;

  // تذكير التجديد: من 15 يوم قبل الانتهاء، نلوّن الكارت بلون تنبيه واضح (حتى
  // لو الحالة لسه "مفعّل" رسميًا)، عشان المبلغ المطلوب يبان بوضوح قبل الموعد
  // مش بس بعد ما يتأخر السداد فعليًا
  const RENEWAL_WARNING_DAYS = 15;
  const inRenewalWindow = tenantRow.subscription_status === "active" && daysLeft !== null && daysLeft >= 0 && daysLeft <= RENEWAL_WARNING_DAYS;
  if (inRenewalWindow) s = { label: t("subRenewalSoonLabel"), bg: "#FBF1E2", color: "#8A5A1E", icon: "⏰" };

  const daysLine = tenantRow.subscription_expires_at
    ? (daysLeft >= 0 ? tf("subExpiresIn", { days: daysLeft, date: tenantRow.subscription_expires_at }) : tf("subExpiredSince", { days: Math.abs(daysLeft) }))
    : "";
  const amountLine = tenantRow.subscription_amount ? tf("subAmountDue", { amount: tenantRow.subscription_amount, currency: tenantRow.subscription_currency || "EGP" }) : "";

  const cardHtml = `
    <div class="card" style="margin-bottom:18px; max-width:480px; background:${s.bg}; border:1px solid ${s.color}22;">
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="font-size:22px;">${s.icon}</div>
        <div>
          <div style="font-weight:800; color:${s.color}; font-size:14px;">${s.label}</div>
          ${daysLine ? `<div style="font-size:12px; color:${s.color};">${daysLine}</div>` : ""}
          ${amountLine ? `<div style="font-size:12.5px; font-weight:700; color:${s.color}; margin-top:2px;">${amountLine}</div>` : ""}
          ${tenantRow.subscription_note ? `<div style="font-size:11.5px; color:var(--ink50); margin-top:2px;">${escHtml(tenantRow.subscription_note)}</div>` : ""}
        </div>
      </div>
    </div>`;

  if (settingsEl) settingsEl.innerHTML = cardHtml;

  if (bannerEl) {
    const canSeeFullBanner = ["admin", "factory_manager", "accountant"].includes(myRole());
    if (state.readOnlyReason) {
      // وضع "قراءة فقط" لازم يبان لكل الأدوار (مش بس الإداريين) — لأنه بيأثر
      // فعليًا على شغل أي حد بيسجّل حركات يومية، مش بس اللي بيديروا الاشتراك
      bannerEl.innerHTML = `
        <div style="background:#FBEAE9; border-bottom:1px solid #f0c9c6; padding:9px 18px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:12.5px; font-weight:700; color:#C0392B;">
          <span style="font-size:16px;">🔒</span><span>${escHtml(state.readOnlyReason)}</span>
        </div>`;
    } else if (!canSeeFullBanner) { bannerEl.innerHTML = ""; }
    else {
      bannerEl.innerHTML = `
        <div style="background:${s.bg}; border-bottom:1px solid ${s.color}33; padding:8px 18px; display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:12.5px;">
          <span style="font-size:16px;">${s.icon}</span>
          <span style="font-weight:800; color:${s.color};">${s.label}</span>
          ${daysLine ? `<span style="color:${s.color};">${daysLine}</span>` : ""}
          ${amountLine ? `<span style="font-weight:700; color:${s.color};">${amountLine}</span>` : ""}
        </div>`;
    }
  }
}

/* ---------------- طباعة إذن صرف / إذن استلام لحركة واحدة ---------------- */
function printVoucher(tx) {
  const isIn = tx.type === "in";
  const title = isIn ? "إذن استلام مخزني" : "إذن صرف مخزني";
  const voucherNo = (tx.id || "").slice(0, 8).toUpperCase();
  const w = state.settings;
  const item = state.items.find(i => i.name === tx.item_name);
  const html = `
    <div style="padding:20px; color:#17323C; direction:rtl; max-width:800px; margin:0 auto;">
      <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:3px solid #17323C; padding-bottom:16px; margin-bottom:20px;">
        <div style="display:flex; align-items:center; gap:12px;">
          ${w.logo_base64 && /^data:image\//.test(w.logo_base64) ? `<img src="${escHtml(w.logo_base64)}" style="width:52px; height:52px; border-radius:10px; object-fit:cover;">` : ""}
          <div>
            <div style="font-weight:800; font-size:19px;">${escHtml(w.workshop_name) || "مصنع نسيج"}</div>
            <div style="font-size:11.5px; color:#666;">${escHtml(w.address) || ""}${w.address && w.phone ? " · " : ""}${escHtml(w.phone) || ""}</div>
          </div>
        </div>
        <div style="text-align:left;">
          <div style="font-size:22px; font-weight:800; color:${isIn ? "#2F8F5B" : "#C85D51"};">${title}</div>
          <div style="font-size:12px; color:#666; margin-top:4px;">رقم الإذن: ${voucherNo}</div>
        </div>
      </div>
      <table style="width:100%; border-collapse:collapse; margin:22px 0;">
        <tr><th style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px; text-align:right; background:#f2f2f2; width:160px; font-weight:700;">التاريخ والساعة</th><td style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px;">${fmtDate(tx.created_at)}</td></tr>
        <tr><th style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px; text-align:right; background:#f2f2f2; font-weight:700;">الصنف</th><td style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px;">${escHtml(tx.item_name)}${item?.code ? ` (${escHtml(item.code)})` : ""}</td></tr>
        <tr><th style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px; text-align:right; background:#f2f2f2; font-weight:700;">الفئة</th><td style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px;">${escHtml(item?.category) || "—"}</td></tr>
        <tr><th style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px; text-align:right; background:#f2f2f2; font-weight:700;">الكمية</th><td style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px;">${tx.qty} ${escHtml(tx.unit) || ""}</td></tr>
        <tr><th style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px; text-align:right; background:#f2f2f2; font-weight:700;">${isIn ? "المورد / جهة التوريد" : "المستلم / العامل"}</th><td style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px;">${escHtml(tx.worker) || "—"}</td></tr>
        <tr><th style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px; text-align:right; background:#f2f2f2; font-weight:700;">ملاحظات</th><td style="border:1px solid #ccc; padding:10px 14px; font-size:13.5px;">${escHtml(tx.note) || "—"}</td></tr>
      </table>
      <div style="display:flex; justify-content:space-between; margin-top:60px;">
        <div style="width:30%; text-align:center;"><div style="border-top:1px solid #333; margin-top:50px; padding-top:6px; font-size:12.5px; color:#444;">أمين المخزن</div></div>
        <div style="width:30%; text-align:center;"><div style="border-top:1px solid #333; margin-top:50px; padding-top:6px; font-size:12.5px; color:#444;">${isIn ? "المورد" : "المستلم"}</div></div>
        <div style="width:30%; text-align:center;"><div style="border-top:1px solid #333; margin-top:50px; padding-top:6px; font-size:12.5px; color:#444;">اعتماد المدير</div></div>
      </div>
      <div style="margin-top:40px; font-size:10.5px; color:#999; text-align:center;">تم إنشاء هذا الإذن تلقائيًا بواسطة نظام إدارة المخازن — ${fmtDate(new Date().toISOString())}</div>
    </div>`;

  const fullDoc = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8">
<title>${title} - ${voucherNo}</title>
<style>
  * { box-sizing: border-box; font-family: 'Cairo', 'Segoe UI', Tahoma, Arial, sans-serif; }
  body { margin: 0; }
  @media print { @page { margin: 12mm; } }
</style></head><body>${html}</body></html>`;

  try {
    let frame = document.getElementById("voucher-print-frame");
    if (frame) frame.remove();
    frame = document.createElement("iframe");
    frame.id = "voucher-print-frame";
    frame.style.position = "fixed";
    frame.style.right = "0";
    frame.style.bottom = "0";
    frame.style.width = "0";
    frame.style.height = "0";
    frame.style.border = "0";
    document.body.appendChild(frame);

    const doc = frame.contentWindow.document;
    doc.open();
    doc.write(fullDoc);
    doc.close();

    // ملحوظة مهمة: حدث onload لا يُطلَق بشكل موثوق للـ iframe اللي محتواه اتكتب بـ document.write
    // (ده كان سبب المشكلة الأصلية)، فبننادي الطباعة مباشرة بعد doc.close() بدل ما ننتظر onload
    frame.contentWindow.focus();
    frame.contentWindow.print();
    // تنظيف الإطار المخفي بعد فترة كافية لإتمام الطباعة
    setTimeout(() => { const f = document.getElementById("voucher-print-frame"); if (f) f.remove(); }, 3000);
  } catch (e) {
    toast("تعذّرت طباعة الإذن: " + e.message, true);
  }
}

/* ---------------- إدارة الأصناف والفئات (المدير وأمين المخزن) ---------------- */
async function renderItemsAdmin(main) {
  if (!_suppliersLoaded) { main.innerHTML = `<div class="empty-note">جاري تحميل البيانات...</div>`; await ensureSuppliers(); if (state.tab !== "items") return; }
  main.innerHTML = `
    <div class="section-header no-print"><div><div class="section-title">${t("itemsAdminTitle")}</div><div class="section-sub">${t("itemsAdminSub")}</div></div></div>

    <div class="card no-print" style="margin-bottom:18px; max-width:480px;">
      <div class="card-title">${icon("grid", 17)} ${t("categoriesTitle")}</div>
      <div id="cat-chips" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:14px;"></div>
      <div style="display:flex; gap:8px;">
        <input id="new-cat" class="input" style="flex:1;" placeholder="${t("newCategoryPlaceholder")}">
        <button class="btn-dark" id="add-cat">${icon("plus", 14)} ${t("add")}</button>
      </div>
    </div>

    <details class="collapsible-card no-print" style="max-width:620px;">
      <summary>${icon("download", 17)} استيراد أصناف من Excel <svg class="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></summary>
      <div class="collapsible-body">
      <div style="font-size:12.5px; color:var(--ink70); margin-bottom:10px;">بيضيف مئات الأصناف دفعة واحدة من ملف Excel. اتبع الخطوات بالترتيب:</div>
      <ol style="font-size:12.5px; color:var(--ink70); margin:0 0 14px; padding-right:20px; line-height:2;">
        <li>اضغط <b>"تنزيل قالب Excel"</b> تحت — هيوصلك ملف فيه صف مثال (اسمه واضح "مثال — احذفه") + شيت تعليمات.</li>
        <li>افتح الملف، احذف صف المثال، واكتب بيانات أصنافك الحقيقية بنفس ترتيب الأعمدة.</li>
        <li>احفظ الملف، وارفعه بزرار <b>"اختيار ملف Excel"</b> تحت.</li>
      </ol>
      <div style="background:var(--paper-deep); border-radius:10px; padding:12px 14px; margin-bottom:14px; font-size:12px;">
        <b>الأعمدة المطلوبة بالظبط (بنفس الأسماء):</b>
        <ul style="margin:8px 0 0; padding-right:18px; line-height:1.9;">
          <li><b>اسم الصنف</b> — إجباري</li>
          <li><b>الفئة</b> — إجباري (لو الفئة مش موجودة عندك، هتتضاف تلقائيًا)</li>
          <li><b>الوحدة</b> — إجباري (مثال: متر، قطعة، بكرة)</li>
          <li><b>الكمية</b> — إجباري (رقم)</li>
          <li><b>الحد الأقصى</b> — إجباري (رقم، أساس حساب نسبة التنبيه)</li>
          <li><b>الكود</b> — اختياري (لو سايبه فاضي هيتولّد تلقائيًا)</li>
          <li><b>الباركود</b> — اختياري</li>
        </ul>
      </div>
      <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
        <button class="btn-dark" id="download-template">${icon("download", 14)} تنزيل قالب Excel</button>
        <label class="btn-dark" style="cursor:pointer;">${icon("plus", 14)} اختيار ملف Excel
          <input type="file" id="import-file" accept=".xlsx,.xls" style="display:none;">
        </label>
      </div>
      <div id="import-status" style="margin-top:12px; font-size:12.5px;"></div>
      </div>
    </details>

    <details class="collapsible-card no-print" style="max-width:620px;">
      <summary>${icon("search", 17)} طباعة ملصقات باركود بالجملة <svg class="chev" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m6 9 6 6 6-6"/></svg></summary>
      <div class="collapsible-body">
      <div id="bulk-barcode-status" style="font-size:12.5px; color:var(--ink70); margin-bottom:12px;"></div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <button class="btn-dark" id="bulk-gen-barcodes">${icon("plus", 14)} توليد أكواد للأصناف اللي بدون باركود</button>
        <button class="btn-primary" id="bulk-print-barcodes">${icon("search", 14)} طباعة ملصقات لكل الأصناف اللي ليها باركود</button>
        <button class="btn-dark" id="check-duplicate-barcodes">${icon("alert", 14)} فحص الباركودات المكررة</button>
      </div>
      <div id="duplicate-barcode-result" style="margin-top:12px;"></div>
      </div>
    </details>

    <div class="section-header no-print"><div style="font-weight:800; font-size:16px;">${t("itemsTitle")}</div>
      <div style="display:flex; gap:8px;">
        <button class="btn-dark" id="items-view-toggle">${icon("grid", 14)} ${state.itemsViewMode === "flat" ? "عرض حسب الفئة" : "عرض كقائمة"}</button>
        ${state.itemsViewMode === "flat" ? "" : `<button class="btn-dark" id="items-print">${icon("history", 14)} طباعة</button><button class="btn-dark" id="items-export">${icon("download", 14)} تصدير Excel</button>`}
        <button class="btn-dark" id="new-item-btn">${icon("plus", 15)} ${t("newItemBtn")}</button>
      </div></div>
    <div class="toolbar no-print" style="${state.itemsViewMode === "flat" ? "display:none;" : ""}">
      <div style="position:relative; max-width:320px; flex:1;">
        <span style="position:absolute; right:12px; top:11px; color:var(--ink50);">${icon("search", 15)}</span>
        <input id="items-search" class="input" style="width:100%; padding-right:34px;" placeholder="${t("searchByNameCode")}">
      </div>
    </div>
    ${state.itemsViewMode === "flat" ? pagerToolbarHtml("itemsflat", "ابحث بالاسم أو الكود...") : ""}
    ${printHeaderHtml("قائمة الأصناف")}
    <div class="card" style="padding:0; overflow:hidden;">
      <table><thead><tr><th>${t("code")}</th><th>${t("itemName")}</th><th>${t("category")}</th><th>${t("unit")}</th><th>${t("currentQty")}</th><th>${t("maxQty")}</th><th>${t("itemSupplier")}</th><th>${t("itemStorage")}</th><th class="no-print"></th></tr></thead><tbody id="items-body"></tbody></table>
    </div>
    ${state.itemsViewMode === "flat" ? pagerBottomHtml("itemsflat") : ""}`;

  $("#items-view-toggle").onclick = () => { state.itemsViewMode = state.itemsViewMode === "flat" ? "grouped" : "flat"; renderItemsAdmin(main); };

  // ---------------- طباعة ملصقات بالجملة + توليد أكواد + فحص التكرار ----------------
  await ensureBarcodeLib();
  const itemsWithBarcode = state.items.filter(i => i.barcode);
  const itemsWithoutBarcode = state.items.filter(i => !i.barcode);
  $("#bulk-barcode-status").textContent = `${itemsWithBarcode.length} صنف ليه باركود، ${itemsWithoutBarcode.length} صنف من غير باركود.`;

  $("#bulk-gen-barcodes").onclick = async () => {
    if (!itemsWithoutBarcode.length) { toast("كل الأصناف ليها باركود بالفعل"); return; }
    if (!confirm(`هيتولّد كود داخلي فريد لـ ${itemsWithoutBarcode.length} صنف. متأكد؟`)) return;
    const btn = $("#bulk-gen-barcodes"); btn.disabled = true; btn.textContent = "...جارِ التوليد";
    // ⚠️ ملحوظة مهمة: genItemCode() بتحسب "الرقم التالي" بالرجوع لـ state.items
    // الحالية — وده تمام لما بتتنده مرة واحدة (شاشة إضافة صنف واحد)، لكن جوه
    // لوب زي ده، state.items مابتتحدّثش بين كل تكرار والتاني (مش بنعمل
    // loadItems() إلا بعد ما اللوب يخلص كله)، فكانت بتطلع نفس الرقم لأكتر من
    // صنف في نفس الفئة (بالظبط اللي حصل معاك). الحل: مولّد مستقل تمامًا
    // (تاريخ + عشوائي) مش محتاج يرجع لأي بيانات مخزّنة، فمفيش احتمال تكرار
    // حتى في نفس اللوب.
    const generateUniqueInternalBarcode = () => {
      const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
      return `INT${Date.now().toString().slice(-7)}${rand}`;
    };
    for (const it of itemsWithoutBarcode) {
      await sb.from("items").update({ barcode: generateUniqueInternalBarcode() }).eq("id", it.id);
    }
    await loadItems();
    toast(`تم توليد ${itemsWithoutBarcode.length} كود بنجاح`);
    renderItemsAdmin(main);
  };

  $("#bulk-print-barcodes").onclick = () => {
    const printable = state.items.filter(i => i.barcode);
    if (!printable.length) { toast("مفيش أصناف ليها باركود لسه — دوس \"توليد أكواد\" الأول", true); return; }
    const w = window.open("", "_blank", "width=800,height=600");
    w.document.write(`<html dir="rtl"><head><title>ملصقات باركود</title><style>
      body{font-family:Tahoma,Arial,sans-serif; padding:14px;}
      .grid{display:flex; flex-wrap:wrap; gap:10px;}
      .label{border:1px dashed #999; padding:8px 10px; text-align:center; page-break-inside:avoid;}
      .n{font-size:12px; font-weight:700; margin-bottom:4px; max-width:160px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;}
    </style></head><body><div class="grid" id="labels-grid"></div>
    <script src="https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js"></script>
    <script>
      const items = ${JSON.stringify(printable.map(i => ({ name: i.name, barcode: i.barcode })))};
      const grid = document.getElementById('labels-grid');
      items.forEach((it, idx) => {
        const div = document.createElement('div'); div.className = 'label';
        div.innerHTML = '<div class="n"></div><svg id="lbl-' + idx + '"></svg>';
        div.querySelector('.n').textContent = it.name;
        grid.appendChild(div);
        JsBarcode('#lbl-' + idx, it.barcode, { height: 35, fontSize: 10, margin: 2 });
      });
      window.onload = () => setTimeout(() => window.print(), 300);
    </script></body></html>`);
    w.document.close();
  };

  $("#check-duplicate-barcodes").onclick = () => {
    const groups = {};
    state.items.filter(i => i.barcode).forEach(i => { (groups[i.barcode] = groups[i.barcode] || []).push(i); });
    const dups = Object.entries(groups).filter(([, items]) => items.length > 1);
    const resultEl = $("#duplicate-barcode-result");
    if (!dups.length) { resultEl.innerHTML = `<div style="color:var(--green); font-size:12.5px; font-weight:700;">${icon("check", 13)} مفيش أي باركود مكرر — كله سليم</div>`; return; }
    // ⚠️ ليه مش بيتصلح تلقائيًا بالكامل: النظام مش عارف الباركود ده بالظبط
    // بتاع أي صنف من الاتنين فعليًا على أرض الواقع (لو حد لصق ملصق مطبوع
    // بالكود ده بالفعل على منتج معيّن)، فتغيير غلط ممكن يبوّظ ملصق مطبوع
    // من غير ما حد ياخد باله. الحل الأسرع تحت ("حل تلقائي") بيسيب أول صنف
    // زي ما هو ويغيّر كود الباقيين بس — استخدمه لو متأكد إن مفيش ملصقات
    // مطبوعة بالكود ده لسه، وإلا عدّل يدويًا بالزرار المخصص لكل صنف.
    resultEl.innerHTML = `
      <div style="background:#fff4e5; border-radius:10px; padding:12px 14px; font-size:12.5px;">
        <div style="font-weight:800; margin-bottom:8px;">${icon("alert", 14)} لقيت ${dups.length} باركود مكرر:</div>
        ${dups.map(([code, items]) => `
          <div style="margin-bottom:8px; padding-bottom:8px; border-bottom:1px solid #eee0c8;">
            <div style="margin-bottom:4px;"><span class="mono" style="font-weight:700;">${escHtml(code)}</span> مسجّل على:</div>
            ${items.map(i => `<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; padding:2px 0;">
              <span>${escHtml(i.name)}</span>
              <button class="pf-row-btn" data-fix-dup-item="${i.id}" style="font-size:11px;">تعديل هذا الصنف</button>
            </div>`).join("")}
          </div>`).join("")}
        <button class="btn-dark" id="auto-fix-duplicates" style="margin-top:6px; font-size:12px;">${icon("check", 12)} حل تلقائي (يسيب أول صنف في كل مجموعة زي ما هو، ويولّد كود جديد للباقيين)</button>
      </div>`;

    $$("[data-fix-dup-item]", resultEl).forEach(btn => btn.onclick = () => {
      const it = state.items.find(i => i.id === btn.dataset.fixDupItem);
      if (it) openItemModal(it, "", () => renderItemsAdmin(main));
    });

    $("#auto-fix-duplicates").onclick = async () => {
      if (!confirm(`هيتولّد باركود جديد لكل صنف تاني في كل مجموعة مكررة، وهيتسيب بس أول صنف في كل مجموعة بنفس الكود القديم. متأكد؟`)) return;
      const generateUniqueInternalBarcode = () => {
        const rand = Math.random().toString(36).slice(2, 7).toUpperCase();
        return `INT${Date.now().toString().slice(-7)}${rand}`;
      };
      for (const [, items] of dups) {
        for (const it of items.slice(1)) {
          await sb.from("items").update({ barcode: generateUniqueInternalBarcode() }).eq("id", it.id);
        }
      }
      await loadItems();
      toast("تم حل كل التكرارات");
      renderItemsAdmin(main);
    };
  };

  if (state.itemsViewMode === "flat") {
    mountPagedTable({
      idPrefix: "itemsflat",
      allRows: state.items,
      tbodySelector: "#items-body",
      colCount: 9,
      emptyMessage: "لا توجد أصناف مطابقة",
      searchFields: (it) => [it.name, it.code, it.category],
      renderRow: (it) => `
        <tr><td class="mono" style="font-weight:700; color:var(--mustard);">${escHtml(it.code) || "—"}</td>
        <td style="font-weight:700;">${escHtml(it.name)}</td>
        <td style="color:var(--ink70);">${escHtml(it.category) || "—"}</td><td>${escHtml(it.unit)}</td>
        <td class="mono">${it.qty}</td><td class="mono">${it.max_qty}</td>
        <td style="color:var(--ink70); font-size:12.5px;">${escHtml((state.suppliers.find(s => s.id === it.supplier_id) || {}).name) || "—"}</td>
        <td style="color:var(--ink70); font-size:12.5px;">${escHtml(it.storage_location) || "—"}</td>
        <td class="no-print"><div style="display:flex; gap:6px; justify-content:flex-end;">
          <button class="icon-btn" style="color:var(--green);" data-quick-add="${it.id}" title="إضافة كمية سريعًا">${icon("plus", 14)}</button>
          <button class="icon-btn" data-edit="${it.id}">${icon("pencil", 14)}</button>
          <button class="icon-btn" style="color:var(--red);" data-del="${it.id}">${icon("trash", 14)}</button>
        </div></td></tr>`,
      excelSheetName: "قائمة الأصناف",
      excelRow: (it) => ({
        "الكود": it.code || "", "الصنف": it.name, "الفئة": it.category || "", "الوحدة": it.unit,
        "الكمية الحالية": it.qty, "الحد الأقصى": it.max_qty,
        "المورد": (state.suppliers.find(s => s.id === it.supplier_id) || {}).name || "",
        "موقع التخزين": it.storage_location || "",
      }),
      onDrawn: () => {
        $$("[data-edit]").forEach(b => b.onclick = () => openItemModal(state.items.find(i => i.id === b.dataset.edit)));
        $$("[data-quick-add]").forEach(b => b.onclick = () => openQuickAddQtyModal(state.items.find(i => i.id === b.dataset.quickAdd), main));
        $$("[data-del]").forEach(b => b.onclick = async () => {
          const it = state.items.find(i => i.id === b.dataset.del);
          if (!confirm(`حذف "${it.name}" نهائيًا؟`)) return;
          await sb.from("items").delete().eq("id", it.id);
          logAudit({ action: "حذف صنف", entity: "item", entityName: it.name });
          await loadItems(); renderItemsAdmin(main); toast("تم حذف الصنف");
        });
      },
    });
    $("#new-item-btn").onclick = () => openItemModal(null);
    return;
  }

  $("#download-template").onclick = async () => {
    const dtBtn = $("#download-template"); const dtOrigText = dtBtn.innerHTML;
    try {
      dtBtn.disabled = true; dtBtn.innerHTML = "...جارِ التجهيز";
      await ensureXLSX();
    } catch (e) { toast("تعذر تحميل مكتبة Excel — تأكد من الاتصال بالإنترنت", true); dtBtn.disabled = false; dtBtn.innerHTML = dtOrigText; return; }
    dtBtn.disabled = false; dtBtn.innerHTML = dtOrigText;
    const wb = XLSX.utils.book_new();

    const instructions = [
      { "التعليمات": "1. احذف صف المثال في شيت (أصناف) قبل إدخال بياناتك." },
      { "التعليمات": "2. لازم تكتب بيانات كل صنف في صف مستقل تحت صف العناوين." },
      { "التعليمات": "3. الأعمدة الإجبارية: اسم الصنف، الفئة، الوحدة، الكمية، الحد الأقصى." },
      { "التعليمات": "4. الكود والباركود اختياريان — لو سايبهم فاضيين هيتولدوا تلقائيًا." },
      { "التعليمات": "5. لو الفئة اللي كتبتها مش موجودة في النظام، هتتضاف تلقائيًا وقت الاستيراد." },
      { "التعليمات": "6. احفظ الملف بصيغة xlsx وارفعه من زرار (اختيار ملف Excel) في صفحة إدارة الأصناف." },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(instructions), "تعليمات");

    const sample = [
      { "اسم الصنف": "مثال — احذف هذا الصف", "الفئة": "أقمشة", "الوحدة": "متر", "الكمية": 50, "الحد الأقصى": 200, "الكود": "", "الباركود": "" },
      { "اسم الصنف": "خيط بوليستر أسود", "الفئة": "خيوط", "الوحدة": "بكرة", "الكمية": 30, "الحد الأقصى": 100, "الكود": "", "الباركود": "" },
    ];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(sample), "أصناف");

    XLSX.writeFile(wb, "قالب_استيراد_الأصناف.xlsx");
  };

  $("#import-file").onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const statusEl = $("#import-status");
    statusEl.innerHTML = `<span style="color:var(--ink70);">...جارِ قراءة الملف</span>`;
    try {
      await ensureXLSX();
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      // نقرأ شيت "أصناف" بالاسم لو موجود (ملف القالب فيه شيت تعليمات كمان)، وإلا أول شيت في الملف للتوافق مع ملفات قديمة
      const sheetName = wb.SheetNames.includes("أصناف") ? "أصناف" : wb.SheetNames[0];
      const sheet = wb.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

      const colVal = (row, ...keys) => { for (const k of keys) if (row[k] !== undefined && row[k] !== "") return row[k]; return ""; };
      const validRows = [];
      const skipped = [];
      const newCats = new Set();

      rows.forEach((row, idx) => {
        const name = String(colVal(row, "اسم الصنف", "الصنف", "name")).trim();
        if (name.includes("مثال") && name.includes("احذف")) return; // تجاهل صف المثال لو نسي المستخدم يحذفه
        const category = String(colVal(row, "الفئة", "category")).trim() || (state.categories[0] || "أخرى");
        const unit = String(colVal(row, "الوحدة", "unit")).trim() || "قطعة";
        const qty = Number(colVal(row, "الكمية", "qty")) || 0;
        const maxQty = Number(colVal(row, "الحد الأقصى", "max_qty")) || 0;
        const code = String(colVal(row, "الكود", "code")).trim();
        const barcode = String(colVal(row, "الباركود", "barcode")).trim();
        if (!name || !maxQty) { skipped.push(idx + 2); return; }
        if (!state.categories.includes(category)) newCats.add(category);
        validRows.push({ name, category, unit, qty, max_qty: maxQty, code: code || null, barcode: barcode || null, tenant_id: TENANT_ID });
      });

      if (!validRows.length) { statusEl.innerHTML = `<span style="color:var(--red); font-weight:700;">لا توجد صفوف صالحة للاستيراد (تأكد من عمودي "اسم الصنف" و"الحد الأقصى").</span>`; e.target.value = ""; return; }

      // كشف التكرار: أصناف بنفس الاسم موجودة بالفعل في النظام، أو مكررة داخل الملف نفسه
      const existingNames = new Set(state.items.map(i => i.name.trim().toLowerCase()));
      const seenInFile = new Set();
      const dupNames = new Set();
      validRows.forEach(r => {
        const key = r.name.trim().toLowerCase();
        if (existingNames.has(key) || seenInFile.has(key)) dupNames.add(r.name);
        seenInFile.add(key);
      });

      let finalRows = validRows;
      if (dupNames.size) {
        const list = [...dupNames].slice(0, 10).join("، ") + (dupNames.size > 10 ? " ..." : "");
        const proceed = confirm(`⚠️ لوحظ ${dupNames.size} صنف مكرر (موجود بالفعل أو مكرر داخل الملف نفسه):\n${list}\n\nاضغط "موافق" لاستيراد الكل بما فيهم المكررات كأصناف منفصلة، أو "إلغاء" لاستبعاد المكررات والاستيراد بالباقي فقط.`);
        if (!proceed) {
          const seen2 = new Set();
          finalRows = validRows.filter(r => {
            const key = r.name.trim().toLowerCase();
            if (existingNames.has(key) || seen2.has(key)) return false;
            seen2.add(key);
            return true;
          });
          if (!finalRows.length) { statusEl.innerHTML = `<span style="color:var(--red); font-weight:700;">كل الصفوف كانت مكررة — لم يتم استيراد أي صنف جديد.</span>`; e.target.value = ""; return; }
          validRows.length = 0; validRows.push(...finalRows);
        }
      }

      statusEl.innerHTML = `<span style="color:var(--ink70);">...جارِ استيراد ${validRows.length} صنف</span>`;

      // إضافة أي فئات جديدة واردة في الملف قبل استيراد الأصناف
      for (const cat of newCats) { await sb.from("categories").insert({ name: cat, tenant_id: TENANT_ID }).select(); }
      if (newCats.size) await loadCategories();

      // توليد أكواد تلقائية لأي صف من غير كود (بعداد محلي عشان مانكررش نفس الكود لأصناف بنفس الفئة في نفس الملف)
      const localCounters = {};
      validRows.forEach(r => {
        if (r.code) return;
        const base = genItemCode(r.category); // يرجع مثلاً FAB-0007 بناءً على الأصناف الموجودة فعلاً
        const prefix = base.split("-")[0];
        if (!(prefix in localCounters)) localCounters[prefix] = parseInt(base.split("-")[1], 10);
        else localCounters[prefix]++;
        r.code = `${prefix}-${String(localCounters[prefix]).padStart(4, "0")}`;
      });

      const { data: insertedItems, error } = await sb.from("items").insert(validRows).select();
      if (error) {
        statusEl.innerHTML = `<span style="color:var(--red); font-weight:700;">تعذر الاستيراد: ${escHtml(error.message)}</span>`;
      } else {
        // تسجيل رصيد افتتاحي كحركة "إدخال" لكل صنف اتضاف بكمية أكبر من صفر
        // عبر دالة آمنة (مش إدخال مباشر — جدول transactions مقفول من أي
        // كتابة مباشرة من الفرونت إند بتصميم متعمد)
        const openingItems = (insertedItems || []).filter(it => it.qty > 0);
        for (const it of openingItems) {
          await sb.rpc("record_opening_transaction", {
            p_item_id: it.id, p_qty: it.qty, p_worker: state.profile?.full_name || "", p_note: "رصيد افتتاحي — استيراد Excel",
          });
        }
        if (openingItems.length) await loadTransactions();
        logAudit({ action: "استيراد أصناف من Excel", entity: "item", details: `تم استيراد ${validRows.length} صنف` });
        statusEl.innerHTML = `<span style="color:var(--green); font-weight:700;">✔ تم استيراد ${validRows.length} صنف بنجاح${skipped.length ? ` — تم تجاهل ${skipped.length} صف ناقص البيانات (السطور: ${skipped.slice(0, 10).join("، ")}${skipped.length > 10 ? "..." : ""})` : ""}</span>`;
        await loadItems();
        renderItemsAdmin(main);
        toast(`تم استيراد ${validRows.length} صنف`);
      }
    } catch (err) {
      statusEl.innerHTML = `<span style="color:var(--red); font-weight:700;">تعذرت قراءة الملف: ${escHtml(err.message)}</span>`;
    }
    e.target.value = "";
  };

  const drawCats = () => {
    $("#cat-chips").innerHTML = state.categories.map(c => `<span class="chip">${escHtml(c)}<button data-cat="${escHtml(c)}">${icon("x", 12)}</button></span>`).join("");
    $$("[data-cat]").forEach(b => b.onclick = async () => {
      if (!confirm(`حذف فئة "${b.dataset.cat}"؟ (لن يتأثر الأصناف الموجودة بها)`)) return;
      await sb.from("categories").delete().eq("name", b.dataset.cat);
      logAudit({ action: "حذف فئة", entity: "category", entityName: b.dataset.cat });
      await loadCategories(); renderItemsAdmin(main);
    });
  };
  drawCats();
  $("#add-cat").onclick = async () => {
    const val = $("#new-cat").value.trim();
    if (!val) { toast("أدخل اسم الفئة", true); return; }
    const { error } = await sb.from("categories").insert({ name: val, tenant_id: TENANT_ID });
    if (error) { toast("هذه الفئة موجودة بالفعل", true); return; }
    logAudit({ action: "إضافة فئة", entity: "category", entityName: val });
    await loadCategories(); renderItemsAdmin(main); toast("تمت إضافة الفئة");
  };

  const collapsedItemCats = new Set();
  let lastFilteredItems = [];
  const drawItems = () => {
    const q = ($("#items-search").value || "").toLowerCase().trim();
    const filtered = q ? state.items.filter(it => it.name.toLowerCase().includes(q) || (it.code || "").toLowerCase().includes(q)) : state.items;
    lastFilteredItems = filtered;
    const isNew = (it) => it.created_at && (Date.now() - new Date(it.created_at).getTime()) < 48 * 3600 * 1000; // آخر 48 ساعة
    if (!filtered.length) { $("#items-body").innerHTML = `<tr><td colspan="9"><div class="empty-note">لا توجد نتائج مطابقة.</div></td></tr>`; return; }
    const groups = {};
    filtered.forEach(it => { const c = it.category || "بدون فئة"; (groups[c] = groups[c] || []).push(it); });
    $("#items-body").innerHTML = Object.entries(groups).map(([catName, catItems]) => {
      const isCollapsed = collapsedItemCats.has(catName);
      return `
      <tr class="cat-row ${isCollapsed ? "is-collapsed" : ""}" data-icat-toggle="${escHtml(catName)}"><td colspan="9" style="background:var(--paper-deep); font-weight:800; font-size:12.5px; padding:8px 16px; border-top:2px solid var(--mustard);"><span class="cat-chevron">${icon("chevronDown", 13)}</span>${escHtml(catName)} <span style="font-weight:600; color:var(--ink50); font-size:11.5px;">(${catItems.length} صنف)</span></td></tr>
      ${catItems.map(it => `
      <tr data-icat-row="${escHtml(catName)}" style="${isCollapsed ? "display:none;" : ""}"><td class="mono" style="font-weight:700; color:var(--mustard);">${escHtml(it.code) || "—"}</td>
      <td style="font-weight:700;">${escHtml(it.name)} ${isNew(it) ? `<span class="pill pill-ok" style="margin-right:6px;">جديد</span>` : ""}</td>
      <td style="color:var(--ink70);">${escHtml(it.category) || "—"}</td><td>${escHtml(it.unit)}</td>
      <td class="mono">${it.qty}</td><td class="mono">${it.max_qty}</td>
      <td style="color:var(--ink70); font-size:12.5px;">${escHtml((state.suppliers.find(s => s.id === it.supplier_id) || {}).name) || "—"}</td>
      <td style="color:var(--ink70); font-size:12.5px;">${escHtml(it.storage_location) || "—"}</td>
      <td class="no-print"><div style="display:flex; gap:6px; justify-content:flex-end;">
        <button class="icon-btn" style="color:var(--green);" data-quick-add="${it.id}" title="إضافة كمية سريعًا">${icon("plus", 14)}</button>
        <button class="icon-btn" data-edit="${it.id}">${icon("pencil", 14)}</button>
        <button class="icon-btn" style="color:var(--red);" data-del="${it.id}">${icon("trash", 14)}</button>
      </div></td></tr>`).join("")}`;
    }).join("");
    $$("[data-edit]").forEach(b => b.onclick = () => openItemModal(state.items.find(i => i.id === b.dataset.edit)));
    $$("[data-quick-add]").forEach(b => b.onclick = () => openQuickAddQtyModal(state.items.find(i => i.id === b.dataset.quickAdd), main));
    $$("[data-del]").forEach(b => b.onclick = async () => {
      const it = state.items.find(i => i.id === b.dataset.del);
      if (!confirm(`حذف "${it.name}" نهائيًا؟`)) return;
      await sb.from("items").delete().eq("id", it.id);
      logAudit({ action: "حذف صنف", entity: "item", entityName: it.name });
      await loadItems(); renderItemsAdmin(main); toast("تم حذف الصنف");
    });
    $$("[data-icat-toggle]").forEach(row => row.onclick = () => {
      const cat = row.dataset.icatToggle;
      if (collapsedItemCats.has(cat)) collapsedItemCats.delete(cat); else collapsedItemCats.add(cat);
      row.classList.toggle("is-collapsed");
      $$(`[data-icat-row="${cat}"]`).forEach(r => r.style.display = collapsedItemCats.has(cat) ? "none" : "");
    });
  };
  drawItems();
  $("#items-search").oninput = drawItems;
  $("#new-item-btn").onclick = () => openItemModal(null);

  $("#items-print").onclick = () => window.print();
  $("#items-export").onclick = async () => {
    const btn = $("#items-export"); const origText = btn.innerHTML;
    try {
      btn.disabled = true; btn.innerHTML = "...جارِ التجهيز";
      await ensureXLSX();
      const rows = lastFilteredItems.map(it => ({
        "الكود": it.code || "", "الصنف": it.name, "الفئة": it.category || "", "الوحدة": it.unit,
        "الكمية الحالية": it.qty, "الحد الأقصى": it.max_qty,
        "المورد": (state.suppliers.find(s => s.id === it.supplier_id) || {}).name || "",
        "موقع التخزين": it.storage_location || "",
      }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(rows.length ? rows : [{ "ملاحظة": "لا توجد بيانات" }]), "قائمة الأصناف");
      XLSX.writeFile(wb, `قائمة_الأصناف_${new Date().toISOString().slice(0, 10)}.xlsx`);
    } catch (e) {
      toast("حدث خطأ أثناء تصدير Excel — " + (e && e.message ? e.message : ""), true);
    } finally {
      btn.disabled = false; btn.innerHTML = origText;
    }
  };
}

/* ---------------- إضافة كمية سريعة لصنف موجود بالفعل ---------------- */
function openQuickAddQtyModal(item, main) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box" style="max-width:360px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div style="font-weight:800; font-size:16px;">إضافة كمية سريعة</div>
        <button class="close-x" id="qa-close">${icon("x", 15)}</button>
      </div>
      <div style="font-size:13px; font-weight:700; margin-bottom:4px;">${escHtml(item.name)}</div>
      <div style="font-size:12px; color:var(--ink70); margin-bottom:14px;">المتوفر حاليًا: ${item.qty} ${escHtml(item.unit)}</div>
      <div class="field">
        <label>الكمية المضافة</label>
        <div class="step-row">
          <button class="step-btn" id="qa-minus">${icon("minus", 16)}</button>
          <input id="qa-qty" type="number" min="1" value="1" class="input mono" style="width:90px; text-align:center;">
          <button class="step-btn" id="qa-plus">${icon("plus", 16)}</button>
          <span style="color:var(--ink70); font-size:13px;">${escHtml(item.unit)}</span>
        </div>
      </div>
      <button class="btn-primary" id="qa-save" style="background:var(--green);">${icon("in", 16)} تأكيد الإضافة</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#qa-close", overlay).onclick = () => overlay.remove();
  $("#qa-minus", overlay).onclick = () => { const inp = $("#qa-qty", overlay); inp.value = Math.max(1, Number(inp.value) - 1); };
  $("#qa-plus", overlay).onclick = () => { const inp = $("#qa-qty", overlay); inp.value = Number(inp.value) + 1; };
  $("#qa-save", overlay).onclick = async () => {
    const qty = Number($("#qa-qty", overlay).value) || 0;
    if (qty <= 0) { toast("أدخل كمية أكبر من صفر", true); return; }
    const { data: moveData, error } = await sb.rpc("move_stock", {
      p_item_id: item.id, p_type: "in", p_qty: qty,
      p_worker: state.profile?.full_name || "", p_note: "إضافة سريعة",
    });
    if (error) { toast(error.message || "تعذر تحديث الكمية", true); return; }
    const newQty = (moveData && moveData[0] && moveData[0].new_qty != null) ? moveData[0].new_qty : item.qty + qty;
    logAudit({ action: "إدخال", entity: "item", entityName: item.name, qtyBefore: item.qty, qtyAfter: newQty, details: "إضافة سريعة" });
    overlay.remove();
    await Promise.all([loadItems(), loadTransactions()]);
    renderItemsAdmin(main);
    toast(`تم إضافة ${qty} ${item.unit} إلى "${item.name}"`);
  };
}

/* ---------------- الموردون (المدير وأمين المخزن) ---------------- */
async function renderSuppliers(main) {
  if (!_suppliersLoaded) { main.innerHTML = `<div class="empty-note">جاري تحميل بيانات الموردين...</div>`; await ensureSuppliers(); if (state.tab !== "suppliers") return; }
  main.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">${t("suppliersTitle")}</div><div class="section-sub">${t("suppliersSub")}</div></div>
      <button class="btn-dark" id="new-supplier-btn">${icon("plus", 15)} ${t("newSupplierBtn")}</button>
    </div>
    <div class="card" style="padding:0; overflow:hidden;">
      <table><thead><tr><th>${t("supplierName")}</th><th>${t("supplierPhone")}</th><th>${t("supplierEmail")}</th><th>${t("supplierNotes")}</th><th></th></tr></thead><tbody id="suppliers-body"></tbody></table>
    </div>`;

  const draw = () => {
    $("#suppliers-body").innerHTML = state.suppliers.length ? state.suppliers.map(s => `
      <tr>
        <td style="font-weight:700;">${escHtml(s.name)}</td>
        <td class="mono">${escHtml(s.phone) || "—"}</td>
        <td>${s.email || "—"}</td>
        <td style="color:var(--ink70);">${s.notes || "—"}</td>
        <td><div style="display:flex; gap:8px; justify-content:flex-end;">
          <button class="icon-btn" data-edit-sup="${s.id}">${icon("pencil", 14)}</button>
          <button class="icon-btn" style="color:var(--red);" data-del-sup="${s.id}">${icon("trash", 14)}</button>
        </div></td>
      </tr>`).join("") : `<tr><td colspan="5"><div class="empty-note">${t("noSuppliers")}</div></td></tr>`;
    $$("[data-edit-sup]").forEach(b => b.onclick = () => openSupplierModal(state.suppliers.find(s => s.id === b.dataset.editSup), main));
    $$("[data-del-sup]").forEach(b => b.onclick = async () => {
      const s = state.suppliers.find(x => x.id === b.dataset.delSup);
      if (!confirm(`حذف المورد "${s.name}"؟`)) return;
      await sb.from("suppliers").delete().eq("id", s.id);
      logAudit({ action: "حذف مورد", entity: "supplier", entityName: s.name });
      await loadSuppliers(); draw();
      toast("تم حذف المورد");
    });
  };
  draw();
  $("#new-supplier-btn").onclick = () => openSupplierModal(null, main);
}

function openSupplierModal(existing, main) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const form = existing ? { ...existing } : { name: "", phone: "", email: "", notes: "" };
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${existing ? t("edit") : t("newSupplierBtn")}</div>
        <button class="close-x" id="sup-close">${icon("x", 15)}</button>
      </div>
      <div class="field"><label>${t("supplierName")}</label><input id="sup-name" class="input" style="width:100%;" value="${escHtml(form.name)}"></div>
      <div class="field"><label>${t("supplierPhone")}</label><input id="sup-phone" class="input" style="width:100%;" value="${escHtml(form.phone) || ""}"></div>
      <div class="field"><label>${t("supplierEmail")}</label><input id="sup-email" class="input" style="width:100%;" value="${form.email || ""}"></div>
      <div class="field"><label>${t("supplierNotes")}</label><input id="sup-notes" class="input" style="width:100%;" value="${form.notes || ""}"></div>
      <button class="btn-primary" id="sup-save">${t("save")}</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#sup-close", overlay).onclick = () => overlay.remove();
  $("#sup-save", overlay).onclick = async () => {
    const payload = {
      name: $("#sup-name", overlay).value.trim(),
      phone: $("#sup-phone", overlay).value.trim(),
      email: $("#sup-email", overlay).value.trim(),
      notes: $("#sup-notes", overlay).value.trim(),
    };
    if (!payload.name) { toast("أدخل اسم المورد", true); return; }
    let error;
    if (existing) ({ error } = await sb.from("suppliers").update(payload).eq("id", existing.id));
    else ({ error } = await sb.from("suppliers").insert({ ...payload, tenant_id: TENANT_ID }));
    if (error) { toast("تعذر حفظ بيانات المورد — " + (error.message || "خطأ غير معروف"), true); return; }
    logAudit({ action: existing ? "تعديل مورد" : "إضافة مورد", entity: "supplier", entityName: payload.name });
    overlay.remove();
    await loadSuppliers();
    renderSuppliers(main);
    toast(existing ? "تم تحديث بيانات المورد" : "تمت إضافة المورد");
  };
}

/* ---------------- المواقع والمخازن ---------------- */
const WH_TYPE_KEYS = { raw_materials: "whTypeRaw", tools_spares: "whTypeTools", finished_products: "whTypeFinished", wip: "whTypeWip", general: "whTypeGeneral" };

async function renderWarehouses(main) {
  if (!_warehousesLoaded) { main.innerHTML = `<div class="empty-note">جاري تحميل بيانات المخازن...</div>`; await ensureWarehouses(); if (state.tab !== "warehouses") return; }

  main.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">${t("warehousesTitle")}</div><div class="section-sub">${t("warehousesSub")}</div></div>
      ${isAdmin() ? `<button class="btn-dark" id="new-site-btn">${icon("plus", 15)}${t("newSiteBtn")}</button>` : ""}
    </div>
    <div id="sites-list"></div>`;

  const draw = () => {
    const sites = state.sites;
    $("#sites-list").innerHTML = sites.length ? sites.map(s => {
      const whs = state.warehouses.filter(w => w.site_id === s.id);
      return `
      <div class="card" style="margin-bottom:16px; ${s.is_active ? "" : "opacity:.6;"}">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <div style="display:flex; align-items:center; gap:8px;">
            <div style="font-weight:800; font-size:14.5px;">${icon("warehouse", 16)} ${escHtml(s.name)}</div>
            ${s.is_default ? `<span class="chip chip-ok">${t("defaultTag")}</span>` : ""}
            ${!s.is_active ? `<span class="chip chip-critical">${t("inactiveTag")}</span>` : ""}
          </div>
          ${isAdmin() ? `
          <div style="display:flex; gap:8px;">
            <button class="icon-btn" data-add-wh="${s.id}" title="${t("newWarehouseBtn")}">${icon("plus", 14)}</button>
            <button class="icon-btn" data-edit-site="${s.id}" title="${t("edit")}">${icon("pencil", 14)}</button>
            <button class="icon-btn" style="color:${s.is_active ? "var(--red)" : "var(--green)"};" data-toggle-site="${s.id}" title="${s.is_active ? t("deactivateSite") : t("activateSite")}">${icon(s.is_active ? "x" : "check", 14)}</button>
          </div>` : ""}
        </div>
        ${s.address ? `<div style="font-size:12px; color:var(--ink70); margin-bottom:10px;">${escHtml(s.address)}</div>` : ""}
        ${whs.length ? `
        <table><thead><tr><th>${t("warehouseName")}</th><th>${t("warehouseCode")}</th><th>${t("warehouseType")}</th><th></th><th></th></tr></thead><tbody>
          ${whs.map(w => `
            <tr style="${w.is_active ? "" : "opacity:.55;"}">
              <td style="font-weight:700;">${escHtml(w.name)} ${w.is_default ? `<span class="chip chip-ok" style="margin-right:6px;">${t("defaultTag")}</span>` : ""} ${!w.is_active ? `<span class="chip chip-critical" style="margin-right:6px;">${t("inactiveTag")}</span>` : ""}</td>
              <td class="mono">${escHtml(w.code) || "—"}</td>
              <td>${t(WH_TYPE_KEYS[w.type] || "whTypeGeneral")}</td>
              <td>${w.allow_negative_stock ? `<span class="chip chip-warning">${t("warehouseAllowNegative")}</span>` : ""}</td>
              <td>${isAdmin() ? `
                <div style="display:flex; gap:8px; justify-content:flex-end;">
                  <button class="icon-btn" data-edit-wh="${w.id}">${icon("pencil", 14)}</button>
                  <button class="icon-btn" style="color:${w.is_active ? "var(--red)" : "var(--green)"};" data-toggle-wh="${w.id}" ${w.is_default ? `disabled title="المخزن الافتراضي لا يمكن تعطيله"` : `title="${w.is_active ? t("deactivateWarehouse") : t("activateWarehouse")}"`}>${icon(w.is_active ? "x" : "check", 14)}</button>
                </div>` : ""}</td>
            </tr>`).join("")}
        </tbody></table>` : `<div class="empty-note">${t("noWarehousesInSite")}</div>`}
      </div>`;
    }).join("") : `<div class="empty-note">${t("noSites")}</div>`;

    $$("[data-add-wh]").forEach(b => b.onclick = () => openWarehouseModal(null, b.dataset.addWh, main));
    $$("[data-edit-site]").forEach(b => b.onclick = () => openSiteModal(state.sites.find(s => s.id === b.dataset.editSite), main));
    $$("[data-edit-wh]").forEach(b => b.onclick = () => {
      const w = state.warehouses.find(x => x.id === b.dataset.editWh);
      openWarehouseModal(w, w.site_id, main);
    });
    $$("[data-toggle-site]").forEach(b => b.onclick = async () => {
      const s = state.sites.find(x => x.id === b.dataset.toggleSite);
      if (!confirm(`${s.is_active ? t("deactivateSite") : t("activateSite")} "${s.name}"؟`)) return;
      const { error } = await sb.from("sites").update({ is_active: !s.is_active }).eq("id", s.id);
      if (error) { toast("تعذر تنفيذ العملية — " + error.message, true); return; }
      logAudit({ action: s.is_active ? "تعطيل موقع" : "تفعيل موقع", entity: "site", entityName: s.name });
      await loadWarehousesData(); draw();
      toast("تم التحديث");
    });
    $$("[data-toggle-wh]").forEach(b => b.onclick = async () => {
      const w = state.warehouses.find(x => x.id === b.dataset.toggleWh);
      if (!confirm(`${w.is_active ? t("deactivateWarehouse") : t("activateWarehouse")} "${w.name}"؟`)) return;
      let error;
      if (w.is_active) ({ error } = await sb.rpc("deactivate_warehouse", { p_warehouse_id: w.id }));
      else ({ error } = await sb.from("warehouses").update({ is_active: true }).eq("id", w.id));
      if (error) { toast(error.message || "تعذر تنفيذ العملية", true); return; }
      logAudit({ action: w.is_active ? "تعطيل مخزن" : "تفعيل مخزن", entity: "warehouse", entityName: w.name });
      await loadWarehousesData(); draw();
      toast("تم التحديث");
    });
  };
  draw();
  const newSiteBtn = $("#new-site-btn");
  if (newSiteBtn) newSiteBtn.onclick = () => openSiteModal(null, main);
}

function openSiteModal(existing, main) {
  if (blockIfReadOnly()) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const form = existing ? { ...existing } : { name: "", address: "" };
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${existing ? t("edit") : t("newSiteBtn")}</div>
        <button class="close-x" id="site-close">${icon("x", 15)}</button>
      </div>
      <div class="field"><label>${t("siteName")}</label><input id="site-name" class="input" style="width:100%;" value="${escHtml(form.name)}"></div>
      <div class="field"><label>${t("siteAddress")}</label><input id="site-address" class="input" style="width:100%;" value="${escHtml(form.address || "")}"></div>
      <button class="btn-primary" id="site-save">${t("save")}</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#site-close", overlay).onclick = () => overlay.remove();
  $("#site-save", overlay).onclick = async () => {
    const payload = { name: $("#site-name", overlay).value.trim(), address: $("#site-address", overlay).value.trim() || null };
    if (!payload.name) { toast("أدخل اسم الموقع", true); return; }
    let error;
    if (existing) ({ error } = await sb.from("sites").update(payload).eq("id", existing.id));
    else ({ error } = await sb.from("sites").insert({ ...payload, tenant_id: TENANT_ID }));
    if (error) { toast("تعذر حفظ الموقع — " + (error.message.includes("duplicate") ? "فيه موقع بنفس الاسم موجود بالفعل" : error.message), true); return; }
    logAudit({ action: existing ? "تعديل موقع" : "إضافة موقع", entity: "site", entityName: payload.name });
    overlay.remove();
    await loadWarehousesData();
    renderWarehouses(main);
    toast(existing ? "تم تحديث الموقع" : "تمت إضافة الموقع");
  };
}

function openWarehouseModal(existing, siteId, main) {
  if (blockIfReadOnly()) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const form = existing ? { ...existing } : { name: "", code: "", type: "general", allow_negative_stock: false, site_id: siteId };
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${existing ? t("edit") : t("newWarehouseBtn")}</div>
        <button class="close-x" id="wh-close">${icon("x", 15)}</button>
      </div>
      <div class="field"><label>${t("warehouseName")}</label><input id="wh-name" class="input" style="width:100%;" value="${escHtml(form.name)}"></div>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1;"><label>${t("warehouseCode")}</label><input id="wh-code" class="input mono" style="width:100%;" value="${escHtml(form.code || "")}"></div>
        <div class="field" style="flex:1;">
          <label>${t("warehouseType")}</label>
          <select id="wh-type" class="input" style="width:100%;">
            ${Object.entries(WH_TYPE_KEYS).map(([val, key]) => `<option value="${val}" ${form.type === val ? "selected" : ""}>${t(key)}</option>`).join("")}
          </select>
        </div>
      </div>
      <div class="field" style="display:flex; align-items:center; gap:8px; flex-direction:row-reverse; justify-content:flex-end;">
        <label for="wh-negative" style="margin:0;">${t("warehouseAllowNegative")}</label>
        <input type="checkbox" id="wh-negative" ${form.allow_negative_stock ? "checked" : ""}>
      </div>
      <button class="btn-primary" id="wh-save">${t("save")}</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#wh-close", overlay).onclick = () => overlay.remove();
  $("#wh-save", overlay).onclick = async () => {
    const payload = {
      name: $("#wh-name", overlay).value.trim(),
      code: $("#wh-code", overlay).value.trim() || null,
      type: $("#wh-type", overlay).value,
      allow_negative_stock: $("#wh-negative", overlay).checked,
    };
    if (!payload.name) { toast("أدخل اسم المخزن", true); return; }
    let error;
    if (existing) ({ error } = await sb.from("warehouses").update(payload).eq("id", existing.id));
    else ({ error } = await sb.from("warehouses").insert({ ...payload, site_id: form.site_id, tenant_id: TENANT_ID }));
    if (error) { toast("تعذر حفظ المخزن — " + (error.message.includes("duplicate") ? "فيه مخزن بنفس الاسم أو الكود موجود بالفعل" : error.message), true); return; }
    logAudit({ action: existing ? "تعديل مخزن" : "إضافة مخزن", entity: "warehouse", entityName: payload.name });
    overlay.remove();
    await loadWarehousesData();
    renderWarehouses(main);
    toast(existing ? "تم تحديث المخزن" : "تمت إضافة المخزن");
  };
}

/* ---------------- الجرد ثلاثي المراحل ---------------- */
const SC_STATUS_META = {
  draft: { key: "scStatusDraft", chip: "" },
  primary_count: { key: "scStatusPrimary", chip: "chip-warning" },
  committee_review: { key: "scStatusCommittee", chip: "chip-warning" },
  pending_approval: { key: "scStatusPending", chip: "chip-critical" },
  approved: { key: "scStatusApproved", chip: "chip-ok" },
  cancelled: { key: "scStatusCancelled", chip: "chip-critical" },
};
const SC_TYPE_KEYS = { surprise: "scTypeSurprise", scheduled: "scTypeScheduled" };
const SC_RECUR_KEYS = { monthly: "scRecurMonthly", quarterly: "scRecurQuarterly", semi_annual: "scRecurSemiAnnual", annual: "scRecurAnnual" };
const SC_PATH_KEYS = { primary_only: "scPathPrimaryOnly", committee_only: "scPathCommitteeOnly", full: "scPathFull" };

function scWarehouseName(id) { return state.warehouses.find(w => w.id === id)?.name || "—"; }
function scMembersOf(sessionId, role) {
  return state.stockCountSessionMembers.filter(m => m.session_id === sessionId && m.member_role === role).map(m => m.user_id);
}
function scIsUserInRole(sessionId, role) { return scMembersOf(sessionId, role).includes(state.profile?.id); }

async function renderStockCount(main) {
  if (state.scDetail) { renderStockCountDetailView(main); return; }
  if (!_stockCountLoaded) { main.innerHTML = `<div class="empty-note">جاري تحميل بيانات الجرد...</div>`; await ensureStockCount(); if (state.tab !== "stockCount") return; }

  const pending = isAdmin() ? state.stockCountSessions.filter(s => s.status === "pending_approval") : [];

  main.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">${t("stockCountTitle")}</div><div class="section-sub">${t("stockCountSub")}</div></div>
      ${canEdit() ? `<button class="btn-dark" id="new-sc-btn">${icon("plus", 15)}${t("newStockCountBtn")}</button>` : ""}
    </div>
    ${pending.length ? `
    <div class="card" style="margin-bottom:16px; border-right:4px solid var(--red);">
      <div style="font-weight:800; margin-bottom:10px;">${icon("alert", 15)} ${t("myApprovalsTitle")} (${pending.length})</div>
      ${pending.map(s => `
        <div style="display:flex; justify-content:space-between; align-items:center; padding:8px 0; border-top:1px solid var(--ink12);">
          <div>${escHtml(scWarehouseName(s.warehouse_id))} — ${fmtDate(s.created_at)}</div>
          <button class="step-btn" style="width:auto; padding:4px 14px;" data-open-sc="${s.id}">فتح ومراجعة</button>
        </div>`).join("")}
    </div>` : ""}
    <div class="card" style="padding:0; overflow:hidden;">
      <table><thead><tr><th>${t("scWarehouse")}</th><th>${t("scCountType")}</th><th>${t("scScope")}</th><th>${t("scApprovalPath")}</th><th>الحالة</th><th>تاريخ الإنشاء</th><th></th></tr></thead>
      <tbody>
        ${state.stockCountSessions.length ? state.stockCountSessions.map(s => {
          const meta = SC_STATUS_META[s.status] || SC_STATUS_META.draft;
          return `<tr>
            <td style="font-weight:700;">${escHtml(scWarehouseName(s.warehouse_id))}</td>
            <td>${t(SC_TYPE_KEYS[s.count_type])}${s.recurrence ? " · " + t(SC_RECUR_KEYS[s.recurrence]) : ""}</td>
            <td>${s.scope === "full" ? t("scScopeFull") : t("scScopeSpecific")}</td>
            <td style="font-size:12px;">${t(SC_PATH_KEYS[s.approval_path])}</td>
            <td><span class="chip ${meta.chip}">${t(meta.key)}</span></td>
            <td class="mono" style="font-size:12px;">${fmtDate(s.created_at)}</td>
            <td><button class="icon-btn" data-open-sc="${s.id}">${icon("search", 14)}</button></td>
          </tr>`;
        }).join("") : `<tr><td colspan="7"><div class="empty-note">${t("noStockCountSessions")}</div></td></tr>`}
      </tbody></table>
    </div>`;

  $$("[data-open-sc]").forEach(b => b.onclick = () => openStockCountDetail(b.dataset.openSc, main));
  const newBtn = $("#new-sc-btn");
  if (newBtn) newBtn.onclick = () => openNewStockCountModal(main);
}

function openNewStockCountModal(main) {
  if (blockIfReadOnly()) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const activeWarehouses = state.warehouses.filter(w => w.is_active);
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${t("newStockCountBtn")}</div>
        <button class="close-x" id="sc-close">${icon("x", 15)}</button>
      </div>
      <div class="field"><label>${t("scWarehouse")}</label>
        <select id="sc-warehouse" class="input" style="width:100%;">
          ${activeWarehouses.map(w => `<option value="${w.id}">${escHtml(w.name)} — ${escHtml(scWarehouseName ? state.sites.find(s => s.id === w.site_id)?.name || "" : "")}</option>`).join("")}
        </select>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1;"><label>${t("scCountType")}</label>
          <select id="sc-type" class="input" style="width:100%;">
            <option value="surprise">${t("scTypeSurprise")}</option>
            <option value="scheduled">${t("scTypeScheduled")}</option>
          </select>
        </div>
        <div class="field" style="flex:1;"><label>${t("scRecurrence")}</label>
          <select id="sc-recur" class="input" style="width:100%;" disabled>
            <option value="">—</option>
            <option value="monthly">${t("scRecurMonthly")}</option>
            <option value="quarterly">${t("scRecurQuarterly")}</option>
            <option value="semi_annual">${t("scRecurSemiAnnual")}</option>
            <option value="annual">${t("scRecurAnnual")}</option>
          </select>
        </div>
      </div>
      <div class="field"><label>${t("scScope")}</label>
        <select id="sc-scope" class="input" style="width:100%;">
          <option value="full">${t("scScopeFull")}</option>
          <option value="specific_items">${t("scScopeSpecific")}</option>
        </select>
      </div>
      <div class="field hidden" id="sc-items-wrap">
        <label>الأصناف المشمولة</label>
        <select id="sc-items" class="input" style="width:100%; height:110px;" multiple>
          ${state.items.map(i => `<option value="${i.id}">${escHtml(i.name)}</option>`).join("")}
        </select>
      </div>
      ${isAdmin() ? `
      <div class="field"><label>${t("scApprovalPath")} (اختياري — لو سبته فاضي هياخد إعداد المخزن الافتراضي)</label>
        <select id="sc-path" class="input" style="width:100%;">
          <option value="">— افتراضي المخزن —</option>
          <option value="primary_only">${t("scPathPrimaryOnly")}</option>
          <option value="committee_only">${t("scPathCommitteeOnly")}</option>
          <option value="full">${t("scPathFull")}</option>
        </select>
      </div>` : ""}
      <div class="field"><label>${t("scPrimaryCounters")}</label>
        <select id="sc-primary" class="input" style="width:100%; height:80px;" multiple>
          ${state.profiles.filter(p => p.is_active).map(p => `<option value="${p.id}">${escHtml(p.full_name || p.username)}</option>`).join("")}
        </select>
      </div>
      ${isAdmin() ? `
      <div class="field"><label>${t("scCommitteeMembers")}</label>
        <select id="sc-committee" class="input" style="width:100%; height:80px;" multiple>
          ${state.profiles.filter(p => p.is_active).map(p => `<option value="${p.id}">${escHtml(p.full_name || p.username)}</option>`).join("")}
        </select>
      </div>` : ""}
      <div class="field" style="display:flex; align-items:center; gap:8px; flex-direction:row-reverse; justify-content:flex-end;">
        <label for="sc-hide" style="margin:0;">${t("scHideBookQty")}</label>
        <input type="checkbox" id="sc-hide">
      </div>
      <button class="btn-primary" id="sc-save">إنشاء الجلسة</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#sc-close", overlay).onclick = () => overlay.remove();
  $("#sc-type", overlay).onchange = (e) => { $("#sc-recur", overlay).disabled = e.target.value !== "scheduled"; };
  $("#sc-scope", overlay).onchange = (e) => { $("#sc-items-wrap", overlay).classList.toggle("hidden", e.target.value !== "specific_items"); };

  $("#sc-save", overlay).onclick = async () => {
    const scope = $("#sc-scope", overlay).value;
    const itemIds = scope === "specific_items" ? Array.from($("#sc-items", overlay).selectedOptions).map(o => o.value) : null;
    if (scope === "specific_items" && (!itemIds || !itemIds.length)) { toast("اختار صنف واحد على الأقل", true); return; }
    const primaryCounters = Array.from($("#sc-primary", overlay).selectedOptions).map(o => o.value);
    const committeeSelect = $("#sc-committee", overlay);
    const committeeMembers = committeeSelect ? Array.from(committeeSelect.selectedOptions).map(o => o.value) : [];
    const pathSelect = $("#sc-path", overlay);
    const path = pathSelect && pathSelect.value ? pathSelect.value : null;

    const { data: sessionId, error } = await sb.rpc("create_stock_count_session", {
      p_warehouse_id: $("#sc-warehouse", overlay).value,
      p_count_type: $("#sc-type", overlay).value,
      p_recurrence: $("#sc-recur", overlay).value || null,
      p_scope: scope,
      p_item_ids: itemIds,
      p_approval_path: path,
      p_hide_book_quantity: $("#sc-hide", overlay).checked,
      p_primary_counters: primaryCounters,
      p_committee_members: committeeMembers,
    });
    if (error) { toast(error.message || "تعذر إنشاء جلسة الجرد", true); return; }
    logAudit({ action: "إنشاء جلسة جرد", entity: "stock_count_session", entityName: scWarehouseName($("#sc-warehouse", overlay).value) });
    overlay.remove();
    _stockCountLoaded = false;
    await ensureStockCount();
    await openStockCountDetail(sessionId, main);
    toast("تم إنشاء جلسة الجرد");
  };
}

async function openStockCountDetail(sessionId, main) {
  const session = state.stockCountSessions.find(s => s.id === sessionId);
  if (!session) { toast("جلسة الجرد غير موجودة", true); return; }
  const [{ data: items, error: itemsErr }, { data: transit }] = await Promise.all([
    sb.rpc("get_stock_count_items", { p_session_id: sessionId }),
    sb.rpc("get_stock_count_in_transit", { p_session_id: sessionId }),
  ]);
  if (itemsErr) { toast(itemsErr.message || "تعذر تحميل تفاصيل الجلسة", true); return; }
  state.scDetail = { session, items: items || [], transit: transit || [] };
  renderStockCountDetailView(main);
}

function scVarianceCell(row, session) {
  const finalQty = session.approval_path === "primary_only" ? row.primary_quantity : row.committee_quantity;
  if (finalQty == null || row.system_quantity == null) return "—";
  const diff = finalQty - row.system_quantity;
  const color = diff === 0 ? "var(--ink70)" : (diff > 0 ? "var(--green)" : "var(--red)");
  return `<span style="color:${color}; font-weight:700;">${diff > 0 ? "+" : ""}${diff}</span>`;
}

function renderStockCountDetailView(main) {
  const { session, items, transit } = state.scDetail;
  const isPrimary = scIsUserInRole(session.id, "primary_counter");
  const isCommittee = scIsUserInRole(session.id, "committee_member");
  const admin = isAdmin();
  const canActPrimary = (isPrimary || admin) && session.status === "primary_count";
  const canActCommittee = (isCommittee || admin) && session.status === "committee_review";
  const canStart = (isPrimary || isCommittee || admin) && session.status === "draft";

  const itemLabel = (row) => row.item_id ? escHtml(state.items.find(i => i.id === row.item_id)?.name || "—") : `<em>${escHtml(row.unregistered_item_note || "صنف غير مسجَّل")}</em>`;

  main.innerHTML = `
    <div class="section-header">
      <div>
        <button class="step-btn" style="width:auto; padding:4px 12px; margin-bottom:8px;" id="sc-back">${icon("history", 13)} ${t("scBackToList")}</button>
        <div class="section-title">${escHtml(scWarehouseName(session.warehouse_id))}</div>
        <div class="section-sub">${t(SC_TYPE_KEYS[session.count_type])} · ${t(SC_PATH_KEYS[session.approval_path])} · <span class="chip ${SC_STATUS_META[session.status].chip}">${t(SC_STATUS_META[session.status].key)}</span></div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:800; margin-bottom:10px;">${t("scInTransitTitle")}</div>
      ${transit.length ? transit.map(tr => `
        <div style="display:flex; justify-content:space-between; padding:6px 0; border-top:1px solid var(--ink12); font-size:13px;">
          <div>${escHtml(state.items.find(i => i.id === tr.item_id)?.name || "—")}</div>
          <div>${tr.direction === "outgoing" ? t("scInTransitOut") : t("scInTransitIn")} ${escHtml(tr.related_warehouse_name)} — <span class="mono">${tr.quantity}</span></div>
        </div>`).join("") : `<div class="empty-note">${t("noInTransit")}</div>`}
    </div>

    ${session.status === "draft" ? `
    <div class="card" style="margin-bottom:16px; text-align:center;">
      ${canStart ? `<button class="btn-primary" id="sc-start-btn">${t("scStartBtn")}</button>` : `<div class="empty-note">لسه الجلسة ما بدأتش — محتاجة أمين مخزن أو عضو لجنة مكلَّف يبدأها</div>`}
    </div>` : `
    <div class="card" style="padding:0; overflow:hidden; margin-bottom:16px;">
      <table><thead><tr>
        <th>${t("scColItem")}</th><th>${t("scColSystem")}</th>
        <th>${t("scColPrimary")}</th>
        ${session.approval_path !== "primary_only" ? `<th>${t("scColCommittee")}</th>` : ""}
        ${session.status === "pending_approval" || session.status === "approved" ? `<th>${t("scColVariance")}</th>` : ""}
      </tr></thead><tbody>
        ${items.map(row => `
          <tr>
            <td style="font-weight:700;">${itemLabel(row)}</td>
            <td class="mono">${row.system_quantity === null ? `<span style="color:var(--ink50); font-size:11px;">${t("scHiddenQty")}</span>` : row.system_quantity}</td>
            <td class="mono">
              ${canActPrimary
                ? `<input type="number" class="input mono" style="width:90px;" data-primary-qty="${row.item_id}" value="${row.primary_quantity ?? ""}">`
                : (row.primary_quantity ?? "—")}
            </td>
            ${session.approval_path !== "primary_only" ? `
            <td class="mono">
              ${canActCommittee
                ? `<input type="number" class="input mono" style="width:90px;" data-committee-qty="${row.item_id}" value="${row.committee_quantity ?? ""}">`
                : (row.committee_quantity ?? "—")}
            </td>` : ""}
            ${session.status === "pending_approval" || session.status === "approved" ? `<td>${scVarianceCell(row, session)}</td>` : ""}
          </tr>`).join("")}
      </tbody></table>
    </div>
    <div style="display:flex; gap:10px; justify-content:flex-end;">
      ${canActPrimary ? `<button class="btn-primary" id="sc-submit-primary">${t("scSubmitPrimaryBtn")}</button>` : ""}
      ${canActCommittee ? `<button class="btn-primary" id="sc-submit-committee">${t("scSubmitCommitteeBtn")}</button>` : ""}
      ${admin && session.status === "pending_approval" ? `
        <button class="step-btn" style="width:auto; padding:8px 16px; color:var(--red);" id="sc-reject">${t("scRejectBtn")}</button>
        <button class="btn-primary" style="background:var(--green);" id="sc-approve">${t("scApproveBtn")}</button>` : ""}
    </div>`}
  `;

  $("#sc-back").onclick = () => { state.scDetail = null; renderStockCount(main); };

  const startBtn = $("#sc-start-btn");
  if (startBtn) startBtn.onclick = async () => {
    const { error } = await sb.rpc("advance_stock_count_session", { p_session_id: session.id, p_action: "start" });
    if (error) { toast(error.message, true); return; }
    _stockCountLoaded = false; await ensureStockCount();
    await openStockCountDetail(session.id, main);
  };

  // حفظ فوري لكل صف عند الخروج من الحقل (blur) — أسهل من انتظار زرار حفظ منفصل لكل سطر
  $$("[data-primary-qty]").forEach(inp => inp.onblur = async () => {
    const val = Number(inp.value);
    if (inp.value === "" || Number.isNaN(val)) return;
    const { error } = await sb.rpc("record_stock_count_item", { p_session_id: session.id, p_item_id: inp.dataset.primaryQty, p_quantity: val, p_entry_method: "manual" });
    if (error) toast(error.message, true);
  });
  $$("[data-committee-qty]").forEach(inp => inp.onblur = async () => {
    const val = Number(inp.value);
    if (inp.value === "" || Number.isNaN(val)) return;
    const { error } = await sb.rpc("record_stock_count_item", { p_session_id: session.id, p_item_id: inp.dataset.committeeQty, p_quantity: val, p_entry_method: "manual" });
    if (error) toast(error.message, true);
  });

  const submitPrimaryBtn = $("#sc-submit-primary");
  if (submitPrimaryBtn) submitPrimaryBtn.onclick = async () => {
    if (!confirm("تأكيد إقفال الجرد الأولي؟ مش هتقدر تعدّل بعد كده.")) return;
    const { error } = await sb.rpc("advance_stock_count_session", { p_session_id: session.id, p_action: "submit" });
    if (error) { toast(error.message || t("scNotAllCounted"), true); return; }
    _stockCountLoaded = false; await ensureStockCount();
    await openStockCountDetail(session.id, main);
    toast("تم إقفال الجرد الأولي");
  };
  const submitCommitteeBtn = $("#sc-submit-committee");
  if (submitCommitteeBtn) submitCommitteeBtn.onclick = async () => {
    if (!confirm("تأكيد إقفال مراجعة اللجنة؟")) return;
    const { error } = await sb.rpc("advance_stock_count_session", { p_session_id: session.id, p_action: "submit" });
    if (error) { toast(error.message || t("scNotAllCounted"), true); return; }
    _stockCountLoaded = false; await ensureStockCount();
    await openStockCountDetail(session.id, main);
    toast("تم إقفال مراجعة اللجنة");
  };
  const approveBtn = $("#sc-approve");
  if (approveBtn) approveBtn.onclick = async () => {
    if (!confirm("تأكيد الاعتماد؟ هيتم تطبيق تسوية المخزون فورًا ولا يمكن التراجع.")) return;
    const { error } = await sb.rpc("advance_stock_count_session", { p_session_id: session.id, p_action: "approve" });
    if (error) { toast(error.message, true); return; }
    logAudit({ action: "اعتماد جرد", entity: "stock_count_session", entityName: scWarehouseName(session.warehouse_id) });
    _stockCountLoaded = false; await ensureStockCount();
    await Promise.all([loadItems(), loadWarehousesData()]);
    state.scDetail = null;
    renderStockCount(main);
    toast("تم اعتماد الجرد وتطبيق التسوية على المخزون");
  };
  const rejectBtn = $("#sc-reject");
  if (rejectBtn) rejectBtn.onclick = async () => {
    const reason = (prompt(t("scRejectReasonPrompt")) || "").trim();
    if (!reason) { toast("لازم تكتب سبب الرفض", true); return; }
    const { error } = await sb.rpc("advance_stock_count_session", { p_session_id: session.id, p_action: "reject", p_note: reason });
    if (error) { toast(error.message, true); return; }
    logAudit({ action: "رفض جرد", entity: "stock_count_session", entityName: scWarehouseName(session.warehouse_id), details: reason });
    _stockCountLoaded = false; await ensureStockCount();
    await openStockCountDetail(session.id, main);
    toast("تم إعادة الجلسة للمراجعة");
  };
}

/* ---------------- شاشة إدارة مستخدمي تيليجرام (للمدير فقط) ---------------- */
async function renderTelegramUsers(main) {
  if (!_profilesLoaded) await ensureProfiles();

  // اسم البوت (@username) بقى مخزّن مباشرة في tenant_settings وقت حفظ
  // التوكن (في manage-secrets) — مفيش داعي نتحقق من التوكن تاني في كل مرة
  // نفتح فيها الشاشة دي، لأن التوكن نفسه أصلاً مش متاح للفرونت إند خالص
  const botUsername = state.settings.telegram_bot_username || null;
  const botLink = botUsername ? `https://t.me/${botUsername}` : null;

  main.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">${t("telegramTitle")}</div><div class="section-sub">${t("telegramSub")}</div></div>
      <div style="display:flex; gap:8px;">
        <button class="btn-dark" id="tg-broadcast-btn">${icon("send", 14)} بث رسالة</button>
      </div>
    </div>

    ${!botUsername ? `
      <div class="card" style="margin-bottom:18px;">
        <div style="color:var(--ink70); font-size:13px;">لازم تحط توكن بوت تليجرام في تبويب "${t("navSettings")}" الأول.</div>
      </div>` : `
      <div class="card" style="margin-bottom:18px;">
        ${botLink ? `
          <div style="font-size:13px; margin-bottom:10px;">شارك الرابط ده مع أي حد عايز يستقبل الإشعارات — يضغط عليه، وبعدين Start، ويتسجل تلقائيًا:</div>
          <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center;">
            <code style="background:var(--paper); padding:8px 12px; border-radius:8px; font-size:12.5px;">${botLink}</code>
            <button class="btn-dark" id="tg-copy-bot-link" type="button">نسخ</button>
          </div>` : `<div style="color:var(--red); font-size:13px;">تعذر التحقق من توكن البوت — راجعه في الإعدادات.</div>`}

        <div style="margin-top:16px; padding-top:16px; border-top:1px solid var(--border);">
          <label style="display:block; margin-bottom:8px; font-weight:700; font-size:13px;">${t("telegramGenLink")}</label>
          <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <select id="tg-link-user-select" class="input" style="flex:1; min-width:200px;">
              ${(state.profiles || []).map(p => `<option value="${p.id}">${escHtml(p.full_name || p.username || p.id)}</option>`).join("")}
            </select>
            <button class="btn-primary" id="tg-gen-link-btn" type="button">${t("telegramGenLinkBtn")}</button>
          </div>
          <div id="tg-gen-link-result" style="margin-top:10px; font-size:12.5px;"></div>
        </div>
      </div>

      <div class="card" style="margin-bottom:18px;">
        <div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:12px;">
          <div style="font-weight:800; font-size:14px;">${icon("grid", 15)} المجموعات</div>
          <button class="btn-dark" id="tg-new-group-btn" style="padding:6px 12px; font-size:12.5px;">${icon("plus", 13)} مجموعة جديدة</button>
        </div>
        <div id="tg-groups-list">
          ${!state.telegramGroups?.length ? `<div style="color:var(--ink50); font-size:13px;">لا توجد مجموعات بعد.</div>` : state.telegramGroups.map(g => `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 0; border-bottom:1px solid var(--border);">
              <div>
                <div style="font-weight:700; font-size:13.5px;">${escHtml(g.name)}</div>
                <div style="font-size:11.5px; color:var(--ink50);">${(g.member_ids || []).length} عضو</div>
              </div>
              <div style="display:flex; gap:6px;">
                <button class="btn-dark" data-group-manage="${g.id}" style="padding:5px 10px; font-size:11.5px;">إدارة الأعضاء</button>
                <button class="icon-btn" style="color:var(--red);" data-group-del="${g.id}">${icon("trash", 14)}</button>
              </div>
            </div>`).join("")}
        </div>
      </div>`}

    <div class="card">
      ${!state.telegramUsers.length ? `<div class="empty-note">${t("telegramNoUsers")}</div>` : `
      <div style="overflow-x:auto;">
        <table class="table">
          <thead><tr>
            <th>${t("fullNameLabel")}</th><th>Username</th><th>${t("status")}</th>
            <th>${t("telegramRole")}</th><th>حرج</th><th>منخفض</th><th>يومي</th><th>${t("telegramLastSeen")}</th><th></th>
          </tr></thead>
          <tbody>
            ${state.telegramUsers.map(u => `
              <tr>
                <td>${escHtml([u.first_name, u.last_name].filter(Boolean).join(" ")) || "—"}</td>
                <td>${u.username ? "@" + escHtml(u.username) : "—"}</td>
                <td>${u.is_active ? `<span class="chip chip-ok">${t("telegramActive")}</span>` : `<span class="chip chip-critical">${t("telegramBlocked")}</span>`}</td>
                <td>
                  <select class="input" data-tg-role="${u.id}" style="min-width:150px;">
                    <option value="">${t("telegramNoRole")}</option>
                    ${Object.keys(ROLE_LABELS).map(r => `<option value="${r}" ${u.role === r ? "selected" : ""}>${ROLE_LABELS[r]}</option>`).join("")}
                  </select>
                </td>
                <td><button class="pill ${u.notify_critical ? "pill-critical" : ""}" data-tg-notify="notify_critical" data-id="${u.id}" style="border:none; cursor:pointer;">${u.notify_critical ? "✓" : "—"}</button></td>
                <td><button class="pill ${u.notify_low ? "pill-warning" : ""}" data-tg-notify="notify_low" data-id="${u.id}" style="border:none; cursor:pointer;">${u.notify_low ? "✓" : "—"}</button></td>
                <td><button class="pill ${u.notify_daily_report ? "pill-ok" : ""}" data-tg-notify="notify_daily_report" data-id="${u.id}" style="border:none; cursor:pointer;">${u.notify_daily_report ? "✓" : "—"}</button></td>
                <td style="white-space:nowrap;">${u.last_seen_at ? fmtDate(u.last_seen_at) : "—"}</td>
                <td>
                  <button class="icon-btn" data-tg-toggle="${u.id}" data-active="${u.is_active}" title="${u.is_active ? t("telegramBlocked") : t("telegramActive")}">${icon(u.is_active ? "x" : "check", 14)}</button>
                </td>
              </tr>`).join("")}
          </tbody>
        </table>
      </div>`}
    </div>
  `;

  const copyBtn = $("#tg-copy-bot-link");
  if (copyBtn) copyBtn.onclick = () => { navigator.clipboard.writeText(botLink); toast("تم نسخ الرابط"); };

  const genBtn = $("#tg-gen-link-btn");
  if (genBtn) genBtn.onclick = async () => {
    const profileId = $("#tg-link-user-select").value;
    const resultEl = $("#tg-gen-link-result");
    if (!profileId) return;
    genBtn.disabled = true; genBtn.textContent = "...";
    const token = crypto.randomUUID().replace(/-/g, "");
    const expires = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
    const { error } = await sb.from("telegram_link_tokens").insert({ token, tenant_id: TENANT_ID, profile_id: profileId, expires_at: expires });
    genBtn.disabled = false; genBtn.textContent = t("telegramGenLinkBtn");
    if (error) { toast("تعذر توليد الرابط — " + error.message, true); return; }
    const link = `${botLink}?start=${token}`;
    resultEl.innerHTML = `<div style="color:var(--ink70); margin-bottom:6px;">${t("telegramLinkGenerated")}</div><code style="background:var(--paper); padding:8px 12px; border-radius:8px; display:inline-block;">${link}</code>`;
  };

  $$("[data-tg-role]").forEach(sel => sel.onchange = async () => {
    const id = sel.dataset.tgRole;
    const role = sel.value || null;
    const { error } = await sb.from("telegram_users").update({ role }).eq("id", id);
    if (error) { toast("تعذر حفظ الدور — " + error.message, true); return; }
    const u = state.telegramUsers.find(x => x.id === id); if (u) u.role = role;
    toast("تم تحديث الدور");
  });

  $$("[data-tg-notify]").forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.id, col = btn.dataset.tgNotify;
    const u = state.telegramUsers.find(x => x.id === id);
    const { error } = await sb.from("telegram_users").update({ [col]: !u[col] }).eq("id", id);
    if (error) { toast("تعذر التحديث — " + error.message, true); return; }
    u[col] = !u[col];
    renderTelegramUsers(main);
  });

  $$("[data-tg-toggle]").forEach(btn => btn.onclick = async () => {
    const id = btn.dataset.tgToggle;
    const isActive = btn.dataset.active === "true";
    const { error } = await sb.from("telegram_users").update({ is_active: !isActive, blocked_at: !isActive ? null : new Date().toISOString() }).eq("id", id);
    if (error) { toast("تعذر تحديث الحالة — " + error.message, true); return; }
    await loadTelegramUsers();
    renderTelegramUsers(main);
  });

  $("#tg-broadcast-btn").onclick = () => openBroadcastModal(main);

  $("#tg-new-group-btn").onclick = async () => {
    const name = prompt("اسم المجموعة الجديدة:");
    if (!name || !name.trim()) return;
    const { error } = await sb.from("telegram_groups").insert({ tenant_id: TENANT_ID, name: name.trim() });
    if (error) { toast("تعذر إنشاء المجموعة — " + error.message, true); return; }
    await loadTelegramGroups();
    renderTelegramUsers(main);
    toast("تم إنشاء المجموعة");
  };

  $$("[data-group-del]").forEach(btn => btn.onclick = async () => {
    const group = state.telegramGroups.find(g => g.id === btn.dataset.groupDel);
    if (!confirm(`حذف مجموعة "${group?.name}"؟`)) return;
    const { error } = await sb.from("telegram_groups").delete().eq("id", btn.dataset.groupDel);
    if (error) { toast("تعذر الحذف — " + error.message, true); return; }
    await loadTelegramGroups();
    renderTelegramUsers(main);
    toast("تم حذف المجموعة");
  });

  $$("[data-group-manage]").forEach(btn => btn.onclick = () => openGroupMembersModal(btn.dataset.groupManage, main));
}

function openGroupMembersModal(groupId, main) {
  const group = state.telegramGroups.find(g => g.id === groupId);
  if (!group) return;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box" style="width:480px; max-width:92vw;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div style="font-weight:800; font-size:16px;">أعضاء "${escHtml(group.name)}"</div>
        <button class="close-x" id="gm-close">${icon("x", 15)}</button>
      </div>
      <div style="max-height:50vh; overflow:auto; display:flex; flex-direction:column; gap:6px;">
        ${!state.telegramUsers.length ? `<div class="empty-note">لا يوجد مستخدمو تيليجرام مسجّلين بعد</div>` : state.telegramUsers.map(u => `
          <label style="display:flex; align-items:center; gap:10px; padding:8px 10px; border-radius:8px; cursor:pointer;" onmouseover="this.style.background='var(--paper)'" onmouseout="this.style.background='transparent'">
            <input type="checkbox" data-member="${u.id}" ${group.member_ids.includes(u.id) ? "checked" : ""}>
            <span>${escHtml([u.first_name, u.last_name].filter(Boolean).join(" ")) || (u.username ? "@" + escHtml(u.username) : u.id)}</span>
          </label>`).join("")}
      </div>
      <button class="btn-primary" id="gm-save" style="margin-top:16px;">حفظ</button>
    </div>`;
  document.body.appendChild(overlay);
  $("#gm-close", overlay).onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  $("#gm-save", overlay).onclick = async () => {
    const btn = $("#gm-save", overlay); btn.disabled = true; btn.textContent = "...جارِ الحفظ";
    const checked = $$("[data-member]", overlay).filter(c => c.checked).map(c => c.dataset.member);
    const toAdd = checked.filter(id => !group.member_ids.includes(id));
    const toRemove = group.member_ids.filter(id => !checked.includes(id));

    if (toAdd.length) await sb.from("telegram_group_members").insert(toAdd.map(id => ({ group_id: groupId, telegram_user_id: id })));
    if (toRemove.length) await sb.from("telegram_group_members").delete().eq("group_id", groupId).in("telegram_user_id", toRemove);

    await loadTelegramGroups();
    overlay.remove();
    renderTelegramUsers(main);
    toast("تم حفظ أعضاء المجموعة");
  };
}

function openBroadcastModal(main) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box" style="width:480px; max-width:92vw;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:14px;">
        <div style="font-weight:800; font-size:16px;">${icon("send", 16)} بث رسالة</div>
        <button class="close-x" id="bc-close">${icon("x", 15)}</button>
      </div>
      <div class="field">
        <label>الجمهور المستهدف</label>
        <select id="bc-target-mode" class="input" style="width:100%;">
          <option value="all">كل المسجّلين في تيليجرام</option>
          <option value="role">دور معيّن</option>
          <option value="group">مجموعة معيّنة</option>
        </select>
      </div>
      <div class="field" id="bc-role-field" style="display:none;">
        <label>الدور</label>
        <select id="bc-role" class="input" style="width:100%;">
          ${Object.keys(ROLE_LABELS).map(r => `<option value="${r}">${ROLE_LABELS[r]}</option>`).join("")}
        </select>
      </div>
      <div class="field" id="bc-group-field" style="display:none;">
        <label>المجموعة</label>
        <select id="bc-group" class="input" style="width:100%;">
          ${state.telegramGroups.map(g => `<option value="${g.id}">${escHtml(g.name)}</option>`).join("")}
        </select>
      </div>
      <div class="field">
        <label>نص الرسالة</label>
        <textarea id="bc-message" class="input" style="width:100%; min-height:100px;" placeholder="اكتب رسالتك هنا..."></textarea>
      </div>
      <button class="btn-primary" id="bc-send">${icon("send", 15)} إرسال الآن</button>
    </div>`;
  document.body.appendChild(overlay);
  $("#bc-close", overlay).onclick = () => overlay.remove();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  $("#bc-target-mode", overlay).onchange = () => {
    const mode = $("#bc-target-mode", overlay).value;
    $("#bc-role-field", overlay).style.display = mode === "role" ? "" : "none";
    $("#bc-group-field", overlay).style.display = mode === "group" ? "" : "none";
  };

  $("#bc-send", overlay).onclick = async () => {
    const message = $("#bc-message", overlay).value.trim();
    if (!message) { toast("اكتب نص الرسالة الأول", true); return; }
    const mode = $("#bc-target-mode", overlay).value;
    let target = { mode: "all" };
    if (mode === "role") target = { mode: "role", role: $("#bc-role", overlay).value };
    if (mode === "group") {
      const groupId = $("#bc-group", overlay).value;
      if (!groupId) { toast("لازم تختار مجموعة", true); return; }
      target = { mode: "group", groupId };
    }
    const btn = $("#bc-send", overlay); btn.disabled = true; btn.textContent = "...جارِ الإرسال";
    const res = await callSendTelegram({ type: "manual", target, message });
    btn.disabled = false; btn.innerHTML = `${icon("send", 15)} إرسال الآن`;
    if (res.error) { toast("فشل الإرسال — " + res.error, true); return; }
    overlay.remove();
    logAudit({ action: "بث رسالة تيليجرام", entity: "notification", details: `${res.sent} نجح، ${res.failed} فشل` });
    toast(`تم الإرسال: ${res.sent} نجح، ${res.failed} فشل، ${res.blocked} محظور (من إجمالي ${res.total})`);
  };
}

/* ---------------- شاشة إدارة مستلمي الإيميل (للمدير فقط) ---------------- */
async function renderEmailRecipients(main) {
  if (!_profilesLoaded) { main.innerHTML = `<div class="empty-note">جاري التحميل...</div>`; await ensureProfiles(); if (state.tab !== "emailRecipients") return; }
  const registeredEmails = new Set(state.emailRecipients.map(r => r.email.toLowerCase()));
  const importCandidates = (state.profiles || []).filter(p => p.contact_email && !registeredEmails.has(p.contact_email.toLowerCase()));

  main.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">مستلمو الإيميل</div><div class="section-sub">حدّد لكل إيميل بالضبط أي نوع رسائل يوصله</div></div>
    </div>
    ${importCandidates.length ? `
    <div class="card" style="margin-bottom:18px; max-width:640px; background:var(--paper);">
      <div class="card-title" style="margin-bottom:6px;">${icon("check", 16)} مستخدمون عندهم بريد إلكتروني مسجّل ومش مضافين هنا لسه</div>
      <div style="font-size:11.5px; color:var(--ink70); margin-bottom:10px;">دي إيميلات موجودة في "${t("navUsers")}" — إضافتهم هنا اختيارية، عشان تتحكم بدقة مين يوصله إيه.</div>
      ${importCandidates.map(p => `
        <div style="display:flex; align-items:center; justify-content:space-between; padding:6px 0; border-bottom:1px solid var(--paper-deep);">
          <div><span style="font-weight:700; font-size:13px;">${escHtml(p.full_name) || escHtml(p.username) || "—"}</span> <span style="color:var(--ink50); font-size:12px;">${escHtml(p.contact_email)}</span></div>
          <button class="btn-dark" style="padding:4px 12px; font-size:11.5px;" data-import-er="${p.id}" data-import-email="${escHtml(p.contact_email)}" data-import-name="${escHtml(p.full_name || p.username || "")}">${icon("plus", 12)} إضافة</button>
        </div>`).join("")}
      ${importCandidates.length > 1 ? `<button class="btn-dark" style="margin-top:10px;" id="er-import-all">${icon("plus", 13)} إضافة الكل (${importCandidates.length})</button>` : ""}
    </div>` : ""}
    <div class="card" style="margin-bottom:18px; max-width:640px;">
      <div class="card-title">${icon("plus", 16)} إضافة مستلم جديد</div>
      <div style="display:flex; gap:10px; flex-wrap:wrap;">
        <div class="field" style="flex:1; min-width:160px;"><label>الاسم (اختياري)</label><input id="er-name" class="input" style="width:100%;" placeholder="مثال: أحمد محمد"></div>
        <div class="field" style="flex:1; min-width:200px;"><label>البريد الإلكتروني</label><input id="er-email" type="email" class="input" style="width:100%;" placeholder="example@domain.com"></div>
      </div>
      <div style="display:flex; gap:18px; flex-wrap:wrap; margin:10px 0 16px;">
        <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="er-critical" checked> تنبيه مخزون حرج</label>
        <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="er-low" checked> تنبيه مخزون منخفض</label>
        <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="er-daily" checked> التقرير اليومي</label>
      </div>
      <button class="btn-dark" id="er-add">${icon("plus", 14)} إضافة المستلم</button>
    </div>
    <div class="card" style="padding:0; overflow:hidden;">
      <table><thead><tr><th>الاسم</th><th>الإيميل</th><th>حرج</th><th>منخفض</th><th>التقرير اليومي</th><th>الحالة</th><th></th></tr></thead><tbody id="er-body"></tbody></table>
    </div>`;

  async function importRecipient(name, email) {
    const { data, error } = await sb.from("email_recipients").insert({ tenant_id: TENANT_ID, name: name || null, email, notify_critical: true, notify_low: true, notify_daily_report: true }).select().single();
    if (error) { toast(error.message.includes("duplicate") ? "هذا الإيميل مضاف بالفعل" : "تعذر الإضافة — " + error.message, true); return false; }
    state.emailRecipients.push(data);
    return true;
  }
  $$("[data-import-er]").forEach(b => b.onclick = async () => {
    b.disabled = true;
    if (await importRecipient(b.dataset.importName, b.dataset.importEmail)) { toast("تمت الإضافة"); renderEmailRecipients(main); }
    else b.disabled = false;
  });
  if ($("#er-import-all")) $("#er-import-all").onclick = async () => {
    $("#er-import-all").disabled = true;
    for (const p of importCandidates) await importRecipient(p.full_name || p.username, p.contact_email);
    toast("تمت إضافة الكل");
    renderEmailRecipients(main);
  };

  const draw = () => {
    $("#er-body").innerHTML = state.emailRecipients.length ? state.emailRecipients.map(r => `
      <tr>
        <td style="font-weight:700;">${escHtml(r.name) || "—"}</td>
        <td class="mono" style="color:var(--ink70);">${escHtml(r.email)}</td>
        <td><button class="pill ${r.notify_critical ? "pill-critical" : ""}" data-toggle-col="notify_critical" data-id="${r.id}" style="border:none; cursor:pointer;">${r.notify_critical ? "✓ مفعّل" : "متوقف"}</button></td>
        <td><button class="pill ${r.notify_low ? "pill-warning" : ""}" data-toggle-col="notify_low" data-id="${r.id}" style="border:none; cursor:pointer;">${r.notify_low ? "✓ مفعّل" : "متوقف"}</button></td>
        <td><button class="pill ${r.notify_daily_report ? "pill-ok" : ""}" data-toggle-col="notify_daily_report" data-id="${r.id}" style="border:none; cursor:pointer;">${r.notify_daily_report ? "✓ مفعّل" : "متوقف"}</button></td>
        <td><button data-toggle-active="${r.id}" class="pill ${r.is_active ? "pill-ok" : "pill-critical"}" style="border:none; cursor:pointer;">${r.is_active ? "نشط" : "موقوف"}</button></td>
        <td><div style="display:flex; gap:6px; justify-content:flex-end;">
          <button class="icon-btn" data-edit-er="${r.id}">${icon("pencil", 13)}</button>
          <button class="icon-btn" style="color:var(--red);" data-del="${r.id}">${icon("trash", 13)}</button>
        </div></td>
      </tr>`).join("") : `<tr><td colspan="7"><div class="empty-note">لا يوجد مستلمون بعد.</div></td></tr>`;

    $$("[data-toggle-col]").forEach(b => b.onclick = async () => {
      const id = b.dataset.id, col = b.dataset.toggleCol;
      const r = state.emailRecipients.find(x => x.id === id);
      const { error } = await sb.from("email_recipients").update({ [col]: !r[col] }).eq("id", id);
      if (error) { toast("تعذر التحديث", true); return; }
      r[col] = !r[col];
      draw();
    });
    $$("[data-toggle-active]").forEach(b => b.onclick = async () => {
      const id = b.dataset.toggleActive;
      const r = state.emailRecipients.find(x => x.id === id);
      const { error } = await sb.from("email_recipients").update({ is_active: !r.is_active }).eq("id", id);
      if (error) { toast("تعذر التحديث", true); return; }
      r.is_active = !r.is_active;
      draw();
    });
    $$("[data-edit-er]").forEach(b => b.onclick = () => openEditEmailRecipientModal(state.emailRecipients.find(x => x.id === b.dataset.editEr), draw));
    $$("[data-del]").forEach(b => b.onclick = async () => {
      const r = state.emailRecipients.find(x => x.id === b.dataset.del);
      if (!confirm(`حذف "${r.email}" من قائمة المستلمين؟`)) return;
      const { error } = await sb.from("email_recipients").delete().eq("id", r.id);
      if (error) { toast("تعذر الحذف", true); return; }
      state.emailRecipients = state.emailRecipients.filter(x => x.id !== r.id);
      draw();
      toast("تم الحذف");
    });
  };
  draw();

  $("#er-add").onclick = async () => {
    const name = $("#er-name").value.trim();
    const email = $("#er-email").value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("أدخل بريد إلكتروني صحيح", true); return; }
    const payload = {
      tenant_id: TENANT_ID,
      name: name || null, email,
      notify_critical: $("#er-critical").checked,
      notify_low: $("#er-low").checked,
      notify_daily_report: $("#er-daily").checked,
    };
    const { data, error } = await sb.from("email_recipients").insert(payload).select().single();
    if (error) { toast(error.message.includes("duplicate") ? "هذا الإيميل مضاف بالفعل" : "تعذر الإضافة — " + error.message, true); return; }
    state.emailRecipients.push(data);
    $("#er-name").value = ""; $("#er-email").value = "";
    draw();
    toast("تمت إضافة المستلم");
  };
}

function openEditEmailRecipientModal(r, onDone) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${icon("pencil", 16)} تعديل بيانات المستلم</div>
        <button class="close-x" id="eer-close">${icon("x", 15)}</button>
      </div>
      <div class="field"><label>الاسم (اختياري)</label><input id="eer-name" class="input" style="width:100%;" value="${escHtml(r.name) || ""}"></div>
      <div class="field"><label>البريد الإلكتروني</label><input id="eer-email" type="email" class="input" style="width:100%;" value="${escHtml(r.email)}"></div>
      <button class="btn-primary" id="eer-save">${t("save")}</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#eer-close", overlay).onclick = () => overlay.remove();
  $("#eer-save", overlay).onclick = async () => {
    const name = $("#eer-name", overlay).value.trim();
    const email = $("#eer-email", overlay).value.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast("أدخل بريد إلكتروني صحيح", true); return; }
    const { error } = await sb.from("email_recipients").update({ name: name || null, email }).eq("id", r.id);
    if (error) { toast(error.message.includes("duplicate") ? "هذا الإيميل مستخدم بالفعل لمستلم آخر" : "تعذر الحفظ", true); return; }
    r.name = name || null; r.email = email;
    overlay.remove();
    if (typeof onDone === "function") onDone();
    toast("تم تحديث بيانات المستلم");
  };
}

/* ---------------- user management (admin only) ---------------- */
async function renderUsers(main) {
  if (!_profilesLoaded) { main.innerHTML = `<div class="empty-note">جاري تحميل بيانات المستخدمين...</div>`; await ensureProfiles(); if (state.tab !== "users") return; }
  const roleLabels = ROLE_LABELS;
  const activeCount = state.profiles.filter(p => p.is_active !== false).length;
  const maxUsers = state.plan?.max_users;
  const atLimit = maxUsers != null && activeCount >= maxUsers;
  main.innerHTML = `
    <div class="section-header">
      <div><div class="section-title">${t("usersTitle")}</div><div class="section-sub">${t("usersSub")}</div></div>
      <button class="btn-dark" id="new-user-btn" ${atLimit ? "disabled" : ""}>${icon("plus", 15)} ${t("newUserBtn")}</button>
    </div>
    ${maxUsers != null ? `
    <div class="card" style="margin-bottom:14px; max-width:480px; padding:12px 16px; ${atLimit ? "background:#fff4e5;" : ""}">
      <div style="font-size:12.5px; ${atLimit ? "color:#8a5a00; font-weight:700;" : "color:var(--ink70);"}">
        ${icon(atLimit ? "alert" : "check", 13)} ${activeCount} / ${maxUsers} مستخدم نشط (باقة ${escHtml(state.plan?.name || "")})
        ${atLimit ? " — وصلت للحد الأقصى، لازم ترقية الباقة عشان تضيف مستخدم جديد" : ""}
      </div>
    </div>` : ""}
    <div class="card" style="padding:0; overflow:hidden;">
      <table><thead><tr><th>${t("fullNameLabel")}</th><th>البريد الإلكتروني</th><th>${t("roleLabel")}</th><th>${t("status")}</th><th>${t("lastLogin")}</th><th>${t("deviceLabel")}</th><th></th></tr></thead><tbody id="users-body"></tbody></table>
    </div>`;
  $("#users-body").innerHTML = state.profiles.map(p => `
    <tr>
      <td style="font-weight:700;">${escHtml(p.full_name) || "—"}${p.id === state.user.id ? ` <span style="color:var(--ink50); font-size:11px;">${t("youLabel")}</span>` : ""}</td>
      <td style="color:var(--ink70); font-size:12.5px;">${escHtml(p.contact_email) || "—"}</td>
      <td>
        <select class="input" style="padding:6px 10px; font-size:12.5px;" data-role="${p.id}" ${p.id === state.user.id ? "disabled" : ""}>
          ${Object.entries(roleLabels).map(([val, label]) => `<option value="${val}" ${p.role === val ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </td>
      <td>
        <button data-toggle="${p.id}" ${p.id === state.user.id ? "disabled" : ""} class="pill ${p.is_active !== false ? "pill-ok" : "pill-critical"}" style="border:none; cursor:${p.id === state.user.id ? "default" : "pointer"};">
          ${p.is_active !== false ? t("activeLabel") : t("suspendedLabel")}
        </button>
      </td>
      <td style="color:var(--ink70); font-size:12.5px;" class="mono">${p.last_login ? fmtDate(p.last_login) : "—"}</td>
      <td style="color:var(--ink70); font-size:12.5px;">${escHtml(p.last_login_device) || "—"}</td>
      <td><div style="display:flex; gap:6px; justify-content:flex-end;">
        <button class="icon-btn" data-edit-user="${p.id}" title="تعديل الاسم / اسم المستخدم">${icon("pencil", 14)}</button>
        ${p.id === state.user.id ? "" : `<button class="icon-btn" style="color:var(--mustard);" data-reset-pass="${p.id}" title="إعادة تعيين كلمة المرور">${icon("key", 14)}</button>`}
        ${p.id === state.user.id ? "" : `<button class="icon-btn" style="color:var(--red);" data-del-user="${p.id}">${icon("trash", 14)}</button>`}
      </div></td>
    </tr>`).join("");
  $$("[data-role]").forEach(sel => sel.onchange = async () => {
    const { error } = await sb.from("profiles").update({ role: sel.value }).eq("id", sel.dataset.role);
    if (error) { toast("تعذر تحديث الدور — " + (error.message || "تأكد إنك مسجل بحساب مدير"), true); return; }
    const p = state.profiles.find(x => x.id === sel.dataset.role);
    logAudit({ action: "تغيير دور مستخدم", entity: "user", entityName: p?.full_name, details: `الدور الجديد: ${roleLabels[sel.value]}` });
    await loadProfiles(); renderUsers(main); toast("تم تحديث الدور");
  });
  $$("[data-del-user]").forEach(btn => btn.onclick = async () => {
    const p = state.profiles.find(x => x.id === btn.dataset.delUser);
    if (!confirm(`حذف حساب "${p.full_name}" نهائيًا؟ الحساب مش هيقدر يسجل دخول تاني، والعملية دي لا يمكن التراجع عنها.`)) return;
    const res = await callManageUsers({ action: "delete", userId: p.id });
    if (res.error) { toast(res.error, true); return; }
    logAudit({ action: "حذف حساب مستخدم نهائيًا", entity: "user", entityName: p.full_name });
    await loadProfiles(); renderUsers(main); toast("تم حذف الحساب نهائيًا");
  });
  $$("[data-edit-user]").forEach(btn => btn.onclick = async () => {
    const p = state.profiles.find(x => x.id === btn.dataset.editUser);
    if (p.contact_email) {
      const { data } = await sb.from("email_recipients").select("notify_critical, notify_low, notify_daily_report").eq("email", p.contact_email).maybeSingle();
      p._emailRecipient = data || null;
    }
    openEditUserModal(p, main);
  });
  $$("[data-reset-pass]").forEach(btn => btn.onclick = () => {
    openResetPasswordModal(state.profiles.find(x => x.id === btn.dataset.resetPass), main);
  });
  $("#new-user-btn").onclick = () => openNewUserModal(main);
  $$("[data-toggle]").forEach(btn => btn.onclick = async () => {
    const p = state.profiles.find(x => x.id === btn.dataset.toggle);
    const newVal = !(p.is_active !== false);
    const { error } = await sb.from("profiles").update({ is_active: newVal }).eq("id", p.id);
    if (error) { toast("تعذر تحديث الحالة — " + (error.message || ""), true); return; }
    logAudit({ action: newVal ? "تفعيل حساب" : "إيقاف حساب", entity: "user", entityName: p.full_name });
    await loadProfiles(); renderUsers(main); toast(newVal ? "تم تفعيل الحساب" : "تم إيقاف الحساب");
  });
}

/* ---------------- استدعاء Edge Function الخاصة بإدارة المستخدمين ---------------- */
async function callManageUsers(payload) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || "حدث خطأ غير متوقع" };
    return json;
  } catch (e) {
    return { error: "تعذر الاتصال بخدمة إدارة المستخدمين — تأكد إن الـ Edge Function متنشرة (راجع README)" };
  }
}

/* ---------------- استدعاء Edge Function الخاصة بحفظ المفاتيح السرية ---------------- */
async function callManageSecrets(payload) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/manage-secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || "حدث خطأ غير متوقع" };
    return json;
  } catch (e) {
    return { error: "تعذر الاتصال بخدمة حفظ المفاتيح السرية — تأكد إن الـ Edge Function \"manage-secrets\" متنشرة على Supabase" };
  }
}

/* ---------------- استدعاء Edge Function الخاصة بـ Telegram ---------------- */
async function callTelegramService(payload) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/telegram-service`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || "حدث خطأ غير متوقع" };
    return json;
  } catch (e) {
    return { error: "تعذر الاتصال بخدمة Telegram — تأكد إن الـ Edge Function \"telegram-service\" متنشرة على Supabase" };
  }
}
/* إرسال إشعار تيليجرام لكل المستخدمين المسجَّلين تلقائيًا (أو حسب الدور/مستخدم/مجموعة)
   عبر فنكشن send-telegram الجديد — بديل نظام Chat ID الواحد القديم */
async function callSendTelegram({ type, target, message }) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-telegram-multi-factory`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify({ type, target, message }),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || "حدث خطأ غير متوقع" };
    return json;
  } catch (e) {
    return { error: "تعذر الاتصال بخدمة send-telegram — تأكد إنها متنشرة على Supabase" };
  }
}

/* ---------------- طبقة إشعارات مشتركة: Email + Telegram معًا ----------------
   كل قناة مستقلة تمامًا عن التانية: فشل Telegram ميوقفش الإيميل، والعكس. */
async function notifyStockAlert(itemName, qty, maxQty, unit, pct, level) {
  const results = { email: null, telegram: null };
  const isCritical = level === "critical";
  // ملحوظة: مبقناش نتحقق من state.settings.resend_api_key / telegram_bot_token
  // هنا قبل المحاولة، لأن المتصفح أصلاً مش عارف قيمتهم (متعمّد، جزء من
  // الإصلاح الأمني — المفاتيح دي بقت محفوظة في tenant_secrets مش قابلة
  // للقراءة من الفرونت إند خالص). بدل كده، بنحاول دايمًا، والـ Edge
  // Function نفسها هي اللي بتتأكد لو المفتاح مضبوط لمصنعنا ولا لأ،
  // وترجع "skipped" بهدوء لو مش مضبوط بدل ما تدي خطأ.
  const col = isCritical ? "notify_critical" : "notify_low";
  const { data: recipientRows } = await sb.from("email_recipients").select("email").eq("is_active", true).eq(col, true);
  const recipients = (recipientRows || []).map(r => r.email).filter(Boolean);
  if (recipients.length) {
    try {
      results.email = await callEmailService({
        action: "sendLowStockAlert", to: recipients,
        itemName, qty, maxQty, unit, pct, level,
      });
    } catch (e) { results.email = { error: String(e) }; }
    if (results.email?.error || results.email?.success === false) console.warn("تعذر إرسال تنبيه المخزون بالإيميل:", results.email.reason || results.email.error);
  }

  const text = `${isCritical ? "🚨" : "⚠️"} تنبيه مخزون ${isCritical ? "حرج" : "منخفض"}\n\nالصنف:\n${itemName}\n\nالكمية الحالية:\n${qty} ${unit || ""}\n\nالحد الأقصى:\n${maxQty} ${unit || ""}\n\nالنسبة:\n${Math.round(pct)}%`;
  try {
    results.telegram = await callSendTelegram({
      type: isCritical ? "stock_critical" : "stock_warning",
      target: { mode: "notify_type", type: isCritical ? "critical" : "low" },
      message: text,
    });
  } catch (e) { results.telegram = { error: String(e) }; }
  if (results.telegram?.error) console.warn("تعذر إرسال تنبيه المخزون بتيليجرام:", results.telegram.error);

  return results;
}
async function callEmailService(payload) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const res = await fetch(`${SUPABASE_URL}/functions/v1/email-service-multi-factory`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${session.access_token}`, "apikey": SUPABASE_ANON_KEY },
      body: JSON.stringify(payload),
    });
    const json = await res.json();
    if (!res.ok) return { error: json.error || "حدث خطأ غير متوقع" };
    return json;
  } catch (e) {
    return { error: "تعذر الاتصال بخدمة البريد الإلكتروني — تأكد إن الـ Edge Function \"email-service\" متنشرة على Supabase" };
  }
}

function genRandomPassword() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  return Array.from(bytes, b => chars[b % chars.length]).join("");
}
function genSuggestedUsername() {
  return "user" + Math.floor(1000 + Math.random() * 9000);
}
function openNewUserModal(main) {
  const roleLabels = ROLE_LABELS;
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${t("newUserBtn")}</div>
        <button class="close-x" id="nu-close">${icon("x", 15)}</button>
      </div>
      <div class="field"><label>${t("fullNameLabel")}</label><input id="nu-fullname" class="input" style="width:100%;" placeholder="مثال: سارة أحمد"></div>
      <div class="field">
        <label>البريد الإلكتروني للتواصل (اختياري)</label>
        <input id="nu-email" type="email" class="input" style="width:100%;" placeholder="example@domain.com">
        <div style="font-size:11px; color:var(--ink70); margin-top:4px;">لو اتملى، هيتولّد اسم مستخدم وكلمة مرور تلقائيًا وتتبعت له رسالة ترحيب فيها بيانات دخوله، وهيتضاف تلقائيًا في صفحة "مستلمي الإيميل".</div>
      </div>
      <div class="field" id="nu-notify-wrap" style="background:var(--paper); border-radius:10px; padding:12px; display:none;">
        <label style="margin-bottom:8px;">أي تنبيهات توصله على الإيميل؟</label>
        <div style="display:flex; gap:18px; flex-wrap:wrap;">
          <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="nu-notify-critical" checked> تنبيه مخزون حرج</label>
          <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="nu-notify-low" checked> تنبيه مخزون منخفض</label>
          <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="nu-notify-daily" checked> التقرير اليومي</label>
        </div>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1;"><label>${t("usernameLabel")}</label><input id="nu-username" class="input" style="width:100%;" placeholder="مثال: sara"></div>
        <div class="field" style="flex:1;"><label>${t("passwordLabel")}</label><input id="nu-password" class="input mono" style="width:100%;" placeholder="6 أحرف على الأقل"></div>
      </div>
      <button type="button" class="btn-dark" id="nu-generate" style="margin-bottom:16px;">${icon("key", 14)} توليد اسم مستخدم وكلمة مرور تلقائيًا</button>
      <div class="field"><label>${t("roleLabel")}</label>
        <select id="nu-role" class="input" style="width:100%;">
          ${Object.entries(roleLabels).map(([val, label]) => `<option value="${val}" ${val === "keeper" ? "selected" : ""}>${label}</option>`).join("")}
        </select>
      </div>
      <button class="btn-primary" id="nu-save">${t("createAccountBtn")}</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#nu-close", overlay).onclick = () => overlay.remove();

  $("#nu-generate", overlay).onclick = () => {
    $("#nu-username", overlay).value = genSuggestedUsername();
    $("#nu-password", overlay).value = genRandomPassword();
  };
  $("#nu-email", overlay).oninput = () => {
    $("#nu-notify-wrap", overlay).style.display = $("#nu-email", overlay).value.trim() ? "block" : "none";
  };

  $("#nu-save", overlay).onclick = async () => {
    if (blockIfReadOnly()) return;
    const contactEmail = $("#nu-email", overlay).value.trim();
    let username = $("#nu-username", overlay).value.trim().toLowerCase();
    let password = $("#nu-password", overlay).value;
    const fullName = $("#nu-fullname", overlay).value.trim();
    const role = $("#nu-role", overlay).value;
    if (!fullName) { toast("اكتب الاسم الكامل", true); return; }
    // لو مفيش اسم مستخدم/كلمة مرور مكتوبين يدويًا، ولّدهم تلقائيًا (مفيد خصوصًا لو هتُبعت رسالة ترحيب)
    if (!username) username = genSuggestedUsername();
    if (!password) password = genRandomPassword();
    if (!/^[a-z0-9._-]+$/.test(username)) { toast("اسم المستخدم لازم يكون بالإنجليزي بدون مسافات", true); return; }
    if (password.length < 6) { toast("كلمة المرور لازم تكون 6 أحرف على الأقل", true); return; }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) { toast("البريد الإلكتروني غير صحيح", true); return; }

    const email = username + emailSuffix();
    const btn = $("#nu-save", overlay); btn.disabled = true; btn.textContent = "...جارِ الإنشاء";
    // البريد الإلكتروني الحقيقي (contactEmail) وكلمة السر المؤقتة بيتسجلوا هنا
    // مباشرة عن طريق manage-users (بصلاحية service_role اللي بتتجاوز RLS) —
    // مش عن طريق تحديث منفصل بعدين من جلسة العميل العادية، عشان كان بيفشل
    // بصمت أحيانًا حسب سياسات RLS من غير أي رسالة خطأ ظاهرة.
    const res = await callManageUsers({ action: "create", email, password, fullName, role, contactEmail });
    if (res.error) { btn.disabled = false; btn.textContent = "إنشاء الحساب"; toast(res.error, true); return; }
    const newUserId = res.userId || res.user?.id || res.id;
    logAudit({ action: "إنشاء حساب مستخدم", entity: "user", entityName: fullName || username, details: `الدور: ${roleLabels[role]}` });

    // ⚠️ تحقق فوري: نقرا الصف اللي اتحفظ فعليًا في profiles تاني على طول
    // بعد الإنشاء مباشرة، ونوري النتيجة الحقيقية للمستخدم — بدل ما نفترض
    // إن الحفظ نجح لمجرد إن manage-users مارجعش خطأ. ده بيقفل أي لبس نهائيًا:
    // لو الإيميل معمول له select هنا وطلع فاضي، معناها المشكلة قبل كده،
    // مش في العرض بعد كده.
    if (contactEmail) {
      const { data: verifyRow } = await sb.from("profiles").select("contact_email").eq("id", newUserId).maybeSingle();
      if (!verifyRow || !verifyRow.contact_email) {
        console.error("تحذير: الحساب اتعمل بس contact_email مش محفوظ في profiles! القيمة اللي اتبعتت:", contactEmail, "القيمة اللي رجعت من القاعدة:", verifyRow);
        toast(`⚠️ الحساب اتعمل، لكن الإيميل "${contactEmail}" لم يُحفظ في بياناته — بلّغ الدعم بهذه الرسالة`, true);
      }
    }

    // مزامنة تلقائية مع "مستلمي الإيميل" — بدل ما يضاف يدويًا مرة تانية من صفحة تانية
    // (بنتأكد الأول لو الإيميل ده مسجّل قبل كده لنفس المصنع، بدل الاعتماد على
    // upsert+onConflict اللي محتاج تأكيد مسبق لاسم قيد فريد معيّن في القاعدة)
    // ⚠️ لاحظ: مفيش عمود user_id في email_recipients (اتأكد من نفس شكل البيانات
    // المستخدم في الإضافة اليدوية من شاشة "مستلمو الإيميل" نفسها) — إضافته هنا
    // غلط كانت سبب فشل الطلب فعليًا بخطأ 400 (عمود غير موجود في الجدول)
    if (contactEmail) {
      const { data: existingRecipient } = await sb.from("email_recipients").select("id").eq("tenant_id", TENANT_ID).eq("email", contactEmail).maybeSingle();
      const recipientPayload = {
        tenant_id: TENANT_ID, email: contactEmail, name: fullName,
        notify_critical: $("#nu-notify-critical", overlay).checked,
        notify_low: $("#nu-notify-low", overlay).checked,
        notify_daily_report: $("#nu-notify-daily", overlay).checked,
      };
      const { error: syncErr } = existingRecipient
        ? await sb.from("email_recipients").update(recipientPayload).eq("id", existingRecipient.id)
        : await sb.from("email_recipients").insert(recipientPayload);
      if (syncErr) console.warn("تعذر مزامنة مستلم الإيميل:", syncErr.message);
    }

    // إرسال رسالة الترحيب لو فيه بريد تواصل، ومفتاح Resend متظبط للمصنع
    if (contactEmail && state.settings.resend_configured) {
      btn.textContent = "...جارِ إرسال رسالة الترحيب";
      const wres = await callEmailService({
        action: "sendWelcome", to: contactEmail,
        fullName, username, password, roleLabel: roleLabels[role],
      });
      if (wres.error || wres.success === false) toast("تم إنشاء الحساب، لكن تعذّر إرسال رسالة الترحيب — " + (wres.reason || wres.error || ""), true);
      else toast(`تم إنشاء الحساب وإرسال رسالة الترحيب إلى ${contactEmail}`);
    } else {
      toast(`تم إنشاء الحساب — اسم المستخدم: ${username}${contactEmail ? " (رسالة الترحيب محتاجة مفتاح Resend في الإعدادات الأول)" : ""}`);
    }

    btn.disabled = false; btn.textContent = "إنشاء الحساب";
    overlay.remove();
    await loadProfiles(); renderUsers(main);
  };
}

/* ---------------- audit log view ---------------- */
async function renderAudit(main) {
  if (!_auditLoaded) { main.innerHTML = `<div class="empty-note">جاري تحميل سجل الأنشطة...</div>`; await ensureAuditLog(); if (state.tab !== "audit") return; }
  main.innerHTML = `
    <div class="section-header"><div><div class="section-title">${t("auditTitle")}</div><div class="section-sub">${t("auditSub")}</div></div></div>
    ${pagerToolbarHtml("audit", "ابحث بالاسم أو الإجراء أو الصنف...")}
    ${printHeaderHtml("سجل العمليات")}
    <div class="card" style="padding:0; overflow:hidden;">
      <table><thead><tr><th>${t("fullNameLabel")}</th><th>${t("actionCol")}</th><th>${t("entityCol")}</th><th>${t("beforeCol")}</th><th>${t("afterCol")}</th><th>${t("deviceLabel")}</th><th>${t("timeCol")}</th></tr></thead><tbody id="audit-body"></tbody></table>
    </div>
    ${pagerBottomHtml("audit")}`;

  mountPagedTable({
    idPrefix: "audit",
    allRows: state.auditLog,
    tbodySelector: "#audit-body",
    colCount: 7,
    emptyMessage: t("noAudit"),
    searchFields: (a) => [a.actor_name, a.action, a.entity_name, a.details, a.device],
    renderRow: (a) => `
      <tr>
        <td style="font-weight:700;">${escHtml(a.actor_name) || "—"}</td>
        <td>${escHtml(a.action)}</td>
        <td>${escHtml(a.entity_name) || "—"}${a.details ? `<div style="font-size:11px; color:var(--ink50);">${escHtml(a.details)}</div>` : ""}</td>
        <td class="mono">${a.qty_before ?? "—"}</td>
        <td class="mono">${a.qty_after ?? "—"}</td>
        <td style="color:var(--ink70); font-size:12px;">${escHtml(a.device) || "—"}</td>
        <td class="mono" style="color:var(--ink70); font-size:12px;">${fmtDate(a.created_at)}</td>
      </tr>`,
    excelSheetName: "سجل العمليات",
    excelRow: (a) => ({
      "الاسم": a.actor_name || "", "الإجراء": a.action, "العنصر": a.entity_name || "",
      "الملاحظات": a.details || "", "قبل": a.qty_before ?? "", "بعد": a.qty_after ?? "",
      "الجهاز": a.device || "", "التاريخ والساعة": fmtDate(a.created_at),
    }),
  });
}

function genItemCode(category) {
  const letters = (category || "GEN").replace(/[^a-zA-Zء-ي]/g, "");
  let prefix = letters.slice(0, 3).toUpperCase();
  if (!prefix || /[ء-ي]/.test(prefix)) {
    const map = { "أ": "A", "ب": "B", "ت": "T", "خ": "K", "س": "S", "ز": "Z", "ط": "F", "إ": "E" };
    prefix = (category || "GEN").split("").map(ch => map[ch] || "").join("").slice(0, 3).toUpperCase() || "GEN";
  }
  const existing = state.items.filter(i => (i.code || "").startsWith(prefix + "-"));
  const nums = existing.map(i => parseInt((i.code || "").split("-")[1], 10)).filter(n => !isNaN(n));
  const next = (nums.length ? Math.max(...nums) : 0) + 1;
  return `${prefix}-${String(next).padStart(4, "0")}`;
}
function openItemModal(existing, prefillName, onDone) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const form = existing ? { ...existing } : { name: prefillName || "", category: state.categories[0] || "", unit: "قطعة", qty: 0, max_qty: 100, code: "", barcode: "" };
  if (!form.code) form.code = genItemCode(form.category);
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${existing ? "تعديل صنف" : "صنف جديد"}</div>
        <button class="close-x" id="modal-close">${icon("x", 15)}</button>
      </div>
      <div class="field"><label>اسم الصنف</label><input id="f-name" class="input" style="width:100%;" value="${escHtml(form.name)}" placeholder="مثال: خيط حرير أحمر"></div>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1;">
          <label>الفئة (العنوان الرئيسي)</label>
          <select id="f-cat" class="input" style="width:100%;">
            ${state.categories.map(c => `<option ${c === form.category ? "selected" : ""}>${c}</option>`).join("")}
            <option value="__new__">+ فئة جديدة...</option>
          </select>
          <input id="f-cat-new" class="input hidden" style="width:100%; margin-top:8px;" placeholder="اكتب اسم الفئة الجديدة، مثال: خيوط">
        </div>
        <div class="field" style="width:110px;"><label>الوحدة</label><input id="f-unit" class="input" style="width:100%;" value="${escHtml(form.unit)}"></div>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1;"><label>الكمية الحالية${existing ? (isAdmin() ? " (تغيير الرقم يتطلب سبب تصحيح)" : " (لتغييرها استخدم الإدخال/السحب)") : ""}</label><input id="f-qty" type="number" class="input mono" style="width:100%;" value="${form.qty}"${existing && !isAdmin() ? " disabled" : ""}></div>
        <div class="field" style="flex:1;"><label>الحد الأقصى للمخزون</label><input id="f-max" type="number" class="input mono" style="width:100%;" value="${form.max_qty}"></div>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1;">
          <label>${t("itemSupplier")}</label>
          <select id="f-supplier" class="input" style="width:100%;">
            <option value="">${t("noneOption")}</option>
            ${state.suppliers.map(s => `<option value="${s.id}" ${form.supplier_id === s.id ? "selected" : ""}>${escHtml(s.name)}</option>`).join("")}
          </select>
        </div>
        <div class="field" style="flex:1;"><label>${t("itemPrice")}</label><input id="f-price" type="number" step="0.01" class="input mono" style="width:100%;" value="${form.price ?? ""}"></div>
      </div>
      <div class="field"><label>${t("itemStorage")}</label><input id="f-storage" class="input" style="width:100%;" value="${form.storage_location || ""}" placeholder="مثال: رف A3 — مخزن 2"></div>
      <div class="field">
        <label>${t("itemImage")}</label>
        <div style="display:flex; align-items:center; gap:12px;">
          <div id="item-image-preview" style="width:52px; height:52px; border-radius:10px; background:var(--paper-deep); display:flex; align-items:center; justify-content:center; overflow:hidden; flex-shrink:0;">
            ${form.image_base64 ? `<img src="${form.image_base64}" style="width:100%; height:100%; object-fit:cover;">` : icon("package", 22)}
          </div>
          <input type="file" id="f-image" accept="image/*">
        </div>
      </div>
      <div style="display:flex; gap:10px;">
        <div class="field" style="flex:1;"><label>كود الصنف</label><input id="f-code" class="input mono" style="width:100%;" value="${form.code}"></div>
      </div>
      <div class="field">
        <label>الباركود (اختياري)</label>
        <div style="display:flex; gap:8px; align-items:center;">
          <input id="f-barcode" class="input mono" style="flex:1;" value="${form.barcode || ""}" placeholder="امسح، اضغط توليد، أو اكتب رقمًا يدويًا">
          <button type="button" id="f-barcode-scan" class="step-btn" style="width:auto; padding:0 12px; font-size:12px;">${icon("search", 13)} مسح</button>
          <button type="button" id="f-barcode-gen" class="step-btn" style="width:auto; padding:0 12px; font-size:12px;">توليد</button>
          <button type="button" id="f-barcode-help" class="icon-btn" title="طريقة استخدام الباركود" style="width:auto; flex-shrink:0;">${icon("alert", 13)}</button>
        </div>
        <div style="font-size:11px; color:var(--ink70); margin-top:5px;">لو المنتج وصل ومعاه باركود مطبوع من المصنّع: دوس "مسح" وامسحه بالكاميرا، أو اكتبه يدويًا. لو وصل من غير باركود خالص: دوس "توليد" — النظام هيعمّلك كود داخلي فريد وطباعة ملصق تحطه إنت على الصنف بنفسك، وبعدها يبقى قابل للمسح زي أي باركود حقيقي.</div>
        <div id="barcode-preview" style="margin-top:8px; background:#fff; padding:6px; border-radius:8px; border:1px solid var(--ink12); text-align:center;"></div>
      </div>
      <div style="font-size:11.5px; color:var(--ink50); margin-bottom:12px;">* التنبيه الحرج يظهر تلقائيًا حسب النسبة المحددة بالإعدادات. يمكنك إنشاء فئة جديدة (عنوان) وتحتها أي عدد من الأصناف مباشرة من هنا. الإدخال والسحب اليدوي يبقى شغالًا دايمًا حتى مع استخدام الباركود — الاتنين متاحين جنب بعض في كل مكان.</div>
      <button class="btn-primary" id="f-save">${existing ? "حفظ التعديلات" : "إضافة الصنف"}</button>
    </div>`;
  document.body.appendChild(overlay);
  let pendingImageData;
  $("#f-image", overlay).onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      pendingImageData = reader.result;
      $("#item-image-preview", overlay).innerHTML = `<img src="${reader.result}" style="width:100%; height:100%; object-fit:cover;">`;
    };
    reader.readAsDataURL(file);
  };
  const drawBarcode = () => {
    const val = $("#f-barcode", overlay).value.trim();
    const prev = $("#barcode-preview", overlay);
    if (!val) { prev.innerHTML = ""; return; }
    if (typeof JsBarcode === "undefined") {
      prev.innerHTML = `<span style="font-size:11px; color:var(--ink50);">...جارِ تحميل مكتبة الباركود</span>`;
      ensureBarcodeLib().then(() => { if ($("#f-barcode", overlay) && $("#f-barcode", overlay).value.trim() === val) drawBarcode(); }).catch(() => { prev.innerHTML = ""; });
      return;
    }
    prev.innerHTML = `<svg id="bc-svg"></svg><div><button type="button" id="bc-print" class="step-btn" style="width:auto; padding:2px 10px; font-size:11px; margin-top:4px;">${icon("history", 11)} طباعة ملصق</button></div>`;
    try {
      JsBarcode("#bc-svg", val, { height: 40, fontSize: 12, margin: 4 });
      $("#bc-print", overlay).onclick = () => {
        const svgHtml = $("#bc-svg", overlay).outerHTML;
        const itemNameForLabel = escHtml($("#f-name", overlay).value.trim() || "");
        const w = window.open("", "_blank", "width=380,height=260");
        w.document.write(`<html dir="rtl"><head><title>ملصق باركود</title><style>
          body{font-family:Tahoma,Arial,sans-serif; text-align:center; padding:14px;}
          .label{border:1px dashed #999; padding:10px; display:inline-block;}
          .n{font-size:13px; font-weight:700; margin-bottom:6px;}
        </style></head><body>
          <div class="label"><div class="n">${itemNameForLabel}</div>${svgHtml}</div>
          <script>window.onload = () => { window.print(); };</script>
        </body></html>`);
        w.document.close();
      };
    } catch (e) { prev.innerHTML = `<span style="font-size:11px; color:var(--ink50);">قيمة غير صالحة للباركود</span>`; }
  };
  $("#f-barcode-gen", overlay).onclick = () => { $("#f-barcode", overlay).value = $("#f-code", overlay).value || genItemCode($("#f-cat", overlay).value); drawBarcode(); };
  $("#f-barcode-help", overlay).onclick = () => openBarcodeHelpModal();
  $("#f-barcode-scan", overlay).onclick = () => {
    openBarcodeScanner((code) => {
      const dup = state.items.find(i => i.barcode === code && i.id !== existing?.id);
      if (dup) { toast(`⚠️ الباركود ده مسجّل بالفعل لصنف "${dup.name}"`, true); return; }
      $("#f-barcode", overlay).value = code;
      drawBarcode();
      toast("تم مسح الباركود بنجاح");
    }, { title: "امسح باركود المنتج" });
  };
  $("#f-barcode", overlay).oninput = drawBarcode;
  drawBarcode();
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#modal-close", overlay).onclick = () => overlay.remove();
  $("#f-cat", overlay).onchange = (e) => {
    $("#f-cat-new", overlay).classList.toggle("hidden", e.target.value !== "__new__");
    if (e.target.value === "__new__") $("#f-cat-new", overlay).focus();
  };
  $("#f-save", overlay).onclick = async () => {
    if (blockIfReadOnly()) return;
    let category = $("#f-cat", overlay).value;
    if (category === "__new__") {
      category = $("#f-cat-new", overlay).value.trim();
      if (!category) { toast("أدخل اسم الفئة الجديدة", true); return; }
      const { error: catErr } = await sb.from("categories").insert({ name: category, tenant_id: TENANT_ID });
      if (!catErr) await loadCategories();
    }
    const payload = {
      name: $("#f-name", overlay).value.trim(),
      category,
      unit: $("#f-unit", overlay).value.trim() || "قطعة",
      max_qty: Number($("#f-max", overlay).value) || 0,
      code: $("#f-code", overlay).value.trim() || null,
      barcode: $("#f-barcode", overlay).value.trim() || null,
      supplier_id: $("#f-supplier", overlay).value || null,
      price: $("#f-price", overlay).value ? Number($("#f-price", overlay).value) : null,
      storage_location: $("#f-storage", overlay).value.trim() || null,
      image_base64: pendingImageData !== undefined ? pendingImageData : (form.image_base64 || null),
    };
    if (!existing) payload.tenant_id = TENANT_ID;
    // ملحوظة: qty مُستثناة عمدًا من التحديث هنا. أي تغيير في الكمية لصنف
    // موجود لازم يمر عبر move_stock() (شاشة الإدخال/السحب أو "إضافة كمية
    // سريعة") — القاعدة نفسها بترفض أي تحديث مباشر لعمود qty من غير الطريق
    // ده، حماية من فقد التزامن بين عمليتين متزامنتين على نفس الصنف.
    // بالنسبة لصنف جديد (مش existing)، الكمية الابتدائية لسه بتتحط عادي.
    // تصحيح جرد مباشر (admin فقط): لو الرقم في حقل الكمية اتغيّر لصنف موجود
    let pendingAdjustQty = null, pendingAdjustReason = null;
    if (existing && isAdmin()) {
      const enteredQty = Number($("#f-qty", overlay).value);
      if (!Number.isNaN(enteredQty) && enteredQty !== existing.qty) {
        pendingAdjustReason = (prompt(`تغيّرت الكمية من ${existing.qty} إلى ${enteredQty} ${existing.unit}.\n\nاكتب سبب التصحيح (مثال: جرد شهري، تصحيح خطأ إدخال):`) || "").trim();
        if (!pendingAdjustReason) { toast("لازم تكتب سبب التصحيح، أو رجّع الرقم زي ما كان", true); return; }
        pendingAdjustQty = enteredQty;
      }
    }
    if (!existing) payload.qty = Number($("#f-qty", overlay).value) || 0;
    if (!payload.name) { toast("أدخل اسم الصنف", true); return; }
    if (!payload.max_qty || payload.max_qty <= 0) { toast("أدخل الحد الأقصى للمخزون", true); return; }
    // تنبيه التكرار: لو ده صنف جديد (مش تعديل) واسمه مطابق لصنف موجود بالفعل
    if (!existing) {
      const dup = state.items.find(i => i.name.trim().toLowerCase() === payload.name.trim().toLowerCase());
      if (dup) {
        const proceed = confirm(`⚠️ يوجد صنف بنفس الاسم "${dup.name}" بالفعل (الفئة: ${dup.category || "—"}، الكمية الحالية: ${dup.qty} ${dup.unit}).\n\nاضغط "موافق" لإضافته كصنف منفصل على أي حال، أو "إلغاء" للتراجع (يمكنك بدلًا من ذلك تعديل الصنف الموجود أو عمل "إدخال مخزون" عليه بدل إنشاء نسخة جديدة).`);
        if (!proceed) return;
      }
    }
    // منع تكرار الباركود: باركود واحد لازم يشاور على صنف واحد بس، وإلا مسح
    // الباركود ده في المخزن هيسحب على صنف غلط
    if (payload.barcode) {
      const dupBarcode = state.items.find(i => i.barcode === payload.barcode && i.id !== existing?.id);
      if (dupBarcode) { toast(`⚠️ الباركود ده مسجّل بالفعل لصنف "${dupBarcode.name}" — استخدم باركود مختلف أو امسح الحقل`, true); return; }
    }
    let error, newItemId = existing?.id;
    if (existing) {
      ({ error } = await sb.from("items").update(payload).eq("id", existing.id));
    } else {
      const { data: inserted, error: insErr } = await sb.from("items").insert(payload).select().single();
      error = insErr;
      if (inserted) newItemId = inserted.id;
    }
    if (error) { toast(error.message.includes("duplicate") ? "هذا الكود مستخدم بالفعل لصنف آخر" : "تعذر حفظ الصنف — " + error.message, true); return; }
    if (pendingAdjustQty !== null && newItemId) {
      const { error: adjErr } = await sb.rpc("admin_adjust_stock", {
        p_item_id: newItemId, p_new_qty: pendingAdjustQty, p_reason: pendingAdjustReason,
      });
      if (adjErr) { toast("تم حفظ بيانات الصنف، لكن تعذّر تصحيح الكمية — " + adjErr.message, true); }
    }
    logAudit({
      action: existing ? "تعديل صنف" : "إضافة صنف", entity: "item", entityName: payload.name,
      qtyBefore: existing ? existing.qty : null, qtyAfter: existing ? (pendingAdjustQty ?? existing.qty) : payload.qty,
    });
    // لو صنف جديد وبكمية ابتدائية أكبر من صفر، نسجّلها كحركة "إدخال" (رصيد افتتاحي)
    // عشان تظهر في لوحة التحكم والتقارير وسجل الحركات زي أي عملية إدخال عادية
    // عبر دالة آمنة (مش إدخال مباشر لجدول transactions المقفول)
    if (!existing && payload.qty > 0 && newItemId) {
      const { error: openErr } = await sb.rpc("record_opening_transaction", {
        p_item_id: newItemId, p_qty: payload.qty, p_worker: state.profile?.full_name || "", p_note: "رصيد افتتاحي عند إضافة الصنف",
      });
      if (openErr) console.warn("تعذر تسجيل الرصيد الافتتاحي:", openErr.message);
      await loadTransactions();
    }
    overlay.remove();
    await loadItems();
    if (typeof onDone === "function") onDone(); else render();
    toast(existing ? "تم تحديث الصنف" : "تمت إضافة الصنف");
  };
}

/* ---------------- تغيير كلمة المرور (ذاتيًا) ---------------- */
/* ---------------- المساعدة ودليل الاستخدام ---------------- */
function openHelpModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  const role = myRole();
  const guides = [
    { roles: ["admin", "factory_manager", "keeper", "production_manager", "quality", "viewer"], title: "لوحة التحكم", body: "نظرة سريعة على حالة المخزن: عدد الأصناف، الأصناف الحرجة، حركة آخر 7 أيام، وأكثر الأصناف استهلاكًا." },
    { roles: ["admin", "keeper"], title: "إدخال مخزون / سحب من المخزن", body: "ابحث عن الصنف أو اخترته من قائمة الفئات، حدد الكمية بالأزرار +/-، واضغط تأكيد. لو الصنف مش موجود أصلاً، هيظهرلك زر لإضافته مباشرة." },
    { roles: ["admin", "factory_manager", "keeper", "production_manager", "accountant", "quality", "viewer"], title: "المخزون الحالي", body: "جدول بكل الأصناف مقسّم حسب الفئة، مع نسبة الامتلاء والحالة (جيد / منخفض / حرج). اضغط أيقونة الساعة بجانب أي صنف لعرض سجل حركته بالكامل." },
    { roles: ["admin", "factory_manager", "keeper", "production_manager", "accountant", "quality", "viewer"], title: "التقارير", body: "فلترة كاملة (تاريخ، نوع، صنف، عامل)، طباعة/PDF متعددة الصفحات، تصدير Excel، وطباعة إذن صرف/استلام لكل حركة على حدة." },
    { roles: ["admin", "keeper"], title: "إدارة الأصناف", body: "إضافة/تعديل/حذف الأصناف والفئات، توليد كود وباركود تلقائي، واستيراد مئات الأصناف دفعة واحدة من ملف Excel." },
    { roles: ["admin", "keeper"], title: "الموردون", body: "بيانات التواصل مع الموردين، وربطها بالأصناف من نموذج إضافة/تعديل الصنف." },
    { roles: ["admin"], title: "إدارة المستخدمين", body: "إنشاء حسابات جديدة بأي دور من 7 أدوار، تحديد الصلاحيات، إيقاف أو حذف أي حساب نهائيًا." },
    { roles: ["admin"], title: "الإعدادات", body: "اسم المصنع، الشعار، العنوان والهاتف، نسب التنبيه الحرج والمنخفض، والنسخ الاحتياطي (يدوي وتلقائي يوميًا)." },
    { roles: ["admin", "factory_manager", "keeper", "production_manager", "quality", "viewer"], title: "الجرس 🔔", body: "يظهر عدد الأصناف اللي تحتاج شراء (منخفضة أو حرجة)، اضغط عليه لعرض القائمة كاملة." },
    { roles: ["admin", "factory_manager", "keeper", "production_manager", "accountant", "quality", "viewer"], title: "تغيير كلمة المرور والخروج", body: "زر 🔑 بجانب زر الخروج في القائمة الجانبية لتغيير كلمة مرورك في أي وقت. النظام بيسجّل خروجك تلقائيًا بعد 20 دقيقة من عدم النشاط." },
  ].filter(g => g.roles.includes(role));

  overlay.innerHTML = `
    <div class="modal-box" style="width:560px; max-width:92vw;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:17px;">دليل الاستخدام</div>
        <button class="close-x" id="help-close">${icon("x", 15)}</button>
      </div>
      <div style="font-size:12px; color:var(--ink70); margin-bottom:14px;">الدليل ده مخصّص حسب صلاحياتك الحالية (${ROLE_LABELS[role]}).</div>
      <div style="display:flex; flex-direction:column; gap:14px; max-height:60vh; overflow:auto;">
        ${guides.map(g => `
          <div>
            <div style="font-weight:700; font-size:13.5px; color:var(--ink); margin-bottom:4px;">${g.title}</div>
            <div style="font-size:12.5px; color:var(--ink70); line-height:1.8;">${g.body}</div>
          </div>`).join("")}
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#help-close", overlay).onclick = () => overlay.remove();
}

/* ---------------- حول النظام ---------------- */
function openAboutModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box" style="width:480px; max-width:92vw; text-align:center;">
      <div style="display:flex; justify-content:flex-end;">
        <button class="close-x" id="about-close">${icon("x", 15)}</button>
      </div>
      <div style="width:60px; height:60px; border-radius:16px; background:var(--mustard); display:flex; align-items:center; justify-content:center; margin:0 auto 14px; overflow:hidden;">
        ${state.settings.logo_base64 ? `<img src="${state.settings.logo_base64}" style="width:100%; height:100%; object-fit:cover;">` : icon("scissors", 28)}
      </div>
      <div style="font-weight:800; font-size:18px;">${escHtml(state.settings.workshop_name) || "مصنع نسيج"}</div>
      <div style="font-size:12.5px; color:var(--ink70); margin-bottom:18px;">نظام إدارة المخازن</div>
      <div style="text-align:right; background:var(--paper); border-radius:12px; padding:14px 16px; font-size:12.5px; color:var(--ink70); line-height:2;">
        <div>✔ إدارة مستخدمين بـ 7 أدوار وصلاحيات مفصّلة</div>
        <div>✔ إدخال وسحب مخزون بأكواد وباركود</div>
        <div>✔ تقارير كاملة قابلة للطباعة والتصدير</div>
        <div>✔ إذن صرف/استلام لكل حركة</div>
        <div>✔ سجل عمليات كامل (Audit Log)</div>
        <div>✔ نسخ احتياطي يدوي وتلقائي يومي</div>
        <div>✔ استيراد أصناف بالجملة من Excel</div>
        <div>✔ دعم لغتين: عربي وتركي</div>
      </div>
      <div style="margin-top:16px; font-size:11px; color:var(--ink50);">تم التطوير خصيصًا لـ ${escHtml(state.settings.workshop_name) || "المصنع"} — جميع البيانات مخزّنة بأمان على Supabase.</div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#about-close", overlay).onclick = () => overlay.remove();
}

function openEditUserModal(p, main) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${icon("pencil", 16)} تعديل بيانات المستخدم</div>
        <button class="close-x" id="eu-close">${icon("x", 15)}</button>
      </div>
      <div class="field"><label>الاسم الكامل</label><input id="eu-fullname" class="input" style="width:100%;" value="${escHtml(p.full_name) || ""}"></div>
      <div class="field">
        <label>اسم المستخدم (لتسجيل الدخول)</label>
        <input id="eu-username" class="input" style="width:100%;" value="${(p.username || "")}" placeholder="مثال: ahmed">
        <div style="font-size:11px; color:var(--ink50); margin-top:6px;">بالإنجليزي وبدون مسافات. تغييره يحتاج إعادة نشر Edge Function (راجع README).</div>
      </div>
      <div class="field">
        <label>البريد الإلكتروني للتواصل (اختياري)</label>
        <input id="eu-email" type="email" class="input" style="width:100%;" value="${escHtml(p.contact_email) || ""}" placeholder="example@domain.com">
      </div>
      <div class="field" style="background:var(--paper); border-radius:10px; padding:12px;">
        <label style="margin-bottom:8px;">أي تنبيهات توصله على الإيميل؟ (لو فيه بريد إلكتروني)</label>
        <div style="display:flex; gap:18px; flex-wrap:wrap;">
          <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="eu-notify-critical" ${p._emailRecipient?.notify_critical !== false ? "checked" : ""}> تنبيه مخزون حرج</label>
          <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="eu-notify-low" ${p._emailRecipient?.notify_low !== false ? "checked" : ""}> تنبيه مخزون منخفض</label>
          <label style="display:flex; align-items:center; gap:6px; font-size:13px;"><input type="checkbox" id="eu-notify-daily" ${p._emailRecipient?.notify_daily_report !== false ? "checked" : ""}> التقرير اليومي</label>
        </div>
      </div>
      <button class="btn-primary" id="eu-save">حفظ التعديلات</button>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#eu-close", overlay).onclick = () => overlay.remove();
  $("#eu-save", overlay).onclick = async () => {
    const newName = $("#eu-fullname", overlay).value.trim();
    const newUsername = $("#eu-username", overlay).value.trim().toLowerCase();
    const contactEmail = $("#eu-email", overlay).value.trim();
    if (!newName) { toast("اكتب الاسم الكامل", true); return; }
    if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) { toast("البريد الإلكتروني غير صحيح", true); return; }
    const btn = $("#eu-save", overlay); btn.disabled = true; btn.textContent = "جاري الحفظ...";
    if (newName !== p.full_name || contactEmail !== (p.contact_email || "")) {
      const { error } = await sb.from("profiles").update({ full_name: newName, contact_email: contactEmail || null }).eq("id", p.id);
      if (error) { toast("تعذر تحديث البيانات — " + (error.message || ""), true); btn.disabled = false; btn.textContent = "حفظ التعديلات"; return; }
    }
    if (newUsername && newUsername !== (p.username || "") && /^[a-z0-9._-]+$/.test(newUsername)) {
      const res = await callManageUsers({ action: "updateUsername", userId: p.id, newUsername });
      if (res.error) { toast(res.error, true); btn.disabled = false; btn.textContent = "حفظ التعديلات"; return; }
    }
    // مزامنة تلقائية مع "مستلمي الإيميل" لو فيه بريد إلكتروني
    if (contactEmail) {
      const { error: syncErr } = await sb.from("email_recipients").upsert({
        email: contactEmail, name: newName, user_id: p.id,
        notify_critical: $("#eu-notify-critical", overlay).checked,
        notify_low: $("#eu-notify-low", overlay).checked,
        notify_daily_report: $("#eu-notify-daily", overlay).checked,
      }, { onConflict: "email" });
      if (syncErr) console.warn("تعذر مزامنة مستلم الإيميل:", syncErr.message);
    }
    logAudit({ action: "تعديل بيانات مستخدم", entity: "user", entityName: newName });
    await loadProfiles(); renderUsers(main); overlay.remove();
    toast("تم حفظ التعديلات");
  };
}

function openResetPasswordModal(p, main) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${icon("key", 16)} إعادة تعيين كلمة مرور "${escHtml(p.full_name)}"</div>
        <button class="close-x" id="rp-close">${icon("x", 15)}</button>
      </div>
      <div id="rp-step1">
        <div style="font-size:13px; color:var(--ink70); line-height:1.8; margin-bottom:16px;">
          هيتم توليد كلمة مرور مؤقتة جديدة للحساب ده. المستخدم هيُطلب منه تغييرها فور تسجيل الدخول. سلّمها له مباشرة (تليفون / واتساب) بدون ما تكتبها في أي مكان تاني.
        </div>
        <button class="btn-primary" id="rp-generate">توليد كلمة مرور مؤقتة</button>
      </div>
      <div id="rp-step2" class="hidden">
        <div style="font-size:12.5px; color:var(--ink70); margin-bottom:8px;">كلمة المرور المؤقتة (هتظهر مرة واحدة بس):</div>
        <div style="display:flex; gap:8px; align-items:center; margin-bottom:16px;">
          <div id="rp-temp-pass" class="mono" style="flex:1; background:var(--paper-deep); border-radius:10px; padding:12px 14px; font-size:16px; font-weight:800; letter-spacing:1px; text-align:center;"></div>
          <button class="icon-btn" id="rp-copy" title="نسخ">${icon("copy", 15)}</button>
        </div>
        <button class="btn-dark" id="rp-done" style="width:100%;">تم — أغلق</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#rp-close", overlay).onclick = () => overlay.remove();
  $("#rp-generate", overlay).onclick = async () => {
    const btn = $("#rp-generate", overlay); btn.disabled = true; btn.textContent = "جاري التوليد...";
    const res = await callManageUsers({ action: "resetPassword", userId: p.id });
    if (res.error) { toast(res.error, true); btn.disabled = false; btn.textContent = "توليد كلمة مرور مؤقتة"; return; }
    logAudit({ action: "إعادة تعيين كلمة مرور", entity: "user", entityName: p.full_name });
    $("#rp-temp-pass", overlay).textContent = res.tempPassword;
    $("#rp-step1", overlay).classList.add("hidden");
    $("#rp-step2", overlay).classList.remove("hidden");
  };
  $("#rp-copy", overlay).onclick = () => {
    navigator.clipboard.writeText($("#rp-temp-pass", overlay).textContent).then(() => toast("تم النسخ"));
  };
  $("#rp-done", overlay).onclick = () => overlay.remove();
}

function openChangePasswordModal(forced) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${forced ? "لازم تغيّر كلمة المرور المؤقتة" : "تغيير كلمة المرور"}</div>
        ${forced ? "" : `<button class="close-x" id="cp-close">${icon("x", 15)}</button>`}
      </div>
      ${forced ? `<div style="font-size:12.5px; color:var(--ink70); background:var(--amber-soft); padding:10px 12px; border-radius:10px; margin-bottom:14px;">تم إعادة تعيين كلمة مرورك من المدير. اختر كلمة مرور جديدة وخاصة بيك عشان تكمّل.</div>` : ""}
      <div class="field"><label>كلمة المرور الجديدة</label><input id="cp-new" type="password" class="input" style="width:100%;" placeholder="6 أحرف على الأقل"></div>
      <div class="field"><label>تأكيد كلمة المرور</label><input id="cp-confirm" type="password" class="input" style="width:100%;" placeholder="أعد كتابتها"></div>
      <button class="btn-primary" id="cp-save">حفظ كلمة المرور الجديدة</button>
    </div>`;
  document.body.appendChild(overlay);
  if (!forced) { overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); }; $("#cp-close", overlay).onclick = () => overlay.remove(); }
  $("#cp-save", overlay).onclick = async () => {
    const p1 = $("#cp-new", overlay).value, p2 = $("#cp-confirm", overlay).value;
    if (p1.length < 6) { toast("كلمة المرور لازم تكون 6 أحرف على الأقل", true); return; }
    if (p1 !== p2) { toast("كلمتا المرور غير متطابقتين", true); return; }
    const { error } = await sb.auth.updateUser({ password: p1 });
    if (error) { toast("تعذر تغيير كلمة المرور — " + (error.message || ""), true); return; }
    if (forced) await sb.from("profiles").update({ must_change_password: false }).eq("id", state.user.id);
    logAudit({ action: "تغيير كلمة المرور", entity: "user", entityName: state.profile?.full_name });
    overlay.remove();
    toast("تم تغيير كلمة المرور بنجاح");
  };
}

function openForgotPasswordModal() {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.innerHTML = `
    <div class="modal-box">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <div style="font-weight:800; font-size:16px;">${icon("key", 16)} نسيت كلمة المرور؟</div>
        <button class="close-x" id="fp-close">${icon("x", 15)}</button>
      </div>
      <div style="font-size:13px; color:var(--ink70); margin-bottom:14px;">اكتب اسم المستخدم بتاعك، هنبعتلك كلمة مرور مؤقتة على بريدك الإلكتروني المسجّل فورًا.</div>
      <div class="field"><label>اسم المستخدم</label><input id="fp-username" class="input" style="width:100%;" placeholder="مثال: ahmed"></div>
      <button class="btn-primary" id="fp-submit" style="width:100%;">إرسال كلمة مرور مؤقتة</button>
      <div id="fp-result" style="display:none; margin-top:14px; font-size:13px; background:var(--paper); padding:12px 14px; border-radius:10px; line-height:1.8;"></div>
      <div style="font-size:11.5px; color:var(--ink50); margin-top:16px; padding-top:14px; border-top:1px solid var(--border);">
        مفيش عندك بريد مسجّل أو الرسالة معتوصلكش؟ كلّم <b>مدير النظام</b> يصفّرها لك يدويًا من "إدارة المستخدمين".
      </div>
    </div>`;
  document.body.appendChild(overlay);
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
  $("#fp-close", overlay).onclick = () => overlay.remove();

  $("#fp-submit", overlay).onclick = async () => {
    const username = $("#fp-username", overlay).value.trim();
    if (!username) { toast("اكتب اسم المستخدم الأول", true); return; }
    const slug = TENANT_SLUG || ($("#login-tenant-slug") ? $("#login-tenant-slug").value.trim() : "");
    if (!slug) { toast("محتاج تحدد كود المصنع في شاشة الدخول الأول", true); return; }

    const btn = $("#fp-submit", overlay); btn.disabled = true; btn.textContent = "...جارِ الإرسال";
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SUPABASE_ANON_KEY },
        body: JSON.stringify({ tenantSlug: slug, username: username.toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));
      $("#fp-result", overlay).style.display = "block";
      $("#fp-result", overlay).textContent = data.message || "لو الحساب صحيح، هيوصلك إيميل خلال دقايق.";
      btn.textContent = "تم الإرسال ✅"; btn.disabled = true;
    } catch (e) {
      btn.disabled = false; btn.textContent = "إرسال كلمة مرور مؤقتة";
      toast("تعذر الاتصال بالخدمة، حاول تاني", true);
    }
  };
}

/* ---------------- منع تسجيل الدخول المتكرر (حماية بسيطة من محاولات القوة الغاشمة) ---------------- */
document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.dir = I18N[state.lang].dir;
  document.documentElement.lang = state.lang;
  applyLoginTexts();
  $$(".lang-btn").forEach(b => b.onclick = () => setLang(b.dataset.lang));

  $("#login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const username = $("#login-username").value.trim();
    const password = $("#login-password").value;
    const tenantSlugInput = $("#login-tenant-slug") ? $("#login-tenant-slug").value.trim() : "";
    $("#login-error").classList.add("hidden");
    const btn = $("#login-submit"); btn.disabled = true; btn.textContent = t("loginLoading");
    try {
      // نتأكد من وجود المصنع فعليًا قبل أي محاولة تسجيل دخول — بدون كده مش
      // هنعرف نبني الإيميل الداخلي الصحيح ولا نحمّل بيانات المصنع الصح
      const slugToUse = detectSlugFromHostname() || tenantSlugInput;
      const tenantOk = await resolveTenant(slugToUse);
      if (!tenantOk) {
        $("#login-error").textContent = "كود المصنع غير صحيح أو غير مفعّل. تأكد من الكود وحاول تاني.";
        $("#login-error").classList.remove("hidden");
        return;
      }

      const { user } = await tryLogin(username, password);
      state.user = user;
      await loadAll();
      // تأكيد إضافي: مصنع الحساب الفعلي (من profiles) هو المرجع الأدق، خصوصًا
      // لو حصل أي اختلاف بسيط بين الـ slug المُدخل ومصنع الحساب الحقيقي
      if (state.profile && state.profile.tenant_id && state.profile.tenant_id !== TENANT_ID) {
        await resolveTenantById(state.profile.tenant_id);
        await loadSettings();
      }
      if (state.profile && state.profile.is_active === false) {
        await sb.auth.signOut();
        state.user = null; state.profile = null;
        $("#login-error").textContent = "هذا الحساب موقوف حاليًا. تواصل مع مدير النظام.";
        $("#login-error").classList.remove("hidden");
        return;
      }
      await sb.from("profiles").update({ last_login: new Date().toISOString(), last_login_device: deviceInfo() }).eq("id", user.id);
      logAudit({ action: "تسجيل دخول", entity: "user", entityName: state.profile?.full_name || username });
      showApp();
      if (state.profile && state.profile.must_change_password) openChangePasswordModal(true);
    } catch (err) {
      $("#login-error").textContent = err.message || t("loginError");
      $("#login-error").classList.remove("hidden");
    } finally {
      btn.disabled = false; btn.textContent = t("loginBtn");
    }
  });
  $("#logout-btn").addEventListener("click", () => doLogout());
  $("#sidebar-toggle-btn").addEventListener("click", () => {
    $("#app-shell").classList.toggle("sidebar-collapsed");
    $("#nav-list").classList.toggle("mobile-open");
    $("#mobile-extra-controls").classList.toggle("mobile-open");
  });
  $("#change-pass-btn").addEventListener("click", () => openChangePasswordModal(false));
  $("#forgot-pass-link").addEventListener("click", openForgotPasswordModal);
  $("#help-btn").addEventListener("click", openHelpModal);
  $("#about-btn").addEventListener("click", openAboutModal);
  $("#help-btn-mobile").addEventListener("click", openHelpModal);
  $("#about-btn-mobile").addEventListener("click", openAboutModal);
  boot().catch((e) => { console.error("boot() error:", e); hideBootLoader(); showLogin(); });
});
