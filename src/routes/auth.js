const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router(); // 正确定义 router
const SECRET = 'your_secret_key';
// 数据库导入
const db = require('../db');

router.post('/login', async (req, res) => {
const { UserID, password } = req.body;
  try {
    // 您的数据库查询代码
    const [rows] = await db.query(
      `SELECT u.UserID, u.UserType, s.Name AS studentName, t.Name AS teacherName
       FROM User u
       LEFT JOIN Student s ON u.UserID = s.UserID_fk
       LEFT JOIN Teacher t ON u.UserID = t.UserID_fk
       WHERE u.UserID = ? AND u.Password = ?`,
      [UserID, password]
    );
    
    if (rows.length === 0) return res.status(401).json({ error: '用户号或密码错误' });
    
    const user = rows[0];
    let name = user.studentName || user.teacherName || '';
    const token = jwt.sign({ id: user.UserID, name, role: user.UserType }, SECRET, { expiresIn: '2h' });
    
    res.status(200).json({ 
      token, 
      user: { 
        id: user.UserID, // 确保id是字符串类型
        name, 
        role: user.UserType 
      } 
    });
    
  } catch (err) {
    res.status(500).json({ error: '数据库错误', detail: err.message });
  }
});

// 用户注册API 
router.post('/register', async (req, res) => {
  const { UserID, password, UserType, name } = req.body;

  // 验证必填字段
  if (!UserID || !password || !UserType || !name) {
    return res.status(400).json({ error: '缺少必要字段: UserID, password, UserType, name' });
  }

  // 验证用户类型（必须匹配数据库中的类型）
  const validUserTypes = ['student', 'teacher', 'admin'];
  if (!validUserTypes.includes(UserType)) {
    return res.status(400).json({ error: `无效的用户类型. 必须是: ${validUserTypes.join(', ')}` });
  }

  try {
    // 检查UserID是否已存在
    const [existingUser] = await db.query(
      'SELECT UserID FROM User WHERE UserID = ?',
      [UserID]
    );

    if (existingUser.length > 0) {
      return res.status(409).json({ error: '用户ID已存在' });
    }

    // 1. 插入User表（设置默认状态为active，FaceID_fk为NULL）
    await db.query(
      `INSERT INTO User (UserID, Password, UserType, UserStatus, FaceID_fk) 
       VALUES (?, ?, ?, 'active', NULL)`,
      [UserID, password, UserType]
    );

    // 2. 根据UserType插入对应子表
    if (UserType === 'student') {
      await db.query(
        `INSERT INTO Student (UserID_fk, Name) 
         VALUES (?, ?)`,
        [UserID, name]
      );
    } else if (UserType === 'teacher') {
      await db.query(
        `INSERT INTO Teacher (UserID_fk, Name) 
         VALUES (?, ?)`,
        [UserID, name]
      );
    } else if (UserType === 'admin') {
      await db.query(
        `INSERT INTO Admin (UserID_fk, Name) 
         VALUES (?, ?)`,
        [UserID, name]
      );
    }

    // 3. 返回成功响应
    res.status(201).json({
      message: '注册成功',
      user: {
        id: UserID,
        name,
        role: UserType
      }
    });

  } catch (err) {
    console.error('注册错误:', err);
    res.status(500).json({ error: '注册失败', detail: err.message });
  }
});

// 确保导出路由
module.exports = router;
