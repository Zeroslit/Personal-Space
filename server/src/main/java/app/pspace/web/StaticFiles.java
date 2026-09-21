package app.pspace.web;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Arrays;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.zip.GZIPOutputStream;

/** 提供前端静态资源：优先磁盘目录（开发），否则读 jar 内置的 /static 资源。 */
public final class StaticFiles {
    public static final class Response {
        public final int status;
        public final String contentType;
        public final byte[] body;
        public final String etag;
        public final String cacheControl;
        public final boolean gzip;

        Response(int status, String contentType, byte[] body, String etag, String cacheControl, boolean gzip) {
            this.status = status;
            this.contentType = contentType;
            this.body = body;
            this.etag = etag;
            this.cacheControl = cacheControl;
            this.gzip = gzip;
        }
    }

    private static final Map<String, String> CONTENT_TYPES = Map.ofEntries(
            Map.entry("html", "text/html; charset=utf-8"),
            Map.entry("js", "text/javascript; charset=utf-8"),
            Map.entry("mjs", "text/javascript; charset=utf-8"),
            Map.entry("css", "text/css; charset=utf-8"),
            Map.entry("json", "application/json; charset=utf-8"),
            Map.entry("svg", "image/svg+xml"),
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("gif", "image/gif"),
            Map.entry("webp", "image/webp"),
            Map.entry("avif", "image/avif"),
            Map.entry("ico", "image/x-icon"),
            Map.entry("woff", "font/woff"),
            Map.entry("woff2", "font/woff2"),
            Map.entry("ttf", "font/ttf"),
            Map.entry("txt", "text/plain; charset=utf-8"),
            Map.entry("map", "application/json; charset=utf-8"));

    private final Path dir;
    private final boolean cacheEnabled;
    private final Map<String, Response> cache = new ConcurrentHashMap<>();
    private final Map<String, Response> gzipCache = new ConcurrentHashMap<>();

    private StaticFiles(Path dir) {
        this.dir = dir;
        this.cacheEnabled = dir == null;
    }

    public static StaticFiles create(Path dir) {
        return new StaticFiles(dir);
    }

    public String describe() {
        return dir == null ? "jar 内置 /static" : dir.toAbsolutePath().toString();
    }

    public Response get(String rawPath, boolean gzipAccepted, String ifNoneMatch) {
        String path = normalize(rawPath);
        if (path == null) {
            return notFound();
        }
        Response response = load(path);
        if (response.status == 200 && ifNoneMatch != null && ifNoneMatch.contains(response.etag)) {
            return new Response(304, response.contentType, new byte[0], response.etag, response.cacheControl, false);
        }
        if (response.status == 200 && gzipAccepted && response.body.length > 1024 && compressible(response.contentType)) {
            return gzipCache.computeIfAbsent(path, key -> gzip(response));
        }
        return response;
    }

    private Response load(String path) {
        Response cached = cache.get(path);
        if (cached != null) {
            return cached;
        }
        byte[] bytes = read(path);
        if (bytes == null && !hasExtension(path)) {
            // SPA 兜底：形如 /p/abc 的前端路由交给 index.html
            bytes = read("/index.html");
            if (bytes != null) {
                return remember(path, ok("/index.html", bytes));
            }
        }
        if (bytes == null) {
            return path.equals("/index.html") ? placeholder() : notFound();
        }
        return remember(path, ok(path, bytes));
    }

    private Response remember(String path, Response response) {
        if (cacheEnabled) {
            cache.put(path, response);
        }
        return response;
    }

    private byte[] read(String path) {
        if (dir != null) {
            Path base = dir.toAbsolutePath().normalize();
            Path file = base.resolve(path.substring(1)).normalize();
            if (!file.startsWith(base) || !Files.isRegularFile(file)) {
                return null;
            }
            try {
                return Files.readAllBytes(file);
            } catch (IOException e) {
                return null;
            }
        }
        try (InputStream in = StaticFiles.class.getResourceAsStream("/static" + path)) {
            return in == null ? null : in.readAllBytes();
        } catch (IOException e) {
            return null;
        }
    }

