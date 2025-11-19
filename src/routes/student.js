const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router(); // 正确定义 router
const SECRET = 'your_secret_key';
const authenticateToken = require('../middleware/auth');
// 数据库导入
const db = require('../db');

// 简化profile路由，直接使用认证后的用户ID
router.get('/profile', authenticateToken, async (req, res) => {
  // 确保用户角色是student
  if (req.user.role !== 'Student') {
    return res.status(403).json({ error: '仅限学生访问' });
  }

  try {
    const [students] = await db.query(`
      SELECT s.StudentID, s.Name, s.Gender, s.Class, s.Year, s.Status, s.TelNumber,
        u.UserType, u.UserStatus
      FROM Student s
      INNER JOIN User u ON s.UserID_fk  = u.UserID
      WHERE s.StudentID = ?;
    `, [req.user.id]); // 直接使用req.user.id

    if (students.length === 0) {
      return res.status(404).json({ error: '学生信息未找到' });
    }

    res.json({
      success: true,
      data: {
        studentId: students[0].UserID,
        name: students[0].Name,
        gender: students[0].Gender,
        class: students[0].Class,
        year: students[0].Year,
        status: students[0].Status,
        telNumber: students[0].TelNumber,
        userType: students[0].UserType
      }
    });
  } catch (error) {
    console.error('查询学生信息错误:', error);
    res.status(500).json({ error: '数据库查询失败', detail: error.message });
  }
});

// 获取学生课程列表 GET /api/student/courses
router.get('/courses', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Student') {
    return res.status(403).json({ error: '仅限学生访问' });
  }

  try {
    const [courses] = await db.query(`
    SELECT 
        s.StudentID,
        s.Name AS StudentName,
        c.CourseID,
        c.CourseName,
        c.Credit,
        tc.ClassName,
        t.TeacherID,
        t.Name AS TeacherName,
        e.Grade,
        e.ChooseDate
    FROM Enrollment e
    INNER JOIN Student s ON e.StudentID = s.StudentID
    INNER JOIN TeachingClass tc ON e.ClassID = tc.ClassID
    INNER JOIN Course c ON tc.CourseID_fk = c.CourseID
    LEFT JOIN Teaching tch ON tch.ClassID = tc.ClassID -- 或 tch.CourseID = c.CourseID，需根据您的Teaching表结构确定
    LEFT JOIN Teacher t ON tch.TeacherID = t.TeacherID
    WHERE e.StudentID = ?
    ORDER BY e.ChooseDate DESC;
    `, [req.user.id]);

    res.json({
      success: true,
      data: courses
    });
  } catch (error) {
    console.error('查询课程列表错误:', error);
    res.status(500).json({ error: '查询课程列表失败', detail: error.message });
  }
});

// 检查指定教学班的激活考勤 GET /api/sessions/active/:teachingClassId
router.get('/sessions/active/:teachingClassId', authenticateToken, async (req, res) => {
  const { teachingClassId } = req.params;

  try {
    const [sessions] = await db.query(`
      SELECT s.SessionID, s.TeachingClassID, s.StartTime, s.EndTime, s.Active
      FROM AttendanceSession s
      WHERE s.TeachingClassID = ? AND s.Active = TRUE
      LIMIT 1
    `, [teachingClassId]);

    if (sessions.length > 0) {
      res.json({ 
        active: true, 
        sessionId: sessions[0].SessionID,
        startTime: sessions[0].StartTime
      });
    } else {
      res.json({ active: false });
    }
  } catch (error) {
    console.error('查询考勤会话错误:', error);
    res.status(500).json({ error: '查询考勤状态失败', detail: error.message });
  }
});

