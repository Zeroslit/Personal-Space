package app.pspace;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import java.io.IOException;
import java.net.URI;
import java.net.URISyntaxException;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/**
 * 读取 GitHub 仓库元信息（描述、主页、语言、Star 数等），支撑「粘贴 GitHub 地址自动填充简介」。
 * 结果内存缓存 10 分钟；设置 PSPACE_GITHUB_TOKEN / GITHUB_TOKEN 可提高匿名速率上限。
 */
public final class GitHub {
    private static final Duration TTL = Duration.ofMinutes(10);
    private static final int MAX_CACHE = 256;
    private static final String API = "https://api.github.com/repos/";
    private static final HttpClient CLIENT = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(5))
            .followRedirects(HttpClient.Redirect.NORMAL)
            .build();
    private static final Map<String, Cached> CACHE = new ConcurrentHashMap<>();
    private static final String TOKEN = resolveToken();

    private record Cached(JsonObject payload, Instant storedAt) {
    }

    public record Repo(String owner, String name) {
        public String fullName() {
            return owner + "/" + name;
        }
    }

    private GitHub() {
    }

    /** 取仓库信息；非 github.com 链接直接 400，GitHub 侧错误映射成对应的 API 错误。 */
    public static JsonObject repo(String rawUrl) {
        Repo repo = parse(rawUrl).orElseThrow(() -> ApiException.validation(
                "只支持 github.com 的仓库地址，例如 https://github.com/owner/repo，收到：" + rawUrl));
        String key = repo.fullName().toLowerCase(Locale.ROOT);
        Cached cached = CACHE.get(key);
        if (cached != null && Duration.between(cached.storedAt(), Instant.now()).compareTo(TTL) < 0) {
            return cached.payload();
        }
        JsonObject payload = fetch(repo);
        if (CACHE.size() >= MAX_CACHE) {
            CACHE.clear();
        }
        CACHE.put(key, new Cached(payload, Instant.now()));
        return payload;
    }

    /** 从各种 GitHub 链接里取出 owner/name：兼容 www、.git 后缀与 /tree/main 之类的多余路径。 */
    public static Optional<Repo> parse(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank()) {
            return Optional.empty();
        }
        URI uri;
        try {
            uri = new URI(rawUrl.trim());
        } catch (URISyntaxException e) {
            return Optional.empty();
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            return Optional.empty();
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase(Locale.ROOT);
        if (!host.equals("github.com") && !host.equals("www.github.com")) {
            return Optional.empty();
        }
        String owner = null;
        String name = null;
        String path = uri.getPath() == null ? "" : uri.getPath();
        for (String segment : path.split("/")) {
            if (segment.isBlank()) {
                continue;
            }
            if (owner == null) {
                owner = segment;
            } else if (name == null) {
                name = segment;
            }
        }
        if (owner == null || name == null) {
            return Optional.empty();
        }
        if (name.endsWith(".git")) {
            name = name.substring(0, name.length() - 4);
        }
        if (owner.isEmpty() || name.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new Repo(owner, name));
    }

    private static JsonObject fetch(Repo repo) {
        HttpResponse<String> response = send(build(repo));
        int status = response.statusCode();
        if (status == 404) {
            throw ApiException.notFound("GitHub 上找不到 " + repo.fullName() + "（可能是私有仓库或名字写错了）");
        }
        if (status == 403 || status == 429) {
            throw new ApiException(429, "rate_limited",
                    "GitHub 接口触发速率限制，稍后再试；也可以在启动服务前设置 PSPACE_GITHUB_TOKEN 提高上限");
        }
        if (status != 200) {
            throw new ApiException(502, "upstream_error", "GitHub 返回 " + status + "：" + snippet(response.body()));
        }
        return normalize(repo, response.body());
    }

    private static HttpRequest build(Repo repo) {
        HttpRequest.Builder builder = HttpRequest.newBuilder(URI.create(API + repo.owner() + "/" + repo.name()))
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "personal-space/" + Version.VERSION)
                .header("X-GitHub-Api-Version", "2022-11-28")
                .timeout(Duration.ofSeconds(12))
                .GET();
        if (TOKEN != null) {
            builder.header("Authorization", "Bearer " + TOKEN);
        }
        return builder.build();
    }

    /** 国内直连 api.github.com 常被重置，先重试一次再报错，避免偶发失败白白打断填写。 */
    private static HttpResponse<String> send(HttpRequest request) {
        IOException last = null;
        for (int attempt = 0; attempt < 2; attempt++) {
            if (attempt > 0) {
                try {
                    Thread.sleep(300L);
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    throw new ApiException(502, "upstream_error", "读取 GitHub 信息被中断");
                }
            }
            try {
                return CLIENT.send(request, HttpResponse.BodyHandlers.ofString(StandardCharsets.UTF_8));
            } catch (IOException e) {
                last = e;
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw new ApiException(502, "upstream_error", "读取 GitHub 信息被中断");
            }
        }
        throw new ApiException(502, "upstream_error", "连不上 GitHub（网络不可用或被拦截）：" + last.getMessage());
    }

    private static JsonObject normalize(Repo repo, String body) {
        JsonElement parsed;
        try {
            parsed = JsonParser.parseString(body);
        } catch (RuntimeException e) {
            throw new ApiException(502, "upstream_error", "GitHub 返回的内容不是合法 JSON");
        }
        if (!parsed.isJsonObject()) {
            throw new ApiException(502, "upstream_error", "GitHub 返回的内容不是 JSON 对象");
        }
        JsonObject json = parsed.getAsJsonObject();
        String description = text(json, "description");
        JsonObject out = new JsonObject();
        out.addProperty("owner", repo.owner());
        out.addProperty("name", repo.name());
        out.addProperty("fullName", repo.fullName());
        out.addProperty("htmlUrl", text(json, "html_url"));
        out.addProperty("description", description);
        out.addProperty("summarySuggestion", description);
        out.addProperty("homepage", text(json, "homepage"));
        out.addProperty("language", text(json, "language"));
        out.addProperty("defaultBranch", text(json, "default_branch"));
        out.addProperty("license", license(json));
        out.addProperty("pushedAt", text(json, "pushed_at"));
        out.addProperty("archived", bool(json, "archived"));
        out.addProperty("stars", number(json, "stargazers_count"));
        out.addProperty("forks", number(json, "forks_count"));
        out.addProperty("openIssues", number(json, "open_issues_count"));
        JsonArray topics = new JsonArray();
        if (json.has("topics") && json.get("topics").isJsonArray()) {
            for (JsonElement topic : json.getAsJsonArray("topics")) {
                if (topic.isJsonPrimitive()) {
                    topics.add(topic.getAsString());
                }
            }
        }
        out.add("topics", topics);
        out.addProperty("fetchedAt", Instant.now().toString());
        return out;
    }

    private static String text(JsonObject json, String field) {
        JsonElement element = json.get(field);
        if (element == null || element.isJsonNull() || !element.isJsonPrimitive()) {
            return null;
        }
        String value = element.getAsString().strip();
        return value.isEmpty() ? null : value;
    }

    private static boolean bool(JsonObject json, String field) {
        JsonElement element = json.get(field);
        return element != null && element.isJsonPrimitive() && element.getAsJsonPrimitive().isBoolean()
                && element.getAsBoolean();
    }

    private static long number(JsonObject json, String field) {
        JsonElement element = json.get(field);
        if (element == null || !element.isJsonPrimitive() || !element.getAsJsonPrimitive().isNumber()) {
            return 0L;
        }
        return element.getAsLong();
    }

    private static String license(JsonObject json) {
        JsonElement element = json.get("license");
        if (element == null || !element.isJsonObject()) {
            return null;
        }
        return text(element.getAsJsonObject(), "spdx_id");
    }

    private static String snippet(String body) {
        if (body == null) {
            return "";
        }
        String flat = body.strip().replaceAll("\\s+", " ");
        return flat.length() > 160 ? flat.substring(0, 160) + "…" : flat;
    }

    /** 只接受纯 ASCII 的 token，避免环境变量里放了占位符或中文导致请求头非法。 */
    private static String resolveToken() {
        for (String name : new String[] {"PSPACE_GITHUB_TOKEN", "GITHUB_TOKEN"}) {
            String value = System.getenv(name);
            if (value == null) {
                continue;
            }
            String trimmed = value.trim();
            if (trimmed.isEmpty() || !trimmed.chars().allMatch(c -> c > 32 && c < 127)) {
                continue;
            }
            return trimmed;
        }
        return null;
    }
}
