const express = require('express');
const multer = require('multer');
const bodyParser = require('body-parser');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// 업로드 폴더 생성
const uploadDir = 'uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

// Multer 설정
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + '-' + file.originalname);
  }
});

const upload = multer({ storage: storage });

// 데이터 저장소 (실제로는 DB 사용 권장)
const DATA_FILE = 'documents.json';
const SUBMISSIONS_FILE = 'submissions.json';

function loadDocuments() {
  if (fs.existsSync(DATA_FILE)) {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  }
  return [];
}

function saveDocuments(docs) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(docs, null, 2));
}

function loadSubmissions() {
  if (fs.existsSync(SUBMISSIONS_FILE)) {
    return JSON.parse(fs.readFileSync(SUBMISSIONS_FILE, 'utf-8'));
  }
  return [];
}

function saveSubmissions(subs) {
  fs.writeFileSync(SUBMISSIONS_FILE, JSON.stringify(subs, null, 2));
}

// 메인 페이지
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// 게시판 페이지
app.get('/documents', (req, res) => {
  res.sendFile(path.join(__dirname, 'documents.html'));
});

// 서류제출 페이지
app.get('/submissions', (req, res) => {
  res.sendFile(path.join(__dirname, 'submissions.html'));
});

// 관리자 페이지
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'admin.html'));
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('.'));

// 게시판 목록 조회 (파일명과 작성일만 반환)
app.get('/api/documents', (req, res) => {
  const docs = loadDocuments();
  const result = docs.map(doc => ({
    id: doc.id,
    title: doc.title,
    uploadDate: doc.uploadDate,
    fileName: doc.fileName
  }));
  res.json(result);
});

// 비밀번호 검증 (다운로드)
app.post('/api/verify-password', (req, res) => {
  const { id, password } = req.body;
  const docs = loadDocuments();
  const doc = docs.find(d => d.id === id);

  if (!doc) {
    return res.json({ success: false, message: '파일을 찾을 수 없습니다.' });
  }

  if (doc.password === password) {
    res.json({ success: true, fileName: doc.fileName, fileId: id });
  } else {
    res.json({ success: false, message: '비밀번호가 틀렸습니다.' });
  }
});

// 파일 다운로드
app.get('/api/download/:id', (req, res) => {
  const { id } = req.params;
  const docs = loadDocuments();
  const doc = docs.find(d => d.id === id);

  if (!doc) {
    return res.status(404).send('파일을 찾을 수 없습니다.');
  }

  const filePath = path.join(uploadDir, doc.fileName);
  
  if (!fs.existsSync(filePath)) {
    return res.status(404).send('파일이 삭제되었습니다.');
  }

  res.download(filePath);
});

// 관리자 - 파일 업로드
app.post('/api/admin/upload', upload.single('file'), (req, res) => {
  const { title, password } = req.body;
  const adminPassword = '1234'; // 관리자 비밀번호 (환경변수로 변경 권장)

  if (!req.body.adminPassword || req.body.adminPassword !== adminPassword) {
    // 파일 삭제
    if (req.file) {
      fs.unlinkSync(path.join(uploadDir, req.file.filename));
    }
    return res.json({ success: false, message: '관리자 인증 실패' });
  }

  if (!title || !password || !req.file) {
    if (req.file) {
      fs.unlinkSync(path.join(uploadDir, req.file.filename));
    }
    return res.json({ success: false, message: '필수 정보가 누락되었습니다.' });
  }

  // 비밀번호 4자리 검증
  if (!/^\d{4}$/.test(password)) {
    fs.unlinkSync(path.join(uploadDir, req.file.filename));
    return res.json({ success: false, message: '비밀번호는 4자리 숫자여야 합니다.' });
  }

  const docs = loadDocuments();
  const newDoc = {
    id: Date.now().toString(),
    title: title,
    fileName: req.file.filename,
    password: password,
    uploadDate: new Date().toLocaleDateString('ko-KR')
  };

  docs.push(newDoc);
  saveDocuments(docs);

  res.json({ success: true, message: '파일이 업로드되었습니다.' });
});

