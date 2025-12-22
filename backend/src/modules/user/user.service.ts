import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export interface Meeting {
  id: number;
  user_id: number;
  session_id: string;
  title: string;
  duration_ms: number;
  status: string;
  created_at: string;
}

export interface MeetingDetail extends Meeting {
  transcripts: Array<{
    id: number;
    start_ms: number;
    end_ms: number;
    content: string;
  }>;
  insights: Array<{
    id: number;
    type: string;
    content: string;
    created_at: string;
  }>;
  visualizations: Array<{
    id: number;
    type: string;
    chart_type: string;
    image_path: string;
    created_at: string;
  }>;
}

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly db: DatabaseService) {}

  // 创建会议记录
  createMeeting(userId: number, sessionId: string, title?: string): Meeting {
    const result = this.db.run(
      `INSERT INTO meetings (user_id, session_id, title) VALUES (?, ?, ?)`,
      [userId, sessionId, title || '未命名会议']
    );

    this.logger.log(`Meeting created: userId=${userId}, sessionId=${sessionId}`);

    return this.db.queryOne<Meeting>(
      'SELECT * FROM meetings WHERE id = ?',
      [result.lastInsertRowid]
    )!;
  }

  // 更新会议信息
  updateMeeting(sessionId: string, data: { title?: string; duration_ms?: number; status?: string }) {
    const sets: string[] = [];
    const params: any[] = [];

    if (data.title !== undefined) {
      sets.push('title = ?');
      params.push(data.title);
    }
    if (data.duration_ms !== undefined) {
      sets.push('duration_ms = ?');
      params.push(data.duration_ms);
    }
    if (data.status !== undefined) {
      sets.push('status = ?');
      params.push(data.status);
    }

    if (sets.length === 0) return;

    params.push(sessionId);
    this.db.run(
      `UPDATE meetings SET ${sets.join(', ')} WHERE session_id = ?`,
      params
    );
  }

  // 获取用户的会议列表
  getMeetings(userId: number, limit: number = 20, offset: number = 0): Meeting[] {
    return this.db.query<Meeting>(
      `SELECT * FROM meetings WHERE user_id = ? AND status != 'deleted' ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [userId, limit, offset]
    );
  }

  // 获取会议详情
  getMeetingDetail(userId: number, meetingId: number): MeetingDetail | null {
    const meeting = this.db.queryOne<Meeting>(
      'SELECT * FROM meetings WHERE id = ? AND user_id = ?',
      [meetingId, userId]
    );

    if (!meeting) return null;

    const transcripts = this.db.query(
      'SELECT id, start_ms, end_ms, content FROM transcripts WHERE meeting_id = ? ORDER BY start_ms',
      [meetingId]
    );

    const insights = this.db.query(
      'SELECT id, type, content, created_at FROM insights WHERE meeting_id = ? ORDER BY created_at DESC',
      [meetingId]
    );

    const visualizations = this.db.query(
      'SELECT id, type, chart_type, image_path, created_at FROM visualizations WHERE meeting_id = ? ORDER BY created_at DESC',
      [meetingId]
    );

    return {
      ...meeting,
      transcripts,
      insights,
      visualizations,
    };
  }

  // 通过 sessionId 获取会议
  getMeetingBySessionId(sessionId: string): Meeting | undefined {
    return this.db.queryOne<Meeting>(
      'SELECT * FROM meetings WHERE session_id = ?',
      [sessionId]
    );
  }

  // 保存转写内容
  saveTranscript(meetingId: number, startMs: number, endMs: number, content: string) {
    this.db.run(
      `INSERT INTO transcripts (meeting_id, start_ms, end_ms, content) VALUES (?, ?, ?, ?)`,
      [meetingId, startMs, endMs, content]
    );
  }

  // 批量保存转写内容
  saveTranscriptsBatch(meetingId: number, transcripts: Array<{ startMs: number; endMs: number; content: string }>) {
    const stmt = this.db.getDatabase().prepare(
      `INSERT INTO transcripts (meeting_id, start_ms, end_ms, content) VALUES (?, ?, ?, ?)`
    );

    this.db.transaction(() => {
      for (const t of transcripts) {
        stmt.run(meetingId, t.startMs, t.endMs, t.content);
      }
    });

    this.logger.log(`Saved ${transcripts.length} transcripts for meeting ${meetingId}`);
  }

  // 保存洞察
  saveInsight(meetingId: number, type: string, content: string) {
    this.db.run(
      `INSERT INTO insights (meeting_id, type, content) VALUES (?, ?, ?)`,
      [meetingId, type, content]
    );
  }

  // 保存可视化
  saveVisualization(meetingId: number, type: string, chartType: string | null, imagePath: string, prompt: string) {
    const result = this.db.run(
      `INSERT INTO visualizations (meeting_id, type, chart_type, image_path, prompt) VALUES (?, ?, ?, ?, ?)`,
      [meetingId, type, chartType, imagePath, prompt]
    );
    return result.lastInsertRowid as number;
  }

  // 删除会议（软删除）
  deleteMeeting(userId: number, meetingId: number): boolean {
    const result = this.db.run(
      `UPDATE meetings SET status = 'deleted' WHERE id = ? AND user_id = ?`,
      [meetingId, userId]
    );
    return result.changes > 0;
  }
}
