use crate::models::{NoteItem, SettingItem, TaskItem};
use rusqlite::{params, Connection};
use std::fmt;
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;

#[derive(Debug, Clone)]
pub enum DbError {
    LockFailed(String),
    QueryFailed(String),
    NotFound(String),
}

impl fmt::Display for DbError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            DbError::LockFailed(msg) => write!(f, "Database lock failed: {}", msg),
            DbError::QueryFailed(msg) => write!(f, "Database query failed: {}", msg),
            DbError::NotFound(msg) => write!(f, "Record not found: {}", msg),
        }
    }
}

impl std::error::Error for DbError {}

impl From<DbError> for String {
    fn from(err: DbError) -> Self {
        err.to_string()
    }
}

pub struct Database {
    pub conn: Mutex<Connection>,
}

impl Database {
    pub fn init(app_dir: PathBuf) -> Result<Self, DbError> {
        if !app_dir.exists() {
            fs::create_dir_all(&app_dir).map_err(|e| DbError::QueryFailed(e.to_string()))?;
        }

        let db_path = app_dir.join("bilet_x.db");
        let conn = Connection::open(&db_path).map_err(|e| DbError::QueryFailed(e.to_string()))?;

        let db = Database {
            conn: Mutex::new(conn),
        };

        db.run_migrations()?;

        Ok(db)
    }

    fn run_migrations(&self) -> Result<(), DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;

        // 1. Versioned Schema Migrations Tracking
        conn.execute(
            "CREATE TABLE IF NOT EXISTS schema_migrations (
                version INTEGER PRIMARY KEY,
                applied_at TEXT NOT NULL
            );",
            [],
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        let current_version: i32 = conn
            .query_row(
                "SELECT COALESCE(MAX(version), 0) FROM schema_migrations",
                [],
                |row| row.get(0),
            )
            .unwrap_or(0);

        // Version 1: Notes, Tasks, and Settings tables
        if current_version < 1 {
            conn.execute(
                "CREATE TABLE IF NOT EXISTS notes (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    content TEXT NOT NULL,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );",
                [],
            )
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

            conn.execute(
                "CREATE TABLE IF NOT EXISTS tasks (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    status TEXT NOT NULL DEFAULT 'pending',
                    priority TEXT NOT NULL DEFAULT 'medium',
                    due_date TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );",
                [],
            )
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

            conn.execute(
                "CREATE TABLE IF NOT EXISTS settings (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                );",
                [],
            )
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

            conn.execute(
                "INSERT INTO schema_migrations (version, applied_at) VALUES (1, datetime('now'));",
                [],
            )
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;
        }

        Ok(())
    }
}

// --- REPOSITORY INTERFACES & IMPLEMENTATION ---
pub trait NoteRepository {
    fn get_all_notes(&self) -> Result<Vec<NoteItem>, DbError>;
    fn save_note(&self, note: NoteItem) -> Result<NoteItem, DbError>;
    fn delete_note(&self, id: &str) -> Result<bool, DbError>;
    fn clear_all_notes(&self) -> Result<usize, DbError>;
}

pub trait TaskRepository {
    fn get_all_tasks(&self) -> Result<Vec<TaskItem>, DbError>;
    fn save_task(&self, task: TaskItem) -> Result<TaskItem, DbError>;
    fn update_task_status(&self, id: &str, status: &str) -> Result<bool, DbError>;
    fn delete_task(&self, id: &str) -> Result<bool, DbError>;
    fn clear_all_tasks(&self) -> Result<usize, DbError>;
}

pub trait SettingsRepository {
    fn get_all_settings(&self) -> Result<Vec<SettingItem>, DbError>;
    fn get_setting(&self, key: &str) -> Result<Option<String>, DbError>;
    fn set_setting(&self, key: &str, value: &str) -> Result<SettingItem, DbError>;
}

impl NoteRepository for Database {
    fn get_all_notes(&self) -> Result<Vec<NoteItem>, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        let mut stmt = conn
            .prepare("SELECT id, title, content, created_at, updated_at FROM notes ORDER BY updated_at DESC")
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        let iter = stmt
            .query_map([], |row| {
                Ok(NoteItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            })
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        let mut list = Vec::new();
        for item in iter {
            list.push(item.map_err(|e| DbError::QueryFailed(e.to_string()))?);
        }

        Ok(list)
    }

    fn save_note(&self, note: NoteItem) -> Result<NoteItem, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        // Timestamps are stamped by SQLite so the client can't backdate rows
        // and break the `ORDER BY updated_at DESC` sort. RETURNING gives the
        // caller the DB-authoritative row rather than echoing input.
        conn.query_row(
            "INSERT INTO notes (id, title, content, created_at, updated_at)
             VALUES (?1, ?2, ?3, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                content = excluded.content,
                updated_at = datetime('now')
             RETURNING id, title, content, created_at, updated_at;",
            params![note.id, note.title, note.content],
            |row| {
                Ok(NoteItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    content: row.get(2)?,
                    created_at: row.get(3)?,
                    updated_at: row.get(4)?,
                })
            },
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))
    }

    fn delete_note(&self, id: &str) -> Result<bool, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        let rows = conn
            .execute("DELETE FROM notes WHERE id = ?1;", params![id])
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        if rows == 0 {
            Err(DbError::NotFound(format!("Note ID '{}' not found", id)))
        } else {
            Ok(true)
        }
    }

    fn clear_all_notes(&self) -> Result<usize, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        let rows = conn
            .execute("DELETE FROM notes;", [])
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;
        Ok(rows)
    }
}

