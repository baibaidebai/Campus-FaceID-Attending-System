const jwt = require('jsonwebtoken');
const db = require('../db');
const SECRET = process.env.JWT_SECRET || 'your_secret_key';

module.exports = async function (req, res, next) {
    const authHeader = req.headers['authorization'];
    
    if (!authHeader) {
        return res.status(401).json({ error: '未提供访问令牌' });
    }

    const tokenParts = authHeader.split(' ');
    if (tokenParts.length !== 2 || tokenParts[0] !== 'Bearer') {
        return res.status(401).json({ error: '令牌格式错误，应为: Bearer <token>' });
    }

    const token = tokenParts[1];

    try {
        // 1. 验证JWT令牌
        const decoded = jwt.verify(token, SECRET);
        
        // 2. 调试日志：查看解码后的Token内容
        console.log('JWT解码内容:', decoded);
        
        // 3. 从数据库查询用户最新信息（包括角色）
        const [users] = await db.query(
            `SELECT u.UserID, u.UserType, u.UserStatus 
             FROM User u 
             WHERE u.UserID = ?`, 
            [decoded.id]
        );
        
        if (users.length === 0) {
            return res.status(401).json({ error: '用户账户不存在' });
        }
        
        if (users[0].UserStatus !== 'active') {
            return res.status(401).json({ error: '用户账户已禁用' });
        }

        // 4. 关键优化：确保req.user包含完整的用户信息
        req.user = {
            id: decoded.id,
            name: decoded.name || users[0].Name, // 后备到数据库查询的值
            role: decoded.role || users[0].UserType, // 优先使用Token中的role，不存在则用数据库的UserType
            ...decoded // 保留Token中的其他信息
        };
        
        // 5. 调试日志：验证最终的req.user内容
        console.log('中间件设置的req.user:', req.user);
        
        next();
        
    } catch (error) {
        console.error('JWT认证错误:', error.message);
        
        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({ error: '令牌已过期' });
        } else if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({ error: '无效的令牌签名' });
        } else if (error.code === 'ECONNREFUSED') {
            return res.status(503).json({ error: '数据库连接失败' });
        } else {
            return res.status(500).json({ error: '认证处理失败' });
        }
    }
};