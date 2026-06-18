import { useState, useEffect, useCallback, useRef } from "react";
import { createClient } from "@supabase/supabase-js";
import jsPDF from "jspdf";
import { QRCodeSVG } from "qrcode.react";

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_KEY,
);

const ls = {
  get: (k) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

const dbSet = async (key, value) => {
  ls.set(key, value);
  try {
    await fetch(import.meta.env.VITE_EDGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-app-secret": import.meta.env.VITE_EDGE_SECRET,
      },
      body: JSON.stringify({ key, value }),
    });
  } catch {}
};

const hashPw = async (str) => {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,"0")).join("");
};
const isHashed = (s) => typeof s==="string" && /^[0-9a-f]{64}$/.test(s);

// === Multi-locatie ===
// Vaste lijst van vestigingen. Volgorde bepaalt weergave in het keuzescherm.
// Per land gesorteerd van noord naar zuid (op breedtegraad).
const LOCATIONS = [
  { id:"groningen",   name:"Groningen",   country:"NL" },
  { id:"ruinerwold",  name:"Ruinerwold",  country:"NL" },
  { id:"diemen",      name:"Diemen",      country:"NL" },
  { id:"nieuwegein",  name:"Nieuwegein",  country:"NL" },
  { id:"bleiswijk",   name:"Bleiswijk",   country:"NL" },
  { id:"duiven",      name:"Duiven",      country:"NL" },
  { id:"etten-leur",  name:"Etten-Leur",  country:"NL" },
  { id:"maastricht",  name:"Maastricht",  country:"NL" },
  { id:"antwerpen",   name:"Antwerpen",   country:"BE" },
  { id:"gent",        name:"Gent",        country:"BE" },
  { id:"houthalen",   name:"Houthalen",   country:"BE" },
  { id:"brussel",     name:"Brussel",     country:"BE" },
  { id:"kluisbergen", name:"Kluisbergen", country:"BE" },
  { id:"namen",       name:"Namen",       country:"BE" },
];
const COUNTRIES = [{ code:"NL", flag:"🇳🇱", label:"Nederland" },{ code:"BE", flag:"🇧🇪", label:"België" }];
const locName = (locId) => LOCATIONS.find(l=>l.id===locId)?.name || locId;
// Ruinerwold houdt de oorspronkelijke keys (vkast-cfg, …) zodat de bestaande live data behouden blijft.
const LEGACY_LOC = "ruinerwold";
const keyFor = (base, locId) => locId===LEGACY_LOC ? base : `${base}:${locId}`;

// HQ-overzicht master-PIN. Standaard "2580".
// Wijzigen? Genereer een nieuwe hash:  node -e "console.log(require('crypto').createHash('sha256').update('XXXX').digest('hex'))"
const HQ_PIN_HASH = "ed946f65d2c785d90e827c5ffd879ce3b49c68d4c88013074176a7e73bc58bcf";

const migrateHashes = async (cfg, locId=LEGACY_LOC) => {
  let changed=false;
  const c=JSON.parse(JSON.stringify(cfg));
  for(const acc of c.accounts||[]){
    if(!isHashed(acc.password)){acc.password=await hashPw(acc.password);changed=true;}
  }
  if(c.adminPin&&!isHashed(c.adminPin)){c.adminPin=await hashPw(c.adminPin);changed=true;}
  if(c.appName==="Vloeistoffenkast"){c.appName="Voorraadbeheer";changed=true;}
  if(changed)dbSet(keyFor("vkast-cfg",locId),c);
  return c;
};

const TRANS = {
  nl: {
    welcome:"Welkom", chooseShelf:"Kies een kast", chooseSection:"Kies een lekbak",
    chemicals:"Vloeistoffenkast", flammables:"Brandbare stoffen",
    normalStock:"Normale Voorraad", consumables:"Verbruiksartikelen",
    worker:"Medewerker", manager:"Manager", admin:"Beheerder",
    logout:"Uitloggen", back:"Terug", close:"Sluiten",
    password:"Wachtwoord", enterPw:"Voer wachtwoord in",
    wrongPw:"Onjuist wachtwoord", blockedMsg:"Geblokkeerd — wacht 30 seconden", blockedBtn:"Geblokkeerd...",
    loginWorker:"Medewerker inloggen", loginManager:"Manager inloggen",
    full:"vol", none:"--",
    maxExceeded:"Maximum overschreden!", almostFull:"Bijna vol — check voordat je bijvult",
    toOrder:"te bestellen", inStock:"op voorraad", present:"aanwezig",
    reportEmpty:"Lekbak leeg melden", reportStockEmpty:"Voorraad leeg melden",
    sectionFill:"Lekbak bezetting", per:"per", reorder:"bijbestellen",
    bottles:"flessen", bottlesSingle:"fles", max:"max", pieces:"stuks",
    ofTarget:(done,total)=>`${done} van ${total} producten op doelstelling`,
    flammable:"Ontvlambaar", corrosive:"Corrosief",
    persons:"personen", person:"persoon", pinRequired:"PIN vereist",
    manualBtn:"Handleiding", manualWorker:"Voor Medewerkers", manualWorkerSub:"Voorraad bijwerken & inloggen",
    manualManager:"Voor Managers", manualManagerSub:"Overzicht, rapportage & beheer",
    qrPrint:"QR-code afdrukken", qrPrintBtn:"Afdrukken",
    qrAccessVia:"Toegang via QR-code", qrScanToOpen:"Scan om de app te openen", qrAppName:"Voorraadbeheer App",
    qrStep1:"Open de camera-app op je telefoon", qrStep2:"Richt de camera op de QR-code", qrStep3:"Tik op de melding om in te loggen",
    stockManagement:"Voorraadbeheer",
    selectName:"Selecteer je naam", noAccounts:"Geen accounts beschikbaar.",
    tabStatus:"Status", tabConsumption:"Verbruik", tabLog:"Logboek",
    trays:"Lekbakken", monthlyReport:"Maandelijkse Uitdraai", createOrderReport:"Bestelrapport aanmaken",
    colProduct:"Product", colOrder:"Bestel",
    monthlyConsumption:"Maandverbruik", recordMonthly:"Maandstand vastleggen", saving:"Opslaan...",
    recordMonthlyHint:"Druk op maandstand vastleggen aan het begin van de maand.",
    consumptionVs:"Verbruik t.o.v.", noConsumption:"Geen verbruik", monthlyRecords:"Maandstanden",
    productsToReorder:(n)=>`${n} producten bijbestellen`, allStockOk:"Alle voorraden op peil!",
    recipients:"Ontvangers", noRecipients:"Geen ontvangers. Stel in via Beheerder.",
    sendByEmail:"Verstuur per e-mail", copyReport:"Kopieer rapport", copied:"Gekopieerd!", downloadPdf:"Download PDF",
    repTitle:"BESTELRAPPORTAGE", repDate:"Datum", repLocation:"Locatie", repNormalStock:"NORMALE VOORRAAD", repTotal:"TOTAAL TE BESTELLEN", repBottles:"flessen", repOk:"ok", repTarget:"doel",
    activityLog:"Activiteitenlog", clearLog:"Wissen", confirmClearLog:"Hele logboek wissen? Dit kan niet ongedaan worden gemaakt.", noActivity:"Nog geen activiteit geregistreerd.", roleSystem:"Systeem",
    partNone:"geen", confirmEmptyTray:(label)=>`${label} volledig leeg melden? Dit zet alle producten op 0.`,
    targetLabel:"doel", confirmEmptyStock:"Normale voorraad volledig leeg melden? Dit zet alle artikelen op 0.",
    enterPin:"Voer PIN in", wrongPin:"Onjuiste PIN",
    tabProducts:"Producten", tabStock:"Voorraad", tabEmail:"E-mail", tabAccounts:"Accounts", tabSettings:"Instellingen",
    admLabel:"Label", admSublabel:"Sublabel", admMaxLiters:"Max liters", admColor:"Kleur",
    on:"AAN", off:"UIT", admGhsCategory:"GHS Categorie", admNone:"— Geen —",
    save:"Opslaan", saved:"Opgeslagen!",
    admNewProduct:"Nieuw product", admProduct:"Product", admName:"Naam", admUnit:"Eenheid",
    admNewItem:"Nieuw artikel", admItem:"Artikel", admDept:"Afdeling", admRecipient:"Ontvanger",
    admNewPw:"Nieuw wachtwoord", admLeaveEmpty:"Laat leeg = ongewijzigd", admRole:"Rol",
    admNewPerson:"Nieuw persoon", admAccount:"Account",
    admAppName:"App naam", admLocation:"Locatie", admNewPin:"Nieuwe PIN (4 cijfers)",
    langLabel:"🇳🇱 Nederlands",
    fbBtn:"Melding maken", fbTitle:"Melding of idee doorgeven",
    fbIntro:"Iets kapot, een vraag of een verbeteridee? Geef het hier door — wij pakken het op.",
    fbType:"Soort melding", fbProblem:"Probleem", fbProblemSub:"Iets werkt niet / is kapot",
    fbChange:"Aanpassing / idee", fbChangeSub:"Voorstel of verbetering",
    fbName:"Je naam (optioneel)", fbNamePlaceholder:"Bijv. Sanne",
    fbMessage:"Omschrijving", fbMessagePlaceholder:"Omschrijf zo duidelijk mogelijk wat er aan de hand is of wat je voorstelt…",
    fbSend:"Versturen", fbSending:"Versturen…", fbRequired:"Vul eerst een omschrijving in.",
    fbThanksTitle:"Bedankt!", fbThanksMsg:"Je melding is doorgegeven. We pakken het op.", fbNew:"Nog een melding maken",
    sds:"VIB", sdsTitle:"Veiligheidsinformatieblad", sdsFor:"VIB voor",
    sdsNone:"Nog geen VIB geüpload.", sdsView:"Bekijken", sdsDownload:"Downloaden",
    sdsUpload:"VIB uploaden", sdsAdd:"VIB toevoegen", sdsReplace:"VIB vervangen", sdsRemove:"VIB verwijderen",
    sdsUploading:"Uploaden…", sdsUploadedBy:"Geüpload door", sdsUploadedOn:"op",
    sdsTooBig:"Bestand te groot (max 10 MB).", sdsBadType:"Alleen PDF, JPG of PNG toegestaan.",
    sdsError:"Upload mislukt. Probeer opnieuw.", sdsRemoveConfirm:"Dit document verwijderen?",
  },
  en: {
    welcome:"Welcome", chooseShelf:"Choose a cabinet", chooseSection:"Choose a tray",
    chemicals:"Chemical Cabinet", flammables:"Flammable substances",
    normalStock:"Normal Stock", consumables:"Consumables",
    worker:"Employee", manager:"Manager", admin:"Administrator",
    logout:"Log out", back:"Back", close:"Close",
    password:"Password", enterPw:"Enter password",
    wrongPw:"Incorrect password", blockedMsg:"Blocked — wait 30 seconds", blockedBtn:"Blocked...",
    loginWorker:"Employee login", loginManager:"Manager login",
    full:"full", none:"--",
    maxExceeded:"Maximum exceeded!", almostFull:"Almost full — check before refilling",
    toOrder:"to order", inStock:"in stock", present:"present",
    reportEmpty:"Report tray empty", reportStockEmpty:"Report stock empty",
    sectionFill:"Tray occupancy", per:"per", reorder:"reorder",
    bottles:"bottles", bottlesSingle:"bottle", max:"max", pieces:"pieces",
    ofTarget:(done,total)=>`${done} of ${total} products at target`,
    flammable:"Flammable", corrosive:"Corrosive",
    persons:"persons", person:"person", pinRequired:"PIN required",
    manualBtn:"Manual", manualWorker:"For Employees", manualWorkerSub:"Update stock & log in",
    manualManager:"For Managers", manualManagerSub:"Overview, reporting & management",
    qrPrint:"Print QR code", qrPrintBtn:"Print",
    qrAccessVia:"Access via QR code", qrScanToOpen:"Scan to open the app", qrAppName:"Stock Management App",
    qrStep1:"Open the camera app on your phone", qrStep2:"Point the camera at the QR code", qrStep3:"Tap the notification to log in",
    stockManagement:"Stock Management",
    selectName:"Select your name", noAccounts:"No accounts available.",
    tabStatus:"Status", tabConsumption:"Consumption", tabLog:"Log",
    trays:"Trays", monthlyReport:"Monthly Report", createOrderReport:"Create order report",
    colProduct:"Product", colOrder:"Order",
    monthlyConsumption:"Monthly consumption", recordMonthly:"Record monthly stock", saving:"Saving...",
    recordMonthlyHint:"Tap record monthly stock at the start of the month.",
    consumptionVs:"Consumption vs", noConsumption:"No consumption", monthlyRecords:"Monthly records",
    productsToReorder:(n)=>`${n} products to reorder`, allStockOk:"All stock at target!",
    recipients:"Recipients", noRecipients:"No recipients. Set them up via Admin.",
    sendByEmail:"Send by email", copyReport:"Copy report", copied:"Copied!", downloadPdf:"Download PDF",
    repTitle:"ORDER REPORT", repDate:"Date", repLocation:"Location", repNormalStock:"NORMAL STOCK", repTotal:"TOTAL TO ORDER", repBottles:"bottles", repOk:"ok", repTarget:"target",
    activityLog:"Activity log", clearLog:"Clear", confirmClearLog:"Clear the entire log? This cannot be undone.", noActivity:"No activity recorded yet.", roleSystem:"System",
    partNone:"none", confirmEmptyTray:(label)=>`Report ${label} completely empty? This sets all products to 0.`,
    targetLabel:"target", confirmEmptyStock:"Report normal stock completely empty? This sets all items to 0.",
    enterPin:"Enter PIN", wrongPin:"Incorrect PIN",
    tabProducts:"Products", tabStock:"Stock", tabEmail:"Email", tabAccounts:"Accounts", tabSettings:"Settings",
    admLabel:"Label", admSublabel:"Sublabel", admMaxLiters:"Max litres", admColor:"Colour",
    on:"ON", off:"OFF", admGhsCategory:"GHS Category", admNone:"— None —",
    save:"Save", saved:"Saved!",
    admNewProduct:"New product", admProduct:"Product", admName:"Name", admUnit:"Unit",
    admNewItem:"New item", admItem:"Item", admDept:"Department", admRecipient:"Recipient",
    admNewPw:"New password", admLeaveEmpty:"Leave empty = unchanged", admRole:"Role",
    admNewPerson:"New person", admAccount:"Account",
    admAppName:"App name", admLocation:"Location", admNewPin:"New PIN (4 digits)",
    langLabel:"🇬🇧 English",
    fbBtn:"Report an issue", fbTitle:"Report an issue or idea",
    fbIntro:"Something broken, a question or an improvement idea? Let us know here — we'll pick it up.",
    fbType:"Type of report", fbProblem:"Problem", fbProblemSub:"Something is broken / not working",
    fbChange:"Change / idea", fbChangeSub:"Suggestion or improvement",
    fbName:"Your name (optional)", fbNamePlaceholder:"E.g. Sanne",
    fbMessage:"Description", fbMessagePlaceholder:"Describe as clearly as possible what is wrong or what you propose…",
    fbSend:"Send", fbSending:"Sending…", fbRequired:"Please enter a description first.",
    fbThanksTitle:"Thank you!", fbThanksMsg:"Your report has been sent. We'll pick it up.", fbNew:"Submit another report",
    sds:"SDS", sdsTitle:"Safety Data Sheet", sdsFor:"SDS for",
    sdsNone:"No SDS uploaded yet.", sdsView:"View", sdsDownload:"Download",
    sdsUpload:"Upload SDS", sdsAdd:"Add SDS", sdsReplace:"Replace SDS", sdsRemove:"Remove SDS",
    sdsUploading:"Uploading…", sdsUploadedBy:"Uploaded by", sdsUploadedOn:"on",
    sdsTooBig:"File too large (max 10 MB).", sdsBadType:"Only PDF, JPG or PNG allowed.",
    sdsError:"Upload failed. Please try again.", sdsRemoveConfirm:"Remove this document?",
  },
  ar: {
    welcome:"مرحباً", chooseShelf:"اختر خزانة", chooseSection:"اختر صينية التسرب",
    chemicals:"خزانة السوائل", flammables:"مواد قابلة للاشتعال",
    normalStock:"المخزون العادي", consumables:"مواد الاستهلاك",
    worker:"موظف", manager:"مدير", admin:"مسؤول",
    logout:"خروج", back:"رجوع", close:"إغلاق",
    password:"كلمة المرور", enterPw:"أدخل كلمة المرور",
    wrongPw:"كلمة مرور خاطئة", blockedMsg:"محظور — انتظر 30 ثانية", blockedBtn:"محظور...",
    loginWorker:"تسجيل الدخول", loginManager:"تسجيل دخول المدير",
    full:"ممتلئ", none:"--",
    maxExceeded:"تم تجاوز الحد الأقصى!", almostFull:"شبه ممتلئ — تحقق قبل الإضافة",
    toOrder:"للطلب", inStock:"متوفر", present:"موجود",
    reportEmpty:"الإبلاغ عن صينية فارغة", reportStockEmpty:"الإبلاغ عن نفاد المخزون",
    sectionFill:"إشغال الصينية", per:"لكل", reorder:"إعادة الطلب",
    bottles:"قطع", bottlesSingle:"قطعة", max:"حد أقصى", pieces:"قطع",
    ofTarget:(done,total)=>`${done} من ${total} منتجات عند الهدف`,
    flammable:"قابل للاشتعال", corrosive:"آكل",
    persons:"أشخاص", person:"شخص", pinRequired:"يتطلب رمز PIN",
    manualBtn:"الدليل", manualWorker:"للموظفين", manualWorkerSub:"تحديث المخزون وتسجيل الدخول",
    manualManager:"للمدراء", manualManagerSub:"نظرة عامة، تقارير وإدارة",
    qrPrint:"طباعة رمز QR", qrPrintBtn:"طباعة",
    qrAccessVia:"الدخول عبر رمز QR", qrScanToOpen:"امسح لفتح التطبيق", qrAppName:"تطبيق إدارة المخزون",
    qrStep1:"افتح تطبيق الكاميرا على هاتفك", qrStep2:"وجّه الكاميرا نحو رمز QR", qrStep3:"اضغط على الإشعار لتسجيل الدخول",
    stockManagement:"إدارة المخزون",
    selectName:"اختر اسمك", noAccounts:"لا توجد حسابات متاحة.",
    tabStatus:"الحالة", tabConsumption:"الاستهلاك", tabLog:"السجل",
    trays:"صواني التسرب", monthlyReport:"التقرير الشهري", createOrderReport:"إنشاء تقرير الطلب",
    colProduct:"المنتج", colOrder:"اطلب",
    monthlyConsumption:"الاستهلاك الشهري", recordMonthly:"تسجيل الحالة الشهرية", saving:"جارٍ الحفظ...",
    recordMonthlyHint:"اضغط على تسجيل الحالة الشهرية في بداية الشهر.",
    consumptionVs:"الاستهلاك مقارنةً بـ", noConsumption:"لا يوجد استهلاك", monthlyRecords:"السجلات الشهرية",
    productsToReorder:(n)=>`${n} منتجات لإعادة الطلب`, allStockOk:"كل المخزون عند الهدف!",
    recipients:"المستلمون", noRecipients:"لا يوجد مستلمون. قم بإعدادهم عبر المسؤول.",
    sendByEmail:"إرسال بالبريد الإلكتروني", copyReport:"نسخ التقرير", copied:"تم النسخ!", downloadPdf:"تنزيل PDF",
    repTitle:"تقرير الطلب", repDate:"التاريخ", repLocation:"الموقع", repNormalStock:"المخزون العادي", repTotal:"الإجمالي للطلب", repBottles:"زجاجات", repOk:"تمام", repTarget:"الهدف",
    activityLog:"سجل الأنشطة", clearLog:"مسح", confirmClearLog:"مسح السجل بالكامل؟ لا يمكن التراجع عن هذا.", noActivity:"لم يتم تسجيل أي نشاط بعد.", roleSystem:"النظام",
    partNone:"لا شيء", confirmEmptyTray:(label)=>`الإبلاغ عن أن ${label} فارغة تماماً؟ سيؤدي هذا إلى ضبط كل المنتجات على 0.`,
    targetLabel:"الهدف", confirmEmptyStock:"الإبلاغ عن أن المخزون العادي فارغ تماماً؟ سيؤدي هذا إلى ضبط كل العناصر على 0.",
    enterPin:"أدخل رمز PIN", wrongPin:"رمز PIN غير صحيح",
    tabProducts:"المنتجات", tabStock:"المخزون", tabEmail:"البريد الإلكتروني", tabAccounts:"الحسابات", tabSettings:"الإعدادات",
    admLabel:"التسمية", admSublabel:"تسمية فرعية", admMaxLiters:"الحد الأقصى لِلِترات", admColor:"اللون",
    on:"تشغيل", off:"إيقاف", admGhsCategory:"فئة GHS", admNone:"— لا شيء —",
    save:"حفظ", saved:"تم الحفظ!",
    admNewProduct:"منتج جديد", admProduct:"منتج", admName:"الاسم", admUnit:"الوحدة",
    admNewItem:"عنصر جديد", admItem:"عنصر", admDept:"القسم", admRecipient:"مستلم",
    admNewPw:"كلمة مرور جديدة", admLeaveEmpty:"اتركه فارغاً = دون تغيير", admRole:"الدور",
    admNewPerson:"شخص جديد", admAccount:"حساب",
    admAppName:"اسم التطبيق", admLocation:"الموقع", admNewPin:"رمز PIN جديد (4 أرقام)",
    langLabel:"🇸🇦 العربية",
    fbBtn:"الإبلاغ عن مشكلة", fbTitle:"الإبلاغ عن مشكلة أو فكرة",
    fbIntro:"هل هناك عطل أو سؤال أو فكرة للتحسين؟ أخبرنا هنا وسنتولى الأمر.",
    fbType:"نوع البلاغ", fbProblem:"مشكلة", fbProblemSub:"شيء لا يعمل / معطل",
    fbChange:"تعديل / فكرة", fbChangeSub:"اقتراح أو تحسين",
    fbName:"اسمك (اختياري)", fbNamePlaceholder:"مثال: سارة",
    fbMessage:"الوصف", fbMessagePlaceholder:"صف بأكبر قدر ممكن من الوضوح ما هي المشكلة أو ما تقترحه…",
    fbSend:"إرسال", fbSending:"جارٍ الإرسال…", fbRequired:"يرجى إدخال وصف أولاً.",
    fbThanksTitle:"شكراً لك!", fbThanksMsg:"تم إرسال بلاغك. سنتولى الأمر.", fbNew:"إرسال بلاغ آخر",
    sds:"صحيفة السلامة", sdsTitle:"صحيفة بيانات السلامة", sdsFor:"صحيفة السلامة لـ",
    sdsNone:"لم يتم رفع صحيفة سلامة بعد.", sdsView:"عرض", sdsDownload:"تنزيل",
    sdsUpload:"رفع صحيفة السلامة", sdsAdd:"إضافة مستند", sdsReplace:"استبدال صحيفة السلامة", sdsRemove:"حذف صحيفة السلامة",
    sdsUploading:"جارٍ الرفع…", sdsUploadedBy:"رفعها", sdsUploadedOn:"في",
    sdsTooBig:"الملف كبير جداً (الحد 10 ميغابايت).", sdsBadType:"يُسمح فقط بملفات PDF أو JPG أو PNG.",
    sdsError:"فشل الرفع. حاول مرة أخرى.", sdsRemoveConfirm:"حذف هذا المستند؟",
  },
  fr: {
    welcome:"Bienvenue", chooseShelf:"Choisissez une armoire", chooseSection:"Choisissez un bac",
    chemicals:"Armoire à liquides", flammables:"Substances inflammables",
    normalStock:"Stock normal", consumables:"Consommables",
    worker:"Employé", manager:"Manager", admin:"Administrateur",
    logout:"Déconnexion", back:"Retour", close:"Fermer",
    password:"Mot de passe", enterPw:"Entrez le mot de passe",
    wrongPw:"Mot de passe incorrect", blockedMsg:"Bloqué — attendez 30 secondes", blockedBtn:"Bloqué...",
    loginWorker:"Connexion employé", loginManager:"Connexion manager",
    full:"plein", none:"--",
    maxExceeded:"Maximum dépassé !", almostFull:"Presque plein — vérifiez avant de remplir",
    toOrder:"à commander", inStock:"en stock", present:"présent",
    reportEmpty:"Signaler bac vide", reportStockEmpty:"Signaler stock vide",
    sectionFill:"Occupation du bac", per:"par", reorder:"recommander",
    bottles:"bouteilles", bottlesSingle:"bouteille", max:"max", pieces:"pièces",
    ofTarget:(done,total)=>`${done} sur ${total} produits à l'objectif`,
    flammable:"Inflammable", corrosive:"Corrosif",
    persons:"personnes", person:"personne", pinRequired:"PIN requis",
    manualBtn:"Manuel", manualWorker:"Pour les employés", manualWorkerSub:"Mettre à jour le stock & se connecter",
    manualManager:"Pour les managers", manualManagerSub:"Aperçu, rapports & gestion",
    qrPrint:"Imprimer le code QR", qrPrintBtn:"Imprimer",
    qrAccessVia:"Accès via code QR", qrScanToOpen:"Scannez pour ouvrir l'application", qrAppName:"Application de gestion des stocks",
    qrStep1:"Ouvrez l'appareil photo de votre téléphone", qrStep2:"Dirigez la caméra vers le code QR", qrStep3:"Appuyez sur la notification pour vous connecter",
    stockManagement:"Gestion des stocks",
    selectName:"Sélectionnez votre nom", noAccounts:"Aucun compte disponible.",
    tabStatus:"Statut", tabConsumption:"Consommation", tabLog:"Journal",
    trays:"Bacs", monthlyReport:"Récapitulatif mensuel", createOrderReport:"Créer un rapport de commande",
    colProduct:"Produit", colOrder:"Commander",
    monthlyConsumption:"Consommation mensuelle", recordMonthly:"Enregistrer le relevé mensuel", saving:"Enregistrement...",
    recordMonthlyHint:"Appuyez sur enregistrer le relevé mensuel au début du mois.",
    consumptionVs:"Consommation par rapport à", noConsumption:"Aucune consommation", monthlyRecords:"Relevés mensuels",
    productsToReorder:(n)=>`${n} produits à recommander`, allStockOk:"Tous les stocks à l'objectif !",
    recipients:"Destinataires", noRecipients:"Aucun destinataire. Configurez-les via Administration.",
    sendByEmail:"Envoyer par e-mail", copyReport:"Copier le rapport", copied:"Copié !", downloadPdf:"Télécharger le PDF",
    repTitle:"RAPPORT DE COMMANDE", repDate:"Date", repLocation:"Emplacement", repNormalStock:"STOCK NORMAL", repTotal:"TOTAL À COMMANDER", repBottles:"bouteilles", repOk:"ok", repTarget:"objectif",
    activityLog:"Journal d'activité", clearLog:"Effacer", confirmClearLog:"Effacer tout le journal ? Cette action est irréversible.", noActivity:"Aucune activité enregistrée pour le moment.", roleSystem:"Système",
    partNone:"aucune", confirmEmptyTray:(label)=>`Signaler ${label} entièrement vide ? Cela met tous les produits à 0.`,
    targetLabel:"objectif", confirmEmptyStock:"Signaler le stock normal entièrement vide ? Cela met tous les articles à 0.",
    enterPin:"Entrez le PIN", wrongPin:"PIN incorrect",
    tabProducts:"Produits", tabStock:"Stock", tabEmail:"E-mail", tabAccounts:"Comptes", tabSettings:"Paramètres",
    admLabel:"Libellé", admSublabel:"Sous-libellé", admMaxLiters:"Litres max", admColor:"Couleur",
    on:"ON", off:"OFF", admGhsCategory:"Catégorie GHS", admNone:"— Aucune —",
    save:"Enregistrer", saved:"Enregistré !",
    admNewProduct:"Nouveau produit", admProduct:"Produit", admName:"Nom", admUnit:"Unité",
    admNewItem:"Nouvel article", admItem:"Article", admDept:"Département", admRecipient:"Destinataire",
    admNewPw:"Nouveau mot de passe", admLeaveEmpty:"Laisser vide = inchangé", admRole:"Rôle",
    admNewPerson:"Nouvelle personne", admAccount:"Compte",
    admAppName:"Nom de l'application", admLocation:"Emplacement", admNewPin:"Nouveau PIN (4 chiffres)",
    langLabel:"🇫🇷 Français",
    fbBtn:"Signaler un problème", fbTitle:"Signaler un problème ou une idée",
    fbIntro:"Quelque chose de cassé, une question ou une idée d'amélioration ? Dites-le ici — nous nous en occupons.",
    fbType:"Type de signalement", fbProblem:"Problème", fbProblemSub:"Quelque chose est cassé / ne marche pas",
    fbChange:"Modification / idée", fbChangeSub:"Suggestion ou amélioration",
    fbName:"Votre nom (facultatif)", fbNamePlaceholder:"Ex. Sanne",
    fbMessage:"Description", fbMessagePlaceholder:"Décrivez le plus clairement possible le problème ou votre proposition…",
    fbSend:"Envoyer", fbSending:"Envoi…", fbRequired:"Veuillez d'abord saisir une description.",
    fbThanksTitle:"Merci !", fbThanksMsg:"Votre signalement a été envoyé. Nous nous en occupons.", fbNew:"Envoyer un autre signalement",
    sds:"FDS", sdsTitle:"Fiche de données de sécurité", sdsFor:"FDS pour",
    sdsNone:"Aucune FDS téléchargée.", sdsView:"Consulter", sdsDownload:"Télécharger",
    sdsUpload:"Téléverser la FDS", sdsAdd:"Ajouter une FDS", sdsReplace:"Remplacer la FDS", sdsRemove:"Supprimer la FDS",
    sdsUploading:"Téléversement…", sdsUploadedBy:"Téléversé par", sdsUploadedOn:"le",
    sdsTooBig:"Fichier trop volumineux (max 10 Mo).", sdsBadType:"Seuls PDF, JPG ou PNG sont autorisés.",
    sdsError:"Échec du téléversement. Réessayez.", sdsRemoveConfirm:"Supprimer ce document ?",
  },
};
const tr = (lang, key, ...args) => {
  const v = TRANS[lang]?.[key] ?? TRANS.nl[key] ?? key;
  return typeof v === "function" ? v(...args) : v;
};
const LOCALE = {nl:"nl-NL", en:"en-GB", ar:"ar-EG", fr:"fr-FR"};
const dloc = (lang) => LOCALE[lang] || "nl-NL";

