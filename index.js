const { getRecommendRestaurant, recommendEat } = require('./services');

const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
// const { init: initDB, Counter } = require("./db");

const logger = morgan('tiny');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cors());
app.use(logger);

// 首页

app.get('/api/wx_openid', async (req, res) => {
  if (req.headers['x-wx-source']) {
    res.send(req.headers['x-wx-openid']);
  }
});

app.post('/api/recommend/questions', async (req, res) => {
  const { history = [], period, location } = req.body;
  const result = await getRecommendRestaurant(history, period, location);
  res.send({
    code: 0,
    data: result,
  });
});

app.post('/api/recommend/restaurants', async (req, res) => {
  const { eatList = [], history = [], period, location } = req.body;
  const result = await recommendEat(eatList, history, period, location);
  res.send({
    code: 0,
    data: result,
  });
});

// 小程序调用，获取微信 Open ID

const port = process.env.PORT || 80;

async function bootstrap() {
  // await initDB();
  app.listen(port, () => {
    console.log('启动成功', port);
  });
}

bootstrap();
