import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
export class DatabaseService implements OnModuleInit {
  private readonly logger = new Logger(DatabaseService.name);
  private db: Database.Database;

  onModuleInit() {
    this.initDatabase();
  }

  private initDatabase() {
    // 确保 data 目录存在
    const dataDir = path.join(process.cwd(), 'data');
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    // 确保 uploads 目录存在
    const uploadsDir = path.join(process.cwd(), 'uploads');
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }

    const dbPath = path.join(dataDir, 'meetmind.db');
    this.db = new Database(dbPath);
    this.logger.log(`SQLite database initialized at ${dbPath}`);

    // 创建表结构
    this.createTables();
  }

  private createTables() {
    // 用户表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 配额表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS quotas (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER UNIQUE REFERENCES users(id),
        daily_insight_limit INTEGER DEFAULT 50,
        daily_insight_used INTEGER DEFAULT 0,
        daily_qa_limit INTEGER DEFAULT 100,
        daily_qa_used INTEGER DEFAULT 0,
        monthly_image_limit INTEGER DEFAULT 5,
        monthly_image_used INTEGER DEFAULT 0,
        daily_reset_at DATETIME,
        monthly_reset_at DATETIME
      )
    `);

    // 会议表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS meetings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER REFERENCES users(id),
        session_id TEXT UNIQUE NOT NULL,
        title TEXT,
        duration_ms INTEGER DEFAULT 0,
        status TEXT DEFAULT 'active',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 转写记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS transcripts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER REFERENCES meetings(id),
        start_ms INTEGER,
        end_ms INTEGER,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 洞察记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS insights (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER REFERENCES meetings(id),
        type TEXT NOT NULL,
        content TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 可视化记录表
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS visualizations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        meeting_id INTEGER REFERENCES meetings(id),
        type TEXT NOT NULL,
        chart_type TEXT,
        image_path TEXT,
        prompt TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // 创建索引
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_meetings_user ON meetings(user_id);
      CREATE INDEX IF NOT EXISTS idx_meetings_session ON meetings(session_id);
      CREATE INDEX IF NOT EXISTS idx_transcripts_meeting ON transcripts(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_insights_meeting ON insights(meeting_id);
      CREATE INDEX IF NOT EXISTS idx_visualizations_meeting ON visualizations(meeting_id);
    `);

    this.logger.log('Database tables initialized');
  }

  // 通用查询方法
  query<T = any>(sql: string, params: any[] = []): T[] {
    return this.db.prepare(sql).all(...params) as T[];
  }

  queryOne<T = any>(sql: string, params: any[] = []): T | undefined {
    return this.db.prepare(sql).get(...params) as T | undefined;
  }

  run(sql: string, params: any[] = []): Database.RunResult {
    return this.db.prepare(sql).run(...params);
  }

  // 事务支持
  transaction<T>(fn: () => T): T {
    return this.db.transaction(fn)();
  }

  getDatabase(): Database.Database {
    return this.db;
  }
}
