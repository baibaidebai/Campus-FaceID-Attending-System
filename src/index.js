const express = require('express');
const bodyParser = require('body-parser');
// 可选：引入安全中间件
// const helmet = require('helmet');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/student');
const teacherRoutes = require('./routes/teacher');
const attendanceRoutes = require('./routes/attendance');
const authMiddleware = require('./middleware/auth');

const app = express();

// 1. 基础中间件（必须在路由之前注册）
app.use(bodyParser.json()); // 解析JSON请求体
// app.use(helmet()); // 设置安全HTTP头（建议生产环境使用）
app.use(express.urlencoded({ extended: true })); // 解析URL编码的请求体[1](@ref)

// 2. API路由
app.use('/api/auth', authRoutes);
// 对需要认证的路由应用认证中间件
app.use('/api/student', authMiddleware, studentRoutes);
app.use('/api/teacher', authMiddleware, teacherRoutes);
// app.use('/api/attendance', authMiddleware, attendanceRoutes);

// 3. 404处理中间件（放在所有路由之后，错误处理之前）
app.use('*splat', (req, res) => {
  res.status(404).json({ error: `Route ${req.originalUrl} not found` });
});

// 4. 全局错误处理中间件（必须放在所有中间件和路由的最后）
app.use((err, req, res, next) => {
  console.error('Unexpected error:', err.stack);
  res.status(err.status || 500).json({
    error: process.env.NODE_ENV === 'production' 
      ? 'Internal Server Error' 
      : err.message
  });
});

app.listen(8080, () => {
  console.log('Server started at http://localhost:8080');
});