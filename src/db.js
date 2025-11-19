const mysql = require('mysql2');
const pool = mysql.createPool({
  host: '101.132.178.161',
  user: 'FaceID_AttendanceDB',
  password: 'FaceID_AttendanceDB',
  database: 'FaceID_AttendanceDB',
  // 新增连接池配置
  waitForConnections: true, // 连接耗尽时是否等待
  connectionLimit: 10, // 最大连接数
  queueLimit: 0 // 排队请求的最大数量，0表示无限制
});
module.exports = pool.promise();