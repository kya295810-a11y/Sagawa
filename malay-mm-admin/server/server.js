const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));

const dataDir = path.join(__dirname, 'data');
const newsFile = path.join(dataDir, 'news.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

if (!fs.existsSync(newsFile)) {
  fs.writeFileSync(newsFile, '[]', 'utf8');
}

function readNews() {
  try {
    const data = fs.readFileSync(
      newsFile,
      'utf8'
    );

    return JSON.parse(data);
  } catch {
    return [];
  }
}

function writeNews(news) {
  fs.writeFileSync(
    newsFile,
    JSON.stringify(news, null, 2),
    'utf8'
  );
}

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'Malay MM Local API is running',
  });
});

/* =========================================================
   GET NEWS
========================================================= */

app.get('/api/news', (req, res) => {
  const news = readNews();

  res.json({
    success: true,
    data: news,
  });
});

/* =========================================================
   CREATE NEWS
========================================================= */

app.post('/api/news', (req, res) => {
  const news = readNews();

  const {
    title,
    description,
    image = '',
    video = '',
    published = true,
  } = req.body;

  if (!title || !description) {
    return res.status(400).json({
      success: false,
      message:
        'Title and description are required.',
    });
  }

  const newNews = {
    id: Date.now(),
    title: title.trim(),
    description: description.trim(),
    image,
    video,
    published: Boolean(published),
    date: new Date().toLocaleDateString(
      'en-GB',
      {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      }
    ),
  };

  news.unshift(newNews);

  writeNews(news);

  res.status(201).json({
    success: true,
    data: newNews,
  });
});

/* =========================================================
   UPDATE NEWS
========================================================= */

app.put('/api/news/:id', (req, res) => {
  const news = readNews();

  const id = Number(req.params.id);

  const index = news.findIndex(
    (item) => item.id === id
  );

  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: 'News not found.',
    });
  }

  news[index] = {
    ...news[index],
    ...req.body,
    id: news[index].id,
  };

  writeNews(news);

  res.json({
    success: true,
    data: news[index],
  });
});

/* =========================================================
   DELETE NEWS
========================================================= */

app.delete('/api/news/:id', (req, res) => {
  const news = readNews();

  const id = Number(req.params.id);

  const filteredNews = news.filter(
    (item) => item.id !== id
  );

  if (filteredNews.length === news.length) {
    return res.status(404).json({
      success: false,
      message: 'News not found.',
    });
  }

  writeNews(filteredNews);

  res.json({
    success: true,
    message: 'News deleted successfully.',
  });
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log('');
  console.log(
    `Malay MM API running at http://localhost:${PORT}`
  );
  console.log(
    `News API: http://localhost:${PORT}/api/news`
  );
  console.log('');
});