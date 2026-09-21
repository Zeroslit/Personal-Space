package app.pspace;

import app.pspace.model.Asset;
import app.pspace.model.AssetBlob;
import app.pspace.model.Project;
import app.pspace.model.ProjectInput;
import app.pspace.model.Settings;
import app.pspace.model.Snippet;
import app.pspace.model.SnippetInput;
import app.pspace.model.TagCount;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.security.SecureRandom;
import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.sql.Types;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** 数据访问层：项目 / 片段 / 标签 / 设置 / 图片资源。 */
public final class Store {

    public record Filter(String q, String tag, String language, String status, Boolean pinned) {
        public static Filter none() {
            return new Filter(null, null, null, null, null);
        }
    }

    private static final String PROJECT_COLUMNS = "p.id, p.title, p.summary, p.repo_url, p.site_url, p.demo_login, "
            + "p.cover, p.language, p.status, p.stars, p.pinned, p.ord, p.created_at, p.updated_at";
    private static final String SELECT_PROJECTS = "SELECT " + PROJECT_COLUMNS + " FROM projects p";
    private static final String ORDER_BY = " ORDER BY p.pinned DESC, p.ord ASC, p.created_at DESC";
    private static final String SETTINGS_KEY = "app";
    private static final char[] ID_ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz".toCharArray();
    private static final SecureRandom RANDOM = new SecureRandom();

    private final Db db;

    public Store(Db db) {
        this.db = db;
    }

    // ------------------------------------------------------------------ 查询

    public List<Project> list(Filter filter) {
        List<Object> params = new ArrayList<>();
        StringBuilder sql = new StringBuilder(SELECT_PROJECTS).append(" WHERE 1 = 1");
        if (filter != null) {
            String q = filter.q() == null ? null : filter.q().trim();
            if (q != null && !q.isEmpty()) {
                String like = "%" + q.toLowerCase(Locale.ROOT) + "%";
                sql.append(" AND (lower(p.title) LIKE ? OR lower(p.summary) LIKE ? OR lower(p.language) LIKE ?")
                        .append(" OR EXISTS (SELECT 1 FROM tags t WHERE t.project_id = p.id AND lower(t.name) LIKE ?)")
                        .append(" OR EXISTS (SELECT 1 FROM snippets s WHERE s.project_id = p.id AND lower(s.code) LIKE ?)")
                        .append(" OR EXISTS (SELECT 1 FROM snippets s WHERE s.project_id = p.id AND lower(s.filename) LIKE ?))");
                for (int i = 0; i < 6; i++) {
                    params.add(like);
                }
            }
            if (filter.tag() != null && !filter.tag().isBlank()) {
                sql.append(" AND EXISTS (SELECT 1 FROM tags t WHERE t.project_id = p.id AND lower(t.name) = ?)");
                params.add(filter.tag().trim().toLowerCase(Locale.ROOT));
            }
            if (filter.language() != null && !filter.language().isBlank()) {
                sql.append(" AND lower(p.language) = ?");
                params.add(filter.language().trim().toLowerCase(Locale.ROOT));
            }
            if (filter.status() != null && !filter.status().isBlank()) {
                sql.append(" AND p.status = ?");
                params.add(filter.status().trim().toLowerCase(Locale.ROOT));
            }
            if (filter.pinned() != null) {
                sql.append(" AND p.pinned = ?");
                params.add(filter.pinned() ? 1 : 0);
            }
        }
        sql.append(ORDER_BY);
        try (Connection connection = db.connect();
             PreparedStatement statement = connection.prepareStatement(sql.toString())) {
            bind(statement, params);
            try (ResultSet rs = statement.executeQuery()) {
                List<Project> projects = new ArrayList<>();
                while (rs.next()) {
                    projects.add(readProject(rs));
                }
                attachSnippets(connection, projects);
                attachTags(connection, projects);
                return projects;
            }
        } catch (SQLException e) {
            throw wrap(e);
        }
    }

    public Project find(String id) {
        if (id == null || id.isEmpty()) {
            return null;
        }
        try (Connection connection = db.connect();
             PreparedStatement statement = connection.prepareStatement(SELECT_PROJECTS + " WHERE p.id = ?")) {
            statement.setString(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                List<Project> projects = new ArrayList<>();
                projects.add(readProject(rs));
                attachSnippets(connection, projects);
                attachTags(connection, projects);
                return projects.get(0);
            }
        } catch (SQLException e) {
            throw wrap(e);
        }
    }

    public Project require(String id) {
        Project project = find(id);
        if (project == null) {
            throw ApiException.notFound("项目不存在：" + id);
        }
        return project;
    }