    private static String normalize(String rawPath) {
        String path = rawPath == null ? "/" : rawPath;
        try {
            path = URLDecoder.decode(path, StandardCharsets.UTF_8);
        } catch (IllegalArgumentException ignored) {
            // 保留原始值
        }
        if (!path.startsWith("/")) {
            path = "/" + path;
        }
        if (path.contains("..")) {
            return null;
        }
        return path.equals("/") ? "/index.html" : path;
    }

    private static boolean hasExtension(String path) {
        int slash = path.lastIndexOf('/');
        return path.indexOf('.', slash + 1) > slash + 1;
    }

    private static boolean compressible(String contentType) {
        return contentType.startsWith("text/")
                || contentType.startsWith("application/json")
                || contentType.startsWith("image/svg");
    }

    private static Response ok(String path, byte[] bytes) {
        String extension = extensionOf(path);
        String contentType = CONTENT_TYPES.getOrDefault(extension, "application/octet-stream");
        String etag = "\"" + Integer.toHexString(Arrays.hashCode(bytes)) + "-" + bytes.length + "\"";
        boolean immutable = path.startsWith("/assets/");
        String cacheControl = immutable ? "public, max-age=31536000, immutable" : "no-cache";
        return new Response(200, contentType, bytes, etag, cacheControl, false);
    }

    private static Response gzip(Response response) {
        try {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream(response.body.length / 3 + 64);
            try (GZIPOutputStream gzip = new GZIPOutputStream(buffer)) {
                gzip.write(response.body);
            }
            byte[] compressed = buffer.toByteArray();
            return new Response(200, response.contentType, compressed, response.etag, response.cacheControl, true);
        } catch (IOException e) {
            return response;
        }
    }

    private static String extensionOf(String path) {
        int dot = path.lastIndexOf('.');
        return dot < 0 ? "" : path.substring(dot + 1).toLowerCase(java.util.Locale.ROOT);
    }

    private static Response notFound() {
        return new Response(404, "text/plain; charset=utf-8",
                "404 Not Found".getBytes(StandardCharsets.UTF_8), null, "no-cache", false);
    }

    /** 前端还没构建时的兜底页面，避免直接打开是白屏。 */
    private static Response placeholder() {
        String html = """
                <!doctype html>
                <html lang="zh-CN"><head><meta charset="utf-8"><title>个人空间 · 前端未构建</title>
                <style>
                  body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",sans-serif;
                       background:#0f1115;color:#e7e9ee;margin:0;display:flex;min-height:100vh;
                       align-items:center;justify-content:center}
                  .card{max-width:640px;padding:40px;border:1px solid #262b36;border-radius:16px;background:#151922}
                  h1{margin:0 0 12px;font-size:22px}
                  code{background:#1e2430;padding:2px 6px;border-radius:6px;font-size:13px}
                  pre{background:#1e2430;padding:14px;border-radius:10px;overflow:auto;font-size:13px}
                  a{color:#8ab4ff}
                  p{line-height:1.7;color:#a9b1c1}
                </style></head>
                <body><div class="card">
                  <h1>API 已在运行，但前端还没有构建</h1>
                  <p>先构建前端产物，让服务端把页面内嵌进来：</p>
                  <pre>cd web &amp;&amp; npm install &amp;&amp; npm run build</pre>
                  <p>然后重新打包服务端（或直接用 <code>--static-dir web/dist</code> 指向构建产物）。</p>
                  <p>同时可以先确认接口：<a href="/api/health">/api/health</a></p>
                </div></body></html>
                """;
        return new Response(200, "text/html; charset=utf-8", html.getBytes(StandardCharsets.UTF_8),
                null, "no-cache", false);
    }

    public static Map<String, String> headersFor(Response response) {
        Map<String, String> headers = new LinkedHashMap<>();
        if (response.etag != null) {
            headers.put("ETag", response.etag);
        }
        headers.put("Cache-Control", response.cacheControl);
        if (response.gzip) {
            headers.put("Content-Encoding", "gzip");
            headers.put("Vary", "Accept-Encoding");
        }
        return headers;
    }
}
