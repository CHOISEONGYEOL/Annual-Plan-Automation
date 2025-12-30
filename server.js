const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const port = process.env.PORT || 8000;

// dist 폴더 존재 확인
const distPath = path.join(__dirname, 'dist');
if (!fs.existsSync(distPath)) {
  console.error('ERROR: dist folder does not exist! Please run npm run build first.');
}

// Health check 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'ok',
    distExists: fs.existsSync(distPath),
    files: fs.existsSync(distPath) ? fs.readdirSync(distPath) : []
  });
});

// 정적 파일 서빙 (빌드된 dist 폴더)
app.use(express.static(distPath));

// 모든 경로를 index.html로 리다이렉트 (SPA 라우팅 지원)
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(500).send('index.html not found. Please build the project first.');
  }
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on 0.0.0.0:${port}`);
});

