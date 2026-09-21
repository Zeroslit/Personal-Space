package app.pspace.web;

import app.pspace.ApiException;
import app.pspace.GitHub;
import app.pspace.Json;
import app.pspace.Store;
import app.pspace.Validate;
import app.pspace.Version;
import app.pspace.model.Asset;
import app.pspace.model.AssetBlob;
import app.pspace.model.Project;
import app.pspace.model.ProjectInput;
import app.pspace.model.TagCount;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpHandler;
import java.io.IOException;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/** REST API + 前端静态资源（含 SPA 兜底）。 */
public final class Router implements HttpHandler {
    private static final int MAX_ASSET_BYTES = 4 * 1024 * 1024;
    private static final int MAX_PROJECT_BYTES = 4 * 1024 * 1024;
    private static final int MAX_SETTINGS_BYTES = 64 * 1024;
    private static final int MAX_ORDER_BYTES = 1024 * 1024;
    private static final List<String> ALLOWED_ASSET_TYPES = List.of(
            "image/png", "image/jpeg", "image/gif", "image/webp", "image/svg+xml", "image/avif");

    private final Store store;
    private final StaticFiles staticFiles;
    private final long startedAt;
    private final Path dbFile;

    public Router(Store store, StaticFiles staticFiles, long startedAt, Path dbFile) {
        this.store = store;
        this.staticFiles = staticFiles;
        this.startedAt = startedAt;
        this.dbFile = dbFile;
    }

    @Override
    public void handle(HttpExchange exchange) throws IOException {
        String method = exchange.getRequestMethod().toUpperCase(Locale.ROOT);
        String path = exchange.getRequestURI().getPath();
        try {
            if (path.equals("/api") || path.startsWith("/api/")) {
                routeApi(exchange, method, path);
            } else if (method.equals("GET") || method.equals("HEAD")) {
                serveStatic(exchange, method, path);
            } else {
                throw methodNotAllowed(exchange, method, "GET, HEAD");
            }
        } catch (ApiException error) {
            sendErrorQuietly(exchange, error);
        } catch (Exception unexpected) {
            System.err.println("[personal-space] 处理 " + method + " " + path + " 失败：" + unexpected);
            unexpected.printStackTrace(System.err);
            sendErrorQuietly(exchange, new ApiException(500, "internal_error", "服务器内部错误：" + unexpected));
        } finally {
            exchange.close();
        }
    }

    // ------------------------------------------------------------------ 路由

    private void routeApi(HttpExchange exchange, String method, String path) throws IOException {
        if (path.equals("/api/health")) {
            requireMethod(method, "GET");
            handleHealth(exchange);
            return;
        }
        if (path.equals("/api/projects")) {
            if (method.equals("GET")) {
                handleListProjects(exchange);
                return;
            }
            if (method.equals("POST")) {
                handleCreateProject(exchange);
                return;
            }
            throw methodNotAllowed(exchange, method, "GET, POST");
        }
        if (path.equals("/api/projects/order")) {
            requireMethod(method, "PATCH");
            handleReorder(exchange);
            return;
        }
        if (path.startsWith("/api/projects/")) {
            String id = pathId(path, "/api/projects/");
            if (method.equals("GET")) {
                Http.sendJson(exchange, 200, store.require(id));
                return;
            }
            if (method.equals("PUT")) {
                handleUpdateProject(exchange, id);
                return;
            }
            if (method.equals("DELETE")) {
                handleDeleteProject(exchange, id);
                return;
            }
            throw methodNotAllowed(exchange, method, "GET, PUT, DELETE");
        }
        if (path.equals("/api/github/repo")) {
            requireMethod(method, "GET");
            handleGitHubRepo(exchange);
            return;
        }
        if (path.equals("/api/tags")) {
            requireMethod(method, "GET");
            handleTags(exchange);
            return;
        }
        if (path.equals("/api/settings")) {
            if (method.equals("GET")) {
                Http.sendJson(exchange, 200, store.settings());
                return;
            }
            if (method.equals("PUT")) {
                JsonObject patch = Json.parseObject(Http.readBody(exchange, MAX_SETTINGS_BYTES));
                Http.sendJson(exchange, 200, store.saveSettings(patch));
                return;
            }
            throw methodNotAllowed(exchange, method, "GET, PUT");
        }
        if (path.equals("/api/assets")) {
            requireMethod(method, "POST");
            handleUploadAsset(exchange);
            return;
        }
        if (path.startsWith("/api/assets/")) {
            requireMethod(method, "GET");
            handleGetAsset(exchange, pathId(path, "/api/assets/"));
            return;
        }
        throw ApiException.notFound("未知接口：" + path);
    }