    // ------------------------------------------------------------------ 写入

    public Project create(ProjectInput input) {
        String id = input.id != null ? input.id : newId("p");
        String now = Instant.now().toString();
        try (Connection connection = db.connect()) {
            connection.setAutoCommit(false);
            try {
                if (exists(connection, id)) {
                    throw ApiException.conflict("项目 id 已存在：" + id);
                }
                int ord = input.ord != null ? input.ord : nextOrd(connection);
                try (PreparedStatement statement = connection.prepareStatement(
                        "INSERT INTO projects (id, title, summary, repo_url, site_url, demo_login, cover,"
                                + " language, status, stars, pinned, ord, created_at, updated_at)"
                                + " VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")) {
                    statement.setString(1, id);
                    statement.setString(2, input.title);
                    statement.setString(3, input.summary);
                    setNullableString(statement, 4, input.repoUrl);
                    setNullableString(statement, 5, input.siteUrl);
                    statement.setInt(6, input.demoLogin ? 1 : 0);
                    statement.setString(7, input.cover);
                    statement.setString(8, input.language);
                    statement.setString(9, input.status);
                    statement.setInt(10, input.stars);
                    statement.setInt(11, input.pinned ? 1 : 0);
                    statement.setInt(12, ord);
                    statement.setString(13, now);
                    statement.setString(14, now);
                    statement.executeUpdate();
                }
                replaceSnippets(connection, id, input.snippets);
                replaceTags(connection, id, input.tags);
                connection.commit();
            } catch (RuntimeException e) {
                connection.rollback();
                throw e;
            } catch (SQLException e) {
                connection.rollback();
                throw wrap(e);
            }
        } catch (SQLException e) {
            throw wrap(e);
        }
        return require(id);
    }

    public Project update(String id, ProjectInput input) {
        require(id);
        String now = Instant.now().toString();
        try (Connection connection = db.connect()) {
            connection.setAutoCommit(false);
            try {
                try (PreparedStatement statement = connection.prepareStatement(
                        "UPDATE projects SET title = ?, summary = ?, repo_url = ?, site_url = ?, cover = ?,"
                                + " language = ?, status = ?, stars = ?, pinned = ?, demo_login = ?,"
                                + " ord = COALESCE(?, ord), updated_at = ? WHERE id = ?")) {
                    statement.setString(1, input.title);
                    statement.setString(2, input.summary);
                    setNullableString(statement, 3, input.repoUrl);
                    setNullableString(statement, 4, input.siteUrl);
                    statement.setString(5, input.cover);
                    statement.setString(6, input.language);
                    statement.setString(7, input.status);
                    statement.setInt(8, input.stars);
                    statement.setInt(9, input.pinned ? 1 : 0);
                    statement.setInt(10, input.demoLogin ? 1 : 0);
                    if (input.ord == null) {
                        statement.setNull(11, Types.INTEGER);
                    } else {
                        statement.setInt(11, input.ord);
                    }
                    statement.setString(12, now);
                    statement.setString(13, id);
                    statement.executeUpdate();
                }
                replaceSnippets(connection, id, input.snippets);
                replaceTags(connection, id, input.tags);
                connection.commit();
            } catch (RuntimeException e) {
                connection.rollback();
                throw e;
            } catch (SQLException e) {
                connection.rollback();
                throw wrap(e);
            }
        } catch (SQLException e) {
            throw wrap(e);
        }
        return require(id);
    }

    public boolean delete(String id) {
        try (Connection connection = db.connect();
             PreparedStatement statement = connection.prepareStatement("DELETE FROM projects WHERE id = ?")) {
            statement.setString(1, id);
            return statement.executeUpdate() > 0;
        } catch (SQLException e) {
            throw wrap(e);
        }
    }

    /** ids 是期望顺序；未列出的项目按原相对顺序追加到末尾，未知 id 忽略。 */
    public List<Project> reorder(List<String> ids) {
        try (Connection connection = db.connect()) {
            connection.setAutoCommit(false);
            try {
                List<String> current = orderedIds(connection);
                LinkedHashSet<String> desired = new LinkedHashSet<>();
                for (String id : ids) {
                    if (current.contains(id)) {
                        desired.add(id);
                    }
                }
                desired.addAll(current);
                try (PreparedStatement statement = connection.prepareStatement("UPDATE projects SET ord = ? WHERE id = ?")) {
                    int ord = 0;
                    for (String id : desired) {
                        statement.setInt(1, ord++);
                        statement.setString(2, id);
                        statement.addBatch();
                    }
                    statement.executeBatch();
                }
                connection.commit();
            } catch (RuntimeException e) {
                connection.rollback();
                throw e;
            } catch (SQLException e) {
                connection.rollback();
                throw wrap(e);
            }
        } catch (SQLException e) {
            throw wrap(e);
        }
        return list(Filter.none());
    }