const DEF = {
  appName: "Voorraadbeheer", location: "Ruinerwold",
  adminPin: "9999", checkAlertDays: 14, shelfAlertPct: 80,
  features: { consumptionTracking: true, emailReports: true, partialBottles: true },
  accounts: [
    { id:1, username:"Medewerker 1", password:"123456", role:"worker",  active:true },
    { id:2, username:"Manager",      password:"654321", role:"manager", active:true },
  ],
  emails: [
    { id:1, dept:"Inkoop",     email:"inkoop@bedrijf.nl",     active:true },
    { id:2, dept:"Facilitair", email:"facilitair@bedrijf.nl", active:true },
  ],
  shelves: [
    { id:1, label:"Lekbak 1", sublabel:"Bovenste lekbak",  maxLiters:30, color:"#3D8B2E", category:"flammable", active:true, products:[
      {id:"1-1",name:"Glasreiniger",vol:0.75,target:5},{id:"1-2",name:"Ontvetter spray",vol:1.0,target:4},
      {id:"1-3",name:"Desinfectie middel",vol:1.0,target:4},{id:"1-4",name:"Badkamerreiniger",vol:2.0,target:3},{id:"1-5",name:"RVS reiniger",vol:0.5,target:5},
    ]},
    { id:2, label:"Lekbak 2", sublabel:"Middelste lekbak", maxLiters:30, color:"#5AAE3C", category:"flammable", active:true, products:[
      {id:"2-1",name:"Allesreiniger",vol:5.0,target:2},{id:"2-2",name:"Vloeibare zeep",vol:2.0,target:3},
      {id:"2-3",name:"Handzeep",vol:1.0,target:3},{id:"2-4",name:"Schuurmiddel",vol:1.0,target:3},{id:"2-5",name:"Sanitairreiniger",vol:2.0,target:2},
    ]},
    { id:3, label:"Lekbak 3", sublabel:"Derde lekbak",    maxLiters:26, color:"#78C74E", category:"corrosive", active:true, products:[
      {id:"3-1",name:"Green'r Indus",vol:5.0,target:1},{id:"3-2",name:"Green'r Hand dish",vol:1.0,target:4},
      {id:"3-3",name:"Green'r Wind",vol:0.75,target:8},{id:"3-4",name:"Green'r Easy All",vol:0.75,target:3},
      {id:"3-5",name:"Green'r Sanit",vol:0.75,target:2},{id:"3-6",name:"Green'r WC",vol:0.75,target:3},{id:"3-7",name:"Phago'derm Sensitive",vol:5.0,target:1},
    ]},
    { id:4, label:"Lekbak 4", sublabel:"Onderste lekbak", maxLiters:33, color:"#A8DE52", category:"corrosive", active:true, products:[
      {id:"4-1",name:"Keukenreiniger",vol:1.0,target:4},{id:"4-2",name:"Vetoplosser",vol:2.0,target:3},
      {id:"4-3",name:"Roestvrijstaal spray",vol:0.5,target:5},{id:"4-4",name:"Ontkalker",vol:1.0,target:3},{id:"4-5",name:"Multireiniger",vol:5.0,target:2},
    ]},
  ],
  // Normale voorraad — op stuks, geen lekbakken
  voorraad: [
    { id:"v-1", name:"WC papier",           unit:"rol",  target:48, active:true },
    { id:"v-2", name:"Handdoekrollen",      unit:"rol",  target:20, active:true },
    { id:"v-3", name:"Latex handschoenen",  unit:"doos", target:10, active:true },
    { id:"v-4", name:"Haarnetjes",          unit:"doos", target:5,  active:true },
    { id:"v-5", name:"Baardnetjes",         unit:"doos", target:5,  active:true },
  ],
};

// Verse config voor een nog niet ingerichte locatie: kopie van DEF met de juiste locatienaam.
const defCfgFor = (locId) => { const c=JSON.parse(JSON.stringify(DEF)); c.location=locName(locId); return c; };

const CAT = {
  flammable:{label:"Ontvlambaar",icon:"🔥",ghs:"GHS02",color:"#E8632A",bg:"#FDF0EB"},
  corrosive:{label:"Corrosief",icon:"⚗️",ghs:"GHS05",color:"#7C3A9A",bg:"#F5EEFF"},
};

const aSh  = (cfg) => cfg.shelves.filter(s=>s.active);
const aPr  = (sh)  => sh.products;
const defI = (cfg) => {
  const i={};
  cfg.shelves.forEach(s=>s.products.forEach(p=>{i[p.id]={full:0,partial:0};}));
  (cfg.voorraad||[]).forEach(p=>{i[p.id]={count:0};});
  return i;
};
const pL   = (p,inv) => { const s=inv[p.id]||{full:0,partial:0}; return s.full*p.vol+(s.partial>0?p.vol*s.partial/100:0); };
const shL  = (sh,inv) => aPr(sh).reduce((s,p)=>s+pL(p,inv),0);
const shP  = (sh,inv) => Math.min((shL(sh,inv)/sh.maxLiters)*100,100);
const fCol = (pct) => pct>=90?"#D44A2A":pct>=70?"#E8A020":pct>=30?"#3D8B2E":"#5AB8E8";
const uCol = (n,t) => n===0?"#3D8B2E":n/t>=1?"#D44A2A":n/t>=0.5?"#E8A020":"#F5C842";

const S = {
  card:{background:"#fff",border:"2.5px solid #C8E6B0",borderRadius:18,padding:16,boxShadow:"0 4px 16px rgba(61,139,46,0.12)",marginBottom:12},
  btn:{border:"none",borderRadius:14,cursor:"pointer",fontFamily:"Nunito,sans-serif",fontWeight:800,padding:"13px 20px",fontSize:14},
  inp:{background:"#F5FBF0",border:"2px solid #C8E6B0",borderRadius:10,padding:"10px 12px",fontFamily:"Nunito,sans-serif",fontSize:13,fontWeight:700,color:"#1A3A0A",outline:"none",width:"100%",boxSizing:"border-box"},
  lbl:{fontSize:10,fontWeight:800,color:"#8AAA7A",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4},
};
const GF=`@import url('https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap');
.mgr-grid{display:grid;grid-template-columns:1fr;gap:10px;}
@media(min-width:600px){.mgr-grid{grid-template-columns:1fr 1fr;}}
/* Fix 3 — Responsive containers */
.resp-wide{width:100%;margin:0 auto;}
@media(min-width:640px){
  .resp-wide{max-width:760px!important;padding-left:20px!important;padding-right:20px!important;}
  /* Fix 2 — Admin tabs: wrap op desktop i.p.v. scrollen */
  .admin-tabs-bar{overflow-x:visible!important;flex-wrap:wrap!important;}
  /* Fix 1 — Modals: floating dialog op desktop */
  .modal-overlay{justify-content:center!important;padding:32px 16px!important;overflow-y:auto!important;align-items:flex-start!important;}
  .modal-box{min-height:0!important;border-radius:20px!important;box-shadow:0 28px 64px rgba(0,0,0,0.5)!important;overflow-y:auto!important;max-height:90vh!important;}
}
/* Fix 5 — Grotere labels op desktop */
@media(min-width:640px){
  .lbl-responsive{font-size:11px!important;letter-spacing:0.5px!important;}
  .text-sm-responsive{font-size:12px!important;}
}
/* Fix 6 — Admin formulieren: 3 kolommen op desktop */
@media(min-width:640px){
  .admin-grid-2{grid-template-columns:1fr 1fr!important;}
  .admin-grid-3{display:grid!important;grid-template-columns:1fr 1fr 1fr!important;gap:8px!important;}
}
/* Fix 4 — Hover effecten (desktop) */
.card-hover{transition:transform .15s ease,filter .15s ease;}
.card-hover:hover{transform:translateY(-4px);filter:brightness(1.07);}
.btn-hover{transition:opacity .12s ease,transform .12s ease;}
.btn-hover:hover{opacity:.88;transform:translateY(-1px);}
.login-card-hover{transition:box-shadow .15s ease,border-color .15s ease;}
.login-card-hover:hover{box-shadow:0 8px 28px rgba(61,139,46,0.2)!important;}
@page{size:A4;margin:0;}
@media print{
  body{visibility:hidden!important;}
  #qr-a4-print,#qr-a4-print *{visibility:visible!important;}
  #qr-a4-print{position:absolute!important;left:0!important;top:0!important;width:210mm!important;min-height:297mm!important;box-shadow:none!important;}
  .qr-no-print{display:none!important;}
}`;

function HelloFreshLogo({size=32}){
  return(
    <img src={`${import.meta.env.BASE_URL}hellofresh-logo.svg`} height={size} width={size*1.5} style={{display:"inline-block",flexShrink:0,objectFit:"contain"}} alt="HelloFresh"/>
  );
}

