const fs = require('fs');
const path = require('path');

const OLD_PATH = path.join(__dirname, 'data.db');
const NEW_DIR = 'D:/word-remember';
const NEW_PATH = 'D:/word-remember/data.db';

async function migrate() {
  const oldExists = fs.existsSync(OLD_PATH);

  if (!oldExists) {
    console.log('未发现旧数据库文件（C盘），无需迁移。');
    console.log(`新路径: ${NEW_PATH}`);
    // 仍然确保新目录存在
    if (!fs.existsSync(NEW_DIR)) {
      fs.mkdirSync(NEW_DIR, { recursive: true });
      console.log('已创建新数据库目录');
    }
    return;
  }

  // 检查新路径是否已有数据
  if (fs.existsSync(NEW_PATH)) {
    const oldSize = fs.statSync(OLD_PATH).size;
    const newSize = fs.statSync(NEW_PATH).size;

    if (newSize > 0) {
      console.log('新路径已有数据库文件，跳过迁移。');
      console.log(`  C盘旧文件: ${OLD_PATH} (${(oldSize / 1024).toFixed(1)} KB)`);
      console.log(`  D盘新文件: ${NEW_PATH} (${(newSize / 1024).toFixed(1)} KB)`);
      return;
    }
  }

  // 确保目标目录存在
  if (!fs.existsSync(NEW_DIR)) {
    fs.mkdirSync(NEW_DIR, { recursive: true });
  }

  // 复制文件
  fs.copyFileSync(OLD_PATH, NEW_PATH);

  const oldSize = fs.statSync(OLD_PATH).size;
  const newSize = fs.statSync(NEW_PATH).size;

  console.log('✅ 数据库迁移成功！');
  console.log(`  来源: ${OLD_PATH} (${(oldSize / 1024).toFixed(1)} KB)`);
  console.log(`  目标: ${NEW_PATH} (${(newSize / 1024).toFixed(1)} KB)`);

  // 验证
  if (oldSize === newSize) {
    console.log('✅ 文件大小一致，迁移验证通过。');
  } else {
    console.warn('⚠️ 文件大小不一致，请检查。');
  }
}

migrate().catch(err => {
  console.error('迁移失败:', err);
  process.exit(1);
});
