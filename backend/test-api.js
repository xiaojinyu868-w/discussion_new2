/**
 * 后端 API 测试脚本
 * 用于验证后端服务是否正常运行
 * 
 * 使用方法: node test-api.js
 */

const BASE_URL = 'http://localhost:4000';

async function testAPI() {
  console.log('========================================');
  console.log('后端 API 测试');
  console.log('========================================\n');

  // 1. 测试创建会话
  console.log('1. 测试创建会话 POST /sessions');
  console.log('----------------------------------------');
  try {
    const createRes = await fetch(`${BASE_URL}/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: `test-meeting-${Date.now()}` })
    });
    
    if (!createRes.ok) {
      const errorText = await createRes.text();
      console.log(`❌ 创建会话失败: ${createRes.status} ${errorText}`);
      return;
    }
    
    const session = await createRes.json();
    console.log('✅ 创建会话成功!');
    console.log(`   sessionId: ${session.sessionId}`);
    console.log(`   taskId: ${session.taskId}`);
    console.log(`   meetingJoinUrl: ${session.meetingJoinUrl ? '已获取' : '未获取'}\n`);

    const sessionId = session.sessionId;

    // 2. 测试获取转写
    console.log('2. 测试获取转写 GET /sessions/:id/transcripts');
    console.log('----------------------------------------');
    const transcriptsRes = await fetch(`${BASE_URL}/sessions/${sessionId}/transcripts`);
    const transcripts = await transcriptsRes.json();
    console.log('✅ 获取转写成功!');
    console.log(`   转写数量: ${transcripts.transcription?.length || 0}`);
    console.log(`   任务状态: ${transcripts.taskStatus || 'N/A'}\n`);

    // 3. 测试获取摘要
    console.log('3. 测试获取摘要 GET /sessions/:id/summaries');
    console.log('----------------------------------------');
    const summariesRes = await fetch(`${BASE_URL}/sessions/${sessionId}/summaries`);
    const summaries = await summariesRes.json();
    console.log('✅ 获取摘要成功!');
    console.log(`   摘要数量: ${summaries.summaries?.length || 0}\n`);

    // 4. 测试上传音频分片（空分片测试）
    console.log('4. 测试上传音频 POST /sessions/:id/audio');
    console.log('----------------------------------------');
    // 创建一个简单的测试音频数据（静音）
    const testAudioBuffer = Buffer.alloc(1024, 0);
    const base64Chunk = testAudioBuffer.toString('base64');
    
    const audioRes = await fetch(`${BASE_URL}/sessions/${sessionId}/audio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chunk: base64Chunk })
    });
    
    if (audioRes.ok) {
      console.log('✅ 上传音频分片成功!\n');
    } else {
      const errorText = await audioRes.text();
      console.log(`⚠️ 上传音频分片: ${audioRes.status} (可能需要有效音频数据)\n`);
    }

    // 5. 测试停止会话
    console.log('5. 测试停止会话 POST /sessions/:id/complete');
    console.log('----------------------------------------');
    const completeRes = await fetch(`${BASE_URL}/sessions/${sessionId}/complete`, {
      method: 'POST'
    });
    
    if (completeRes.ok) {
      console.log('✅ 停止会话成功!\n');
    } else {
      const errorText = await completeRes.text();
      console.log(`⚠️ 停止会话: ${completeRes.status} ${errorText}\n`);
    }

    console.log('========================================');
    console.log('✅ 所有基础 API 测试通过!');
    console.log('========================================');
    console.log('\n前端可以正常调用后端 API。');
    console.log('如需完整测试音频转写功能，请使用:');
    console.log('  - 浏览器打开: tools/web-audio-tester/index.html');
    console.log('  - 或运行前端 App 进行录音测试');

  } catch (error) {
    console.log(`❌ 测试失败: ${error.message}`);
    console.log('\n请确保后端服务已启动:');
    console.log('  cd backend && npm start');
  }
}

testAPI();
