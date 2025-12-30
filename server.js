const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8000;

// 정적 파일 서빙 (빌드된 dist 폴더)
app.use(express.static(path.join(__dirname, 'dist')));

// Health check 엔드포인트
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 모든 경로를 index.html로 리다이렉트 (SPA 라우팅 지원)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on 0.0.0.0:${port}`);
});