// 관리자 - 게시글 목록
app.post('/api/admin/documents', (req, res) => {
  const adminPassword = '1234';

  if (!req.body.adminPassword || req.body.adminPassword !== adminPassword) {
    return res.json({ success: false, message: '관리자 인증 실패' });
  }

  const docs = loadDocuments();
  res.json({ success: true, documents: docs });
});

// 관리자 - 게시글 삭제
app.post('/api/admin/delete', (req, res) => {
  const { id, adminPassword } = req.body;
  const ADMIN_PASSWORD = '1234';

  if (adminPassword !== ADMIN_PASSWORD) {
    return res.json({ success: false, message: '관리자 인증 실패' });
  }

  let docs = loadDocuments();
  const doc = docs.find(d => d.id === id);

  if (!doc) {
    return res.json({ success: false, message: '파일을 찾을 수 없습니다.' });
  }

  // 파일 삭제
  const filePath = path.join(uploadDir, doc.fileName);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }

  // 데이터에서 제거
  docs = docs.filter(d => d.id !== id);
  saveDocuments(docs);

  res.json({ success: true, message: '파일이 삭제되었습니다.' });
});

// 서류제출 API
// 서류제출 조회
app.get('/api/submissions', (req, res) => {
  const subs = loadSubmissions();
  const result = subs.map(sub => ({
    id: sub.id,
    submitterName: sub.submitterName,
    submitterPhone: sub.submitterPhone,
    submitterEmail: sub.submitterEmail,
    submitterCompany: sub.submitterCompany,
    submissionTitle: sub.submissionTitle,
    submissionMessage: sub.submissionMessage,
    submissionDate: sub.submissionDate,
    fileName: sub.fileName
  }));
  res.json(result);
});

// 서류제출 생성
app.post('/api/submissions/create', upload.single('file'), (req, res) => {
  const { submitterName, submitterPhone, submitterEmail, submitterCompany, submissionTitle, submissionMessage } = req.body;

  if (!submitterName || !submitterPhone || !submitterEmail || !submissionTitle) {
    if (req.file) {
      fs.unlinkSync(path.join(uploadDir, req.file.filename));
    }
    return res.json({ success: false, message: '필수 정보가 누락되었습니다.' });
  }

  const subs = loadSubmissions();
  const newSubmission = {
    id: Date.now().toString(),
    submitterName: submitterName,
    submitterPhone: submitterPhone,
    submitterEmail: submitterEmail,
    submitterCompany: submitterCompany || '',
    submissionTitle: submissionTitle,
    submissionMessage: submissionMessage || '',
    submissionDate: new Date().toLocaleDateString('ko-KR'),
    fileName: req.file ? req.file.filename : null
  };

  subs.push(newSubmission);
  saveSubmissions(subs);

  res.json({ success: true, message: '서류가 제출되었습니다.' });
});

// 관리자 - 서류제출 목록
app.post('/api/admin/submissions', (req, res) => {
  const adminPassword = '1234';

  if (!req.body.adminPassword || req.body.adminPassword !== adminPassword) {
    return res.json({ success: false, message: '관리자 인증 실패' });
  }

  const subs = loadSubmissions();
  res.json({ success: true, submissions: subs });
});

// 관리자 - 서류제출 삭제
app.post('/api/admin/submissions/delete', (req, res) => {
  const { id, adminPassword } = req.body;
  const ADMIN_PASSWORD = '1234';

  if (adminPassword !== ADMIN_PASSWORD) {
    return res.json({ success: false, message: '관리자 인증 실패' });
  }

  let subs = loadSubmissions();
  const sub = subs.find(s => s.id === id);

  if (!sub) {
    return res.json({ success: false, message: '항목을 찾을 수 없습니다.' });
  }

  // 파일 삭제
  if (sub.fileName) {
    const filePath = path.join(uploadDir, sub.fileName);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  }

  // 데이터에서 제거
  subs = subs.filter(s => s.id !== id);
  saveSubmissions(subs);

  res.json({ success: true, message: '항목이 삭제되었습니다.' });
});

// 서버 시작
app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT} 에서 실행 중입니다.`);
});
