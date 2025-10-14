// استيراد المكتبات الضرورية
const express = require('express');
const fs = require('fs');
const cors = require('cors');

const app = express();

// --- الإعدادات الأساسية للخادم ---
app.use(cors()); 
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

// اسم الملف الذي سنخزن فيه بيانات القطيع
const DATA_FILE = 'flock_data.json'; 

// قراءة البيانات المحفوظة من الملف (يجب أن يكون الملف في نفس مسار النشر)
function loadFlockData() {
    try {
        const filePath = DATA_FILE;
        if (!fs.existsSync(filePath) || fs.statSync(filePath).size === 0) {
            return [];
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error("خطأ في قراءة ملف البيانات:", error.message);
        return [];
    }
}

// حفظ البيانات في الملف
function saveFlockData(data) {
    const filePath = DATA_FILE;
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
}


// --- 1. نقطة API لحفظ/تحديث سجل (POST/Save) ---
app.post('/api/records/save', (req, res) => {
    
    console.log("-> طلب حفظ جديد. البيانات المستلمة:", req.body); 

    const newRecord = req.body;
    const now = new Date().toISOString(); 

    // التحقق الصارم من الحقول المطلوبة
    if (!newRecord.flockId || newRecord.day === undefined || !newRecord.breederName) {
        return res.status(400).send({ 
            message: "خطأ 400: البيانات المرسلة غير كاملة. يجب توفر (flockId, day, واسم المربي)." 
        });
    }

    let flockData = loadFlockData();
    let flock = flockData.find(f => f.flockId === newRecord.flockId);

    if (!flock) {
        // التحقق من العدد الأولي عند إنشاء القطيع لأول مرة
        if (!newRecord.initialChickCount || newRecord.initialChickCount <= 0) {
             return res.status(400).send({ message: "خطأ 400: يجب توفير العدد الأولي للقطيع (initialChickCount) عند أول عملية حفظ." });
        }
        
        // إنشاء سجل قطيع جديد
        flock = {
            flockId: newRecord.flockId,
            breederName: newRecord.breederName, 
            initialChickCount: newRecord.initialChickCount,
            dailyRecords: []
        };
        flockData.push(flock);
    } else {
        // تحديث اسم المربي في سجل القطيع الرئيسي
        flock.breederName = newRecord.breederName;
        // تحديث العدد الأولي فقط إذا تم إرساله من الواجهة ولم يكن مسجلاً
         if (newRecord.initialChickCount && !flock.initialChickCount) {
             flock.initialChickCount = newRecord.initialChickCount;
         }
    }

    const existingIndex = flock.dailyRecords.findIndex(r => r.day === newRecord.day);

    if (existingIndex > -1) {
        // تحديث السجل الموجود: لا نغير createdAt، ونحدث updatedAt
        flock.dailyRecords[existingIndex] = { 
            ...flock.dailyRecords[existingIndex], 
            ...newRecord,
            updatedAt: now 
        };
    } else {
        // إضافة سجل جديد
        flock.dailyRecords.push({
             ...newRecord,
             createdAt: now 
        });
    }

    // يجب إزالة 'initialChickCount' من السجل اليومي المكرر
    delete newRecord.initialChickCount;

    saveFlockData(flockData);
    res.status(200).send({ message: `تم حفظ بيانات اليوم ${newRecord.day} للمربي ${newRecord.breederName} بنجاح.`, record: newRecord });
});


// --- 2. نقطة API لجلب جميع البيانات (GET) ---
app.get('/api/flock/all-data', (req, res) => {
    // هذه النقطة تجلب كل البيانات لغرض لوحة الإدارة
    const allData = loadFlockData();
    res.status(200).send(allData);
});


// --- 3. نقطة API لحذف سجل يومي (DELETE) ---
app.delete('/api/records/delete', (req, res) => {
    const { flockId, day } = req.body;
    // ... (منطق الحذف يبقى كما هو) ...

    if (!flockId || day === undefined) {
        return res.status(400).send({ message: "خطأ 400: يجب توفير (flockId و day) للحذف." });
    }

    let flockData = loadFlockData();
    const flockIndex = flockData.findIndex(f => f.flockId === flockId);

    if (flockIndex === -1) {
        return res.status(404).send({ message: `خطأ 404: لم يتم العثور على القطيع ${flockId}.` });
    }

    const initialLength = flockData[flockIndex].dailyRecords.length;
    
    flockData[flockIndex].dailyRecords = flockData[flockIndex].dailyRecords.filter(r => r.day !== day);

    if (flockData[flockIndex].dailyRecords.length === initialLength) {
        return res.status(404).send({ message: `خطأ 404: لم يتم العثور على سجل لليوم ${day}.` });
    }

    saveFlockData(flockData);
    res.status(200).send({ message: `✅ تم حذف سجل اليوم ${day} من القطيع ${flockId} بنجاح.` });
});


// --- 4. نقطة API لتعديل سجل يومي (PUT) ---
app.put('/api/records/update', (req, res) => {
    const updatedRecord = req.body;
    const now = new Date().toISOString(); // تاريخ ووقت التعديل

    if (!updatedRecord.flockId || updatedRecord.day === undefined) {
        return res.status(400).send({ message: "خطأ 400: يجب توفير (flockId و day) للتعديل." });
    }

    let flockData = loadFlockData();
    const flock = flockData.find(f => f.flockId === updatedRecord.flockId);

    if (!flock) {
        return res.status(404).send({ message: `خطأ 404: لم يتم العثور على القطيع ${updatedRecord.flockId}.` });
    }

    const existingIndex = flock.dailyRecords.findIndex(r => r.day === updatedRecord.day);

    if (existingIndex === -1) {
        return res.status(404).send({ message: `خطأ 404: لم يتم العثور على سجل لليوم ${updatedRecord.day} للتعديل.` });
    }

    // تحديث اسم المربي في سجل القطيع الرئيسي
    flock.breederName = updatedRecord.breederName || flock.breederName;
    
    // تحديث السجل بدمج البيانات الجديدة
    flock.dailyRecords[existingIndex] = {
        ...flock.dailyRecords[existingIndex], 
        ...updatedRecord,
        updatedAt: now 
    };

    saveFlockData(flockData);
    res.status(200).send({ message: `✅ تم تحديث سجل اليوم ${updatedRecord.day} بنجاح.`, record: flock.dailyRecords[existingIndex] });
});
module.exports = app;
