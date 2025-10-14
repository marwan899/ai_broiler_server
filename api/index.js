const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path'); // <<< 1. استيراد مكتبة Path

const app = express();
const DATA_FILE = path.join(__dirname, '..', 'flock_data.json'); // مسار مطلق لملف البيانات (خطوة حاسمة)

// --- وظائف قراءة وكتابة البيانات ---

function loadFlockData() {
    try {
        if (fs.existsSync(DATA_FILE)) {
            const data = fs.readFileSync(DATA_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading flock data:', error);
    }
    return [];
}

function saveFlockData(data) {
    try {
        fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error('Error writing flock data:', error);
        throw new Error("فشل في حفظ البيانات على الخادم. يرجى مراجعة إعدادات الأذونات.");
    }
}

// --- التهيئة الأساسية لـ Express.js ---

app.use(cors({
    origin: '*', // السماح لجميع الروابط بالوصول (للتجربة السريعة)
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
}));

app.use(express.json());

// 2. تفعيل خدمة الملفات الثابتة (Static Files)
// هذا يخبر الخادم بتقديم ملفات HTML و CSS و JS من المجلد الجذر
app.use(express.static(path.join(__dirname, '..')));

// --- مسارات API (Routes) ---

// مسار لجلب بيانات قطيع معين (مطلوب لواجهة المستخدم)
app.get('/api/flock/data/:flockId', (req, res) => {
    const { flockId } = req.params;
    const allData = loadFlockData();
    const flock = allData.find(f => f.flockId === flockId);
    if (flock) {
        res.json(flock);
    } else {
        res.status(404).json({ message: 'Flock not found' });
    }
});

// مسار لجلب كل بيانات القطعان (مطلوب للوحة الإدارة)
app.get('/api/flock/all-data', (req, res) => {
    const allData = loadFlockData();
    res.json(allData);
});

// مسار لحفظ/تحديث سجل يومي
app.post('/api/records/save', (req, res) => {
    const newRecord = req.body; 
    const { flockId, day } = newRecord;

    if (!flockId || typeof day !== 'number') {
        return res.status(400).json({ message: 'Invalid data format' });
    }

    const allData = loadFlockData();
    let flockIndex = allData.findIndex(f => f.flockId === flockId);
    
    if (flockIndex === -1) {
        // إنشاء قطيع جديد إذا لم يكن موجوداً
        const newFlock = {
            flockId: flockId,
            breederName: newRecord.breederName || 'Unknown',
            initialChickCount: newRecord.initialChickCount || 0,
            startDate: new Date().toISOString().split('T')[0],
            dailyRecords: []
        };
        allData.push(newFlock);
        flockIndex = allData.length - 1;
    }
    
    let flock = allData[flockIndex];
    
    // تحديث بيانات القطيع الأولية (إذا لم تكن موجودة)
    if (newRecord.initialChickCount && !flock.initialChickCount) {
        flock.initialChickCount = newRecord.initialChickCount;
    }

    // تحديث أو إضافة السجل اليومي
    const recordIndex = flock.dailyRecords.findIndex(r => r.day === day);
    
    const recordToSave = {
        day: day,
        mortality: newRecord.mortality,
        feedKg: newRecord.feedKg,
        avgWeight: newRecord.avgWeight,
        waterIntake: newRecord.waterIntake,
        notes: newRecord.notes,
        createdAt: recordIndex === -1 ? new Date().toISOString() : flock.dailyRecords[recordIndex].createdAt,
        updatedAt: new Date().toISOString()
    };

    if (recordIndex !== -1) {
        flock.dailyRecords[recordIndex] = recordToSave;
    } else {
        flock.dailyRecords.push(recordToSave);
    }
    
    // تحديث العمر الحالي للقطيع
    flock.currentAge = Math.max(flock.currentAge || 0, day);

    // فرز السجلات للتأكد من أنها بالترتيب
    flock.dailyRecords.sort((a, b) => a.day - b.day);
    
    saveFlockData(allData);
    res.status(200).json({ message: 'Record saved successfully', data: recordToSave });
});

// مسار تحديث سجل (من لوحة الإدارة)
app.put('/api/records/update', (req, res) => {
    const updatedRecord = req.body;
    const { flockId, day } = updatedRecord;

    if (!flockId || typeof day !== 'number') {
        return res.status(400).json({ message: 'Invalid data format' });
    }

    const allData = loadFlockData();
    const flock = allData.find(f => f.flockId === flockId);
    
    if (!flock) {
        return res.status(404).json({ message: 'Flock not found' });
    }

    const recordIndex = flock.dailyRecords.findIndex(r => r.day === day);

    if (recordIndex === -1) {
        return res.status(404).json({ message: 'Record for this day not found' });
    }
    
    // تطبيق التحديثات
    flock.dailyRecords[recordIndex] = {
        ...flock.dailyRecords[recordIndex],
        mortality: updatedRecord.mortality,
        feedKg: updatedRecord.feedKg,
        avgWeight: updatedRecord.avgWeight,
        waterIntake: updatedRecord.waterIntake,
        notes: updatedRecord.notes,
        updatedAt: new Date().toISOString()
    };
    
    saveFlockData(allData);
    res.status(200).json({ message: 'Record updated successfully' });
});

// مسار حذف سجل (من لوحة الإدارة)
app.delete('/api/records/delete', (req, res) => {
    const { flockId, day } = req.body;

    if (!flockId || typeof day !== 'number') {
        return res.status(400).json({ message: 'Invalid data format' });
    }

    const allData = loadFlockData();
    const flock = allData.find(f => f.flockId === flockId);
    
    if (!flock) {
        return res.status(404).json({ message: 'Flock not found' });
    }

    const initialLength = flock.dailyRecords.length;
    flock.dailyRecords = flock.dailyRecords.filter(r => r.day !== day);
    
    if (flock.dailyRecords.length === initialLength) {
        return res.status(404).json({ message: 'Record for this day not found' });
    }

    // تحديث العمر الحالي بعد الحذف (إذا كان السجل المحذوف هو الأحدث)
    if (flock.currentAge === day) {
        flock.currentAge = flock.dailyRecords.length > 0 
            ? Math.max(...flock.dailyRecords.map(r => r.day)) 
            : 0;
    }
    
    saveFlockData(allData);
    res.status(200).json({ message: `Record for day ${day} deleted successfully.` });
});


// 4. مسار catch-all: لضمان توجيه الطلبات غير API (مثل الوصول المباشر إلى /admin-dashboard.html)
app.get('/:file', (req, res, next) => {
    const fileName = req.params.file;
    if (fileName && fileName.endsWith('.html')) {
        const filePath = path.join(__dirname, '..', fileName);
        if (fs.existsSync(filePath)) {
            return res.sendFile(filePath);
        }
    }
    next(); // استمر في المسارات الأخرى
});

// مسار الصفحة الرئيسية (توجيه الجذر إلى index.html)
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'index.html'));
});


// --- 3. تشغيل الخادم على منفذ App Engine ---

// App Engine يستخدم متغير البيئة PORT لتحديد المنفذ
const PORT = process.env.PORT || 8080; 

app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ الخادم يعمل على منفذ Google Cloud: ${PORT}`);
});