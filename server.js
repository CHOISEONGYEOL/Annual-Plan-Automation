const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 8000;

// Health check 엔드포인트 (정적 파일보다 먼저)
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// 정적 파일 서빙 (빌드된 dist 폴더)
// assets 폴더와 기타 정적 파일들을 먼저 서빙
app.use(express.static(path.join(__dirname, 'dist'), {
  index: false, // index.html 자동 서빙 비활성화 (수동으로 처리)
}));

// 모든 경로를 index.html로 리다이렉트 (SPA 라우팅 지원)
// 정적 파일이 아닌 경우에만 index.html 반환
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Listening on 0.0.0.0:${port}`);
});