    // ------------------------------------------------------------------ 标签 / 设置 / 资源

    public List<TagCount> tags() {
        String sql = "SELECT name, COUNT(*) AS usage_count FROM tags"
                + " GROUP BY name COLLATE NOCASE ORDER BY usage_count DESC, name COLLATE NOCASE ASC";
        try (Connection connection = db.connect();
             PreparedStatement statement = connection.prepareStatement(sql);
             ResultSet rs = statement.executeQuery()) {
            List<TagCount> tags = new ArrayList<>();
            while (rs.next()) {
                tags.add(new TagCount(rs.getString("name"), rs.getInt("usage_count")));
            }
            return tags;
        } catch (SQLException e) {
            throw wrap(e);
        }
    }

    public Settings settings() {
        try (Connection connection = db.connect();
             PreparedStatement statement = connection.prepareStatement("SELECT value FROM settings WHERE key = ?")) {
            statement.setString(1, SETTINGS_KEY);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    return Settings.defaults();
                }
                return Settings.fromJson(JsonParser.parseString(rs.getString(1)).getAsJsonObject());
            }
        } catch (SQLException | IllegalStateException e) {
            return Settings.defaults();
        }
    }

    public Settings saveSettings(JsonObject patch) {
        Settings next = settings().apply(patch);
        try (Connection connection = db.connect();
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT INTO settings (key, value) VALUES (?, ?)"
                             + " ON CONFLICT(key) DO UPDATE SET value = excluded.value")) {
            statement.setString(1, SETTINGS_KEY);
            statement.setString(2, Json.toJson(next));
            statement.executeUpdate();
        } catch (SQLException e) {
            throw wrap(e);
        }
        return next;
    }

    public Asset saveAsset(String mime, byte[] bytes) {
        String id = newId("a");
        String now = Instant.now().toString();
        try (Connection connection = db.connect();
             PreparedStatement statement = connection.prepareStatement(
                     "INSERT INTO assets (id, mime, size, bytes, created_at) VALUES (?, ?, ?, ?, ?)")) {
            statement.setString(1, id);
            statement.setString(2, mime);
            statement.setLong(3, bytes.length);
            statement.setBytes(4, bytes);
            statement.setString(5, now);
            statement.executeUpdate();
        } catch (SQLException e) {
            throw wrap(e);
        }
        Asset asset = new Asset();
        asset.id = id;
        asset.mime = mime;
        asset.size = bytes.length;
        asset.createdAt = now;
        asset.url = "/api/assets/" + id;
        return asset;
    }

    public AssetBlob asset(String id) {
        try (Connection connection = db.connect();
             PreparedStatement statement = connection.prepareStatement(
                     "SELECT id, mime, bytes FROM assets WHERE id = ?")) {
            statement.setString(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                if (!rs.next()) {
                    return null;
                }
                AssetBlob blob = new AssetBlob();
                blob.id = rs.getString("id");
                blob.mime = rs.getString("mime");
                blob.bytes = rs.getBytes("bytes");
                return blob;
            }
        } catch (SQLException e) {
            throw wrap(e);
        }
    }

    public int countProjects() {
        return count("projects");
    }

    public int countSnippets() {
        return count("snippets");
    }

    private int count(String table) {
        try {
            return db.count(table);
        } catch (SQLException e) {
            throw wrap(e);
        }
    }

    // ------------------------------------------------------------------ 内部工具

    private static void attachSnippets(Connection connection, List<Project> projects) throws SQLException {
        if (projects.isEmpty()) {
            return;
        }
        Map<String, Project> index = new LinkedHashMap<>();
        for (Project project : projects) {
            index.put(project.id, project);
        }
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT id, project_id, filename, language, code, ord FROM snippets ORDER BY project_id, ord ASC");
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                Project owner = index.get(rs.getString("project_id"));
                if (owner == null) {
                    continue;
                }
                Snippet snippet = new Snippet();
                snippet.id = rs.getString("id");
                snippet.filename = rs.getString("filename");
                snippet.language = rs.getString("language");
                snippet.code = rs.getString("code");
                snippet.ord = rs.getInt("ord");
                owner.snippets.add(snippet);
            }
        }
    }

    private static void attachTags(Connection connection, List<Project> projects) throws SQLException {
        if (projects.isEmpty()) {
            return;
        }
        Map<String, Project> index = new LinkedHashMap<>();
        for (Project project : projects) {
            index.put(project.id, project);
        }
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT project_id, name FROM tags ORDER BY project_id, ord ASC");
             ResultSet rs = statement.executeQuery()) {
            while (rs.next()) {
                Project owner = index.get(rs.getString("project_id"));
                if (owner == null) {
                    continue;
                }
                owner.tags.add(rs.getString("name"));
            }
        }
    }

    private static void replaceSnippets(Connection connection, String projectId, List<SnippetInput> snippets)
            throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement("DELETE FROM snippets WHERE project_id = ?")) {
            delete.setString(1, projectId);
            delete.executeUpdate();
        }
        if (snippets == null || snippets.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT OR REPLACE INTO snippets (id, project_id, filename, language, code, ord)"
                        + " VALUES (?, ?, ?, ?, ?, ?)")) {
            int position = 0;
            for (SnippetInput snippet : snippets) {
                insert.setString(1, snippet.id != null ? snippet.id : newId("s"));
                insert.setString(2, projectId);
                insert.setString(3, snippet.filename);
                insert.setString(4, snippet.language);
                insert.setString(5, snippet.code);
                insert.setInt(6, position);
                insert.addBatch();
                position++;
            }
            insert.executeBatch();
        }
    }

    private static void replaceTags(Connection connection, String projectId, List<String> tags) throws SQLException {
        try (PreparedStatement delete = connection.prepareStatement("DELETE FROM tags WHERE project_id = ?")) {
            delete.setString(1, projectId);
            delete.executeUpdate();
        }
        if (tags == null || tags.isEmpty()) {
            return;
        }
        try (PreparedStatement insert = connection.prepareStatement(
                "INSERT OR REPLACE INTO tags (project_id, name, ord) VALUES (?, ?, ?)")) {
            int position = 0;
            for (String tag : tags) {
                insert.setString(1, projectId);
                insert.setString(2, tag);
                insert.setInt(3, position);
                insert.addBatch();
                position++;
            }
            insert.executeBatch();
        }
    }

    private static List<String> orderedIds(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement(
                "SELECT id FROM projects p" + ORDER_BY);
             ResultSet rs = statement.executeQuery()) {
            List<String> ids = new ArrayList<>();
            while (rs.next()) {
                ids.add(rs.getString("id"));
            }
            return ids;
        }
    }

    private static int nextOrd(Connection connection) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT COALESCE(MAX(ord), -1) + 1 FROM projects");
             ResultSet rs = statement.executeQuery()) {
            return rs.next() ? rs.getInt(1) : 0;
        }
    }

    private static boolean exists(Connection connection, String id) throws SQLException {
        try (PreparedStatement statement = connection.prepareStatement("SELECT 1 FROM projects WHERE id = ?")) {
            statement.setString(1, id);
            try (ResultSet rs = statement.executeQuery()) {
                return rs.next();
            }
        }
    }

    private static Project readProject(ResultSet rs) throws SQLException {
        Project project = new Project();
        project.id = rs.getString("id");
        project.title = rs.getString("title");
        project.summary = rs.getString("summary");
        project.repoUrl = rs.getString("repo_url");
        project.siteUrl = rs.getString("site_url");
        project.cover = rs.getString("cover");
        project.language = rs.getString("language");
        project.status = rs.getString("status");
        project.stars = rs.getInt("stars");
        project.pinned = rs.getInt("pinned") != 0;
        project.demoLogin = rs.getInt("demo_login") != 0;
        project.ord = rs.getInt("ord");
        project.createdAt = rs.getString("created_at");
        project.updatedAt = rs.getString("updated_at");
        return project;
    }

    private static void bind(PreparedStatement statement, List<Object> params) throws SQLException {
        for (int i = 0; i < params.size(); i++) {
            statement.setObject(i + 1, params.get(i));
        }
    }

    private static void setNullableString(PreparedStatement statement, int index, String value) throws SQLException {
        if (value == null || value.isEmpty()) {
            statement.setNull(index, Types.VARCHAR);
        } else {
            statement.setString(index, value);
        }
    }

    public static String newId(String prefix) {
        StringBuilder builder = new StringBuilder(prefix).append('_');
        for (int i = 0; i < 12; i++) {
            builder.append(ID_ALPHABET[RANDOM.nextInt(ID_ALPHABET.length)]);
        }
        return builder.toString();
    }

    private static ApiException wrap(SQLException e) {
        String message = e.getMessage() == null ? e.toString() : e.getMessage();
        if (message.contains("CHECK constraint failed")) {
            return ApiException.validation("repoUrl（GitHub 仓库） 不能为空");
        }
        return new ApiException(500, "internal_error", "数据库错误：" + message);
    }
}