export default function App() {
  const [cfg,setCfg]       = useState(null);
  const [inv,setInv]       = useState(null);
  const [snaps,setSnaps]   = useState([]);
  const [loading,setLoading] = useState(true);
  const [role,setRole]     = useState(null);
  const [currentUser,setCurrentUser] = useState(null);
  const [lang,setLang]     = useState("nl");
  const [mgrTab,setMgrTab] = useState("status");
  const [screen,setScreen] = useState("home");
  // "home" | "open" | "shelf-N" | "voorraad"
  const [loginErr,setLoginErr] = useState("");
  const [loginRole,setLoginRole] = useState(null);
  const [showManual,setShowManual] = useState(null);
  const [manualMenu,setManualMenu] = useState(false);
  const [adminPin,setAdminPin] = useState("");
  const [adminErr,setAdminErr] = useState(false);
  const [showAdmin,setShowAdmin] = useState(false);
  const [showReport,setShowReport] = useState(false);
  const [showQR,setShowQR] = useState(false);
  const [showFeedback,setShowFeedback] = useState(false);
  const [pinAttempts,setPinAttempts] = useState(0);
  const [pinLocked,setPinLocked] = useState(false);
  const [auditLog,setAuditLog] = useState([]);
  const [sdsMap,setSdsMap] = useState({});   // VIB/SDS per product-id (key vkast-sds:<locId>)
  // Deep-link: ?loc=<hub> in de URL (bijv. via een hub-specifieke QR) opent direct die locatie.
  const [locId,setLocId]   = useState(()=>{
    try{ const q=new URLSearchParams(window.location.search).get("loc"); return LOCATIONS.some(l=>l.id===q)?q:null; }catch{ return null; }
  });
  const [showHQ,setShowHQ] = useState(false);   // HQ-overzicht (alle locaties)

  // Data laden per locatie. Draait opnieuw zodra een andere locatie wordt gekozen.
  useEffect(()=>{
    if(!locId)return;
    let cancelled=false;
    setLoading(true);
    const kCfg=keyFor("vkast-cfg",locId), kInv=keyFor("vkast-inv",locId), kSnap=keyFor("vkast-snap",locId), kAudit=keyFor("vkast-audit",locId), kSds=keyFor("vkast-sds",locId);
    (async()=>{
      try{
        const [{data:cd},{data:id_},{data:sd},{data:ad},{data:sds}]=await Promise.all([
          supabase.from("app_state").select("value").eq("key",kCfg).maybeSingle(),
          supabase.from("app_state").select("value").eq("key",kInv).maybeSingle(),
          supabase.from("app_state").select("value").eq("key",kSnap).maybeSingle(),
          supabase.from("app_state").select("value").eq("key",kAudit).maybeSingle(),
          supabase.from("app_state").select("value").eq("key",kSds).maybeSingle(),
        ]);
        if(cancelled)return;
        const raw=cd?.value||ls.get(kCfg)||defCfgFor(locId);
        const c=await migrateHashes(raw,locId);
        setCfg(c);
        setInv(id_?.value||ls.get(kInv)||defI(c));
        setSnaps(sd?.value||ls.get(kSnap)||[]);
        setAuditLog(ad?.value||ls.get(kAudit)||[]);
        setSdsMap(sds?.value||ls.get(kSds)||{});
      }catch{
        if(cancelled)return;
        const raw=ls.get(kCfg)||defCfgFor(locId);
        const c=await migrateHashes(raw,locId);
        setCfg(c);
        setInv(ls.get(kInv)||defI(c));
        setSnaps(ls.get(kSnap)||[]);
        setAuditLog(ls.get(kAudit)||[]);
        setSdsMap(ls.get(kSds)||{});
      }
      if(!cancelled)setLoading(false);
    })();
    const ch=supabase.channel("app_state_rt_"+locId)
      .on("postgres_changes",{event:"*",schema:"public",table:"app_state"},(p)=>{
        if(!p.new)return;
        const {key,value}=p.new;
        if(key===kCfg)setCfg(value);
        else if(key===kInv)setInv(value);
        else if(key===kSnap)setSnaps(value);
        else if(key===kAudit)setAuditLog(value);
        else if(key===kSds)setSdsMap(value);
      }).subscribe();
    return()=>{cancelled=true;supabase.removeChannel(ch);};
  },[locId]);

  // Terug naar het locatiekeuzescherm: alle locatie-gebonden state wissen.
  const leaveLocation = ()=>{
    try{ window.history.replaceState(null,"",window.location.pathname); }catch{}
    setLocId(null);setCfg(null);setInv(null);setSnaps([]);setAuditLog([]);setSdsMap({});
    setRole(null);setCurrentUser(null);setLang("nl");setLoginRole(null);setLoginErr("");
    setScreen("home");setMgrTab("status");setShowAdmin(false);setLoading(true);
  };

  const updateInv = useCallback((pid,field,val)=>{
    setInv(prev=>{
      const current = prev[pid] || (field==="count" ? {count:0} : {full:0,partial:0});
      const next={...prev,[pid]:{...current,[field]:val}};
      dbSet(keyFor("vkast-inv",locId),next);
      return next;
    });
  },[locId]);

  const addAudit = useCallback((msg)=>{
    const entry={id:Date.now(),ts:new Date().toISOString(),role:role||"systeem",user:currentUser||"Onbekend",msg};
    setAuditLog(prev=>{ const next=[entry,...prev].slice(0,200); dbSet(keyFor("vkast-audit",locId),next); return next; });
  },[role,currentUser,locId]);

  // sdsMap[productId] is een array van documenten. Oudere data (één object) wordt
  // bij gebruik genormaliseerd zodat bestaande uploads blijven werken.
  const saveSds = useCallback((productId,doc)=>{
    setSdsMap(prev=>{
      const cur=Array.isArray(prev[productId])?prev[productId]:(prev[productId]?[prev[productId]]:[]);
      const next={...prev,[productId]:[...cur,doc]};
      dbSet(keyFor("vkast-sds",locId),next); return next;
    });
    addAudit(`VIB toegevoegd — ${doc.productName||productId} (${doc.fileName})`);
  },[locId,addAudit]);

  const removeSds = useCallback((productId,doc,productName)=>{
    setSdsMap(prev=>{
      const cur=Array.isArray(prev[productId])?prev[productId]:(prev[productId]?[prev[productId]]:[]);
      const rest=cur.filter(d=>d.path!==doc.path);
      const next={...prev};
      if(rest.length)next[productId]=rest; else delete next[productId];
      dbSet(keyFor("vkast-sds",locId),next); return next;
    });
    addAudit(`VIB verwijderd — ${productName||productId} (${doc.fileName||""})`);
  },[locId,addAudit]);

  const saveCfg = useCallback((nc)=>{ setCfg(nc); dbSet(keyFor("vkast-cfg",locId),nc); addAudit("Configuratie opgeslagen"); },[addAudit,locId]);
  const takeSnap = useCallback((label)=>{
    const snap={id:Date.now(),label,date:new Date().toISOString(),inv:JSON.parse(JSON.stringify(inv))};
    setSnaps(p=>{ const n=[snap,...p].slice(0,12); dbSet(keyFor("vkast-snap",locId),n); return n; });
    addAudit(`Maandstand vastgelegd: ${label}`);
  },[inv,addAudit,locId]);
  const saveSnaps = useCallback((n)=>{ setSnaps(n); dbSet(keyFor("vkast-snap",locId),n); },[locId]);
  const clearAudit = useCallback(()=>{ setAuditLog([]); dbSet(keyFor("vkast-audit",locId),[]); },[locId]);

  const openCab  = ()=>{ setScreen("open"); };
  const closeCab = ()=>{ setScreen("home"); };
  const activeShelf = screen.startsWith("shelf-")?aSh(cfg||DEF).find(s=>s.id===parseInt(screen.split("-")[1])):null;

  // Geen locatie gekozen → keuzescherm (of HQ-overzicht).
  if (!locId) {
    if (showHQ) return <HQDashboard onBack={()=>setShowHQ(false)}/>;
    return <LocationPicker onPick={setLocId} onHQ={()=>setShowHQ(true)}/>;
  }

  if (loading||!cfg||!inv) return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#F0FAE8",fontFamily:"Nunito,sans-serif"}}>
      <style>{GF}</style>
      <div style={{textAlign:"center"}}><div style={{marginBottom:12}}><HelloFreshLogo size={52}/></div><div style={{fontSize:14,fontWeight:700,color:"#8AAA7A",letterSpacing:2}}>LADEN...</div></div>
    </div>
  );

  if (showAdmin) return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#1A1A2E,#16213E)",fontFamily:"Nunito,sans-serif",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <style>{GF}</style>
      <Hdr cfg={cfg} isAdmin lang={lang} onBack={()=>{setShowAdmin(false);setAdminPin("");setAdminErr(false);}} backLabel={tr(lang,"back")}/>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{background:"#1A1A2E",border:"2px solid #7C5CBF",borderRadius:24,padding:32,width:"100%",maxWidth:300,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:10}}>🔧</div>
          <div style={{fontSize:20,fontWeight:900,color:"#A07EE0",marginBottom:4}}>{tr(lang,"admin")}</div>
          <div style={{fontSize:10,color:"#5A4A7A",letterSpacing:2,textTransform:"uppercase",marginBottom:20}}>{tr(lang,"enterPin")}</div>
          {adminErr&&<div style={{color:"#e74c3c",fontSize:12,fontWeight:700,marginBottom:10}}>{tr(lang,"wrongPin")}</div>}
          <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:20}}>
            {[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:"50%",border:`2.5px solid ${adminPin.length>i?"#7C5CBF":"#3D2A7A"}`,background:adminPin.length>i?"#7C5CBF":"transparent"}}/>)}
          </div>
          {pinLocked&&<div style={{color:"#e74c3c",fontSize:12,fontWeight:700,marginBottom:10}}>{tr(lang,"blockedMsg")}</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[1,2,3,4,5,6,7,8,9].map(n=>(
              <button key={n} style={{height:52,background:"#16213E",border:"2px solid #3D2A7A",borderRadius:12,color:pinLocked?"#3D2A7A":"#C0B0E8",fontFamily:"Nunito,sans-serif",fontSize:20,fontWeight:700,cursor:pinLocked?"not-allowed":"pointer"}}
                onClick={()=>{
                  if(adminPin.length>=4||pinLocked)return;
                  const nx=adminPin+n; setAdminPin(nx);
                  if(nx.length===4)setTimeout(async()=>{
                    const h=await hashPw(nx);
                    if(h===cfg.adminPin){setRole("admin");setCurrentUser("Beheerder");setShowAdmin(false);setAdminPin("");setAdminErr(false);setPinAttempts(0);}
                    else{const a=pinAttempts+1;setPinAttempts(a);if(a>=3){setPinLocked(true);setTimeout(()=>{setPinLocked(false);setPinAttempts(0);},30000);}setAdminErr(true);setAdminPin("");}
                  },150);
                }}>{n}</button>
            ))}
            <div/>
            <button style={{height:52,background:"#16213E",border:"2px solid #3D2A7A",borderRadius:12,color:pinLocked?"#3D2A7A":"#C0B0E8",fontFamily:"Nunito,sans-serif",fontSize:20,fontWeight:700,cursor:pinLocked?"not-allowed":"pointer"}}
              onClick={()=>{
                if(adminPin.length>=4||pinLocked)return;
                const nx=adminPin+"0"; setAdminPin(nx);
                if(nx.length===4)setTimeout(async()=>{
                  const h=await hashPw(nx);
                  if(h===cfg.adminPin){setRole("admin");setCurrentUser("Beheerder");setShowAdmin(false);setAdminPin("");setAdminErr(false);setPinAttempts(0);}
                  else{const a=pinAttempts+1;setPinAttempts(a);if(a>=3){setPinLocked(true);setTimeout(()=>{setPinLocked(false);setPinAttempts(0);},30000);}setAdminErr(true);setAdminPin("");}
                },150);
              }}>0</button>
            <button style={{height:52,background:"#16213E",border:"2px solid #3D2A7A",borderRadius:12,color:"#9B8EC4",fontFamily:"Nunito,sans-serif",fontSize:16,cursor:"pointer"}}
              onClick={()=>{setAdminPin(p=>p.slice(0,-1));setAdminErr(false);}}>DEL</button>
          </div>
        </div>
      </div>
      <Ftr isAdmin/>
    </div>
  );

  if (!role) {
    const allAccs=(cfg.accounts||[]).filter(a=>a.active);
    const workerAccs=allAccs.filter(a=>a.role==="worker");
    const managerAccs=allAccs.filter(a=>a.role==="manager");

    if (!loginRole) return (
      <div dir={lang==="ar"?"rtl":"ltr"} style={{minHeight:"100vh",background:"linear-gradient(160deg,#F0FAE8,#FEFCF4)",fontFamily:"Nunito,Arial,sans-serif",display:"flex",flexDirection:"column",alignItems:"center"}}>
        <style>{GF}</style>
        <Hdr cfg={cfg}/>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",width:"100%"}}>
          <div style={{marginBottom:10}}><HelloFreshLogo size={56}/></div>
          <div style={{fontSize:30,fontWeight:900,color:"#3D8B2E",marginBottom:4}}>{tr(lang,"welcome")}</div>
          <button onClick={leaveLocation} title="Andere locatie kiezen"
            style={{display:"inline-flex",alignItems:"center",gap:6,background:"#fff",border:"2px solid #C8E6B0",borderRadius:20,padding:"5px 14px",marginBottom:18,fontFamily:"Nunito,Arial,sans-serif",fontSize:11,letterSpacing:1,textTransform:"uppercase",fontWeight:800,color:"#3D8B2E",cursor:"pointer"}}>
            📍 {cfg.location} <span style={{fontSize:9,opacity:0.6}}>▼</span>
          </button>

          {/* Taalkeuze */}
          <div style={{marginBottom:28,position:"relative",display:"inline-block"}}>
            <select
              value={lang}
              onChange={e=>setLang(e.target.value)}
              style={{background:"#fff",border:"2px solid #C8E6B0",borderRadius:20,padding:"10px 40px 10px 18px",fontFamily:"Nunito,Arial,sans-serif",fontSize:13,fontWeight:700,color:"#3D8B2E",cursor:"pointer",outline:"none",appearance:"none",WebkitAppearance:"none",minWidth:160}}>
              <option value="nl">🇳🇱 Nederlands</option>
              <option value="en">🇬🇧 English</option>
              <option value="ar">🇸🇦 العربية</option>
              <option value="fr">🇫🇷 Français</option>
            </select>
            <span style={{position:"absolute",right:14,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#3D8B2E",fontSize:12}}>▼</span>
          </div>

          {/* Rolknoppen */}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,width:"100%",maxWidth:420}}>
            <div className="card-hover" onClick={()=>{setLoginRole("worker");setLoginErr("");}} style={{cursor:"pointer",background:"linear-gradient(160deg,#4DA035,#3D8B2E)",border:"3px solid #2D7020",borderRadius:18,padding:"22px 8px",textAlign:"center",boxShadow:"0 6px 20px rgba(61,139,46,0.28)"}}>
              <div style={{fontSize:34,marginBottom:8}}>👥</div>
              <div style={{fontSize:13,fontWeight:900,color:"#fff",lineHeight:1.2}}>{tr(lang,"worker")}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.75)",marginTop:4}}>{workerAccs.length} {workerAccs.length===1?tr(lang,"person"):tr(lang,"persons")}</div>
            </div>
            <div className="card-hover" onClick={()=>{setLoginRole("manager");setLoginErr("");}} style={{cursor:"pointer",background:"linear-gradient(160deg,#E8632A,#C44820)",border:"3px solid #A03010",borderRadius:18,padding:"22px 8px",textAlign:"center",boxShadow:"0 6px 20px rgba(232,99,42,0.28)"}}>
              <div style={{fontSize:34,marginBottom:8}}>📊</div>
              <div style={{fontSize:13,fontWeight:900,color:"#fff",lineHeight:1.2}}>{tr(lang,"manager")}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.75)",marginTop:4}}>{managerAccs.length} {managerAccs.length===1?tr(lang,"person"):tr(lang,"persons")}</div>
            </div>
            <div className="card-hover" onClick={()=>setShowAdmin(true)} style={{cursor:"pointer",background:"linear-gradient(160deg,#6A4ABF,#5A3A9F)",border:"3px solid #4A2A8F",borderRadius:18,padding:"22px 8px",textAlign:"center",boxShadow:"0 6px 20px rgba(106,74,191,0.28)"}}>
              <div style={{fontSize:34,marginBottom:8}}>🔧</div>
              <div style={{fontSize:13,fontWeight:900,color:"#fff",lineHeight:1.2}}>{tr(lang,"admin")}</div>
              <div style={{fontSize:11,color:"rgba(255,255,255,0.75)",marginTop:4}}>{tr(lang,"pinRequired")}</div>
            </div>
          </div>

          {/* Handleiding knop */}
          <div style={{marginTop:22,position:"relative"}}>
            <button
              onClick={()=>setManualMenu(m=>!m)}
              style={{background:"#fff",border:"2.5px solid #C8E6B0",borderRadius:20,padding:"12px 28px",fontFamily:"Nunito,Arial,sans-serif",fontSize:14,fontWeight:800,color:"#3D8B2E",cursor:"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:"0 3px 12px rgba(61,139,46,0.12)"}}>
              <span style={{fontSize:18}}>📖</span> {tr(lang,"manualBtn")} <span style={{fontSize:11,opacity:0.6}}>{manualMenu?"▲":"▼"}</span>
            </button>
            {manualMenu&&(
              <div style={{position:"absolute",top:"110%",left:"50%",transform:"translateX(-50%)",background:"#fff",border:"2px solid #C8E6B0",borderRadius:14,boxShadow:"0 8px 28px rgba(61,139,46,0.18)",zIndex:100,width:"min(260px,90vw)",overflow:"hidden"}}>
                <button onClick={()=>{setShowManual("worker");setManualMenu(false);}}
                  style={{width:"100%",padding:"14px 18px",background:"none",border:"none",borderBottom:"1.5px solid #EEF9E6",fontFamily:"Nunito,Arial,sans-serif",fontSize:13,fontWeight:800,color:"#3D8B2E",cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
                  <span style={{fontSize:22}}>👥</span>
                  <div>
                    <div>{tr(lang,"manualWorker")}</div>
                    <div style={{fontSize:10,color:"#8AAA7A",fontWeight:600,marginTop:1}}>{tr(lang,"manualWorkerSub")}</div>
                  </div>
                </button>
                <button onClick={()=>{setShowManual("manager");setManualMenu(false);}}
                  style={{width:"100%",padding:"14px 18px",background:"none",border:"none",fontFamily:"Nunito,Arial,sans-serif",fontSize:13,fontWeight:800,color:"#E8632A",cursor:"pointer",display:"flex",alignItems:"center",gap:10,textAlign:"left"}}>
                  <span style={{fontSize:22}}>📊</span>
                  <div>
                    <div>{tr(lang,"manualManager")}</div>
                    <div style={{fontSize:10,color:"#8AAA7A",fontWeight:600,marginTop:1}}>{tr(lang,"manualManagerSub")}</div>
                  </div>
                </button>
              </div>
            )}
          </div>

          {/* QR-code knop */}
          <div style={{marginTop:12}}>
            <button
              onClick={()=>setShowQR(true)}
              style={{background:"#fff",border:"2.5px solid #C8E6B0",borderRadius:20,padding:"12px 28px",fontFamily:"Nunito,Arial,sans-serif",fontSize:14,fontWeight:800,color:"#3D8B2E",cursor:"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:"0 3px 12px rgba(61,139,46,0.12)"}}>
              <span style={{fontSize:18}}>📱</span> {tr(lang,"qrPrint")}
            </button>
          </div>

          {/* Melding / probleem doorgeven (geen login nodig) */}
          <div style={{marginTop:12}}>
            <button
              onClick={()=>setShowFeedback(true)}
              style={{background:"#fff",border:"2.5px solid #F3C98B",borderRadius:20,padding:"12px 28px",fontFamily:"Nunito,Arial,sans-serif",fontSize:14,fontWeight:800,color:"#C46A12",cursor:"pointer",display:"flex",alignItems:"center",gap:8,boxShadow:"0 3px 12px rgba(196,106,18,0.12)"}}>
              <span style={{fontSize:18}}>📣</span> {tr(lang,"fbBtn")}
            </button>
          </div>
        </div>
        {showManual&&<ManualModal type={showManual} lang={lang} onClose={()=>setShowManual(null)}/>}
        {showQR&&<QRPrintModal cfg={cfg} locId={locId} lang={lang} onClose={()=>setShowQR(false)}/>}
        {showFeedback&&<FeedbackModal locId={locId} lang={lang} onClose={()=>setShowFeedback(false)}/>}
        <Ftr/>
      </div>
    );

    const roleAccs = loginRole==="worker" ? workerAccs : managerAccs;
    const roleColor = loginRole==="worker" ? "#3D8B2E" : "#E8632A";
    return (
      <div dir={lang==="ar"?"rtl":"ltr"} style={{minHeight:"100vh",background:"linear-gradient(160deg,#F0FAE8,#FEFCF4)",fontFamily:"Nunito,sans-serif",display:"flex",flexDirection:"column",alignItems:"center"}}>
        <style>{GF}</style>
        <Hdr cfg={cfg} lang={lang} onBack={()=>{setLoginRole(null);setLoginErr("");}} backLabel={tr(lang,"back")}/>
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"24px 20px",width:"100%"}}>
          <div style={{marginBottom:6,fontSize:28}}>{loginRole==="worker"?"👥":"📊"}</div>
          <div style={{fontSize:18,fontWeight:900,color:roleColor,marginBottom:20}}>{tr(lang,loginRole==="worker"?"loginWorker":"loginManager")}</div>
          <div style={{width:"100%",maxWidth:340}}>
            <AccountLoginPanel
              key={loginRole}
              accounts={roleAccs}
              lang={lang}
              loginErr={loginErr}
              onClear={()=>setLoginErr("")}
              onFail={id=>setLoginErr(id)}
              onSuccess={acc=>{setRole(acc.role);setCurrentUser(acc.username);}}
              roleColor={roleColor}
            />
          </div>
        </div>
        <Ftr/>
      </div>
    );
  }

  if (role==="admin") return (
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#1A1A2E,#0F3460)",fontFamily:"Nunito,sans-serif",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <style>{GF}</style>
      <Hdr cfg={cfg} isAdmin role="admin" onBack={()=>{setRole(null);setCurrentUser(null);setLang("nl");}} backLabel={tr(lang,"logout")}/>
      <AdminPanel cfg={cfg} onSave={saveCfg} lang={lang} sdsMap={sdsMap} locId={locId} onSdsSaved={saveSds} onSdsRemoved={removeSds} uploadedBy={currentUser}/>
      <Ftr isAdmin/>
    </div>
  );

  if (role==="manager") {
    const shelves=aSh(cfg);
    const vProducts=(cfg.voorraad||[]).filter(p=>p.active!==false);
    const totalOrderShelves=shelves.reduce((s,sh)=>s+aPr(sh).reduce((ss,p)=>ss+Math.max(0,p.target-(inv[p.id]||{full:0}).full),0),0);
    const totalOrderVoorraad=vProducts.reduce((s,p)=>s+Math.max(0,p.target-(inv[p.id]||{count:0}).count),0);
    const totalOrder=totalOrderShelves+totalOrderVoorraad;
    return (
      <div dir={lang==="ar"?"rtl":"ltr"} style={{minHeight:"100vh",background:"linear-gradient(160deg,#F0FAE8,#FEFCF4)",fontFamily:"Nunito,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",paddingBottom:40}}>
        <style>{GF}</style>
        <Hdr cfg={cfg} role="manager" userName={currentUser} lang={lang} onBack={()=>{setRole(null);setCurrentUser(null);setLang("nl");}} backLabel={tr(lang,"logout")}/>
        <div className="resp-wide" style={{display:"flex",gap:8,width:"100%",maxWidth:440,padding:"12px 14px 0",margin:"0 auto"}}>
          {[["status",tr(lang,"tabStatus")],["verbruik",tr(lang,"tabConsumption")],["logboek",tr(lang,"tabLog")]].map(([t,l])=>(
            <button key={t} onClick={()=>setMgrTab(t)}
              style={{flex:1,padding:"10px 6px",border:"2.5px solid",borderColor:mgrTab===t?"#3D8B2E":"#C8E6B0",borderRadius:12,background:mgrTab===t?"#3D8B2E":"#fff",color:mgrTab===t?"#fff":"#8AAA7A",fontFamily:"Nunito,sans-serif",fontSize:11,fontWeight:800,cursor:"pointer"}}>
              {l}
            </button>
          ))}
        </div>
        <div className="resp-wide" style={{width:"100%",maxWidth:440,padding:"14px 14px 0",margin:"0 auto"}}>
          {mgrTab==="status"&&(
            <div>
              <div style={{display:"flex",gap:10,marginBottom:14}}>
                <div style={{flex:1,...S.card,textAlign:"center",padding:12}}>
                  <div style={{fontSize:28,fontWeight:900,color:totalOrder>0?"#E8A020":"#3D8B2E"}}>{totalOrder}</div>
                  <div style={{fontSize:9,color:"#8AAA7A",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginTop:3}}>{tr(lang,"toOrder")}</div>
                </div>
                <div style={{flex:1,...S.card,textAlign:"center",padding:12}}>
                  <div style={{fontSize:28,fontWeight:900,color:"#5AAE3C"}}>{shelves.length}</div>
                  <div style={{fontSize:9,color:"#8AAA7A",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginTop:3}}>{tr(lang,"trays")}</div>
                </div>
              </div>
              {cfg.features.emailReports&&(
                <button className="btn-hover" onClick={()=>setShowReport(true)}
                  style={{width:"100%",padding:"16px 20px",background:"linear-gradient(135deg,#E8632A,#D44A20)",border:"none",borderRadius:16,color:"#fff",fontFamily:"Nunito,sans-serif",fontSize:15,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:16}}>
                  <span style={{fontSize:22}}>📧</span>
                  <div><div>{tr(lang,"monthlyReport")}</div><div style={{fontSize:10,opacity:0.85,marginTop:2}}>{tr(lang,"createOrderReport")}</div></div>
                </button>
              )}
              <div className="mgr-grid">
              {shelves.map(sh=>{
                const pct=shP(sh,inv); const col=fCol(pct);
                const ord=aPr(sh).reduce((s,p)=>s+Math.max(0,p.target-(inv[p.id]||{full:0}).full),0);
                return (
                  <div key={sh.id} style={{...S.card,padding:0,overflow:"hidden"}}>
                    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px 8px",borderBottom:"2px solid #EEF9E6"}}>
                      <div style={{display:"flex",alignItems:"center",gap:8}}>
                        <div style={{width:10,height:10,borderRadius:"50%",background:sh.color,flexShrink:0}}/>
                        <div>
                          <div style={{fontSize:13,fontWeight:800}}>{sh.label}</div>
                          <div style={{fontSize:9,color:"#8AAA7A",fontWeight:700,marginTop:2}}>{shL(sh,inv).toFixed(1)}L / {sh.maxLiters}L</div>
                          {sh.category&&CAT[sh.category]&&<div style={{fontSize:9,fontWeight:800,color:CAT[sh.category].color}}>{CAT[sh.category].icon} {CAT[sh.category].ghs}</div>}
                        </div>
                      </div>
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontSize:20,fontWeight:900,color:col}}>{Math.round(pct)}%</div>
                        <div style={{fontSize:9,color:ord>0?"#E8A020":"#3D8B2E",fontWeight:700}}>{ord>0?`+${ord}`:"✓"}</div>
                      </div>
                    </div>
                    <div style={{height:5,background:"#EEF9E6"}}><div style={{height:"100%",width:`${pct}%`,background:col}}/></div>
                    <div>
                      <div style={{display:"grid",gridTemplateColumns:"1fr auto",padding:"5px 10px",borderBottom:"1px solid #EEF9E6"}}>
                        {[["product",tr(lang,"colProduct")],["order",tr(lang,"colOrder")]].map(([k,h])=><div key={k} style={{fontSize:9,color:"#8AAA7A",fontWeight:800,textTransform:"uppercase",letterSpacing:1,textAlign:k!=="product"?"right":"left"}}>{h}</div>)}
                      </div>
                      {aPr(sh).map(p=>{
                        const st=inv[p.id]||{full:0,partial:0};
                        const need=Math.max(0,p.target-st.full);
                        const uc=uCol(need,p.target);
                        return (
                          <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr auto",padding:"7px 10px",borderBottom:"1px solid #F5FBF0",alignItems:"center",gap:6}}>
                            <div style={{display:"flex",alignItems:"center",gap:6,minWidth:0}}>
                              <span style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</span>
                              <SdsControl product={p} locId={locId} meta={sdsMap[p.id]} canEdit lang={lang} uploadedBy={currentUser} onSaved={saveSds} onRemoved={removeSds}/>
                            </div>
                            <div style={{textAlign:"right"}}>
                              <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:32,padding:"2px 5px",borderRadius:6,fontSize:11,fontWeight:800,border:`2px solid ${uc}66`,background:`${uc}18`,color:uc}}>{need===0?"✓":`+${need}`}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Normale voorraad sectie */}
              {vProducts.length>0&&(
                <div style={{...S.card,padding:0,overflow:"hidden",borderColor:"#90B8E8"}}>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"10px 12px 8px",borderBottom:"2px solid #EBF3FD",background:"linear-gradient(135deg,#EBF3FD,#F0F7FF)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <span style={{fontSize:16}}>📦</span>
                      <div>
                        <div style={{fontSize:13,fontWeight:800}}>{tr(lang,"normalStock")}</div>
                        <div style={{fontSize:9,color:"#5A80B0",fontWeight:700,marginTop:2}}>
                          {totalOrderVoorraad>0?`${totalOrderVoorraad} ${tr(lang,"toOrder")}`:tr(lang,"inStock")}
                        </div>
                      </div>
                    </div>
                    <div style={{fontSize:20,fontWeight:900,color:totalOrderVoorraad>0?"#E8A020":"#3D8B2E",flexShrink:0}}>
                      {totalOrderVoorraad>0?`+${totalOrderVoorraad}`:"✓"}
                    </div>
                  </div>
                  <div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr auto",padding:"5px 10px",borderBottom:"1px solid #EBF3FD"}}>
                      {[["product",tr(lang,"colProduct")],["order",tr(lang,"colOrder")]].map(([k,h])=><div key={k} style={{fontSize:9,color:"#8AAA7A",fontWeight:800,textTransform:"uppercase",letterSpacing:1,textAlign:k!=="product"?"right":"left"}}>{h}</div>)}
                    </div>
                    {vProducts.map(p=>{
                      const cnt=(inv[p.id]||{count:0}).count;
                      const need=Math.max(0,p.target-cnt);
                      const uc=uCol(need,p.target);
                      return(
                        <div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr auto",padding:"7px 10px",borderBottom:"1px solid #F0F7FF",alignItems:"center",gap:6}}>
                          <div style={{fontSize:11,fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{p.name}</div>
                          <div style={{textAlign:"right"}}>
                            <span style={{display:"inline-flex",alignItems:"center",justifyContent:"center",minWidth:32,padding:"2px 5px",borderRadius:6,fontSize:11,fontWeight:800,border:`2px solid ${uc}66`,background:`${uc}18`,color:uc}}>{need===0?"✓":`+${need}`}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
              </div>
            </div>
          )}
          {mgrTab==="verbruik"&&cfg.features.consumptionTracking&&(
            <ConsumptionView inv={inv} snaps={snaps} setSnaps={saveSnaps} onSnap={takeSnap} cfg={cfg} lang={lang}/>
          )}
          {mgrTab==="logboek"&&(
            <AuditView log={auditLog} onClear={clearAudit} lang={lang}/>
          )}
        </div>
        {showReport&&<ReportModal cfg={cfg} inv={inv} onClose={()=>setShowReport(false)} lang={lang}/>}
        <Ftr/>
      </div>
    );
  }

  const wSh=aSh(cfg);
  const isVoorraad = screen==="voorraad";
  const backLabel = activeShelf ? tr(lang,"close") : (screen==="open") ? tr(lang,"close") : isVoorraad ? tr(lang,"close") : null;
  const onBack    = activeShelf ? ()=>setScreen("open")
                  : screen==="open" ? closeCab
                  : isVoorraad ? ()=>setScreen("home")
                  : null;

  return (
    <div dir={lang==="ar"?"rtl":"ltr"} style={{minHeight:"100vh",background:"linear-gradient(160deg,#F0FAE8,#FEFCF4)",fontFamily:"Nunito,Arial,sans-serif",display:"flex",flexDirection:"column",alignItems:"center",paddingBottom:40}}>
      <style>{GF}</style>
      <Hdr cfg={cfg} role="worker" userName={currentUser} lang={lang} onBack={onBack} backLabel={backLabel} onSwitch={()=>{setRole(null);setCurrentUser(null);setLang("nl");}}/>

      {screen==="home" && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"22px 16px 0",width:"100%",gap:20}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8AAA7A",textTransform:"uppercase",letterSpacing:2,textAlign:"center"}}>
            {tr(lang,"chooseShelf")}
          </div>
          <div style={{display:"flex",gap:14,width:"100%",maxWidth:420,justifyContent:"center",flexWrap:"wrap"}}>
            <div className="card-hover" onClick={openCab} style={{flex:"1 1 160px",maxWidth:200,cursor:"pointer",background:"linear-gradient(160deg,#4DA035,#3D8B2E)",border:"3px solid #2D7020",borderRadius:16,padding:"20px 16px",textAlign:"center",boxShadow:"0 8px 28px rgba(61,139,46,0.25)"}}>
              <div style={{marginBottom:8}}><HelloFreshLogo size={36}/></div>
              <div style={{fontSize:15,fontWeight:900,color:"#fff",letterSpacing:1}}>{tr(lang,"chemicals")}</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",marginTop:4,letterSpacing:1,textTransform:"uppercase"}}>{tr(lang,"flammables")}</div>
              <div style={{marginTop:12,display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
                {wSh.map(sh=>{const pct=shP(sh,inv);const col=fCol(pct);return(
                  <div key={sh.id} style={{background:"rgba(0,0,0,0.2)",borderRadius:6,padding:"3px 7px",fontSize:9,fontWeight:800,color:col}}>
                    {sh.label} {Math.round(pct)}%
                  </div>
                );})}
              </div>
            </div>
            <div className="card-hover" onClick={()=>setScreen("voorraad")} style={{flex:"1 1 160px",maxWidth:200,cursor:"pointer",background:"linear-gradient(160deg,#4A80C4,#2D5FA0)",border:"3px solid #1E4A80",borderRadius:16,padding:"20px 16px",textAlign:"center",boxShadow:"0 8px 28px rgba(45,95,160,0.25)"}}>
              <div style={{fontSize:36,marginBottom:8}}>📦</div>
              <div style={{fontSize:15,fontWeight:900,color:"#fff",letterSpacing:1}}>{tr(lang,"normalStock")}</div>
              <div style={{fontSize:9,color:"rgba(255,255,255,0.65)",marginTop:4,letterSpacing:1,textTransform:"uppercase"}}>{tr(lang,"consumables")}</div>
              <div style={{marginTop:12,display:"flex",gap:6,justifyContent:"center",flexWrap:"wrap"}}>
                {(cfg.voorraad||[]).map(p=>{
                  const cnt=(inv[p.id]||{count:0}).count;
                  const need=cnt<Math.ceil(p.target*0.3);
                  return(
                    <div key={p.id} style={{background:"rgba(0,0,0,0.2)",borderRadius:6,padding:"3px 7px",fontSize:9,fontWeight:800,color:need?"#FFB880":"rgba(255,255,255,0.7)"}}>
                      {cnt} {p.unit}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {screen==="open" && !activeShelf && (
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"22px 16px 0",width:"100%"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8AAA7A",textTransform:"uppercase",letterSpacing:2,marginBottom:18,textAlign:"center"}}>
            {tr(lang,"chooseSection")}
          </div>
          <Cabinet shelves={wSh} inv={inv} onSelect={s=>setScreen(`shelf-${s.id}`)}/>
          <div style={{width:"100%",maxWidth:340,margin:"20px auto 0",background:"#fff",border:"2px solid #C8E6B0",borderRadius:16,padding:16,boxShadow:"0 4px 16px rgba(61,139,46,0.12)"}}>
            <div style={{fontSize:11,fontWeight:800,color:"#8AAA7A",textTransform:"uppercase",letterSpacing:2,marginBottom:12}}>{tr(lang,"sectionFill")}</div>
            {wSh.map(sh=>{const pct=shP(sh,inv);const col=fCol(pct);return(
              <div key={sh.id} style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                <div style={{fontSize:12,fontWeight:800,width:60,color:"#4A6A3A"}}>{sh.label}</div>
                <div style={{flex:1,height:14,background:"#EEF9E6",borderRadius:8,overflow:"hidden"}}>
                  <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:8,transition:"width 0.8s"}}/>
                </div>
                <div style={{fontSize:13,fontWeight:800,color:col,width:42,textAlign:"right"}}>{Math.round(pct)}%</div>
              </div>
            );})}
          </div>
        </div>
      )}

      {activeShelf && <ShelfDetail shelf={activeShelf} inv={inv} onUpdate={updateInv} cfg={cfg} onAudit={addAudit} lang={lang} sdsMap={sdsMap} locId={locId}/>}
      {isVoorraad && <VoorraadView cfg={cfg} inv={inv} onUpdate={updateInv} onAudit={addAudit} lang={lang}/>}

      <Ftr/>
    </div>
  );
}

function Hdr({cfg,role,isAdmin,onBack,backLabel,onSwitch,userName,lang="nl"}){
  const roleLabel = role==="admin"?tr(lang,"admin"):role==="manager"?tr(lang,"manager"):tr(lang,"worker");
  return(
    <div style={{width:"100%",background:isAdmin?"#0D0D1A":"#3D8B2E",padding:"11px 14px",display:"flex",alignItems:"center",gap:10,position:"sticky",top:0,zIndex:200,boxShadow:"0 3px 14px rgba(61,139,46,0.25)",overflowX:"auto",scrollbarWidth:"none"}}>
      <span style={{flexShrink:0}}>{isAdmin?"🔧":<HelloFreshLogo size={36}/>}</span>
      <div style={{flexShrink:0}}>
        <div style={{fontSize:15,fontWeight:900,color:"#fff",whiteSpace:"nowrap"}}>{isAdmin?"Masterfile":cfg?.appName||"Voorraadbeheer"}</div>
        <div style={{fontSize:9,color:"rgba(255,255,255,0.6)",whiteSpace:"nowrap"}}>{cfg?.location||""}</div>
      </div>
      <div style={{marginLeft:"auto",display:"flex",alignItems:"center",gap:6,flexShrink:0}}>
        {userName&&<div style={{fontSize:10,fontWeight:800,color:"#fff",whiteSpace:"nowrap",maxWidth:100,overflow:"hidden",textOverflow:"ellipsis"}}>{userName}</div>}
        {role&&<div style={{fontSize:9,fontWeight:700,color:"rgba(255,255,255,0.85)",padding:"4px 8px",border:"1.5px solid rgba(255,255,255,0.3)",borderRadius:20,background:"rgba(255,255,255,0.12)",textTransform:"uppercase",whiteSpace:"nowrap"}}>{roleLabel}</div>}
        {onBack&&<button style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",fontFamily:"Nunito,Arial,sans-serif",fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap"}} onClick={onBack}>{backLabel||tr(lang,"back")}</button>}
        {!onBack&&role&&onSwitch&&<button style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",fontFamily:"Nunito,Arial,sans-serif",fontSize:11,fontWeight:700,padding:"5px 11px",borderRadius:20,cursor:"pointer",whiteSpace:"nowrap"}} onClick={onSwitch}>{tr(lang,"logout")}</button>}
      </div>
    </div>
  );
}

function AccountLoginPanel({accounts,onSuccess,onFail,loginErr,onClear,roleColor,lang="nl"}){
  const [selectedId,setSelectedId]=useState(accounts[0]?.id??null);
  const acc=accounts.find(a=>a.id===selectedId)||accounts[0];
  if(!acc)return <div style={{color:"#8AAA7A",textAlign:"center",padding:20,fontSize:13}}>{tr(lang,"noAccounts")}</div>;
  return(
    <div>
      {accounts.length>1&&(
        <div style={{marginBottom:14}}>
          <label className="lbl-responsive" style={S.lbl}>{tr(lang,"selectName")}</label>
          <div style={{position:"relative"}}>
            <select style={{...S.inp,width:"100%",borderColor:roleColor+"66",paddingRight:36,appearance:"none",WebkitAppearance:"none"}}
              value={selectedId}
              onChange={e=>{setSelectedId(Number(e.target.value));onClear();}}>
              {accounts.map(a=><option key={a.id} value={a.id}>{a.username}</option>)}
            </select>
            <span style={{position:"absolute",right:12,top:"50%",transform:"translateY(-50%)",pointerEvents:"none",color:"#8AAA7A",fontSize:11}}>▼</span>
          </div>
        </div>
      )}
      <LoginCard key={acc.id} acc={acc} lang={lang} onSuccess={()=>onSuccess(acc)} onFail={()=>onFail(acc.id)} hasErr={loginErr===acc.id} onClear={onClear} hideRole/>
    </div>
  );
}

function LoginCard({acc,onSuccess,onFail,hasErr,onClear,hideRole,lang="nl"}){
  const [pass,setPass]=useState("");
  const [showPw,setShowPw]=useState(false);
  const [attempts,setAttempts]=useState(0);
  const [lockedUntil,setLockedUntil]=useState(0);
  const isMgr=acc.role==="manager";
  const isLocked=Date.now()<lockedUntil;

  const tryLogin=async()=>{
    if(isLocked)return;
    const h=await hashPw(pass);
    if(h===acc.password){
      onSuccess();
    } else {
      const a=attempts+1;
      setAttempts(a);
      if(a>=3){
        const until=Date.now()+30000;
        setLockedUntil(until);
        setTimeout(()=>{setAttempts(0);setLockedUntil(0);},30000);
      }
      onFail();
    }
  };

  return(
    <div style={{background:hasErr?"#FDEDEA":"#fff",border:`2.5px solid ${hasErr?"#D44A2A":isLocked?"#D44A2A44":isMgr?"#E8632A55":"#C8E6B0"}`,borderRadius:18,padding:18,boxShadow:"0 4px 16px rgba(61,139,46,0.1)",overflow:"hidden"}}>
      {!hideRole&&<div style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,paddingBottom:12,borderBottom:`2px solid ${isMgr?"#E8632A22":"#EEF9E6"}`}}>
        <span style={{fontSize:28}}>{isMgr?"📊":"👥"}</span>
        <div>
          <div style={{fontSize:15,fontWeight:900,color:isMgr?"#E8632A":"#3D8B2E"}}>{isMgr?tr(lang,"manager"):tr(lang,"worker")}</div>
          <div style={{fontSize:11,fontWeight:700,color:isMgr?"#E8632A":"#3D8B2E",background:isMgr?"#FDF0EB":"#EEF9E6",border:`1.5px solid ${isMgr?"#E8632A44":"#C8E6B0"}`,borderRadius:20,padding:"2px 10px",display:"inline-block",marginTop:3}}>{acc.username}</div>
        </div>
      </div>}
      {hideRole&&<div style={{fontSize:15,fontWeight:900,color:isMgr?"#E8632A":"#3D8B2E",marginBottom:14}}>{acc.username}</div>}
      {isLocked&&<div style={{background:"#FDEDEA",border:"1.5px solid #D44A2A",borderRadius:10,padding:"9px 12px",fontSize:12,fontWeight:700,color:"#D44A2A",marginBottom:10}}>{tr(lang,"blockedMsg")}</div>}
      {!isLocked&&hasErr&&<div style={{background:"#FDEDEA",border:"1.5px solid #D44A2A",borderRadius:10,padding:"9px 12px",fontSize:12,fontWeight:700,color:"#D44A2A",marginBottom:10}}>{tr(lang,"wrongPw")}{attempts>0?` (${attempts}/3)`:""}</div>}
      <label className="lbl-responsive" style={S.lbl}>{tr(lang,"password")}</label>
      <div style={{position:"relative",width:"100%"}}>
        <input style={{...S.inp,paddingRight:44,marginBottom:12,borderColor:hasErr?"#D44A2A":"#C8E6B0"}}
          type={showPw?"text":"password"} placeholder={tr(lang,"enterPw")} value={pass}
          disabled={isLocked}
          onChange={e=>{setPass(e.target.value);if(hasErr)onClear();}}
          onKeyDown={e=>e.key==="Enter"&&tryLogin()}/>
        <button style={{position:"absolute",insetInlineEnd:8,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",cursor:"pointer",fontSize:18,color:"#8AAA7A",padding:"8px",lineHeight:1}} onClick={()=>setShowPw(p=>!p)}>{showPw?"🙈":"👁"}</button>
      </div>
      <button style={{...S.btn,width:"100%",background:isLocked?"#ccc":isMgr?"linear-gradient(135deg,#E8632A,#D44A20)":"linear-gradient(135deg,#3D8B2E,#5AAE3C)",color:"#fff",letterSpacing:1,textTransform:"uppercase",cursor:isLocked?"not-allowed":"pointer"}} onClick={tryLogin} disabled={isLocked}>
        {isLocked?tr(lang,"blockedBtn"):isMgr?tr(lang,"loginManager"):tr(lang,"loginWorker")}
      </button>
    </div>
  );
}

function Cabinet({shelves,inv,onSelect}){
  return(
    <div style={{width:270,background:"linear-gradient(180deg,#F5FBF0,#EEF9E6)",border:"3px solid #9FCC80",borderRadius:12,boxShadow:"0 12px 40px rgba(61,139,46,0.18)",overflow:"hidden"}}>
      {shelves.map(sh=>{
        const pct=shP(sh,inv);const col=fCol(pct);
        return(
          <div className="btn-hover" key={sh.id} style={{display:"flex",alignItems:"stretch",height:84,borderBottom:"3px solid #C8E6B0",position:"relative",cursor:"pointer"}} onClick={()=>onSelect(sh)}>
            <div style={{position:"absolute",bottom:0,left:0,right:0,height:`${pct}%`,background:col,opacity:0.25,transition:"height 0.8s"}}/>
            <div style={{position:"relative",zIndex:2,flex:1,display:"flex",flexDirection:"column",justifyContent:"center",padding:"8px 10px",gap:2}}>
              <div style={{fontSize:8,letterSpacing:2,color:"#8AAA7A",fontWeight:700,textTransform:"uppercase"}}>{sh.label}</div>
              <div style={{fontSize:22,fontWeight:900,color:col,lineHeight:1}}>{Math.round(pct)}%</div>
              <div style={{fontSize:9,color:"#8AAA7A",fontWeight:600}}>{shL(sh,inv).toFixed(1)}L / {sh.maxLiters}L</div>
            </div>
            <div style={{width:13,background:"#C8E6B0",margin:"10px 11px 10px 4px",borderRadius:7,overflow:"hidden",position:"relative",zIndex:2}}>
              <div style={{position:"absolute",bottom:0,left:0,right:0,height:`${pct}%`,background:col,borderRadius:"6px 6px 0 0",transition:"height 0.8s"}}/>
            </div>
            <div style={{position:"absolute",right:7,bottom:6,fontSize:8,letterSpacing:1,color:"#8AAA7A",fontWeight:700,zIndex:2}}>TAP</div>
          </div>
        );
      })}
    </div>
  );
}

function ShelfDetail({shelf,inv,onUpdate,cfg,onAudit,lang="nl",sdsMap={},locId}){
  const total=shL(shelf,inv);const pct=Math.min((total/shelf.maxLiters)*100,100);const col=fCol(pct);
  const cat=shelf.category?CAT[shelf.category]:null;
  const catLabel = cat ? (shelf.category==="flammable"?tr(lang,"flammable"):tr(lang,"corrosive")) : null;
  return(
    <div style={{width:"100%",maxWidth:420,padding:"14px 14px 0",margin:"0 auto"}}>
      <div style={S.card}>
        <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
          <div>
            <div style={{fontSize:10,color:"#8AAA7A",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{shelf.label} · {shelf.sublabel}</div>
            <div style={{fontSize:22,fontWeight:900,color:col}}>{shelf.label}</div>
            {cat&&<div style={{fontSize:10,fontWeight:800,color:cat.color,background:cat.bg,padding:"2px 8px",borderRadius:20,display:"inline-block",marginTop:4}}>{cat.icon} {cat.ghs} {catLabel}</div>}
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:28,fontWeight:900,color:col}}>{Math.round(pct)}%</div>
            <div style={{fontSize:10,color:"#8AAA7A",fontWeight:600}}>{total.toFixed(2)}L / {shelf.maxLiters}L</div>
          </div>
        </div>
        <div style={{height:10,background:"#EEF9E6",borderRadius:6,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:6,transition:"width 0.5s"}}/>
        </div>
      </div>
      {pct>=100&&<div style={{background:"#FDEDEA",border:"2px solid #D44A2A",borderRadius:12,padding:"10px 14px",fontSize:13,fontWeight:800,color:"#D44A2A",marginBottom:12}}>{tr(lang,"maxExceeded")}</div>}
      {pct>=80&&pct<100&&<div style={{background:"#FFFBEA",border:"2px solid #F5C842",borderRadius:12,padding:"10px 14px",fontSize:13,fontWeight:800,color:"#A06A00",marginBottom:12}}>{tr(lang,"almostFull")}</div>}
      {aPr(shelf).map(p=>{
        const st=inv[p.id]||{full:0,partial:0};
        const curL=pL(p,inv);
        const partL=st.partial>0?p.vol*st.partial/100:0;
        const remaining=shelf.maxLiters-(total-st.full*p.vol-partL);
        const maxFull=Math.min(p.target,Math.floor(remaining/p.vol));
        return(
          <div key={p.id} style={S.card}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:12}}>
              <div><div style={{fontSize:14,fontWeight:800}}>{p.name}</div><div style={{fontSize:10,color:"#8AAA7A",fontWeight:600,marginTop:2}}>{p.vol}L · {tr(lang,"max")} {p.target}</div><div style={{marginTop:6}}><SdsControl product={p} locId={locId} meta={sdsMap[p.id]} lang={lang}/></div></div>
              <div style={{textAlign:"right"}}><div style={{fontSize:14,fontWeight:800,color:curL>0?col:"#8AAA7A"}}>{curL.toFixed(2)}L</div></div>
            </div>
            <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:10,flexWrap:"wrap"}}>
              <div style={{display:"flex",alignItems:"center",gap:10}}>
                <div style={{display:"flex",alignItems:"center",border:"2px solid #C8E6B0",borderRadius:12,overflow:"hidden"}}>
                  <button style={{width:44,height:44,background:"#F5FBF0",border:"none",color:"#3D8B2E",fontSize:22,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} disabled={st.full<=0} onClick={()=>{onUpdate(p.id,"full",st.full-1);onAudit?.(`${shelf.label} — ${p.name}: ${st.full} → ${st.full-1} vol`)}}>−</button>
                  <div style={{width:50,height:44,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#1A3A0A",borderLeft:"2px solid #C8E6B0",borderRight:"2px solid #C8E6B0"}}>{st.full}</div>
                  <button style={{width:44,height:44,background:"#F5FBF0",border:"none",color:"#3D8B2E",fontSize:22,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}} disabled={st.full>=maxFull} onClick={()=>{onUpdate(p.id,"full",st.full+1);onAudit?.(`${shelf.label} — ${p.name}: ${st.full} → ${st.full+1} vol`)}}>+</button>
                </div>
                <span style={{fontSize:11,color:"#8AAA7A",fontWeight:700}}>{tr(lang,"full")}</span>
              </div>
              {cfg.features.partialBottles!==false&&(
                <div style={{display:"flex",gap:5}}>
                  {[0,25,50,75].map(v=>{
                    const active=st.partial===v;
                    return(
                      <button key={v} style={{height:44,padding:"0 8px",background:active?"#EEF9E6":"#F5FBF0",border:`2px solid ${active?"#3D8B2E":"#C8E6B0"}`,borderRadius:10,color:active?"#3D8B2E":"#8AAA7A",fontFamily:"Nunito,sans-serif",fontSize:11,fontWeight:800,cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:1}}
                        onClick={()=>onUpdate(p.id,"partial",st.partial===v?0:v)}>
                        <span>{v===0?"--":`${v}%`}</span>
                        <span style={{fontSize:7,opacity:0.7}}>{v===0?tr(lang,"partNone"):v===25?"¼":v===50?"½":"¾"}</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })}
      <button style={{width:"100%",padding:13,background:"#FDEDEA",border:"2px solid #D44A2A55",color:"#D44A2A",fontFamily:"Nunito,Arial,sans-serif",fontSize:12,fontWeight:800,letterSpacing:1,borderRadius:14,cursor:"pointer",textTransform:"uppercase",marginTop:4,marginBottom:20}} onClick={()=>{if(!window.confirm(tr(lang,"confirmEmptyTray",shelf.label)))return;aPr(shelf).forEach(p=>{onUpdate(p.id,"full",0);onUpdate(p.id,"partial",0);});onAudit?.(`${shelf.label} leeg gemeld`)}}>
        {tr(lang,"reportEmpty")}
      </button>
    </div>
  );
}

function ConsumptionView({inv,snaps,setSnaps,onSnap,cfg,lang="nl"}){
  const [taking,setTaking]=useState(false);
  const label=new Date().toLocaleDateString(dloc(lang),{month:"long",year:"numeric"});
  const hasSnaps=snaps.length>0;
  const latest=hasSnaps?snaps[0]:null;
  const calc=(snapInv)=>{
    const rows=[];
    aSh(cfg).forEach(sh=>aPr(sh).forEach(p=>{
      const b=snapInv[p.id]||{full:0,partial:0},a=inv[p.id]||{full:0,partial:0};
      const bL=b.full*p.vol+(b.partial>0?p.vol*b.partial/100:0);
      const aL=a.full*p.vol+(a.partial>0?p.vol*a.partial/100:0);
      rows.push({sh,p,used:Math.max(0,bL-aL),maxUsed:p.target*p.vol});
    }));
    return rows;
  };
  const rows=latest?calc(latest.inv):[];
  const total=rows.reduce((s,r)=>s+r.used,0);
  return(
    <div>
      <div style={{fontSize:14,fontWeight:900,color:"#3D8B2E",textTransform:"uppercase",letterSpacing:1,marginBottom:14}}>{tr(lang,"monthlyConsumption")}</div>
      <button style={{...S.btn,width:"100%",background:"linear-gradient(135deg,#3D8B2E,#5AAE3C)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:12,marginBottom:14}}
        onClick={()=>{setTaking(true);onSnap(label);setTaking(false);}}>
        <span style={{fontSize:20}}>📸</span>
        <div><div>{taking?tr(lang,"saving"):tr(lang,"recordMonthly")}</div><div style={{fontSize:10,opacity:0.8,marginTop:2}}>{label}</div></div>
      </button>
      {!hasSnaps&&<div style={{...S.card,textAlign:"center",padding:28}}><div style={{fontSize:36,marginBottom:10}}>📊</div><div style={{fontSize:13,color:"#8AAA7A"}}>{tr(lang,"recordMonthlyHint")}</div></div>}
      {hasSnaps&&(
        <div style={{...S.card,padding:0,overflow:"hidden"}}>
          <div style={{background:"#EEF9E6",padding:"12px 16px",borderBottom:"2px solid #C8E6B0",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{fontSize:13,fontWeight:900,color:"#3D8B2E"}}>{tr(lang,"consumptionVs")} {latest.label}</div>
            <div style={{fontSize:16,fontWeight:900,color:"#3D8B2E"}}>{total.toFixed(2)}L</div>
          </div>
          {aSh(cfg).map(sh=>{
            const shRows=rows.filter(r=>r.sh.id===sh.id&&r.used>0);
            return(
              <div key={sh.id} style={{padding:"10px 16px 4px",borderBottom:"1px solid #EEF9E6"}}>
                <div style={{fontSize:10,fontWeight:800,color:"#8AAA7A",textTransform:"uppercase",letterSpacing:2,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
                  <div style={{width:8,height:8,borderRadius:"50%",background:sh.color}}/>{sh.label}
                </div>
                {shRows.length===0&&<div style={{fontSize:11,color:"#8AAA7A",paddingBottom:6}}>{tr(lang,"noConsumption")}</div>}
                {shRows.map(r=>(
                  <div key={r.p.id} style={{display:"flex",alignItems:"center",gap:10,padding:"5px 0",borderBottom:"1px solid #F5FBF0"}}>
                    <div style={{flex:1}}><div style={{fontSize:12,fontWeight:700}}>{r.p.name}</div><div style={{height:5,background:"#EEF9E6",borderRadius:3,overflow:"hidden",marginTop:3}}><div style={{height:"100%",width:`${Math.min((r.used/r.maxUsed)*100,100)}%`,background:sh.color,borderRadius:3}}/></div></div>
                    <div style={{fontSize:13,fontWeight:800,color:sh.color,flexShrink:0}}>{r.used.toFixed(2)}L</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      )}
      {snaps.length>0&&(
        <div style={{...S.card,marginTop:12}}>
          <div style={{fontSize:11,fontWeight:800,color:"#8AAA7A",textTransform:"uppercase",letterSpacing:2,marginBottom:10}}>{tr(lang,"monthlyRecords")}</div>
          {snaps.map(snap=>(
            <div key={snap.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 0",borderBottom:"1px solid #EEF9E6"}}>
              <div><div style={{fontSize:13,fontWeight:700,color:"#4A6A3A"}}>{snap.label}</div><div style={{fontSize:10,color:"#8AAA7A",marginTop:1}}>{new Date(snap.date).toLocaleDateString(dloc(lang),{day:"2-digit",month:"short"})}</div></div>
              <button style={{background:"#FDEDEA",border:"none",color:"#D44A2A",borderRadius:7,width:36,height:36,cursor:"pointer",fontSize:15}} onClick={()=>{const n=snaps.filter(s=>s.id!==snap.id);setSnaps(n);}}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AdminPanel({cfg,onSave,lang="nl",sdsMap={},locId,onSdsSaved,onSdsRemoved,uploadedBy=""}){
  const [tab,setTab]=useState("lekbakken");
  const [local,setLocal]=useState(()=>JSON.parse(JSON.stringify(cfg)));
  const [saved,setSaved]=useState(false);
  const save=async()=>{
    const next=JSON.parse(JSON.stringify(local));
    for(const acc of next.accounts||[]){
      if(acc._newPw&&acc._newPw.trim()){acc.password=await hashPw(acc._newPw.trim());}
      delete acc._newPw;
    }
    if(next._newPin&&next._newPin.trim()){next.adminPin=await hashPw(next._newPin.trim());}
    delete next._newPin;
    onSave(next);setSaved(true);setTimeout(()=>setSaved(false),2500);
  };
  const upd=(path,val)=>{
    setLocal(prev=>{
      const next=JSON.parse(JSON.stringify(prev));
      const keys=path.split(".");let obj=next;
      keys.slice(0,-1).forEach(k=>{obj=Array.isArray(obj)?obj[parseInt(k)]:obj[k];});
      const last=keys[keys.length-1];
      if(Array.isArray(obj))obj[parseInt(last)]=val;else obj[last]=val;
      return next;
    });
  };
  const TABS=[{id:"lekbakken",l:tr(lang,"trays")},{id:"producten",l:tr(lang,"tabProducts")},{id:"voorraad",l:tr(lang,"tabStock")},{id:"email",l:tr(lang,"tabEmail")},{id:"accounts",l:tr(lang,"tabAccounts")},{id:"instellingen",l:tr(lang,"tabSettings")}];
  const ac={background:"rgba(255,255,255,0.05)",border:"1.5px solid #3D2A7A",borderRadius:12,padding:14,marginBottom:10};
  const ai={background:"#0D0D1A",border:"1.5px solid #3D2A7A",borderRadius:9,color:"#E0D8F8",fontFamily:"Nunito,sans-serif",fontSize:13,fontWeight:700,padding:"8px 10px",outline:"none",width:"100%"};
  const al={fontSize:9,fontWeight:800,color:"#7B6A9B",textTransform:"uppercase",letterSpacing:1,display:"block",marginBottom:4};
  const sv={...S.btn,width:"100%",background:"linear-gradient(135deg,#7C5CBF,#5A3A9F)",color:"#fff",letterSpacing:1};
  return(
    <div dir={lang==="ar"?"rtl":"ltr"} style={{width:"100%"}}>
      <div className="admin-tabs-bar resp-wide" style={{display:"flex",overflowX:"auto",gap:6,width:"100%",maxWidth:460,padding:"12px 14px 0",margin:"0 auto",scrollbarWidth:"none",WebkitOverflowScrolling:"touch"}}>
        {TABS.map(t=><button key={t.id} onClick={()=>setTab(t.id)} className="btn-hover" style={{flexShrink:0,padding:"9px 10px",border:`2px solid ${tab===t.id?"#7C5CBF":"#3D2A7A"}`,borderRadius:10,background:tab===t.id?"#7C5CBF":"#16213E",color:tab===t.id?"#fff":"#9B8EC4",fontFamily:"Nunito,sans-serif",fontSize:11,fontWeight:800,cursor:"pointer",whiteSpace:"nowrap"}}>{t.l}</button>)}
      </div>
      <div className="resp-wide" style={{width:"100%",maxWidth:460,padding:"14px 14px 0",margin:"0 auto"}}>
        {tab==="lekbakken"&&<div>
          {local.shelves.map((sh,si)=><div key={sh.id} style={ac}>
            <div className="admin-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:8,alignItems:"end"}}>
              <div>
                <label className="lbl-responsive" style={al}>{tr(lang,"admLabel")}</label>
                <input style={ai} value={sh.label} onChange={e=>upd(`shelves.${si}.label`,e.target.value)}/>
              </div>
              <div>
                <label className="lbl-responsive" style={al}>{tr(lang,"admSublabel")}</label>
                <input style={ai} value={sh.sublabel} onChange={e=>upd(`shelves.${si}.sublabel`,e.target.value)}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 52px 44px",gap:6,alignItems:"end"}}>
                <div><label className="lbl-responsive" style={al}>{tr(lang,"admMaxLiters")}</label><input style={{...ai,width:"100%"}} type="number" value={sh.maxLiters} onChange={e=>upd(`shelves.${si}.maxLiters`,parseFloat(e.target.value)||10)}/></div>
                <div><label className="lbl-responsive" style={al}>{tr(lang,"admColor")}</label><input type="color" value={sh.color} style={{width:"100%",height:36,border:"none",background:"transparent",cursor:"pointer"}} onChange={e=>upd(`shelves.${si}.color`,e.target.value)}/></div>
                <div style={{paddingBottom:2}}><button style={{background:"none",border:`1.5px solid ${sh.active?"#2A5A1A":"#5A1A1A"}`,color:sh.active?"#7FE060":"#CC6666",borderRadius:8,width:"100%",height:36,cursor:"pointer",fontSize:10,fontWeight:800}} onClick={()=>upd(`shelves.${si}.active`,!sh.active)}>{sh.active?tr(lang,"on"):tr(lang,"off")}</button></div>
              </div>
              <div style={{marginTop:6}}>
                <label className="lbl-responsive" style={al}>{tr(lang,"admGhsCategory")}</label>
                <select style={{...ai,width:"100%"}} value={sh.category||""} onChange={e=>upd(`shelves.${si}.category`,e.target.value||null)}>
                  <option value="">{tr(lang,"admNone")}</option>
                  <option value="flammable">🔥 GHS02 {tr(lang,"flammable")}</option>
                  <option value="corrosive">⚗️ GHS05 {tr(lang,"corrosive")}</option>
                </select>
              </div>
            </div>
          </div>)}
          <button style={sv} onClick={save}>{saved?tr(lang,"saved"):tr(lang,"save")}</button>
        </div>}
        {tab==="producten"&&<div>
          {local.shelves.map((sh,si)=><div key={sh.id} style={{...ac,marginBottom:12}}>
            <div style={{fontSize:12,fontWeight:800,color:"#A07EE0",marginBottom:10}}>{sh.label}</div>
            {sh.products.map((p,pi)=><div key={p.id} style={{display:"grid",gridTemplateColumns:"1fr 70px 60px auto auto",gap:6,alignItems:"center",padding:"6px 0",borderBottom:"1px solid #1A1040"}}>
              <input style={ai} value={p.name} onChange={e=>upd(`shelves.${si}.products.${pi}.name`,e.target.value)}/>
              <input style={{...ai,textAlign:"center"}} type="number" value={p.vol} min={0.1} step={0.25} onChange={e=>upd(`shelves.${si}.products.${pi}.vol`,parseFloat(e.target.value)||0.5)}/>
              <input style={{...ai,textAlign:"center"}} type="number" value={p.target} min={1} onChange={e=>upd(`shelves.${si}.products.${pi}.target`,parseInt(e.target.value)||1)}/>
              <SdsControl product={p} locId={locId} meta={sdsMap[p.id]} canEdit lang={lang} uploadedBy={uploadedBy} onSaved={onSdsSaved} onRemoved={onSdsRemoved}/>
              <button style={{background:"none",border:"1.5px solid #5A1A1A",color:"#CC6666",borderRadius:7,width:36,height:36,cursor:"pointer"}} onClick={()=>{const n=JSON.parse(JSON.stringify(local));n.shelves[si].products.splice(pi,1);setLocal(n);}}>×</button>
            </div>)}
            <button style={{...S.btn,width:"100%",background:"transparent",border:"1.5px dashed #3D2A7A",color:"#7C5CBF",fontSize:11,marginTop:8,padding:8}} onClick={()=>{const n=JSON.parse(JSON.stringify(local));n.shelves[si].products.push({id:`${sh.id}-${Date.now()}`,name:tr(lang,"admNewProduct"),vol:1.0,target:3});setLocal(n);}}>+ {tr(lang,"admProduct")}</button>
          </div>)}
          <button style={sv} onClick={save}>{saved?tr(lang,"saved"):tr(lang,"save")}</button>
        </div>}
        {tab==="voorraad"&&<div>
          {(local.voorraad||[]).map((p,pi)=>(
            <div key={p.id} style={ac}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 80px 60px auto auto",gap:6,alignItems:"center"}}>
                <input style={ai} value={p.name} placeholder={tr(lang,"admName")} onChange={e=>upd(`voorraad.${pi}.name`,e.target.value)}/>
                <input style={ai} value={p.unit} placeholder={tr(lang,"admUnit")} onChange={e=>upd(`voorraad.${pi}.unit`,e.target.value)}/>
                <input style={{...ai,textAlign:"center"}} type="number" min={1} value={p.target} onChange={e=>upd(`voorraad.${pi}.target`,parseInt(e.target.value)||1)}/>
                <button style={{background:"none",border:`1.5px solid ${p.active!==false?"#2A5A1A":"#5A1A1A"}`,color:p.active!==false?"#7FE060":"#CC6666",borderRadius:8,width:38,height:32,cursor:"pointer",fontSize:10,fontWeight:800}} onClick={()=>upd(`voorraad.${pi}.active`,!(p.active!==false))}>{p.active!==false?tr(lang,"on"):tr(lang,"off")}</button>
                <button style={{background:"none",border:"1.5px solid #5A1A1A",color:"#CC6666",borderRadius:7,width:28,height:32,cursor:"pointer"}} onClick={()=>{const n=JSON.parse(JSON.stringify(local));n.voorraad.splice(pi,1);setLocal(n);}}>×</button>
              </div>
              <div style={{display:"flex",gap:10,marginTop:4}}>
                <span style={{fontSize:9,color:"#7B6A9B",fontWeight:700,textTransform:"uppercase",letterSpacing:1}}>{tr(lang,"admName")}</span>
                <span style={{fontSize:9,color:"#7B6A9B",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginLeft:4}}>{tr(lang,"admUnit")}</span>
                <span style={{fontSize:9,color:"#7B6A9B",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginLeft:20}}>{tr(lang,"targetLabel")}</span>
              </div>
            </div>
          ))}
          <button style={{...S.btn,width:"100%",background:"transparent",border:"1.5px dashed #3D2A7A",color:"#7C5CBF",fontSize:11,marginBottom:10,padding:9}} onClick={()=>setLocal(p=>({...p,voorraad:[...(p.voorraad||[]),{id:`v-${Date.now()}`,name:tr(lang,"admNewItem"),unit:tr(lang,"pieces"),target:10,active:true}]}))}>+ {tr(lang,"admItem")}</button>
          <button style={sv} onClick={save}>{saved?tr(lang,"saved"):tr(lang,"save")}</button>
        </div>}
        {tab==="email"&&<div>
          <div style={ac}>
            {local.emails.map((em,ei)=><div key={em.id} style={{display:"flex",gap:6,marginBottom:8,alignItems:"center"}}>
              <input style={{...ai,width:80}} value={em.dept} onChange={e=>upd(`emails.${ei}.dept`,e.target.value)}/>
              <input style={{...ai,flex:1}} value={em.email} type="email" onChange={e=>upd(`emails.${ei}.email`,e.target.value)}/>
              <button style={{background:"none",border:"1.5px solid #5A1A1A",color:"#CC6666",borderRadius:7,width:36,height:36,cursor:"pointer"}} onClick={()=>{const n=JSON.parse(JSON.stringify(local));n.emails.splice(ei,1);setLocal(n);}}>×</button>
            </div>)}
            <button style={{...S.btn,width:"100%",background:"transparent",border:"1.5px dashed #3D2A7A",color:"#7C5CBF",fontSize:12,padding:9,marginTop:4}} onClick={()=>setLocal(p=>({...p,emails:[...p.emails,{id:Date.now(),dept:tr(lang,"admDept"),email:"",active:true}]}))}>+ {tr(lang,"admRecipient")}</button>
          </div>
          <button style={sv} onClick={save}>{saved?tr(lang,"saved"):tr(lang,"save")}</button>
        </div>}
        {tab==="accounts"&&<div>
          {(local.accounts||[]).map((acc,ai_)=><div key={acc.id} style={ac}>
            <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
              <span style={{fontSize:20}}>{acc.role==="manager"?"📊":"👥"}</span>
              <div style={{flex:1}}><div style={{fontSize:12,fontWeight:800,color:"#C0B0E8"}}>{acc.username}</div></div>
              <button style={{background:"none",border:`1.5px solid ${acc.active?"#2A5A1A":"#5A1A1A"}`,color:acc.active?"#7FE060":"#CC6666",borderRadius:8,width:38,height:28,cursor:"pointer",fontSize:10,fontWeight:800}} onClick={()=>upd(`accounts.${ai_}.active`,!acc.active)}>{acc.active?tr(lang,"on"):tr(lang,"off")}</button>
              <button style={{background:"none",border:"1.5px solid #5A1A1A",color:"#CC6666",borderRadius:7,width:36,height:36,cursor:"pointer"}} onClick={()=>{const n=JSON.parse(JSON.stringify(local));n.accounts.splice(ai_,1);setLocal(n);}}>×</button>
            </div>
            <div className="admin-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:6}}>
              <div><label className="lbl-responsive" style={al}>{tr(lang,"admName")}</label><input style={ai} value={acc.username} onChange={e=>upd(`accounts.${ai_}.username`,e.target.value)}/></div>
              <div><label className="lbl-responsive" style={al}>{tr(lang,"admNewPw")}</label><input style={ai} type="password" placeholder={tr(lang,"admLeaveEmpty")} value={acc._newPw||""} onChange={e=>upd(`accounts.${ai_}._newPw`,e.target.value)}/></div>
              <div><label className="lbl-responsive" style={al}>{tr(lang,"admRole")}</label>
                <select style={{...ai,width:"100%"}} value={acc.role} onChange={e=>upd(`accounts.${ai_}.role`,e.target.value)}>
                  <option value="worker">{tr(lang,"worker")}</option>
                  <option value="manager">{tr(lang,"manager")}</option>
                </select>
              </div>
            </div>
          </div>)}
          <button style={{...S.btn,width:"100%",background:"transparent",border:"1.5px dashed #3D2A7A",color:"#7C5CBF",fontSize:12,marginBottom:10,padding:9}} onClick={()=>setLocal(p=>({...p,accounts:[...(p.accounts||[]),{id:Date.now(),username:tr(lang,"admNewPerson"),password:"wachtwoord",role:"worker",active:true}]}))}>+ {tr(lang,"admAccount")}</button>
          <button style={sv} onClick={save}>{saved?tr(lang,"saved"):tr(lang,"save")}</button>
        </div>}
        {tab==="instellingen"&&<div>
          <div style={ac}>
            <div className="admin-grid-3" style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:10}}>
              <div><label className="lbl-responsive" style={al}>{tr(lang,"admAppName")}</label><input style={ai} value={local.appName} onChange={e=>upd("appName",e.target.value)}/></div>
              <div><label className="lbl-responsive" style={al}>{tr(lang,"admLocation")}</label><input style={ai} value={local.location} onChange={e=>upd("location",e.target.value)}/></div>
              <div><label className="lbl-responsive" style={al}>{tr(lang,"admNewPin")}</label><input style={{...ai,width:"100%"}} type="password" placeholder={tr(lang,"admLeaveEmpty")} value={local._newPin||""} onChange={e=>upd("_newPin",e.target.value.replace(/\D/g,"").slice(0,4))}/></div>
            </div>
          </div>
          <button style={sv} onClick={save}>{saved?tr(lang,"saved"):tr(lang,"save")}</button>
        </div>}
        {saved&&<div style={{color:"#7FE060",fontSize:12,fontWeight:800,textAlign:"center",letterSpacing:1,marginTop:8}}>✓ {tr(lang,"saved")}</div>}
      </div>
    </div>
  );
}

function ReportModal({cfg,inv,onClose,lang="nl"}){
  const [copied,setCopied]=useState(false);
  const emails=(cfg.emails||[]).filter(e=>e.active&&e.email.includes("@"));
  const lines=[`${cfg.appName.toUpperCase()} — ${tr(lang,"repTitle")}`,`${tr(lang,"repDate")}: ${new Date().toLocaleDateString(dloc(lang),{weekday:"long",day:"2-digit",month:"long",year:"numeric"})}`,`${tr(lang,"repLocation")}: ${cfg.location}`,""];
  let total=0;
  aSh(cfg).forEach(sh=>{
    lines.push(`${sh.label} (${shL(sh,inv).toFixed(1)}L / ${sh.maxLiters}L)`);
    aPr(sh).forEach(p=>{
      const s=inv[p.id]||{full:0,partial:0};const need=Math.max(0,p.target-s.full);total+=need;
      const curr=s.partial>0?`${s.full}+${s.partial}%`:`${s.full}`;
      lines.push(`  ${p.name.padEnd(24)} ${curr.padEnd(8)} ${tr(lang,"repTarget")}:${p.target}  ${need>0?`+${need} ${tr(lang,"repBottles")}`:tr(lang,"repOk")}`);
    });lines.push("");
  });
  const vp=(cfg.voorraad||[]).filter(p=>p.active!==false);
  if(vp.length>0){
    lines.push(tr(lang,"repNormalStock"));
    vp.forEach(p=>{
      const cnt=(inv[p.id]||{count:0}).count;const need=Math.max(0,p.target-cnt);total+=need;
      const mv=p.unit==="rol"?"rollen":p.unit==="doos"?"dozen":`${p.unit}s`;
      lines.push(`  ${p.name.padEnd(24)} ${String(cnt).padEnd(8)} ${tr(lang,"repTarget")}:${p.target}  ${need>0?`+${need} ${mv}`:tr(lang,"repOk")}`);
    });
    lines.push("");
  }
  lines.push(`${tr(lang,"repTotal")}: ${total}`);
  const report=lines.join("\n");
  return(
    <div className="modal-overlay" style={{position:"fixed",inset:0,background:"rgba(30,90,15,0.55)",zIndex:500,display:"flex",flexDirection:"column",alignItems:"center",overflowY:"auto"}}>
      <div dir={lang==="ar"?"rtl":"ltr"} className="modal-box" style={{width:"100%",maxWidth:480,minHeight:"100vh",display:"flex",flexDirection:"column",background:"linear-gradient(160deg,#F0FAE8,#FEFCF4)"}}>
        <div style={{background:"#3D8B2E",padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0}}>
          <div style={{fontSize:15,fontWeight:900,color:"#fff"}}>{tr(lang,"monthlyReport")}</div>
          <button style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",fontSize:16,width:36,height:36,borderRadius:10,cursor:"pointer",fontWeight:700}} onClick={onClose}>×</button>
        </div>
        <div style={{flex:1,padding:16,background:"linear-gradient(160deg,#F0FAE8,#FEFCF4)"}}>
          <div style={{background:total>0?"#FFFBEA":"#EEF9E6",border:`2px solid ${total>0?"#F5C842":"#9FCC80"}`,borderRadius:14,padding:"14px 16px",marginBottom:14,display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:28}}>{total>0?"📦":"🎉"}</span>
            <div style={{fontSize:14,fontWeight:900,color:total>0?"#A06A00":"#3D8B2E"}}>{total>0?tr(lang,"productsToReorder",total):tr(lang,"allStockOk")}</div>
          </div>
          <div style={{...S.card,marginBottom:14}}>
            <div style={{fontSize:11,fontWeight:800,color:"#8AAA7A",textTransform:"uppercase",letterSpacing:2,marginBottom:8}}>{tr(lang,"recipients")} ({emails.length})</div>
            {emails.length===0&&<div style={{fontSize:12,color:"#8AAA7A"}}>{tr(lang,"noRecipients")}</div>}
            {emails.map(e=><div key={e.id} style={{fontSize:12,fontWeight:700,color:"#4A6A3A",padding:"4px 0"}}>📬 {e.dept} — {e.email}</div>)}
          </div>
          <textarea readOnly value={report} style={{width:"100%",height:200,background:"#F5FBF0",border:"2px solid #C8E6B0",borderRadius:10,padding:12,fontFamily:"monospace",fontSize:10,color:"#4A6A3A",lineHeight:1.7,resize:"none",outline:"none",marginBottom:12}}/>
          <button style={{...S.btn,width:"100%",background:"linear-gradient(135deg,#E8632A,#D44A20)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:10,marginBottom:10,opacity:emails.length===0?0.5:1,cursor:emails.length===0?"not-allowed":"pointer"}}
            onClick={()=>{const to=emails.map(e=>e.email).join(",");const subj=encodeURIComponent(`${cfg.appName} — Bestelrapport`);window.location.href=`mailto:${to}?subject=${subj}&body=${encodeURIComponent(report)}`;}} disabled={emails.length===0}>
            <span style={{fontSize:20}}>📧</span> {tr(lang,"sendByEmail")}
          </button>
          <button style={{...S.btn,width:"100%",background:"#fff",border:"2.5px solid #C8E6B0",color:copied?"#3D8B2E":"#4A6A3A",display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:8}}
            onClick={async()=>{try{await navigator.clipboard.writeText(report);}catch{}setCopied(true);setTimeout(()=>setCopied(false),2500);}}>
            {copied?`✅ ${tr(lang,"copied")}`:`⧉ ${tr(lang,"copyReport")}`}
          </button>
          <button style={{...S.btn,width:"100%",background:"#fff",border:"2.5px solid #C8E6B0",color:"#4A6A3A",display:"flex",alignItems:"center",justifyContent:"center",gap:8}}
            onClick={()=>{
              const doc=new jsPDF();
              doc.setFont("courier","normal");doc.setFontSize(9);
              const ph=doc.internal.pageSize.height;let y=14;
              report.split("\n").forEach(line=>{if(y>ph-12){doc.addPage();y=14;}doc.text(line||" ",12,y);y+=4.8;});
              doc.save(`bestelrapport-${new Date().toISOString().slice(0,10)}.pdf`);
            }}>
            📄 {tr(lang,"downloadPdf")}
          </button>
        </div>
      </div>
    </div>
  );
}

function VoorraadView({cfg,inv,onUpdate,onAudit,lang="nl"}){
  const products=(cfg.voorraad||[]).filter(p=>p.active!==false);
  const totalNeed=products.reduce((s,p)=>s+Math.max(0,p.target-(inv[p.id]||{count:0}).count),0);
  return(
    <div style={{width:"100%",maxWidth:420,padding:"14px 14px 0",margin:"0 auto"}}>
      {/* Header */}
      <div style={{...S.card,background:"linear-gradient(135deg,#EBF3FD,#F0F7FF)",borderColor:"#90B8E8"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10}}>
          <div>
            <div style={{fontSize:10,color:"#5A80B0",fontWeight:700,letterSpacing:1,textTransform:"uppercase"}}>{tr(lang,"normalStock")}</div>
            <div style={{fontSize:22,fontWeight:900,color:"#2D5FA0"}}>📦 {tr(lang,"consumables")}</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{fontSize:26,fontWeight:900,color:totalNeed>0?"#E8A020":"#3D8B2E"}}>{totalNeed}</div>
            <div style={{fontSize:10,color:"#8AAA7A",fontWeight:600}}>{tr(lang,"toOrder")}</div>
          </div>
        </div>
        <div style={{height:8,background:"#D8E8F8",borderRadius:5,overflow:"hidden"}}>
          <div style={{height:"100%",width:`${products.length>0?Math.round((products.filter(p=>(inv[p.id]||{count:0}).count>=p.target).length/products.length)*100):0}%`,background:"#3D8B2E",borderRadius:5,transition:"width 0.5s"}}/>
        </div>
        <div style={{fontSize:10,color:"#5A80B0",fontWeight:600,marginTop:6}}>
          {tr(lang,"ofTarget",products.filter(p=>(inv[p.id]||{count:0}).count>=p.target).length,products.length)}
        </div>
      </div>

      {/* Products */}
      {products.map(p=>{
        const cnt=(inv[p.id]||{count:0}).count;
        const need=Math.max(0,p.target-cnt);
        const pct=Math.min((cnt/p.target)*100,100);
        const col=pct>=80?"#3D8B2E":pct>=40?"#E8A020":"#D44A2A";
        return(
          <div key={p.id} style={S.card}>
            <div style={{display:"flex",alignItems:"flex-start",justifyContent:"space-between",marginBottom:10}}>
              <div>
                <div style={{fontSize:15,fontWeight:800}}>{p.name}</div>
                <div style={{fontSize:10,color:"#8AAA7A",fontWeight:600,marginTop:2}}>{tr(lang,"per")} {p.unit} · {tr(lang,"targetLabel")}: {p.target} {p.unit}{p.target!==1?"s":""}</div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:15,fontWeight:800,color:col}}>{cnt}</div>
                <div style={{fontSize:10,color:"#8AAA7A",fontWeight:600}}>{p.unit}{cnt!==1?"s":""}</div>
              </div>
            </div>
            <div style={{height:8,background:"#EEF9E6",borderRadius:5,overflow:"hidden",marginBottom:12}}>
              <div style={{height:"100%",width:`${pct}%`,background:col,borderRadius:5,transition:"width 0.4s"}}/>
            </div>
            {need>0&&<div style={{fontSize:11,fontWeight:700,color:"#E8632A",marginBottom:10}}>⚠ {need} {p.unit} {tr(lang,"reorder")}</div>}
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <div style={{display:"flex",alignItems:"center",border:"2px solid #C8E6B0",borderRadius:12,overflow:"hidden"}}>
                <button style={{width:44,height:44,background:"#F5FBF0",border:"none",color:"#3D8B2E",fontSize:22,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
                  disabled={cnt<=0}
                  onClick={()=>{onUpdate(p.id,"count",cnt-1);onAudit?.(`${p.name}: ${cnt} → ${cnt-1} ${p.unit}`)}}>−</button>
                <div style={{width:54,height:44,background:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22,fontWeight:900,color:"#1A3A0A",borderLeft:"2px solid #C8E6B0",borderRight:"2px solid #C8E6B0"}}>{cnt}</div>
                <button style={{width:44,height:44,background:"#F5FBF0",border:"none",color:"#3D8B2E",fontSize:22,fontWeight:900,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}
                  disabled={cnt>=p.target*3}
                  onClick={()=>{onUpdate(p.id,"count",cnt+1);onAudit?.(`${p.name}: ${cnt} → ${cnt+1} ${p.unit}`)}}>+</button>
              </div>
              <span style={{fontSize:11,color:"#8AAA7A",fontWeight:700}}>{p.unit} {tr(lang,"present")}</span>
            </div>
          </div>
        );
      })}

      <button style={{width:"100%",padding:13,background:"#FDEDEA",border:"2px solid #D44A2A55",color:"#D44A2A",fontFamily:"Nunito,Arial,sans-serif",fontSize:12,fontWeight:800,letterSpacing:1,borderRadius:14,cursor:"pointer",textTransform:"uppercase",marginTop:4,marginBottom:20}}
        onClick={()=>{if(!window.confirm(tr(lang,"confirmEmptyStock")))return;products.forEach(p=>onUpdate(p.id,"count",0));onAudit?.("Normale voorraad leeg gemeld")}}>
        {tr(lang,"reportStockEmpty")}
      </button>
    </div>
  );
}

const MANUAL_TRANS = {
  nl:{
    worker:{
      title:"Handleiding Medewerker", subtitle:"Voorraadbeheer Ruinerwold",
      goalTitle:"Doel van de app",
      goalText:"Deze app helpt jou en je collega's om de vloeistoffenvoorraad en verbruiksartikelen bij te houden. Door de voorraad regelmatig bij te werken, weet de manager precies wat er besteld moet worden — zodat er nooit tekort is.",
      s1Title:"Inloggen", s1a:"Tik op de groene", s1b:"knop op het startscherm.", s1c:"Kies jouw naam uit de dropdown lijst, voer je wachtwoord in en tik op \"Medewerker inloggen\".", s1tip:"Wachtwoord vergeten? Vraag dit na bij je manager of beheerder.",
      s2Title:"Startscherm — kies een kast", s2intro:"Na het inloggen zie je twee opties:", s2chemName:"Vloeistoffenkast", s2chemDesc:"Gevaarlijke stoffen op liters", s2stockName:"Normale Voorraad", s2stockDesc:"Verbruiksartikelen op stuks", s2outro:"Tik op de kast die je wilt bijwerken.",
      s3Title:"Vloeistoffenkast bijwerken", s3intro:"Kies een lekbak (1 t/m 4). Je ziet per lekbak het vulpercentage.", s3btns:"Tik op een product en gebruik de knoppen:", s3minus:"Fles verwijderen (bijv. leeg gebruikt)", s3plus:"Fles toevoegen (nieuwe fles geplaatst)", s3partial:"Gedeeltelijke fles? Selecteer het resterende percentage:", s3warn:"De knop \"Lekbak leeg melden\" zet alles op 0. Gebruik dit alleen als de lekbak echt leeg is.",
      s4Title:"Normale Voorraad bijwerken", s4intro:"Je ziet een lijst van verbruiksartikelen (WC-papier, handschoenen, etc.).", s4btns:"Gebruik + en − om het werkelijke aantal in te voeren dat aanwezig is.", s4ok:"✓ Op voorraad", s4order:"+X Bijbestellen", s4empty:"Leeg!",
      tipsTitle:"✅ Belangrijke tips",
      tips:[["🕐","Werk de voorraad bij aan het begin of einde van je dienst"],["👀","Tel altijd de fysieke voorraad voordat je de app bijwerkt"],["🔄","Twijfel je over een hoeveelheid? Kijk nog een keer"],["💬","Bij problemen of vragen: meld dit bij je manager"]],
    },
    manager:{
      title:"Handleiding Manager", subtitle:"Voorraadbeheer Ruinerwold",
      goalTitle:"Doel van de app",
      goalText:"Als manager heb je volledig overzicht over alle lekbakken en verbruiksartikelen. Je ziet direct wat er besteld moet worden, kunt maandelijkse bestelrapporten aanmaken en het activiteitenlogboek raadplegen.",
      s1Title:"Inloggen als Manager", s1a:"Tik op de oranje", s1b:"knop op het startscherm.", s1c:"Kies jouw naam, voer je wachtwoord in en tik op \"Manager inloggen\".", s1tip:"Als manager kun je ook inloggen via de Medewerker knop om direct de voorraad bij te werken.",
      s2Title:"Tab: Status — Overzicht", s2intro:"De Status tab toont een volledig overzicht van alle voorraden:", s2g:[["Te bestellen","Totaal producten dat bijbesteld moet worden"],["Lekbakken","Aantal actieve lekbakken en vulpercentage"]], s2badge:"Per product zie je:",  s2ok:"= op orde", s2order:"= bestellen",
      s3Title:"Tab: Verbruik — Maandstand", s3intro:"Gebruik deze tab om het maandverbruik bij te houden.", s3wfTitle:"📸 Werkwijze:", s3wf:["Begin van de maand: tik op \"Maandstand vastleggen\"","De app slaat de huidige voorraadstand op","Aan het einde van de maand zie je het verbruik per product","Maximaal 12 maandstanden worden bewaard"],
      s4Title:"Tab: Logboek — Activiteiten", s4intro:"Het logboek toont elke voorraadwijziging met naam, datum en tijdstip.", s4tip:"Handig voor controle: je ziet direct wie wat heeft gewijzigd en wanneer.",
      s5Title:"Bestelrapport — Maandelijkse Uitdraai", s5intro:"Tik op de oranje \"Maandelijkse Uitdraai\" knop in de Status tab.", s5btns:[["📧","Verstuur per e-mail","Gaat naar ingestelde ontvangers"],["⧉","Kopieer tekst","Plak in WhatsApp of Teams"],["📄","Download PDF","Sla op als bestand"]],
      s6Title:"Beheer — Masterfile (PIN)", s6intro:"Via de paarse Beheer knop op het startscherm (PIN vereist) kun je:", s6items:[["Lekbakken","Maximale liters en kleur aanpassen"],["Producten","Producten toevoegen, verwijderen of hernoemen"],["Voorraad","Verbruiksartikelen en doelstellingen beheren"],["Accounts","Medewerkers toevoegen, naam en wachtwoord wijzigen"],["E-mail","Ontvangers voor het bestelrapport instellen"]],
      tipsTitle:"✅ Tips voor managers",
      tips:[["📅","Leg de maandstand vast op de eerste werkdag van elke maand"],["📊","Controleer wekelijks de Status tab om bijtijds te bestellen"],["📋","Gebruik het logboek bij onduidelijkheden over de voorraad"],["🔒","Houd je PIN geheim — alleen jij en de beheerder hebben toegang"]],
    },
  },
  en:{
    worker:{
      title:"Employee Manual", subtitle:"Inventory Management Ruinerwold",
      goalTitle:"Purpose of the app",
      goalText:"This app helps you and your colleagues keep track of the chemical cabinet and consumables inventory. By regularly updating the stock, the manager knows exactly what needs to be ordered — so there is never a shortage.",
      s1Title:"Login", s1a:"Tap the green", s1b:"button on the start screen.", s1c:"Select your name from the dropdown list, enter your password and tap \"Employee login\".", s1tip:"Forgot your password? Ask your manager or administrator.",
      s2Title:"Home screen — choose a cabinet", s2intro:"After logging in you see two options:", s2chemName:"Chemical Cabinet", s2chemDesc:"Hazardous substances in litres", s2stockName:"Normal Stock", s2stockDesc:"Consumables in units", s2outro:"Tap the cabinet you want to update.",
      s3Title:"Update Chemical Cabinet", s3intro:"Choose a tray (1 to 4). You can see the fill percentage per tray.", s3btns:"Tap a product and use the buttons:", s3minus:"Remove bottle (e.g. used up)", s3plus:"Add bottle (new bottle placed)", s3partial:"Partial bottle? Select the remaining percentage:", s3warn:"The \"Report tray empty\" button sets everything to 0. Only use this if the tray is truly empty.",
      s4Title:"Update Normal Stock", s4intro:"You see a list of consumables (toilet paper, gloves, etc.).", s4btns:"Use + and − to enter the actual quantity present.", s4ok:"✓ In stock", s4order:"+X Reorder", s4empty:"Empty!",
      tipsTitle:"✅ Important tips",
      tips:[["🕐","Update the stock at the start or end of your shift"],["👀","Always count the physical stock before updating the app"],["🔄","Not sure about a quantity? Count again"],["💬","Problems or questions? Report them to your manager"]],
    },
    manager:{
      title:"Manager Manual", subtitle:"Inventory Management Ruinerwold",
      goalTitle:"Purpose of the app",
      goalText:"As a manager you have full visibility of all trays and consumables. You can see directly what needs to be ordered, create monthly order reports and consult the activity log.",
      s1Title:"Login as Manager", s1a:"Tap the orange", s1b:"button on the start screen.", s1c:"Select your name, enter your password and tap \"Manager login\".", s1tip:"As a manager you can also log in via the Employee button to update stock directly.",
      s2Title:"Tab: Status — Overview", s2intro:"The Status tab shows a full overview of all stock:", s2g:[["To order","Total products that need to be reordered"],["Trays","Number of active trays and fill percentage"]], s2badge:"Per product you see:", s2ok:"= in order", s2order:"= order",
      s3Title:"Tab: Consumption — Monthly record", s3intro:"Use this tab to track monthly consumption.", s3wfTitle:"📸 How it works:", s3wf:["Start of the month: tap \"Record monthly stock\"","The app saves the current stock level","At the end of the month you see the consumption per product","Maximum 12 monthly records are saved"],
      s4Title:"Tab: Log — Activities", s4intro:"The log shows every stock change with name, date and time.", s4tip:"Useful for review: you can see directly who changed what and when.",
      s5Title:"Order report — Monthly summary", s5intro:"Tap the orange \"Monthly Summary\" button in the Status tab.", s5btns:[["📧","Send by email","Goes to configured recipients"],["⧉","Copy text","Paste in WhatsApp or Teams"],["📄","Download PDF","Save as file"]],
      s6Title:"Admin — Masterfile (PIN)", s6intro:"Via the purple Admin button on the start screen (PIN required) you can:", s6items:[["Trays","Adjust maximum litres and colour"],["Products","Add, remove or rename products"],["Stock","Manage consumables and targets"],["Accounts","Add employees, change name and password"],["Email","Set recipients for the order report"]],
      tipsTitle:"✅ Tips for managers",
      tips:[["📅","Record the monthly stock on the first working day of each month"],["📊","Check the Status tab weekly to order on time"],["📋","Use the log if there are any doubts about the stock"],["🔒","Keep your PIN secret — only you and the administrator have access"]],
    },
  },
  ar:{
    worker:{
      title:"دليل الموظف", subtitle:"إدارة المخزون — رونيرفولد",
      goalTitle:"هدف التطبيق",
      goalText:"يساعدك هذا التطبيق وزملاءك على تتبع مخزون خزانة السوائل ومواد الاستهلاك. من خلال تحديث المخزون بانتظام، يعرف المدير بالضبط ما يحتاج إلى طلبه — حتى لا يحدث نقص أبدًا.",
      s1Title:"تسجيل الدخول", s1a:"اضغط على الزر الأخضر", s1b:"في الشاشة الرئيسية.", s1c:"اختر اسمك من القائمة المنسدلة، أدخل كلمة المرور، ثم اضغط على \"تسجيل الدخول\".", s1tip:"نسيت كلمة المرور؟ اسأل مديرك أو المسؤول.",
      s2Title:"الشاشة الرئيسية — اختر خزانة", s2intro:"بعد تسجيل الدخول ترى خيارين:", s2chemName:"خزانة السوائل", s2chemDesc:"مواد خطرة بالليتر", s2stockName:"المخزون العادي", s2stockDesc:"مواد الاستهلاك بالقطع", s2outro:"اضغط على الخزانة التي تريد تحديثها.",
      s3Title:"تحديث خزانة السوائل", s3intro:"اختر صينية (من 1 إلى 4). ترى نسبة الامتلاء لكل صينية.", s3btns:"اضغط على منتج واستخدم الأزرار:", s3minus:"إزالة زجاجة (مثلاً: استُخدمت)", s3plus:"إضافة زجاجة (زجاجة جديدة وُضعت)", s3partial:"زجاجة جزئية؟ اختر النسبة المتبقية:", s3warn:"زر \"الإبلاغ عن صينية فارغة\" يضع كل شيء على 0. استخدمه فقط إذا كانت الصينية فارغة فعلاً.",
      s4Title:"تحديث المخزون العادي", s4intro:"ترى قائمة بمواد الاستهلاك (ورق تواليت، قفازات، إلخ).", s4btns:"استخدم + و − لإدخال الكمية الفعلية الموجودة.", s4ok:"✓ متوفر", s4order:"+X إعادة الطلب", s4empty:"نفد المخزون!",
      tipsTitle:"✅ نصائح مهمة",
      tips:[["🕐","قم بتحديث المخزون في بداية أو نهاية وردية عملك"],["👀","احسب المخزون الفعلي دائمًا قبل تحديث التطبيق"],["🔄","غير متأكد من الكمية؟ أعد الحساب مرة أخرى"],["💬","مشاكل أو أسئلة؟ أبلغ مديرك"]],
    },
    manager:{
      title:"دليل المدير", subtitle:"إدارة المخزون — رونيرفولد",
      goalTitle:"هدف التطبيق",
      goalText:"بوصفك مديرًا، لديك رؤية كاملة لجميع الصواني ومواد الاستهلاك. يمكنك رؤية ما يحتاج إلى طلب مباشرةً، وإنشاء تقارير طلب شهرية، والاطلاع على سجل الأنشطة.",
      s1Title:"تسجيل الدخول كمدير", s1a:"اضغط على الزر البرتقالي", s1b:"في الشاشة الرئيسية.", s1c:"اختر اسمك، أدخل كلمة المرور، ثم اضغط على \"تسجيل دخول المدير\".", s1tip:"بوصفك مديرًا، يمكنك أيضًا تسجيل الدخول عبر زر الموظف لتحديث المخزون مباشرةً.",
      s2Title:"تبويب: الحالة — نظرة عامة", s2intro:"يعرض تبويب الحالة نظرة عامة كاملة على جميع المخزونات:", s2g:[["للطلب","إجمالي المنتجات التي تحتاج إلى إعادة طلب"],["الصواني","عدد الصواني النشطة ونسبة الامتلاء"]], s2badge:"لكل منتج ترى:", s2ok:"= على ما يرام", s2order:"= للطلب",
      s3Title:"تبويب: الاستهلاك — السجل الشهري", s3intro:"استخدم هذا التبويب لتتبع الاستهلاك الشهري.", s3wfTitle:"📸 طريقة العمل:", s3wf:["بداية الشهر: اضغط على \"تسجيل الحالة الشهرية\"","يحفظ التطبيق مستوى المخزون الحالي","في نهاية الشهر ترى الاستهلاك لكل منتج","يتم الاحتفاظ بـ 12 سجلاً شهريًا كحد أقصى"],
      s4Title:"تبويب: السجل — الأنشطة", s4intro:"يعرض السجل كل تغيير في المخزون مع الاسم والتاريخ والوقت.", s4tip:"مفيد للمراجعة: يمكنك رؤية من غيّر ماذا ومتى مباشرةً.",
      s5Title:"تقرير الطلب — التقرير الشهري", s5intro:"اضغط على زر \"التقرير الشهري\" البرتقالي في تبويب الحالة.", s5btns:[["📧","إرسال بالبريد الإلكتروني","يذهب إلى المستلمين المحددين"],["⧉","نسخ النص","الصقه في واتساب أو Teams"],["📄","تنزيل PDF","حفظ كملف"]],
      s6Title:"الإدارة — Masterfile (PIN)", s6intro:"عبر زر الإدارة الأرجواني في الشاشة الرئيسية (يتطلب PIN) يمكنك:", s6items:[["الصواني","تعديل الحد الأقصى للترات واللون"],["المنتجات","إضافة أو حذف أو إعادة تسمية المنتجات"],["المخزون","إدارة مواد الاستهلاك والأهداف"],["الحسابات","إضافة موظفين وتغيير الاسم وكلمة المرور"],["البريد الإلكتروني","تعيين مستلمي تقرير الطلب"]],
      tipsTitle:"✅ نصائح للمديرين",
      tips:[["📅","سجّل الحالة الشهرية في أول يوم عمل من كل شهر"],["📊","تحقق من تبويب الحالة أسبوعيًا للطلب في الوقت المناسب"],["📋","استخدم السجل عند وجود شكوك حول المخزون"],["🔒","احتفظ بـ PIN سريًا — أنت والمسؤول فقط لديهما صلاحية الوصول"]],
    },
  },
  fr:{
    worker:{
      title:"Manuel de l'employé", subtitle:"Gestion des stocks Ruinerwold",
      goalTitle:"Objectif de l'application",
      goalText:"Cette application vous aide, vous et vos collègues, à suivre le stock de l'armoire à liquides et des consommables. En mettant le stock à jour régulièrement, le manager sait exactement ce qui doit être commandé — pour qu'il n'y ait jamais de pénurie.",
      s1Title:"Connexion", s1a:"Appuyez sur le bouton vert", s1b:"sur l'écran d'accueil.", s1c:"Sélectionnez votre nom dans la liste déroulante, entrez votre mot de passe et appuyez sur « Connexion employé ».", s1tip:"Mot de passe oublié ? Demandez à votre manager ou administrateur.",
      s2Title:"Écran d'accueil — choisissez une armoire", s2intro:"Après la connexion, vous voyez deux options :", s2chemName:"Armoire à liquides", s2chemDesc:"Substances dangereuses en litres", s2stockName:"Stock normal", s2stockDesc:"Consommables en pièces", s2outro:"Appuyez sur l'armoire que vous souhaitez mettre à jour.",
      s3Title:"Mettre à jour l'armoire à liquides", s3intro:"Choisissez un bac (1 à 4). Vous voyez le pourcentage de remplissage par bac.", s3btns:"Appuyez sur un produit et utilisez les boutons :", s3minus:"Retirer une bouteille (par ex. vide)", s3plus:"Ajouter une bouteille (nouvelle bouteille placée)", s3partial:"Bouteille partielle ? Sélectionnez le pourcentage restant :", s3warn:"Le bouton « Signaler bac vide » met tout à 0. Utilisez-le uniquement si le bac est vraiment vide.",
      s4Title:"Mettre à jour le stock normal", s4intro:"Vous voyez une liste de consommables (papier toilette, gants, etc.).", s4btns:"Utilisez + et − pour saisir la quantité réelle présente.", s4ok:"✓ En stock", s4order:"+X Recommander", s4empty:"Vide !",
      tipsTitle:"✅ Conseils importants",
      tips:[["🕐","Mettez le stock à jour au début ou à la fin de votre service"],["👀","Comptez toujours le stock physique avant de mettre à jour l'application"],["🔄","Pas sûr d'une quantité ? Comptez à nouveau"],["💬","Problèmes ou questions ? Signalez-les à votre manager"]],
    },
    manager:{
      title:"Manuel du manager", subtitle:"Gestion des stocks Ruinerwold",
      goalTitle:"Objectif de l'application",
      goalText:"En tant que manager, vous avez une visibilité complète sur tous les bacs et consommables. Vous voyez directement ce qui doit être commandé, vous pouvez créer des rapports de commande mensuels et consulter le journal d'activité.",
      s1Title:"Connexion en tant que manager", s1a:"Appuyez sur le bouton orange", s1b:"sur l'écran d'accueil.", s1c:"Sélectionnez votre nom, entrez votre mot de passe et appuyez sur « Connexion manager ».", s1tip:"En tant que manager, vous pouvez aussi vous connecter via le bouton Employé pour mettre à jour le stock directement.",
      s2Title:"Onglet : Statut — Aperçu", s2intro:"L'onglet Statut affiche un aperçu complet de tous les stocks :", s2g:[["À commander","Total des produits à recommander"],["Bacs","Nombre de bacs actifs et pourcentage de remplissage"]], s2badge:"Par produit, vous voyez :", s2ok:"= en ordre", s2order:"= à commander",
      s3Title:"Onglet : Consommation — Relevé mensuel", s3intro:"Utilisez cet onglet pour suivre la consommation mensuelle.", s3wfTitle:"📸 Comment ça marche :", s3wf:["Début du mois : appuyez sur « Enregistrer le relevé mensuel »","L'application enregistre le niveau de stock actuel","À la fin du mois, vous voyez la consommation par produit","12 relevés mensuels maximum sont conservés"],
      s4Title:"Onglet : Journal — Activités", s4intro:"Le journal affiche chaque modification de stock avec le nom, la date et l'heure.", s4tip:"Utile pour le contrôle : vous voyez directement qui a modifié quoi et quand.",
      s5Title:"Rapport de commande — Récapitulatif mensuel", s5intro:"Appuyez sur le bouton orange « Récapitulatif mensuel » dans l'onglet Statut.", s5btns:[["📧","Envoyer par e-mail","Va aux destinataires configurés"],["⧉","Copier le texte","Collez dans WhatsApp ou Teams"],["📄","Télécharger le PDF","Enregistrer comme fichier"]],
      s6Title:"Administration — Masterfile (PIN)", s6intro:"Via le bouton violet Administration sur l'écran d'accueil (PIN requis), vous pouvez :", s6items:[["Bacs","Ajuster le maximum de litres et la couleur"],["Produits","Ajouter, supprimer ou renommer des produits"],["Stock","Gérer les consommables et les objectifs"],["Comptes","Ajouter des employés, modifier le nom et le mot de passe"],["E-mail","Définir les destinataires du rapport de commande"]],
      tipsTitle:"✅ Conseils pour les managers",
      tips:[["📅","Enregistrez le relevé mensuel le premier jour ouvrable de chaque mois"],["📊","Vérifiez l'onglet Statut chaque semaine pour commander à temps"],["📋","Utilisez le journal en cas de doute sur le stock"],["🔒","Gardez votre PIN secret — seuls vous et l'administrateur y avez accès"]],
    },
  },
};

function ManualModal({type,lang="nl",onClose}){
  const isWorker=type==="worker";
  const accent=isWorker?"#3D8B2E":"#E8632A";
  const accentLight=isWorker?"#EEF9E6":"#FDF0EB";
  const accentBorder=isWorker?"#C8E6B0":"#F5C8A8";
  const L=(MANUAL_TRANS[lang]||MANUAL_TRANS.nl)[type];

  const Step=({n,icon,title,children})=>(
    <div style={{display:"flex",gap:14,marginBottom:20}}>
      <div style={{flexShrink:0,width:36,height:36,borderRadius:"50%",background:accent,color:"#fff",fontFamily:"Nunito,sans-serif",fontWeight:900,fontSize:15,display:"flex",alignItems:"center",justifyContent:"center"}}>{n}</div>
      <div style={{flex:1}}>
        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
          <span style={{fontSize:20}}>{icon}</span>
          <div style={{fontSize:14,fontWeight:900,color:accent}}>{title}</div>
        </div>
        <div style={{fontSize:13,color:"#4A6A3A",lineHeight:1.7}}>{children}</div>
      </div>
    </div>
  );

  const Tip=({icon,children,color="#E8A020",bg="#FFFBEA",border="#F5C842"})=>(
    <div style={{background:bg,border:`2px solid ${border}`,borderRadius:12,padding:"12px 14px",marginBottom:12,display:"flex",gap:10,alignItems:"flex-start"}}>
      <span style={{fontSize:20,flexShrink:0}}>{icon}</span>
      <div style={{fontSize:12,color:"#5A4A00",fontWeight:700,lineHeight:1.6}}>{children}</div>
    </div>
  );

  const Badge=({color,bg,children})=>(
    <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:6,fontSize:11,fontWeight:800,background:bg,color,border:`1.5px solid ${color}44`,marginInlineEnd:4}}>{children}</span>
  );

  return(
    <div className="modal-overlay" style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.6)",zIndex:600,display:"flex",flexDirection:"column",alignItems:"center",overflowY:"auto"}}>
      <div className="modal-box" style={{width:"100%",maxWidth:500,minHeight:"100vh",display:"flex",flexDirection:"column",background:"#F8FDF4"}}>

        {/* Header */}
        <div style={{background:accent,padding:"14px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0,zIndex:10}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:22}}>{isWorker?"👥":"📊"}</span>
            <div>
              <div style={{fontSize:16,fontWeight:900,color:"#fff"}}>{L.title}</div>
              <div style={{fontSize:10,color:"rgba(255,255,255,0.75)"}}>{L.subtitle}</div>
            </div>
          </div>
          <button onClick={onClose} style={{background:"rgba(255,255,255,0.2)",border:"1.5px solid rgba(255,255,255,0.4)",color:"#fff",fontSize:20,width:44,height:44,borderRadius:12,cursor:"pointer",fontWeight:700,flexShrink:0}}>×</button>
        </div>

        <div dir={lang==="ar"?"rtl":"ltr"} style={{flex:1,padding:"20px 18px 40px",fontFamily:"Nunito,Arial,sans-serif",background:"#F8FDF4"}}>

          {/* Doel */}
          <div style={{background:accentLight,border:`2px solid ${accentBorder}`,borderRadius:16,padding:"16px 18px",marginBottom:24}}>
            <div style={{fontSize:13,fontWeight:900,color:accent,marginBottom:6,display:"flex",alignItems:"center",gap:6}}>
              <span>🎯</span> {L.goalTitle}
            </div>
            <div style={{fontSize:13,color:isWorker?"#4A6A3A":"#6A3A1A",lineHeight:1.7}}>{L.goalText}</div>
          </div>

          {isWorker ? <>
            <Step n="1" icon="🔐" title={L.s1Title}>
              <div>{L.s1a} <Badge color="#3D8B2E" bg="#EEF9E6">👥 {tr(lang,"worker")}</Badge> {L.s1b}</div>
              <div style={{marginTop:6}}>{L.s1c}</div>
              <Tip icon="💡" bg="#F0FAE8" border="#C8E6B0">{L.s1tip}</Tip>
            </Step>

            <Step n="2" icon="🏠" title={L.s2Title}>
              <div>{L.s2intro}</div>
              <div style={{display:"flex",gap:10,margin:"10px 0",flexWrap:"wrap"}}>
                <div style={{flex:1,minWidth:120,background:"#EEF9E6",border:"2px solid #C8E6B0",borderRadius:10,padding:"10px",textAlign:"center"}}>
                  <div style={{fontSize:24}}>🧪</div>
                  <div style={{fontSize:12,fontWeight:800,color:"#3D8B2E",marginTop:4}}>{L.s2chemName}</div>
                  <div style={{fontSize:10,color:"#8AAA7A",marginTop:2}}>{L.s2chemDesc}</div>
                </div>
                <div style={{flex:1,minWidth:120,background:"#EBF3FD",border:"2px solid #90B8E8",borderRadius:10,padding:"10px",textAlign:"center"}}>
                  <div style={{fontSize:24}}>📦</div>
                  <div style={{fontSize:12,fontWeight:800,color:"#2D5FA0",marginTop:4}}>{L.s2stockName}</div>
                  <div style={{fontSize:10,color:"#8AAA7A",marginTop:2}}>{L.s2stockDesc}</div>
                </div>
              </div>
              <div>{L.s2outro}</div>
            </Step>

            <Step n="3" icon="🧪" title={L.s3Title}>
              <div>{L.s3intro}</div>
              <div style={{margin:"8px 0"}}>{L.s3btns}</div>
              <div style={{display:"flex",gap:8,margin:"8px 0",alignItems:"center"}}>
                <div style={{width:40,height:40,background:"#F5FBF0",border:"2px solid #C8E6B0",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#3D8B2E",flexShrink:0}}>−</div>
                <div style={{fontSize:12,color:"#4A6A3A"}}>{L.s3minus}</div>
              </div>
              <div style={{display:"flex",gap:8,margin:"8px 0",alignItems:"center"}}>
                <div style={{width:40,height:40,background:"#F5FBF0",border:"2px solid #C8E6B0",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:20,fontWeight:900,color:"#3D8B2E",flexShrink:0}}>+</div>
                <div style={{fontSize:12,color:"#4A6A3A"}}>{L.s3plus}</div>
              </div>
              <div style={{margin:"8px 0 4px"}}>{L.s3partial}</div>
              <div style={{display:"flex",gap:6,margin:"6px 0"}}>
                {["--","25%","50%","75%"].map(v=>(
                  <div key={v} style={{padding:"6px 8px",background:v==="50%"?"#EEF9E6":"#F5FBF0",border:`2px solid ${v==="50%"?"#3D8B2E":"#C8E6B0"}`,borderRadius:8,fontSize:11,fontWeight:800,color:v==="50%"?"#3D8B2E":"#8AAA7A"}}>{v}</div>
                ))}
              </div>
              <Tip icon="⚠️" bg="#FDEDEA" border="#D44A2A">{L.s3warn}</Tip>
            </Step>

            <Step n="4" icon="📦" title={L.s4Title}>
              <div>{L.s4intro}</div>
              <div style={{margin:"8px 0"}}>{L.s4btns}</div>
              <div style={{display:"flex",gap:8,margin:"8px 0",flexWrap:"wrap"}}>
                <div style={{padding:"6px 10px",borderRadius:8,fontSize:11,fontWeight:800,background:"#EEF9E6",color:"#3D8B2E",border:"2px solid #C8E6B066"}}>{L.s4ok}</div>
                <div style={{padding:"6px 10px",borderRadius:8,fontSize:11,fontWeight:800,background:"#FFFBEA",color:"#E8A020",border:"2px solid #F5C84266"}}>{L.s4order}</div>
                <div style={{padding:"6px 10px",borderRadius:8,fontSize:11,fontWeight:800,background:"#FDEDEA",color:"#D44A2A",border:"2px solid #D44A2A66"}}>{L.s4empty}</div>
              </div>
            </Step>

            <div style={{background:"#EEF9E6",border:"2px solid #C8E6B0",borderRadius:14,padding:"14px 16px",marginTop:8}}>
              <div style={{fontSize:13,fontWeight:900,color:"#3D8B2E",marginBottom:10}}>{L.tipsTitle}</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {L.tips.map(([icon,text])=>(
                  <div key={text} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
                    <span style={{fontSize:12,color:"#4A6A3A",lineHeight:1.5}}>{text}</span>
                  </div>
                ))}
              </div>
            </div>

          </> : <>

            <Step n="1" icon="🔐" title={L.s1Title}>
              <div>{L.s1a} <Badge color="#E8632A" bg="#FDF0EB">📊 {tr(lang,"manager")}</Badge> {L.s1b}</div>
              <div style={{marginTop:6}}>{L.s1c}</div>
              <Tip icon="💡" bg="#FDF0EB" border="#F5C8A8">{L.s1tip}</Tip>
            </Step>

            <Step n="2" icon="📊" title={L.s2Title}>
              <div>{L.s2intro}</div>
              <div style={{background:"#fff",border:"2px solid #EEF9E6",borderRadius:10,padding:"10px 12px",margin:"8px 0"}}>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  {L.s2g.map(([t,d])=>(
                    <div key={t} style={{background:"#F5FBF0",borderRadius:8,padding:"8px"}}>
                      <div style={{fontSize:11,fontWeight:900,color:"#3D8B2E"}}>{t}</div>
                      <div style={{fontSize:10,color:"#8AAA7A",marginTop:2}}>{d}</div>
                    </div>
                  ))}
                </div>
              </div>
              <div>{L.s2badge} <Badge color="#3D8B2E" bg="#EEF9E6">✓</Badge> {L.s2ok} &nbsp; <Badge color="#E8A020" bg="#FFFBEA">+X</Badge> {L.s2order}</div>
            </Step>

            <Step n="3" icon="📈" title={L.s3Title}>
              <div>{L.s3intro}</div>
              <div style={{background:"#fff",border:"2px solid #EEF9E6",borderRadius:10,padding:"12px",margin:"8px 0"}}>
                <div style={{fontSize:12,fontWeight:800,color:"#3D8B2E",marginBottom:6}}>{L.s3wfTitle}</div>
                {L.s3wf.map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:8,marginBottom:5}}>
                    <div style={{flexShrink:0,width:18,height:18,borderRadius:"50%",background:"#3D8B2E",color:"#fff",fontSize:10,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>{i+1}</div>
                    <div style={{fontSize:12,color:"#4A6A3A"}}>{s}</div>
                  </div>
                ))}
              </div>
            </Step>

            <Step n="4" icon="📋" title={L.s4Title}>
              <div>{L.s4intro}</div>
              <div style={{background:"#fff",border:"2px solid #EEF9E6",borderRadius:10,padding:"10px 12px",margin:"8px 0"}}>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",padding:"6px 0",borderBottom:"1px solid #EEF9E6"}}>
                  <span style={{fontSize:10,fontWeight:800,color:"#3D8B2E",background:"#EEF9E6",border:"1.5px solid #3D8B2E44",borderRadius:20,padding:"2px 8px",whiteSpace:"nowrap"}}>Jan</span>
                  <div><div style={{fontSize:11,fontWeight:700}}>{lang==="ar"?"الصينية 1 — Glasreiniger: 2 → 3":lang==="en"?"Tray 1 — Glasreiniger: 2 → 3":"Lekbak 1 — Glasreiniger: 2 → 3"}</div><div style={{fontSize:10,color:"#8AAA7A"}}>{lang==="ar"?"08 مايو · 09:14":"08 mei · 09:14"}</div></div>
                </div>
                <div style={{display:"flex",gap:10,alignItems:"flex-start",padding:"6px 0"}}>
                  <span style={{fontSize:10,fontWeight:800,color:"#E8632A",background:"#FDF0EB",border:"1.5px solid #E8632A44",borderRadius:20,padding:"2px 8px",whiteSpace:"nowrap"}}>{tr(lang,"manager")}</span>
                  <div><div style={{fontSize:11,fontWeight:700}}>{lang==="ar"?"تم تسجيل الحالة الشهرية: مايو 2026":lang==="en"?"Monthly stock recorded: May 2026":"Maandstand vastgelegd: mei 2026"}</div><div style={{fontSize:10,color:"#8AAA7A"}}>{lang==="ar"?"01 مايو · 08:02":"01 mei · 08:02"}</div></div>
                </div>
              </div>
              <Tip icon="🔍">{L.s4tip}</Tip>
            </Step>

            <Step n="5" icon="📧" title={L.s5Title}>
              <div>{L.s5intro}</div>
              <div style={{display:"flex",gap:8,margin:"10px 0",flexWrap:"wrap"}}>
                {L.s5btns.map(([icon,t,d])=>(
                  <div key={t} style={{flex:"1 1 90px",background:"#fff",border:"2px solid #EEF9E6",borderRadius:10,padding:"10px",textAlign:"center"}}>
                    <div style={{fontSize:22,marginBottom:4}}>{icon}</div>
                    <div style={{fontSize:11,fontWeight:800,color:"#3D8B2E"}}>{t}</div>
                    <div style={{fontSize:9,color:"#8AAA7A",marginTop:2}}>{d}</div>
                  </div>
                ))}
              </div>
            </Step>

            <Step n="6" icon="🔧" title={L.s6Title}>
              <div>{L.s6intro}</div>
              <div style={{display:"flex",flexDirection:"column",gap:6,margin:"8px 0"}}>
                {L.s6items.map(([t,d])=>(
                  <div key={t} style={{display:"flex",gap:8,alignItems:"center"}}>
                    <div style={{width:8,height:8,borderRadius:"50%",background:"#7C5CBF",flexShrink:0}}/>
                    <div style={{fontSize:12,color:"#4A6A3A"}}><strong>{t}:</strong> {d}</div>
                  </div>
                ))}
              </div>
            </Step>

            <div style={{background:"#FDF0EB",border:"2px solid #F5C8A8",borderRadius:14,padding:"14px 16px",marginTop:8}}>
              <div style={{fontSize:13,fontWeight:900,color:"#E8632A",marginBottom:10}}>{L.tipsTitle}</div>
              <div style={{display:"flex",flexDirection:"column",gap:8}}>
                {L.tips.map(([icon,text])=>(
                  <div key={text} style={{display:"flex",gap:10,alignItems:"flex-start"}}>
                    <span style={{fontSize:16,flexShrink:0}}>{icon}</span>
                    <span style={{fontSize:12,color:"#6A3A1A",lineHeight:1.5}}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </>}
        </div>
      </div>
    </div>
  );
}

function AuditView({log,onClear,lang="nl"}){
  const roleColor={worker:"#3D8B2E",manager:"#E8632A",admin:"#7C5CBF",systeem:"#8AAA7A"};
  const roleLabel={worker:tr(lang,"worker"),manager:tr(lang,"manager"),admin:tr(lang,"admin"),systeem:tr(lang,"roleSystem")};
  return(
    <div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div style={{fontSize:11,fontWeight:800,color:"#8AAA7A",textTransform:"uppercase",letterSpacing:2}}>{tr(lang,"activityLog")} ({log.length})</div>
        {log.length>0&&<button style={{background:"#FDEDEA",border:"1.5px solid #D44A2A44",color:"#D44A2A",borderRadius:8,padding:"4px 10px",fontFamily:"Nunito,sans-serif",fontSize:11,fontWeight:800,cursor:"pointer"}} onClick={()=>{if(!window.confirm(tr(lang,"confirmClearLog")))return;onClear();}}>{tr(lang,"clearLog")}</button>}
      </div>
      {log.length===0&&(
        <div style={{...S.card,textAlign:"center",padding:28}}>
          <div style={{fontSize:32,marginBottom:8}}>📋</div>
          <div style={{fontSize:13,color:"#8AAA7A"}}>{tr(lang,"noActivity")}</div>
        </div>
      )}
      {log.map(e=>{
        const col=roleColor[e.role]||"#8AAA7A";
        const lbl=e.user||roleLabel[e.role]||e.role;
        const dt=new Date(e.ts);
        const dateStr=dt.toLocaleDateString(dloc(lang),{day:"2-digit",month:"short"});
        const timeStr=dt.toLocaleTimeString(dloc(lang),{hour:"2-digit",minute:"2-digit"});
        return(
          <div key={e.id} style={{...S.card,padding:"10px 14px",display:"flex",alignItems:"flex-start",gap:10,marginBottom:8}}>
            <div style={{flexShrink:0,marginTop:2}}>
              <span style={{fontSize:10,fontWeight:800,color:col,background:`${col}18`,border:`1.5px solid ${col}44`,borderRadius:20,padding:"2px 8px",whiteSpace:"nowrap"}}>{lbl}</span>
            </div>
            <div style={{flex:1,minWidth:0}}>
              <div style={{fontSize:12,fontWeight:700,color:"#1A3A0A",lineHeight:1.4}}>{e.msg}</div>
              <div style={{fontSize:10,color:"#8AAA7A",marginTop:2}}>{dateStr} · {timeStr}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function QRPrintModal({cfg,locId,lang="nl",onClose}){
  const base="https://hellofresh-webtooling.github.io/";
  // Unieke URL per hub: scannen opent de app direct op deze locatie (slaat het keuzescherm over).
  const appUrl=locId?`${base}?loc=${locId}`:base;
  const location=cfg?.location||locName(locId)||"Ruinerwold";

  // Sluiten met de Escape-toets.
  useEffect(()=>{
    const onKey=e=>{ if(e.key==="Escape")onClose(); };
    window.addEventListener("keydown",onKey);
    return()=>window.removeEventListener("keydown",onKey);
  },[onClose]);

  return(
    // Klik op de donkere achtergrond (buiten de poster) sluit de modal.
    <div className="modal-overlay" onClick={e=>{if(e.target===e.currentTarget)onClose();}} style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.75)",zIndex:700,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"flex-start",overflowY:"auto",padding:"24px 16px"}}>
      {/* Sticky knoppenbalk — blijft altijd bovenin staan tijdens scrollen */}
      <div className="qr-no-print" style={{position:"sticky",top:0,zIndex:710,display:"flex",gap:12,alignItems:"center",justifyContent:"center",marginBottom:20,padding:"10px 14px",background:"rgba(0,0,0,0.55)",borderRadius:16,backdropFilter:"blur(4px)",flexShrink:0}}>
        <button onClick={()=>window.print()} style={{background:"#3D8B2E",border:"none",borderRadius:14,padding:"12px 28px",fontFamily:"Nunito,sans-serif",fontSize:15,fontWeight:800,color:"#fff",cursor:"pointer",boxShadow:"0 4px 16px rgba(61,139,46,0.35)"}}>
          🖨️ {tr(lang,"qrPrintBtn")}
        </button>
        <button onClick={onClose} aria-label={tr(lang,"close")} title={tr(lang,"close")} style={{width:48,height:48,borderRadius:"50%",background:"#D44A2A",border:"none",color:"#fff",fontSize:26,fontWeight:900,cursor:"pointer",boxShadow:"0 4px 16px rgba(212,74,42,0.5)",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1,flexShrink:0}}>
          ×
        </button>
      </div>

      {/* A4 pagina */}
      <div id="qr-a4-print" dir={lang==="ar"?"rtl":"ltr"} style={{
        width:"210mm",minHeight:"297mm",background:"#fff",
        boxShadow:"0 12px 48px rgba(0,0,0,0.4)",
        display:"flex",flexDirection:"column",
        fontFamily:"'Nunito',sans-serif",
        overflow:"hidden",flexShrink:0,position:"relative",
      }}>
        {/* Fysieke sluitknop op de sheet zelf — tikbaar op telefoon/tablet, wordt niet meegeprint */}
        <button onClick={onClose} aria-label={tr(lang,"close")} title={tr(lang,"close")} className="qr-no-print" style={{position:"absolute",top:16,right:16,zIndex:5,width:52,height:52,borderRadius:"50%",background:"#fff",border:"3px solid #D44A2A",color:"#D44A2A",fontSize:30,fontWeight:900,cursor:"pointer",boxShadow:"0 4px 14px rgba(0,0,0,0.25)",display:"flex",alignItems:"center",justifyContent:"center",lineHeight:1}}>
          ×
        </button>
        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#1E5514 0%,#2D8B1E 60%,#3DA82A 100%)",padding:"36px 48px",display:"flex",alignItems:"center",gap:24}}>
          <div style={{width:72,height:72,background:"#fff",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 4px 16px rgba(0,0,0,0.2)"}}>
            <HelloFreshLogo size={42}/>
          </div>
          <div>
            <div style={{fontSize:36,fontWeight:900,color:"#fff",letterSpacing:-0.5,lineHeight:1}}>HelloFresh</div>
            <div style={{fontSize:20,fontWeight:700,color:"rgba(255,255,255,0.82)",marginTop:6,letterSpacing:0.5}}>{location}</div>
          </div>
          <div style={{marginLeft:"auto",textAlign:"right"}}>
            <div style={{fontSize:11,fontWeight:800,color:"rgba(255,255,255,0.6)",textTransform:"uppercase",letterSpacing:2}}>{tr(lang,"stockManagement")}</div>
            <div style={{fontSize:11,fontWeight:700,color:"rgba(255,255,255,0.5)",marginTop:3}}>{tr(lang,"qrAccessVia")}</div>
          </div>
        </div>

        {/* Oranje balk */}
        <div style={{height:6,background:"linear-gradient(90deg,#E8632A,#F5A060)"}}/>

        {/* Hoofd content */}
        <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"52px 48px 40px"}}>
          <div style={{fontSize:13,fontWeight:800,color:"#8AAA7A",textTransform:"uppercase",letterSpacing:3,marginBottom:36}}>{tr(lang,"qrScanToOpen")}</div>

          {/* QR code kaart */}
          <div style={{
            background:"#fff",border:"5px solid #3D8B2E",borderRadius:28,
            padding:"32px",
            boxShadow:"0 16px 56px rgba(61,139,46,0.18)",
            marginBottom:36,
            position:"relative",
          }}>
            {/* hoekdecoraties */}
            {[{top:-3,left:-3},{top:-3,right:-3},{bottom:-3,left:-3},{bottom:-3,right:-3}].map((pos,i)=>(
              <div key={i} style={{position:"absolute",width:20,height:20,background:"#E8632A",borderRadius:4,...pos}}/>
            ))}
            <QRCodeSVG
              value={appUrl}
              size={280}
              bgColor="#ffffff"
              fgColor="#1A3A0A"
              level="H"
              marginSize={1}
            />
          </div>

          <div style={{fontSize:30,fontWeight:900,color:"#1A3A0A",marginBottom:10,textAlign:"center",letterSpacing:-0.5}}>{tr(lang,"qrAppName")}</div>
          <div style={{fontSize:13,fontWeight:700,color:"#8AAA7A",textAlign:"center",letterSpacing:0.5,marginBottom:40}}>{appUrl}</div>

          {/* Scheidingslijn */}
          <div style={{display:"flex",alignItems:"center",gap:16,width:"100%",maxWidth:380,marginBottom:40}}>
            <div style={{flex:1,height:2,background:"#EEF9E6"}}/>
            <div style={{width:10,height:10,background:"#E8632A",borderRadius:"50%"}}/>
            <div style={{flex:1,height:2,background:"#EEF9E6"}}/>
          </div>

          {/* Stappen */}
          <div style={{display:"flex",flexDirection:"column",gap:16,width:"100%",maxWidth:380}}>
            {[
              ["1","📷",tr(lang,"qrStep1")],
              ["2","🔍",tr(lang,"qrStep2")],
              ["3","✅",tr(lang,"qrStep3")],
            ].map(([num,icon,text])=>(
              <div key={num} style={{display:"flex",gap:16,alignItems:"center"}}>
                <div style={{width:36,height:36,background:"linear-gradient(135deg,#3D8B2E,#2D7A1E)",borderRadius:"50%",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,boxShadow:"0 3px 10px rgba(61,139,46,0.3)"}}>
                  <span style={{fontSize:14,fontWeight:900,color:"#fff"}}>{num}</span>
                </div>
                <div style={{width:36,height:36,background:"#F0FAE8",border:"2px solid #C8E6B0",borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:20}}>{icon}</div>
                <div style={{fontSize:14,fontWeight:700,color:"#1A3A0A",lineHeight:1.4}}>{text}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div style={{background:"#F0FAE8",borderTop:"3px solid #C8E6B0",padding:"20px 48px",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
          <div style={{fontSize:12,fontWeight:700,color:"#8AAA7A"}}>HelloFresh {location} · {tr(lang,"stockManagement")}</div>
          <div style={{display:"flex",gap:6,alignItems:"center"}}>
            <div style={{width:8,height:8,background:"#3D8B2E",borderRadius:"50%"}}/>
            <div style={{width:8,height:8,background:"#E8632A",borderRadius:"50%"}}/>
            <div style={{fontSize:12,fontWeight:700,color:"#8AAA7A",marginLeft:4}}>© 2026</div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Per locatie: totaal te bestellen, aantal lage-voorraad-items en de uitsplitsing.
const orderSummary = (cfg,inv) => {
  const shelves=aSh(cfg);
  const vProducts=(cfg.voorraad||[]).filter(p=>p.active!==false);
  let order=0, low=0; const items=[];
  shelves.forEach(sh=>aPr(sh).forEach(p=>{
    const need=Math.max(0,p.target-(inv[p.id]||{full:0}).full);
    order+=need; if(need>0){low++; items.push({group:sh.label,name:p.name,need,unit:"fl"});}
  }));
  vProducts.forEach(p=>{
    const need=Math.max(0,p.target-(inv[p.id]||{count:0}).count);
    order+=need; if(need>0){low++; items.push({group:"Normale Voorraad",name:p.name,need,unit:p.unit});}
  });
  return {order,low,items,shelfCount:shelves.length};
};

// VIB/SDS-document per product. Knop + modal: bekijken/downloaden altijd,
// uploaden/vervangen/verwijderen alleen als canEdit (Beheer + Manager).
// Bestand staat in Storage-bucket "sds" onder <locId>/<productId>.<ext>; de
// metadata (fileName/path/url/...) staat per product-id in sdsMap (key
// "vkast-sds:<locId>"). Werkt voor zowel lekbak-producten als normale voorraad.
function SdsControl({product,locId,meta,canEdit=false,lang="nl",uploadedBy="",onSaved,onRemoved}){
  const [open,setOpen]=useState(false);
  const [busy,setBusy]=useState(false);
  const [err,setErr]=useState("");
  const fileRef=useRef(null);
  const rtl=lang==="ar";
  // meta kan een array (nieuw) of één object (oude data) zijn — normaliseren.
  const docs=Array.isArray(meta)?meta:(meta?[meta]:[]);
  const has=docs.length>0;

  const onFile=async(e)=>{
    const file=e.target.files?.[0];
    if(e.target)e.target.value="";   // reset zodat hetzelfde bestand opnieuw kan
    if(!file)return;
    if(!["application/pdf","image/jpeg","image/png"].includes(file.type)){setErr(tr(lang,"sdsBadType"));return;}
    if(file.size>10*1024*1024){setErr(tr(lang,"sdsTooBig"));return;}
    setErr("");setBusy(true);
    try{
      const ext=(file.name.split(".").pop()||"pdf").toLowerCase();
      const path=`${locId}/${product.id}-${Date.now()}.${ext}`;   // uniek pad: documenten overschrijven elkaar niet
      const {error}=await supabase.storage.from("sds").upload(path,file,{upsert:true,contentType:file.type});
      if(error)throw error;
      const {data}=supabase.storage.from("sds").getPublicUrl(path);
      onSaved?.(product.id,{fileName:file.name,path,url:data.publicUrl,size:file.size,type:file.type,uploadedAt:new Date().toISOString(),uploadedBy,productName:product.name});
    }catch{ setErr(tr(lang,"sdsError")); }
    setBusy(false);
  };

  const remove=(doc)=>{
    if(!window.confirm(tr(lang,"sdsRemoveConfirm")))return;
    if(doc?.path)supabase.storage.from("sds").remove([doc.path]).catch(()=>{});
    onRemoved?.(product.id,doc,product.name);
  };

  return(<>
    <button title={tr(lang,"sds")} onClick={()=>setOpen(true)}
      style={{flexShrink:0,display:"inline-flex",alignItems:"center",gap:3,background:has?"#EEF9E6":"#F3F3F3",border:`1.5px solid ${has?"#3D8B2E":"#D6D6D6"}`,borderRadius:8,padding:"3px 7px",cursor:"pointer",fontFamily:"Nunito,sans-serif",fontSize:10,fontWeight:800,color:has?"#3D8B2E":"#9A9A9A",lineHeight:1}}>
      <span style={{fontSize:12}}>📄</span>{tr(lang,"sds")}{has&&<span style={{background:"#3D8B2E",color:"#fff",borderRadius:8,padding:"0 5px",fontSize:9}}>{docs.length}</span>}
    </button>
    {open&&(
      <div className="modal-overlay" style={{position:"fixed",inset:0,background:"rgba(61,139,46,0.45)",zIndex:600,display:"flex",alignItems:"center",justifyContent:"center",padding:16}} onClick={()=>!busy&&setOpen(false)}>
        <div dir={rtl?"rtl":"ltr"} onClick={e=>e.stopPropagation()} style={{width:"100%",maxWidth:440,maxHeight:"90vh",display:"flex",flexDirection:"column",background:"linear-gradient(160deg,#F7FCF2,#FEFEFB)",borderRadius:18,overflow:"hidden",boxShadow:"0 12px 40px rgba(0,0,0,0.25)"}}>
          <div style={{background:"#3D8B2E",padding:"13px 16px",display:"flex",alignItems:"center",justifyContent:"space-between",flexShrink:0}}>
            <div style={{display:"flex",alignItems:"center",gap:8,minWidth:0}}><span style={{fontSize:18}}>📄</span><div style={{minWidth:0}}>
              <div style={{fontSize:14,fontWeight:900,color:"#fff"}}>{tr(lang,"sdsTitle")}</div>
              <div style={{fontSize:11,fontWeight:700,color:"#D6F0C8",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{product.name}</div>
            </div></div>
            <button onClick={()=>!busy&&setOpen(false)} style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",fontSize:16,width:34,height:34,borderRadius:9,cursor:"pointer",fontWeight:700,flexShrink:0}}>×</button>
          </div>
          <div style={{padding:16,overflowY:"auto"}}>
            {has?(
              <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:14}}>
                {docs.map((doc,i)=>{
                  const dt=doc.uploadedAt?new Date(doc.uploadedAt).toLocaleDateString(dloc(lang)):"";
                  return(
                    <div key={doc.path||i} style={{border:"2px solid #DCEFCF",borderRadius:12,padding:"10px 12px",background:"#fff"}}>
                      <div style={{fontSize:13,fontWeight:800,color:"#1A3A0A",wordBreak:"break-all",marginBottom:4}}>{doc.fileName}</div>
                      {(doc.uploadedBy||dt)&&<div style={{fontSize:11,fontWeight:700,color:"#8AAA7A",marginBottom:8}}>{tr(lang,"sdsUploadedBy")} {doc.uploadedBy||"—"}{dt&&` ${tr(lang,"sdsUploadedOn")} ${dt}`}</div>}
                      <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
                        <a href={doc.url} target="_blank" rel="noreferrer" style={{...S.btn,flex:1,minWidth:120,textAlign:"center",textDecoration:"none",background:"linear-gradient(135deg,#4DA035,#3D8B2E)",color:"#fff",padding:"9px 10px",fontSize:13}}>👁 {tr(lang,"sdsView")}</a>
                        <a href={doc.url} download={doc.fileName} style={{...S.btn,flex:1,minWidth:120,textAlign:"center",textDecoration:"none",background:"#F5FBF0",border:"2px solid #C8E6B0",color:"#3D8B2E",padding:"9px 10px",fontSize:13}}>⬇ {tr(lang,"sdsDownload")}</a>
                        {canEdit&&<button onClick={()=>remove(doc)} disabled={busy} title={tr(lang,"sdsRemove")} style={{background:"#fff",border:"2px solid #E8C0C0",color:"#C0392B",borderRadius:12,padding:"9px 12px",cursor:busy?"wait":"pointer",fontSize:13,fontWeight:800}}>🗑</button>}
                      </div>
                    </div>
                  );
                })}
              </div>
            ):(
              <div style={{fontSize:13,fontWeight:700,color:"#8AAA7A",textAlign:"center",padding:"14px 0 18px"}}>{tr(lang,"sdsNone")}</div>
            )}
            {canEdit&&(<div>
              <input ref={fileRef} type="file" accept="application/pdf,image/jpeg,image/png" style={{display:"none"}} onChange={onFile}/>
              {err&&<div style={{color:"#e74c3c",fontSize:12,fontWeight:700,marginBottom:8,textAlign:"center"}}>{err}</div>}
              <button onClick={()=>fileRef.current?.click()} disabled={busy}
                style={{...S.btn,width:"100%",background:busy?"#B8D9A8":"linear-gradient(135deg,#4DA035,#3D8B2E)",color:"#fff",cursor:busy?"wait":"pointer"}}>
                {busy?tr(lang,"sdsUploading"):`⬆ ${tr(lang,"sdsAdd")}`}
              </button>
            </div>)}
          </div>
        </div>
      </div>
    )}
  </>);
}

// Meldingen/ideeën van medewerkers per locatie. Opgeslagen in app_state onder
// key "vkast-feedback:<locId>" (zelfde schrijfpad als de rest via dbSet).
// In te zien door HQ via het "Meldingen"-tabblad in het HQ-overzicht.
function FeedbackModal({locId,lang="nl",onClose}){
  const [type,setType]=useState("probleem");
  const [name,setName]=useState("");
  const [msg,setMsg]=useState("");
  const [err,setErr]=useState(false);
  const [sending,setSending]=useState(false);
  const [done,setDone]=useState(false);
  const rtl=lang==="ar";

  const submit=async()=>{
    if(!msg.trim()){setErr(true);return;}
    setSending(true);
    const entry={id:crypto.randomUUID(),type,name:name.trim(),msg:msg.trim(),ts:Date.now(),status:"open"};
    const k=keyFor("vkast-feedback",locId);
    let cur=[];
    try{
      const {data}=await supabase.from("app_state").select("value").eq("key",k).maybeSingle();
      cur=Array.isArray(data?.value)?data.value:[];
    }catch{ cur=ls.get(k)||[]; }
    if(!Array.isArray(cur))cur=[];
    await dbSet(k,[entry,...cur].slice(0,300));
    setSending(false);setDone(true);
  };
  const reset=()=>{setType("probleem");setName("");setMsg("");setErr(false);setDone(false);};

  return(
    <div className="modal-overlay" style={{position:"fixed",inset:0,background:"rgba(196,106,18,0.5)",zIndex:500,display:"flex",flexDirection:"column",alignItems:"center",overflowY:"auto"}}>
      <div dir={rtl?"rtl":"ltr"} className="modal-box" style={{width:"100%",maxWidth:460,minHeight:"100vh",display:"flex",flexDirection:"column",background:"linear-gradient(160deg,#FFF8EF,#FEFCF4)"}}>
        <div style={{background:"#E8902A",padding:"13px 18px",display:"flex",alignItems:"center",justifyContent:"space-between",position:"sticky",top:0}}>
          <div style={{display:"flex",alignItems:"center",gap:8}}><span style={{fontSize:18}}>📣</span><div style={{fontSize:15,fontWeight:900,color:"#fff"}}>{tr(lang,"fbTitle")}</div></div>
          <button style={{background:"rgba(255,255,255,0.15)",border:"1.5px solid rgba(255,255,255,0.3)",color:"#fff",fontSize:16,width:36,height:36,borderRadius:10,cursor:"pointer",fontWeight:700}} onClick={onClose}>×</button>
        </div>

        {done?(
          <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"40px 24px",textAlign:"center"}}>
            <div style={{fontSize:54,marginBottom:12}}>✅</div>
            <div style={{fontSize:22,fontWeight:900,color:"#C46A12",marginBottom:6}}>{tr(lang,"fbThanksTitle")}</div>
            <div style={{fontSize:14,fontWeight:700,color:"#8A6A3A",marginBottom:28,maxWidth:300}}>{tr(lang,"fbThanksMsg")}</div>
            <button onClick={reset} style={{...S.btn,background:"#fff",border:"2.5px solid #F3C98B",color:"#C46A12",marginBottom:10}}>{tr(lang,"fbNew")}</button>
            <button onClick={onClose} style={{...S.btn,background:"linear-gradient(135deg,#E8902A,#C46A12)",color:"#fff"}}>{tr(lang,"close")}</button>
          </div>
        ):(
          <div style={{flex:1,padding:16}}>
            <div style={{fontSize:13,fontWeight:700,color:"#8A6A3A",lineHeight:1.5,marginBottom:16}}>{tr(lang,"fbIntro")}</div>

            <div style={{marginBottom:16}}>
              <span style={{...S.lbl,color:"#B5895A"}}>{tr(lang,"fbType")}</span>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                {[["probleem","⚠️","fbProblem","fbProblemSub"],["aanpassing","💡","fbChange","fbChangeSub"]].map(([t,ic,lbl,sub])=>(
                  <div key={t} onClick={()=>setType(t)} className="card-hover"
                    style={{cursor:"pointer",textAlign:"center",padding:"14px 8px",borderRadius:14,border:`2.5px solid ${type===t?"#E8902A":"#F0DFC4"}`,background:type===t?"#FFF1DE":"#fff"}}>
                    <div style={{fontSize:24,marginBottom:4}}>{ic}</div>
                    <div style={{fontSize:13,fontWeight:900,color:type===t?"#C46A12":"#8A6A3A"}}>{tr(lang,lbl)}</div>
                    <div style={{fontSize:9,fontWeight:700,color:"#B5895A",marginTop:2}}>{tr(lang,sub)}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{marginBottom:16}}>
              <span style={{...S.lbl,color:"#B5895A"}}>{tr(lang,"fbName")}</span>
              <input value={name} onChange={e=>setName(e.target.value)} placeholder={tr(lang,"fbNamePlaceholder")}
                style={{...S.inp,background:"#FFFDF8",border:"2px solid #F0DFC4",textAlign:rtl?"right":"left"}}/>
            </div>

            <div style={{marginBottom:8}}>
              <span style={{...S.lbl,color:"#B5895A"}}>{tr(lang,"fbMessage")} *</span>
              <textarea value={msg} onChange={e=>{setMsg(e.target.value);if(err)setErr(false);}} placeholder={tr(lang,"fbMessagePlaceholder")}
                style={{...S.inp,background:"#FFFDF8",border:`2px solid ${err?"#e74c3c":"#F0DFC4"}`,height:120,resize:"vertical",lineHeight:1.5,textAlign:rtl?"right":"left"}}/>
            </div>
            {err&&<div style={{color:"#e74c3c",fontSize:12,fontWeight:700,marginBottom:10}}>{tr(lang,"fbRequired")}</div>}

            <button onClick={submit} disabled={sending}
              style={{...S.btn,width:"100%",marginTop:8,background:sending?"#E8C49A":"linear-gradient(135deg,#E8902A,#C46A12)",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",gap:8,cursor:sending?"wait":"pointer"}}>
              <span style={{fontSize:18}}>📨</span> {sending?tr(lang,"fbSending"):tr(lang,"fbSend")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function LocationPicker({onPick,onHQ}){
  return(
    <div style={{minHeight:"100vh",background:"linear-gradient(160deg,#F0FAE8,#FEFCF4)",fontFamily:"Nunito,Arial,sans-serif",display:"flex",flexDirection:"column",alignItems:"center"}}>
      <style>{GF}</style>
      <Hdr cfg={{appName:"Voorraadbeheer",location:"Kies je locatie"}}/>
      <div style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",padding:"28px 18px 12px",width:"100%",maxWidth:560}}>
        <div style={{marginBottom:14}}><HelloFreshLogo size={96}/></div>
        <div style={{fontSize:26,fontWeight:900,color:"#3D8B2E",marginBottom:2}}>Voorraadbeheer</div>
        <div style={{fontSize:11,color:"#8AAA7A",letterSpacing:2,textTransform:"uppercase",marginBottom:24,fontWeight:700}}>Kies een vestiging</div>

        {COUNTRIES.map(c=>{
          const locs=LOCATIONS.filter(l=>l.country===c.code);
          if(locs.length===0)return null;
          return(
            <div key={c.code} style={{width:"100%",marginBottom:22}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:10}}>
                <span style={{fontSize:18}}>{c.flag}</span>
                <span style={{fontSize:12,fontWeight:800,color:"#4A6A3A",textTransform:"uppercase",letterSpacing:1}}>{c.label}</span>
                <div style={{flex:1,height:2,background:"#EEF9E6",borderRadius:2}}/>
                <span style={{fontSize:10,fontWeight:700,color:"#8AAA7A"}}>{locs.length}</span>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:10}}>
                {locs.map(l=>(
                  <div key={l.id} className="card-hover" onClick={()=>onPick(l.id)}
                    style={{cursor:"pointer",background:"#fff",border:"2.5px solid #C8E6B0",borderRadius:16,padding:"16px 12px",textAlign:"center",boxShadow:"0 4px 14px rgba(61,139,46,0.1)"}}>
                    <div style={{fontSize:22,marginBottom:6}}>📍</div>
                    <div style={{fontSize:14,fontWeight:900,color:"#1A3A0A",lineHeight:1.2}}>{l.name}</div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

        <button className="btn-hover" onClick={onHQ}
          style={{marginTop:6,marginBottom:20,display:"flex",alignItems:"center",gap:10,background:"linear-gradient(135deg,#1E3A5F,#0F2A47)",border:"none",borderRadius:16,padding:"14px 26px",fontFamily:"Nunito,Arial,sans-serif",fontSize:14,fontWeight:800,color:"#fff",cursor:"pointer",boxShadow:"0 6px 20px rgba(15,42,71,0.3)"}}>
          <span style={{fontSize:20}}>🏢</span>
          <div style={{textAlign:"left"}}><div>HQ-overzicht</div><div style={{fontSize:9,opacity:0.7,fontWeight:700}}>Alle locaties · PIN vereist</div></div>
        </button>
      </div>
      <Ftr/>
    </div>
  );
}

function HQDashboard({onBack}){
  const [pin,setPin]=useState("");
  const [unlocked,setUnlocked]=useState(false);
  const [err,setErr]=useState(false);
  const [attempts,setAttempts]=useState(0);
  const [locked,setLocked]=useState(false);
  const [loading,setLoading]=useState(false);
  const [rows,setRows]=useState(null);
  const [open,setOpen]=useState(null);
  const [tab,setTab]=useState("voorraad");
  const [fb,setFb]=useState({}); // { locId: [ {id,type,name,msg,ts,status} ] }

  const load=useCallback(async()=>{
    setLoading(true);
    const cfgK=(id)=>keyFor("vkast-cfg",id), invK=(id)=>keyFor("vkast-inv",id), fbK=(id)=>keyFor("vkast-feedback",id);
    const allKeys=[...LOCATIONS.map(l=>cfgK(l.id)),...LOCATIONS.map(l=>invK(l.id)),...LOCATIONS.map(l=>fbK(l.id))];
    const map={};
    try{
      const {data}=await supabase.from("app_state").select("key,value").in("key",allKeys);
      (data||[]).forEach(r=>{map[r.key]=r.value;});
    }catch{}
    const res=LOCATIONS.map(l=>{
      const rawCfg=map[cfgK(l.id)]||ls.get(cfgK(l.id));
      const rawInv=map[invK(l.id)]||ls.get(invK(l.id));
      const cfg=rawCfg||defCfgFor(l.id);
      const inv=rawInv||{};
      return {loc:l,configured:!!rawCfg,...orderSummary(cfg,inv)};
    });
    const fbMap={};
    LOCATIONS.forEach(l=>{
      const raw=map[fbK(l.id)]||ls.get(fbK(l.id));
      fbMap[l.id]=Array.isArray(raw)?raw:[];
    });
    setRows(res);setFb(fbMap);setLoading(false);
  },[]);

  // Markeer opgepakt / verwijder een melding; schrijft de hele lijst terug.
  const updateFb=async(locId,nextList)=>{
    setFb(prev=>({...prev,[locId]:nextList}));
    await dbSet(keyFor("vkast-feedback",locId),nextList);
  };
  const toggleFb=(locId,id)=>{
    const list=(fb[locId]||[]).map(m=>m.id===id?{...m,status:m.status==="done"?"open":"done"}:m);
    updateFb(locId,list);
  };
  const deleteFb=(locId,id)=>{
    if(!window.confirm("Deze melding verwijderen?"))return;
    updateFb(locId,(fb[locId]||[]).filter(m=>m.id!==id));
  };

  const submit=async(nx)=>{
    const h=await hashPw(nx);
    if(h===HQ_PIN_HASH){setUnlocked(true);setErr(false);setPin("");setAttempts(0);load();}
    else{const a=attempts+1;setAttempts(a);if(a>=3){setLocked(true);setTimeout(()=>{setLocked(false);setAttempts(0);},30000);}setErr(true);setPin("");}
  };
  const onDigit=(d)=>{
    if(pin.length>=4||locked)return;
    const nx=pin+d;setPin(nx);
    if(nx.length===4)setTimeout(()=>submit(nx),150);
  };

  const wrap={minHeight:"100vh",background:"linear-gradient(160deg,#0F2A47,#1E3A5F)",fontFamily:"Nunito,sans-serif",display:"flex",flexDirection:"column",alignItems:"center"};

  if(!unlocked) return(
    <div style={wrap}>
      <style>{GF}</style>
      <Hdr cfg={{appName:"HQ-overzicht",location:"Alle locaties"}} isAdmin onBack={onBack} backLabel="Terug"/>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",padding:24}}>
        <div style={{background:"#0F2A47",border:"2px solid #2E6FA8",borderRadius:24,padding:32,width:"100%",maxWidth:300,textAlign:"center"}}>
          <div style={{fontSize:40,marginBottom:10}}>🏢</div>
          <div style={{fontSize:20,fontWeight:900,color:"#6FB4E8",marginBottom:4}}>HQ-overzicht</div>
          <div style={{fontSize:10,color:"#4A7AA8",letterSpacing:2,textTransform:"uppercase",marginBottom:20}}>Voer master-PIN in</div>
          {err&&<div style={{color:"#e74c3c",fontSize:12,fontWeight:700,marginBottom:10}}>Onjuiste PIN</div>}
          <div style={{display:"flex",justifyContent:"center",gap:12,marginBottom:20}}>
            {[0,1,2,3].map(i=><div key={i} style={{width:16,height:16,borderRadius:"50%",border:`2.5px solid ${pin.length>i?"#2E6FA8":"#1A3A5A"}`,background:pin.length>i?"#2E6FA8":"transparent"}}/>)}
          </div>
          {locked&&<div style={{color:"#e74c3c",fontSize:12,fontWeight:700,marginBottom:10}}>Geblokkeerd — wacht 30 seconden</div>}
          <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:8}}>
            {[1,2,3,4,5,6,7,8,9].map(n=>(
              <button key={n} style={{height:52,background:"#16324E",border:"2px solid #1A3A5A",borderRadius:12,color:locked?"#1A3A5A":"#A8D0F0",fontFamily:"Nunito,sans-serif",fontSize:20,fontWeight:700,cursor:locked?"not-allowed":"pointer"}} onClick={()=>onDigit(String(n))}>{n}</button>
            ))}
            <div/>
            <button style={{height:52,background:"#16324E",border:"2px solid #1A3A5A",borderRadius:12,color:locked?"#1A3A5A":"#A8D0F0",fontFamily:"Nunito,sans-serif",fontSize:20,fontWeight:700,cursor:locked?"not-allowed":"pointer"}} onClick={()=>onDigit("0")}>0</button>
            <button style={{height:52,background:"#16324E",border:"2px solid #1A3A5A",borderRadius:12,color:"#7BA8CC",fontFamily:"Nunito,sans-serif",fontSize:16,cursor:"pointer"}} onClick={()=>{setPin(p=>p.slice(0,-1));setErr(false);}}>DEL</button>
          </div>
        </div>
      </div>
      <Ftr isAdmin/>
    </div>
  );

  const totalOrder=(rows||[]).reduce((s,r)=>s+r.order,0);
  const activeLocs=(rows||[]).filter(r=>r.configured).length;
  const allFb=Object.values(fb).flat();
  const totalFb=allFb.length;
  const openFb=allFb.filter(m=>m.status!=="done").length;
  return(
    <div style={wrap}>
      <style>{GF}</style>
      <Hdr cfg={{appName:"HQ-overzicht",location:`${LOCATIONS.length} locaties`}} isAdmin onBack={onBack} backLabel="Terug"/>
      <div className="resp-wide" style={{width:"100%",maxWidth:620,padding:"16px 14px 0",margin:"0 auto"}}>
        {loading&&<div style={{textAlign:"center",color:"#7BA8CC",fontWeight:700,padding:40,letterSpacing:2}}>LADEN...</div>}
        {!loading&&rows&&(
          <div>
            <div style={{display:"flex",gap:8,marginBottom:14}}>
              {[["voorraad","📦","Voorraad",0],["meldingen","📣","Meldingen",openFb]].map(([t,ic,lbl,badge])=>(
                <button key={t} onClick={()=>setTab(t)}
                  style={{flex:1,position:"relative",padding:"11px 6px",border:"2px solid",borderColor:tab===t?"#6FB4E8":"#1A3A5A",borderRadius:12,background:tab===t?"#16324E":"#0F2A47",color:tab===t?"#E0ECF8":"#5A8AB8",fontFamily:"Nunito,sans-serif",fontSize:12,fontWeight:800,cursor:"pointer"}}>
                  {ic} {lbl}
                  {badge>0&&<span style={{position:"absolute",top:-7,right:8,minWidth:18,height:18,padding:"0 5px",borderRadius:9,background:"#E8632A",color:"#fff",fontSize:10,fontWeight:900,display:"inline-flex",alignItems:"center",justifyContent:"center"}}>{badge}</span>}
                </button>
              ))}
            </div>
            <button onClick={load} style={{background:"#16324E",border:"2px solid #2E6FA8",color:"#A8D0F0",borderRadius:10,padding:"7px 14px",fontFamily:"Nunito,sans-serif",fontSize:11,fontWeight:800,cursor:"pointer",marginBottom:14}}>↻ Vernieuwen</button>

          {tab==="voorraad"&&(<div>
            <div style={{display:"flex",gap:10,marginBottom:16}}>
              <div style={{flex:1,background:"#0F2A47",border:"2px solid #2E6FA8",borderRadius:16,padding:"14px 12px",textAlign:"center"}}>
                <div style={{fontSize:28,fontWeight:900,color:totalOrder>0?"#F5A623":"#5AD18A"}}>{totalOrder}</div>
                <div style={{fontSize:9,color:"#7BA8CC",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginTop:3}}>Totaal te bestellen</div>
              </div>
              <div style={{flex:1,background:"#0F2A47",border:"2px solid #2E6FA8",borderRadius:16,padding:"14px 12px",textAlign:"center"}}>
                <div style={{fontSize:28,fontWeight:900,color:"#6FB4E8"}}>{activeLocs}<span style={{fontSize:14,color:"#4A7AA8"}}>/{LOCATIONS.length}</span></div>
                <div style={{fontSize:9,color:"#7BA8CC",fontWeight:700,textTransform:"uppercase",letterSpacing:1,marginTop:3}}>Ingericht</div>
              </div>
            </div>
            {COUNTRIES.map(c=>{
              const locRows=rows.filter(r=>r.loc.country===c.code);
              if(locRows.length===0)return null;
              return(
                <div key={c.code} style={{marginBottom:18}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:16}}>{c.flag}</span>
                    <span style={{fontSize:11,fontWeight:800,color:"#7BA8CC",textTransform:"uppercase",letterSpacing:1}}>{c.label}</span>
                  </div>
                  {locRows.map(r=>{
                    const isOpen=open===r.loc.id;
                    return(
                      <div key={r.loc.id} style={{background:"#0F2A47",border:`2px solid ${r.order>0?"#5A4520":"#1A3A5A"}`,borderRadius:14,marginBottom:8,overflow:"hidden"}}>
                        <div onClick={()=>setOpen(isOpen?null:r.loc.id)} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"12px 14px",cursor:"pointer"}}>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:16}}>📍</span>
                            <div>
                              <div style={{fontSize:14,fontWeight:900,color:"#E0ECF8"}}>{r.loc.name}</div>
                              <div style={{fontSize:10,color:"#5A8AB8",fontWeight:700,marginTop:1}}>
                                {!r.configured?"Nog niet ingericht":r.order>0?`${r.low} ${r.low===1?"artikel":"artikelen"} laag`:"Alles op peil"}
                              </div>
                            </div>
                          </div>
                          <div style={{display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:18,fontWeight:900,color:r.order>0?"#F5A623":"#5AD18A"}}>{r.order>0?`+${r.order}`:"✓"}</span>
                            <span style={{fontSize:11,color:"#4A7AA8"}}>{isOpen?"▲":"▼"}</span>
                          </div>
                        </div>
                        {isOpen&&(
                          <div style={{borderTop:"1px solid #1A3A5A",padding:"8px 14px 12px"}}>
                            {r.items.length===0&&<div style={{fontSize:12,color:"#5A8AB8",padding:"6px 0"}}>Geen bestellingen nodig.</div>}
                            {r.items.map((it,i)=>(
                              <div key={i} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"5px 0",borderBottom:"1px solid #14304C"}}>
                                <div style={{minWidth:0}}>
                                  <div style={{fontSize:12,fontWeight:700,color:"#D0E2F4",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.name}</div>
                                  <div style={{fontSize:9,color:"#4A7AA8",fontWeight:600}}>{it.group}</div>
                                </div>
                                <span style={{fontSize:12,fontWeight:800,color:"#F5A623",flexShrink:0,marginLeft:10}}>+{it.need} {it.unit}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>)}

          {tab==="meldingen"&&(<div>
            {openFb===0&&totalFb===0&&(
              <div style={{textAlign:"center",color:"#5A8AB8",padding:"36px 16px"}}>
                <div style={{fontSize:40,marginBottom:8}}>📭</div>
                <div style={{fontSize:13,fontWeight:700}}>Nog geen meldingen binnengekomen.</div>
              </div>
            )}
            {COUNTRIES.map(c=>{
              const locsWithFb=LOCATIONS.filter(l=>l.country===c.code&&(fb[l.id]||[]).length>0);
              if(locsWithFb.length===0)return null;
              return(
                <div key={c.code} style={{marginBottom:18}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}>
                    <span style={{fontSize:16}}>{c.flag}</span>
                    <span style={{fontSize:11,fontWeight:800,color:"#7BA8CC",textTransform:"uppercase",letterSpacing:1}}>{c.label}</span>
                  </div>
                  {locsWithFb.map(l=>{
                    const items=[...(fb[l.id]||[])].sort((a,b)=>(a.status==="done")-(b.status==="done")||b.ts-a.ts);
                    const openN=items.filter(m=>m.status!=="done").length;
                    return(
                      <div key={l.id} style={{marginBottom:12}}>
                        <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6,paddingLeft:2}}>
                          <span style={{fontSize:14}}>📍</span>
                          <span style={{fontSize:13,fontWeight:900,color:"#E0ECF8"}}>{l.name}</span>
                          <span style={{fontSize:10,fontWeight:800,color:openN>0?"#F5A623":"#5AD18A"}}>{openN>0?`${openN} open`:"afgehandeld"}</span>
                        </div>
                        {items.map(m=>{
                          const dn=m.status==="done";
                          return(
                            <div key={m.id} style={{background:"#0F2A47",border:`2px solid ${dn?"#1A3A5A":m.type==="probleem"?"#5A3520":"#3A4A20"}`,borderRadius:12,padding:"10px 12px",marginBottom:7,opacity:dn?0.55:1}}>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8,marginBottom:5}}>
                                <div style={{display:"flex",alignItems:"center",gap:7,minWidth:0}}>
                                  <span style={{fontSize:14}}>{m.type==="probleem"?"⚠️":"💡"}</span>
                                  <span style={{fontSize:11,fontWeight:800,color:m.type==="probleem"?"#F0A878":"#A8C870"}}>{m.type==="probleem"?"Probleem":"Aanpassing / idee"}</span>
                                  {m.name&&<span style={{fontSize:11,fontWeight:700,color:"#7BA8CC",overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>· {m.name}</span>}
                                </div>
                                <span style={{fontSize:10,color:"#4A7AA8",fontWeight:700,flexShrink:0}}>{new Date(m.ts).toLocaleDateString("nl-NL",{day:"2-digit",month:"short"})} {new Date(m.ts).toLocaleTimeString("nl-NL",{hour:"2-digit",minute:"2-digit"})}</span>
                              </div>
                              <div style={{fontSize:13,fontWeight:600,color:"#D0E2F4",lineHeight:1.45,whiteSpace:"pre-wrap",wordBreak:"break-word",marginBottom:8,textDecoration:dn?"line-through":"none"}}>{m.msg}</div>
                              <div style={{display:"flex",gap:8}}>
                                <button onClick={()=>toggleFb(l.id,m.id)} style={{flex:1,background:dn?"#16324E":"#1E5A3A",border:`1.5px solid ${dn?"#2E6FA8":"#2E8A52"}`,color:dn?"#A8D0F0":"#A8F0C8",borderRadius:9,padding:"7px 10px",fontFamily:"Nunito,sans-serif",fontSize:11,fontWeight:800,cursor:"pointer"}}>{dn?"↩ Heropenen":"✓ Opgepakt"}</button>
                                <button onClick={()=>deleteFb(l.id,m.id)} style={{background:"#16324E",border:"1.5px solid #5A2A2A",color:"#E08A8A",borderRadius:9,padding:"7px 12px",fontFamily:"Nunito,sans-serif",fontSize:11,fontWeight:800,cursor:"pointer"}}>🗑</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              );
            })}
          </div>)}
          </div>
        )}
      </div>
      <Ftr isAdmin/>
    </div>
  );
}

function Ftr({isAdmin}){
  return(
    <div style={{width:"100%",padding:"13px 20px 16px",marginTop:28,borderTop:`2px solid ${isAdmin?"#3D2A7A":"#C8E6B0"}`,background:isAdmin?"#16213E":"linear-gradient(180deg,#F5FBF0,#fff)",textAlign:"center"}}>
      <div style={{fontSize:11,fontWeight:600,color:isAdmin?"#5A4A7A":"#8AAA7A",lineHeight:1.6}}>2026 HelloFresh — Alle rechten voorbehouden.</div>
    </div>
  );
}
