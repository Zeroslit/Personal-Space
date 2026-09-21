package app.pspace;

import java.nio.file.Files;
import java.nio.file.Path;
import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Statement;

public final class Db {
    private static final String[] SCHEMA = {
        """
        CREATE TABLE IF NOT EXISTS projects (
          id          TEXT PRIMARY KEY,
          title       TEXT NOT NULL,
          summary     TEXT NOT NULL DEFAULT '',
          repo_url    TEXT,
          site_url    TEXT,
          demo_login  INTEGER NOT NULL DEFAULT 0,
          cover       TEXT NOT NULL DEFAULT '',
          language    TEXT NOT NULL DEFAULT '',
          status      TEXT NOT NULL DEFAULT 'active',
          stars       INTEGER NOT NULL DEFAULT 0,
          pinned      INTEGER NOT NULL DEFAULT 0,
          ord         INTEGER NOT NULL DEFAULT 0,
          created_at  TEXT NOT NULL,
          updated_at  TEXT NOT NULL,
          CHECK (repo_url IS NOT NULL AND TRIM(repo_url) <> '')
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_projects_order ON projects (pinned DESC, ord ASC)",
        """
        CREATE TABLE IF NOT EXISTS snippets (
          id          TEXT PRIMARY KEY,
          project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
          filename    TEXT NOT NULL DEFAULT '',
          language    TEXT NOT NULL DEFAULT 'plaintext',
          code        TEXT NOT NULL DEFAULT '',
          ord         INTEGER NOT NULL DEFAULT 0
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_snippets_project ON snippets (project_id, ord ASC)",
        """
        CREATE TABLE IF NOT EXISTS tags (
          project_id  TEXT NOT NULL REFERENCES projects (id) ON DELETE CASCADE,
          name        TEXT NOT NULL,
          ord         INTEGER NOT NULL DEFAULT 0,
          PRIMARY KEY (project_id, name)
        )
        """,
        "CREATE INDEX IF NOT EXISTS idx_tags_name ON tags (name)",
        """
        CREATE TABLE IF NOT EXISTS assets (
          id          TEXT PRIMARY KEY,
          mime        TEXT NOT NULL,
          size        INTEGER NOT NULL,
          bytes       BLOB NOT NULL,
          created_at  TEXT NOT NULL
        )
        """,
        """
        CREATE TABLE IF NOT EXISTS settings (
          key    TEXT PRIMARY KEY,
          value  TEXT NOT NULL
        )
        """
    };

    private final Path file;
    private final String url;

    private Db(Path file) {
        this.file = file;
        this.url = "jdbc:sqlite:" + file.toAbsolutePath();
    }

    public static Db open(Path file) throws Exception {
        Path parent = file.toAbsolutePath().getParent();
        if (parent != null) {
            Files.createDirectories(parent);
        }
        Class.forName("org.sqlite.JDBC");
        Db db = new Db(file);
        db.migrate();
        return db;
    }

    public Path file() {
        return file;
    }

    public Connection connect() throws SQLException {
        Connection connection = DriverManager.getConnection(url);
        try (Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA foreign_keys = ON");
            statement.execute("PRAGMA busy_timeout = 5000");
        }
        return connection;
    }

    private void migrate() throws SQLException {
        try (Connection connection = connect(); Statement statement = connection.createStatement()) {
            statement.execute("PRAGMA journal_mode = WAL");
            for (String ddl : SCHEMA) {
                statement.executeUpdate(ddl);
            }
            addColumnIfMissing(statement, "projects", "demo_login", "INTEGER NOT NULL DEFAULT 0");
        }
    }

    /** 老库补列：抛错说明列已存在，忽略即可。 */
    private static void addColumnIfMissing(Statement statement, String table, String column, String definition) {
        try {
            statement.executeUpdate("ALTER TABLE " + table + " ADD COLUMN " + column + " " + definition);
        } catch (SQLException ignored) {
            // 列已存在，无需处理
        }
    }

    public int count(String table) throws SQLException {
        try (Connection connection = connect();
             Statement statement = connection.createStatement();
             ResultSet rs = statement.executeQuery("SELECT COUNT(*) FROM " + table)) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }
}