// 获取个人考勤历史 GET /api/student/history
router.get('/history', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Student') {
    return res.status(403).json({ error: '仅限学生访问' });
  }

  try {
    const [records] = await db.query(`
    SELECT 
        ar.RecordID, 
        ar.AttendanceID , 
        ar.StudentID, 
        ar.CheckInTime, 
        ar.Status,
        a.BeginTime AS StartTime,
        a.EndTime, 
        tc.ClassName, 
        c.CourseName
    FROM Attendance_Record ar
    INNER JOIN Attendance a ON ar.AttendanceID = a.AttendanceID
    INNER JOIN TeachingClass tc ON a.ClassID_fk = tc.ClassID
    INNER JOIN Course c ON tc.CourseID_fk = c.CourseID
    WHERE ar.StudentID = ?
    ORDER BY a.BeginTime DESC;
    `, [req.user.id]);

    const formattedRecords = records.map(record => ({
      recordId: record.RecordID,
      sessionId: record.SessionID,
      courseName: record.CourseName || record.ClassName,
      className: record.ClassName,
      checkInTime: record.CheckInTime,
      sessionTime: record.StartTime,
      status: record.Status
    }));

    res.json({
      success: true,
      data: formattedRecords
    });
  } catch (error) {
    console.error('查询考勤历史错误:', error);
    res.status(500).json({ error: '查询考勤历史失败', detail: error.message });
  }
});

// 获取指定教学班的活跃考勤会话 GET /api/student/Attendances/:teachingClassId
router.get('/Attendances/:teachingClassId', authenticateToken, async (req, res) => {
  const { teachingClassId } = req.params;

  try {
    const [sessions] = await db.query(`
      SELECT a.AttendanceID, a.ClassID_fk, a.BeginTime, a.EndTime,
             tc.ClassName, c.CourseName
      FROM Attendance a
      JOIN TeachingClass tc ON a.ClassID_fk = tc.ClassID
      JOIN Course c ON tc.CourseID_fk = c.CourseID
      WHERE a.ClassID_fk = ? 
        AND a.BeginTime <= NOW() 
        AND a.EndTime >= NOW()
      ORDER BY a.BeginTime DESC
    `, [teachingClassId]);

    if (sessions.length > 0) {
      res.json({
        success: true,
        data: sessions.map(session => ({
          sessionId: session.AttendanceID,
          classId: session.ClassID_fk,
          className: session.ClassName,
          courseName: session.CourseName,
          beginTime: session.BeginTime,
          endTime: session.EndTime,
          active: true
        }))
      });
    } else {
      res.json({
        success: true,
        data: [],
        message: '该教学班当前无活跃的考勤会话'
      });
    }
  } catch (error) {
    console.error('查询考勤会话错误:', error);
    res.status(500).json({
      success: false,
      error: '查询考勤状态失败',
      detail: error.message
    });
  }
});

// 获取所有教学班的活跃考勤会话 GET /api/student/Attendances
router.get('/Attendances', authenticateToken, async (req, res) => {
  if (req.user.role !== 'Student') {
    return res.status(403).json({ error: '仅限学生访问' });
  }

  try {
    const [sessions] = await db.query(`
    SELECT 
        a.AttendanceID,
        a.ClassID_fk,
        a.BeginTime,
        a.EndTime,
        tc.ClassName,
        c.CourseName,
        c.CourseID
    FROM Attendance a
    INNER JOIN TeachingClass tc ON a.ClassID_fk = tc.ClassID
    INNER JOIN Course c ON tc.CourseID_fk = c.CourseID
    INNER JOIN Enrollment e ON tc.ClassID = e.ClassID
    WHERE 
        a.BeginTime <= NOW() 
        AND a.EndTime >= NOW()
        AND e.StudentID = ?
    ORDER BY a.BeginTime DESC;
    ` , [req.user.id]);

    res.json({
      success: true,
      data: sessions.map(session => ({
        sessionId: session.AttendanceID,
        classId: session.ClassID_fk,
        className: session.ClassName,
        courseName: session.CourseName,
        beginTime: session.BeginTime,
        endTime: session.EndTime,
        active: true
      }))
    });
  } catch (error) {
    console.error('查询所有考勤会话错误:', error);
    res.status(500).json({
      success: false,
      error: '查询考勤状态失败',
      detail: error.message
    });
  }
});

// 提交人脸考勤记录 POST /api/student/FaceID
// router.post('/FaceID', authenticateToken, async (req, res) => {
//   if (req.user.role !== 'Student') {
//     return res.status(403).json({ error: '仅限学生访问' });
//   }
// });

module.exports = router;
