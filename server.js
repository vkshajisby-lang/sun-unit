const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure directories exist
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Initial persistent database structure
const DEFAULT_DB = {
  adminPass: 'admin123',
  classes: {
    classA: {
      id: 'classA',
      name: 'ക്ലാസ്സ് 1 (Class 1)',
      hasPdf: false,
      pdfPath: null,
      hasKeyPdf: false,
      answerKey: Array(50).fill('A')
    },
    classB: {
      id: 'classB',
      name: 'ക്ലാസ്സ് 2 (Class 2)',
      hasPdf: false,
      pdfPath: null,
      hasKeyPdf: false,
      answerKey: Array(50).fill('B')
    }
  },
  students: [],
  results: []
};

function readDB() {
  try {
    if (fs.existsSync(DB_FILE)) {
      return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
    }
  } catch (e) {
    console.error('Error reading db:', e);
  }
  return DEFAULT_DB;
}

function writeDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
  } catch (e) {
    console.error('Error writing db:', e);
  }
}

// Initialize db if not present
if (!fs.existsSync(DB_FILE)) {
  writeDB(DEFAULT_DB);
}

const MIME_TYPES = {
  '.html': 'text/html; charset=UTF-8',
  '.css': 'text/css; charset=UTF-8',
  '.js': 'application/javascript; charset=UTF-8',
  '.json': 'application/json; charset=UTF-8',
  '.pdf': 'application/pdf',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon'
};

const server = http.createServer((req, res) => {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  // API ROUTE: Get application data / config
  if (pathname === '/api/data' && req.method === 'GET') {
    const db = readDB();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(db));
    return;
  }

  // API ROUTE: Update class configuration (name & answer keys)
  if (pathname === '/api/class-config' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        const { classId, name, answerKey, hasKeyPdf } = payload;
        const db = readDB();
        if (db.classes[classId]) {
          if (name) db.classes[classId].name = name;
          if (answerKey) db.classes[classId].answerKey = answerKey;
          if (typeof hasKeyPdf === 'boolean') db.classes[classId].hasKeyPdf = hasKeyPdf;
          writeDB(db);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ success: true, classConfig: db.classes[classId] }));
        } else {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Invalid classId' }));
        }
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API ROUTE: Upload Question Paper PDF permanently
  if (pathname === '/api/upload-pdf' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { classId, pdfBase64, filename } = JSON.parse(body);
        if (!classId || !pdfBase64) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Missing parameters' }));
          return;
        }

        const base64Data = pdfBase64.replace(/^data:application\/pdf;base64,/, '');
        const targetFile = `paper_${classId}.pdf`;
        const filePath = path.join(UPLOADS_DIR, targetFile);
        
        fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

        const db = readDB();
        db.classes[classId].hasPdf = true;
        db.classes[classId].pdfPath = `/uploads/${targetFile}`;
        writeDB(db);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, pdfUrl: `/uploads/${targetFile}` }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API ROUTE: Save or update student roster
  if (pathname === '/api/students' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const { students } = JSON.parse(body);
        const db = readDB();
        db.students = students || [];
        writeDB(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, count: db.students.length }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API ROUTE: Record student submission (result)
  if (pathname === '/api/submit-result' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const submission = JSON.parse(body);
        const db = readDB();
        if (!db.results) db.results = [];
        db.results.unshift(submission);
        writeDB(db);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, id: submission.id }));
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message }));
      }
    });
    return;
  }

  // API ROUTE: Clear results
  if (pathname === '/api/clear-results' && req.method === 'POST') {
    const db = readDB();
    db.results = [];
    writeDB(db);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ success: true }));
    return;
  }

  // SERVE STATIC UPLOADS (PDF files)
  if (pathname.startsWith('/uploads/')) {
    const fileName = path.basename(pathname);
    const filePath = path.join(UPLOADS_DIR, fileName);
    if (fs.existsSync(filePath)) {
      res.writeHead(200, { 'Content-Type': 'application/pdf' });
      fs.createReadStream(filePath).pipe(res);
      return;
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('File not found');
      return;
    }
  }

  // SERVE STATIC FRONTEND FILES
  let filePath = path.join(__dirname, pathname === '/' ? 'index.html' : pathname);
  const ext = path.extname(filePath).toLowerCase();

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      filePath = path.join(__dirname, 'index.html');
    }
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || 'text/html';
    fs.readFile(filePath, (readErr, content) => {
      if (readErr) {
        res.writeHead(500);
        res.end('Server Error');
      } else {
        res.writeHead(200, { 'Content-Type': contentType });
        res.end(content);
      }
    });
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`=======================================================`);
  console.log(`⛪ St. George Sunday School, Karyambadi Exam Server running`);
  console.log(`Local Access:   http://localhost:${PORT}`);
  console.log(`Network Access: http://192.168.1.72:${PORT}`);
  console.log(`Database File:  ${DB_FILE}`);
  console.log(`Uploads Folder: ${UPLOADS_DIR}`);
  console.log(`=======================================================`);
});