    // ------------------------------------------------------------------ 处理函数

    private void handleHealth(HttpExchange exchange) throws IOException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("status", "ok");
        payload.put("name", Version.NAME);
        payload.put("version", Version.VERSION);
        payload.put("projects", store.countProjects());
        payload.put("snippets", store.countSnippets());
        payload.put("uptimeMs", System.currentTimeMillis() - startedAt);
        payload.put("time", Instant.now().toString());
        payload.put("db", dbFile.toAbsolutePath().toString());
        Http.sendJson(exchange, 200, payload);
    }

    private void handleListProjects(HttpExchange exchange) throws IOException {
        Map<String, String> query = Http.query(exchange);
        Boolean pinned = query.containsKey("pinned") ? Boolean.parseBoolean(query.get("pinned")) : null;
        List<Project> items = store.list(new Store.Filter(
                query.get("q"), query.get("tag"), query.get("language"), query.get("status"), pinned));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("items", items);
        payload.put("total", items.size());
        Http.sendJson(exchange, 200, payload);
    }

    private void handleCreateProject(HttpExchange exchange) throws IOException {
        ProjectInput input = ProjectInput.parse(Json.parseObject(Http.readBody(exchange, MAX_PROJECT_BYTES)));
        Project created = store.create(input);
        System.out.println("[personal-space] 新建项目 " + created.id + "（" + created.title + "）");
        exchange.getResponseHeaders().set("Location", "/api/projects/" + created.id);
        Http.sendJson(exchange, 201, created);
    }

    private void handleUpdateProject(HttpExchange exchange, String id) throws IOException {
        ProjectInput input = ProjectInput.parse(Json.parseObject(Http.readBody(exchange, MAX_PROJECT_BYTES)));
        Project updated = store.update(id, input);
        System.out.println("[personal-space] 更新项目 " + updated.id + "（" + updated.title + "）");
        Http.sendJson(exchange, 200, updated);
    }

    private void handleDeleteProject(HttpExchange exchange, String id) throws IOException {
        if (!store.delete(id)) {
            throw ApiException.notFound("项目不存在：" + id);
        }
        System.out.println("[personal-space] 删除项目 " + id);
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("ok", true);
        payload.put("id", id);
        Http.sendJson(exchange, 200, payload);
    }

    private void handleReorder(HttpExchange exchange) throws IOException {
        JsonObject body = Json.parseObject(Http.readBody(exchange, MAX_ORDER_BYTES));
        List<Project> items = store.reorder(readOrderIds(body));
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("items", items);
        payload.put("total", items.size());
        Http.sendJson(exchange, 200, payload);
    }

    private void handleTags(HttpExchange exchange) throws IOException {
        List<TagCount> tags = store.tags();
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("items", tags);
        payload.put("total", tags.size());
        Http.sendJson(exchange, 200, payload);
    }

    /** GET /api/github/repo?url=... —— 代取 GitHub 仓库信息，供「粘贴地址自动填充简介」使用。 */
    private void handleGitHubRepo(HttpExchange exchange) throws IOException {
        Map<String, String> query = Http.query(exchange);
        String url = query.get("url");
        if (url == null || url.isBlank()) {
            throw ApiException.validation(
                    "需要 url 参数，例如 /api/github/repo?url=https%3A%2F%2Fgithub.com%2Fowner%2Frepo");
        }
        Http.sendJson(exchange, 200, GitHub.repo(url.trim()));
    }

    private void handleUploadAsset(HttpExchange exchange) throws IOException {
        String rawContentType = exchange.getRequestHeaders().getFirst("Content-Type");
        String mime = rawContentType == null ? "" : rawContentType.split(";")[0].trim().toLowerCase(Locale.ROOT);
        if (!ALLOWED_ASSET_TYPES.contains(mime)) {
            throw ApiException.unsupportedMediaType("封面图只支持 " + String.join(" / ", ALLOWED_ASSET_TYPES));
        }
        byte[] bytes = Http.readBody(exchange, MAX_ASSET_BYTES);
        if (bytes.length == 0) {
            throw ApiException.validation("上传内容为空");
        }
        Asset asset = store.saveAsset(mime, bytes);
        System.out.println("[personal-space] 上传封面 " + asset.url + "（" + asset.size + " bytes）");
        Http.sendJson(exchange, 201, asset);
    }

    private void handleGetAsset(HttpExchange exchange, String id) throws IOException {
        AssetBlob blob = store.asset(id);
        if (blob == null) {
            throw ApiException.notFound("资源不存在：" + id);
        }
        Map<String, String> headers = new LinkedHashMap<>();
        headers.put("Cache-Control", "public, max-age=31536000, immutable");
        headers.put("ETag", "\"" + blob.id + "\"");
        Http.send(exchange, 200, blob.mime, blob.bytes, headers);
    }

    private void serveStatic(HttpExchange exchange, String method, String path) throws IOException {
        boolean head = method.equals("HEAD");
        StaticFiles.Response response = staticFiles.get(
                path,
                Http.acceptGzip(exchange).contains("gzip"),
                exchange.getRequestHeaders().getFirst("If-None-Match"));
        Map<String, String> headers = StaticFiles.headersFor(response);
        if (head) {
            Http.sendHeadersOnly(exchange, response.status, response.contentType, response.body.length, headers);
            return;
        }
        Http.send(exchange, response.status, response.contentType, response.body, headers);
    }

    // ------------------------------------------------------------------ 工具

    private static void requireMethod(String method, String expected) {
        if (!method.equals(expected)) {
            throw new ApiException(405, "method_not_allowed", method + " 不被支持，请使用 " + expected);
        }
    }

    private static ApiException methodNotAllowed(HttpExchange exchange, String method, String allowed) {
        exchange.getResponseHeaders().set("Allow", allowed);
        return new ApiException(405, "method_not_allowed", method + " 不被支持，请使用 " + allowed);
    }

    private static String pathId(String path, String prefix) {
        String raw = path.substring(prefix.length());
        if (raw.isEmpty()) {
            throw ApiException.validation("URL 缺少 id");
        }
        if (raw.contains("/")) {
            throw ApiException.notFound("未知接口：" + path);
        }
        String decoded;
        try {
            decoded = URLDecoder.decode(raw, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            throw ApiException.validation("URL 中的 id 编码不合法：" + raw);
        }
        return Validate.id(decoded, "id");
    }

    private static List<String> readOrderIds(JsonObject body) {
        JsonElement element = body.has("ids") ? body.get("ids") : body.get("order");
        if (element == null || element.isJsonNull()) {
            throw ApiException.validation("需要 ids 数组，例如 {\"ids\": [\"p_a\", \"p_b\"]}");
        }
        if (!element.isJsonArray()) {
            throw ApiException.validation("ids 必须是数组");
        }
        JsonArray array = element.getAsJsonArray();
        if (array.size() > 5000) {
            throw ApiException.validation("ids 数量过多（最多 5000）");
        }
        List<String> ids = new ArrayList<>();
        for (int index = 0; index < array.size(); index++) {
            JsonElement item = array.get(index);
            if (item.isJsonPrimitive() && item.getAsJsonPrimitive().isString()) {
                ids.add(Validate.id(item.getAsString(), "ids[" + index + "]"));
            } else if (item.isJsonObject() && item.getAsJsonObject().has("id")
                    && !item.getAsJsonObject().get("id").isJsonNull()) {
                ids.add(Validate.id(item.getAsJsonObject().get("id").getAsString(), "order[" + index + "].id"));
            } else {
                throw ApiException.validation("ids[" + index + "] 必须是项目 id 字符串，或含 id 的对象");
            }
        }
        return ids;
    }

    private static void sendErrorQuietly(HttpExchange exchange, ApiException error) {
        try {
            Http.sendError(exchange, error);
        } catch (IOException ignored) {
            // 客户端提前断开，无需处理
        }
    }
}
