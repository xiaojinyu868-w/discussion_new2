/**
 * V2 视觉化功能测试脚本
 * 
 * 使用方法：
 * 1. 确保后端服务已启动（npm start）
 * 2. 运行此脚本：node test-visualization.js
 */

const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:4000';

async function testAPI() {
  console.log('========================================');
  console.log('V2 视觉化功能测试');
  console.log('========================================\n');

  try {
    // 1. 健康检查
    console.log('[1] 测试后端健康检查...');
    const healthRes = await fetch(`${API_BASE_URL}/sessions/health`);
    const healthData = await healthRes.json();
    console.log('✅ 健康检查通过:', healthData);
    console.log('');

    // 2. 创建会话
    console.log('[2] 创建测试会话...');
    const createRes = await fetch(`${API_BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: `test-vis-${Date.now()}` }),
    });
    const createData = await createRes.json();
    const sessionId = createData.sessionId;
    console.log('✅ 会话创建成功:', sessionId);
    console.log('');

    // 3. 模拟转写内容（实际场景中，转写内容会通过录音或上传音频文件自动生成）
    console.log('[3] 注意：实际测试需要先有转写内容');
    console.log('   请在前端页面：');
    console.log('   1. 开始录音或上传音频文件');
    console.log('   2. 等待有转写内容');
    console.log('   3. 然后在前端页面测试视觉化生成功能');
    console.log('');

    // 4. 测试获取视觉化列表（应该为空）
    console.log('[4] 测试获取视觉化列表...');
    try {
      const visListRes = await fetch(`${API_BASE_URL}/sessions/${sessionId}/visualizations`);
      const visListData = await visListRes.json();
      console.log('✅ 视觉化列表API正常:', visListData);
      console.log('   当前视觉化数量:', visListData.visualizations?.length || 0);
    } catch (error) {
      console.log('⚠️  获取视觉化列表失败（可能还没有转写内容）:', error.message);
    }
    console.log('');

    // 5. 测试生成视觉化（需要先有转写内容）
    console.log('[5] 测试生成视觉化（需要先有转写内容）...');
    console.log('   如果已有转写内容，可以手动测试：');
    console.log(`   curl -X POST ${API_BASE_URL}/sessions/${sessionId}/visualization \\`);
    console.log('     -H "Content-Type: application/json" \\');
    console.log('     -d \'{"type": "chart", "chartType": "radar"}\'');
    console.log('');

    console.log('========================================');
    console.log('基础API测试完成！');
    console.log('========================================');
    console.log('');
    console.log('下一步：');
    console.log('1. 打开前端页面：demo_show/index.html');
    console.log('2. 开始录音或上传音频文件');
    console.log('3. 等待有转写内容后，测试视觉化生成功能');
    console.log('');

  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    console.log('');
    console.log('请确保：');
    console.log('1. 后端服务已启动：cd backend && npm start');
    console.log('2. 后端服务运行在 http://localhost:4000');
    console.log('3. .env 文件已正确配置');
  }
}

testAPI();

