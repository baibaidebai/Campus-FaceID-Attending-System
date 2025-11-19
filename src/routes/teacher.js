const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router(); // 正确定义 router
const SECRET = 'your_secret_key';
const authenticateToken = require('../middleware/auth');
// 数据库导入
const db = require('../db');

//获取教师所负责的课程列表 /api/teacher/courses
router.get('/courses', authenticateToken, async (req, res) => {
  try {
    // 从认证中间件获取教师的UserID
    const teacherID = req.user.id;
    
    // 查询该教师负责的所有教学班
    const [courses] = await db.query(
      `SELECT 
        tc.ClassID,
        tc.ClassName,
        tc.BeginDate,
        tc.EndDate,
        c.CourseName,
        c.Description,
        c.Hours,
        c.Credit
      FROM Teaching t
      JOIN Teacher tr ON t.TeacherID = tr.UserID_fk
      JOIN TeachingClass tc ON t.ClassID = tc.ClassID
      JOIN Course c ON tc.CourseID_fk = c.CourseID
      WHERE tr.UserID_fk = ?
      ORDER BY tc.BeginDate DESC`,
      [teacherID]
    );
    
    res.status(200).json(courses);
    
  } catch (err) {
    console.error('获取课程列表失败:', err);
    res.status(500).json({ error: '获取课程列表失败', detail: err.message });
  }
});

module.exports = router;