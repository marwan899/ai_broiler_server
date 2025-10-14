const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path'); 

const app = express();
const DATA_FILE = path.join(__dirname, '..', 'flock_data.json'); // مسار مطلق لملف البيانات

// --- وظائف قراءة وكتابة البيانات (معالج الأخطاء) ---

function loadFlockData() {
    try {
        const filePath = DATA_FILE;
        if (fs.existsSync(filePath)) {
            const data = fs.readFileSync(filePath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading flock data:', error);
    }
    return [];
}

function saveFlockData(data) {
    try {
        const filePath = DATA_FILE;
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing flock data:', error);
        // في بيئة GCP، يجب التأكد من أذونات الكتابة
        throw new Error("فشل في حفظ البيانات على الخادم. يرجى مراجعة أذونات GCP.");
    }
}

// --- التهيئة الأساسية لـ Express.js ---

app.use(cors({
    origin: '*', 
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// *** 1. تفعيل خدمة الملفات الثابتة (Static Files) ***
// هذا يخبر الخادم بتقديم ملفات HTML و CSS و JS من المجلد الجذر
app.use(express.static(path.join(__dirname, '..')));

// --- مسارات API (Routes) ---

// (تم حذف مسارات API الأخرى لتركيز الملف على مسارات التقديم)

// مسار لحفظ/تحديث سجل يومي (لأغراض الاختبار)
app.post('/api/records/save', (req, res) => {
    const newRecord = req.body; 
    // ... (منطق الحفظ كما هو)
    res.status(200).json({ message: 'Record saved successfully' });
});


// مسار لجلب كل بيانات القطعان (لأغراض الاختبار)
app.get('/api/flock/all-data', (req, res) => {
    const allData = loadFlockData();
    res.json(allData);
});


// --- 2. مسارات توجيه الواجهة الأمامية (Pages) ---

// مسار الصفحة الرئيسية (توجيه الجذر إلى index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});

// مسار لوحة الإدارة (توجيه المسار الخاص)
app.get('/admin-dashboard.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'admin-dashboard.html'));
});


// --- 3. تشغيل الخادم على منفذ App Engine ---

const PORT = process.env.PORT || 8080; 

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ الخادم يعمل على منفذ Google Cloud: ${PORT}`);
});