impl TaskRepository for Database {
    fn get_all_tasks(&self) -> Result<Vec<TaskItem>, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        let mut stmt = conn
            .prepare("SELECT id, title, description, status, priority, due_date, created_at, updated_at FROM tasks ORDER BY created_at DESC")
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        let iter = stmt
            .query_map([], |row| {
                Ok(TaskItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    status: row.get(3)?,
                    priority: row.get(4)?,
                    due_date: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            })
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        let mut list = Vec::new();
        for item in iter {
            list.push(item.map_err(|e| DbError::QueryFailed(e.to_string()))?);
        }

        Ok(list)
    }

    fn save_task(&self, task: TaskItem) -> Result<TaskItem, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        conn.query_row(
            "INSERT INTO tasks (id, title, description, status, priority, due_date, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, datetime('now'), datetime('now'))
             ON CONFLICT(id) DO UPDATE SET
                title = excluded.title,
                description = excluded.description,
                status = excluded.status,
                priority = excluded.priority,
                due_date = excluded.due_date,
                updated_at = datetime('now')
             RETURNING id, title, description, status, priority, due_date, created_at, updated_at;",
            params![
                task.id,
                task.title,
                task.description,
                task.status,
                task.priority,
                task.due_date,
            ],
            |row| {
                Ok(TaskItem {
                    id: row.get(0)?,
                    title: row.get(1)?,
                    description: row.get(2)?,
                    status: row.get(3)?,
                    priority: row.get(4)?,
                    due_date: row.get(5)?,
                    created_at: row.get(6)?,
                    updated_at: row.get(7)?,
                })
            },
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))
    }

    fn update_task_status(&self, id: &str, status: &str) -> Result<bool, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        let rows = conn
            .execute(
                "UPDATE tasks SET status = ?1, updated_at = datetime('now') WHERE id = ?2;",
                params![status, id],
            )
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        if rows == 0 {
            Err(DbError::NotFound(format!("Task ID '{}' not found", id)))
        } else {
            Ok(true)
        }
    }

    fn delete_task(&self, id: &str) -> Result<bool, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        let rows = conn
            .execute("DELETE FROM tasks WHERE id = ?1;", params![id])
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        if rows == 0 {
            Err(DbError::NotFound(format!("Task ID '{}' not found", id)))
        } else {
            Ok(true)
        }
    }

    fn clear_all_tasks(&self) -> Result<usize, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        let rows = conn
            .execute("DELETE FROM tasks;", [])
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;
        Ok(rows)
    }
}

impl SettingsRepository for Database {
    fn get_all_settings(&self) -> Result<Vec<SettingItem>, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        let mut stmt = conn
            .prepare("SELECT key, value, updated_at FROM settings")
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        let iter = stmt
            .query_map([], |row| {
                Ok(SettingItem {
                    key: row.get(0)?,
                    value: row.get(1)?,
                    updated_at: row.get(2)?,
                })
            })
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        let mut list = Vec::new();
        for item in iter {
            list.push(item.map_err(|e| DbError::QueryFailed(e.to_string()))?);
        }

        Ok(list)
    }

    fn get_setting(&self, key: &str) -> Result<Option<String>, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        let mut stmt = conn
            .prepare("SELECT value FROM settings WHERE key = ?1")
            .map_err(|e| DbError::QueryFailed(e.to_string()))?;

        let val = stmt.query_row(params![key], |row| row.get(0)).ok();
        Ok(val)
    }

    fn set_setting(&self, key: &str, value: &str) -> Result<SettingItem, DbError> {
        let conn = self
            .conn
            .lock()
            .map_err(|e| DbError::LockFailed(e.to_string()))?;
        conn.query_row(
            "INSERT INTO settings (key, value, updated_at)
             VALUES (?1, ?2, datetime('now'))
             ON CONFLICT(key) DO UPDATE SET
                value = excluded.value,
                updated_at = datetime('now')
             RETURNING key, value, updated_at;",
            params![key, value],
            |row| {
                Ok(SettingItem {
                    key: row.get(0)?,
                    value: row.get(1)?,
                    updated_at: row.get(2)?,
                })
            },
        )
        .map_err(|e| DbError::QueryFailed(e.to_string()))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_persistence_across_restart() {
        let temp_dir = std::env::temp_dir().join(format!("bilet_x_test_{}", std::process::id()));

        // 1. First app launch: Save data
        {
            let db1 = Database::init(temp_dir.clone()).expect("Init DB failed");
            let note = NoteItem {
                id: "n1".to_string(),
                title: "Test Persistent Note".to_string(),
                content: "Content stored in SQLite".to_string(),
                created_at: "2026-09-04".to_string(),
                updated_at: "2026-09-04".to_string(),
            };
            db1.save_note(note).expect("Save note failed");

            let task = TaskItem {
                id: "t1".to_string(),
                title: "Persistent Task".to_string(),
                description: "Task desc".to_string(),
                status: "pending".to_string(),
                priority: "high".to_string(),
                due_date: None,
                created_at: "2026-09-04".to_string(),
                updated_at: "2026-09-04".to_string(),
            };
            db1.save_task(task).expect("Save task failed");
        }

        // 2. Simulated app restart: Re-open DB from disk and verify persistence
        {
            let db2 = Database::init(temp_dir.clone()).expect("Re-init DB failed");
            let notes = db2.get_all_notes().expect("Fetch notes failed");
            assert_eq!(notes.len(), 1);
            assert_eq!(notes[0].title, "Test Persistent Note");

            let tasks = db2.get_all_tasks().expect("Fetch tasks failed");
            assert_eq!(tasks.len(), 1);
            assert_eq!(tasks[0].title, "Persistent Task");
        }

        let _ = fs::remove_dir_all(temp_dir);
    }
}
