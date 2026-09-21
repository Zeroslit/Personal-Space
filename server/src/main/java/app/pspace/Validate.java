package app.pspace;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/** 入参校验工具：任何不合法输入都以 400 validation_error 抛出。 */
public final class Validate {
    public static final List<String> STATUSES = List.of("active", "wip", "paused", "archived", "idea");
    private static final int MAX_TAGS = 12;
    private static final int MAX_TAG_LENGTH = 24;

    private Validate() {
    }

    public static String requireString(JsonObject body, String field, String label, int maxLength) {
        String value = optionalString(body, field, label, maxLength);
        if (value == null || value.isEmpty()) {
            throw ApiException.validation(label + " 不能为空");
        }
        return value;
    }

    /** 缺失返回 null；显式传 null / "" 返回 ""。 */
    public static String optionalString(JsonObject body, String field, String label, int maxLength) {
        JsonElement el = body.get(field);
        if (el == null || el.isJsonNull()) {
            return null;
        }
        if (!el.isJsonPrimitive() || !el.getAsJsonPrimitive().isString()) {
            throw ApiException.validation(label + " 必须是字符串");
        }
        String value = el.getAsString().trim();
        if (value.length() > maxLength) {
            throw ApiException.validation(label + " 长度不能超过 " + maxLength + " 个字符");
        }
        return value;
    }

    public static String url(JsonObject body, String field, String label) {
        String value = optionalString(body, field, label, 2048);
        if (value == null || value.isEmpty()) {
            return null;
        }
        URI uri;
        try {
            uri = new URI(value);
        } catch (URISyntaxException e) {
            throw ApiException.validation(label + " 不是合法的 URL：" + value);
        }
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase(Locale.ROOT);
        if (!scheme.equals("http") && !scheme.equals("https")) {
            throw ApiException.validation(label + " 必须以 http:// 或 https:// 开头");
        }
        if (uri.getHost() == null || uri.getHost().isEmpty()) {
            throw ApiException.validation(label + " 缺少主机名：" + value);
        }
        return value;
    }

    /** 与 optionalString 相同，但保留原始空白（代码片段必须原样保存）。 */
    public static String rawString(JsonObject body, String field, String label, int maxLength) {
        JsonElement el = body.get(field);
        if (el == null || el.isJsonNull()) {
            return null;
        }
        if (!el.isJsonPrimitive() || !el.getAsJsonPrimitive().isString()) {
            throw ApiException.validation(label + " 必须是字符串");
        }
        String value = el.getAsString();
        if (value.length() > maxLength) {
            throw ApiException.validation(label + " 长度不能超过 " + maxLength + " 个字符");
        }
        return value;
    }

    /** 必填 URL：为空即 400，格式要求与 url() 一致。 */
    public static String requireUrl(JsonObject body, String field, String label) {
        String value = url(body, field, label);
        if (value == null || value.isEmpty()) {
            throw ApiException.validation(label + " 不能为空");
        }
        return value;
    }

    public static String status(JsonObject body, String fallback) {
        String value = optionalString(body, "status", "status", 24);
        if (value == null || value.isEmpty()) {
            return fallback;
        }
        String normalized = value.toLowerCase(Locale.ROOT);
        if (!STATUSES.contains(normalized)) {
            throw ApiException.validation("status 只能是 " + String.join(" / ", STATUSES) + " 之一");
        }
        return normalized;
    }

    public static int intValue(JsonObject body, String field, String label, int fallback, int min, int max) {
        JsonElement el = body.get(field);
        if (el == null || el.isJsonNull()) {
            return fallback;
        }
        if (!el.isJsonPrimitive() || !el.getAsJsonPrimitive().isNumber()) {
            throw ApiException.validation(label + " 必须是数字");
        }
        double raw = el.getAsDouble();
        if (raw != Math.floor(raw)) {
            throw ApiException.validation(label + " 必须是整数");
        }
        int value = (int) raw;
        if (value < min || value > max) {
            throw ApiException.validation(label + " 必须在 " + min + " 到 " + max + " 之间");
        }
        return value;
    }

    public static boolean boolValue(JsonObject body, String field, String label, boolean fallback) {
        JsonElement el = body.get(field);
        if (el == null || el.isJsonNull()) {
            return fallback;
        }
        if (!el.isJsonPrimitive() || !el.getAsJsonPrimitive().isBoolean()) {
            throw ApiException.validation(label + " 必须是 true 或 false");
        }
        return el.getAsBoolean();
    }

    public static List<String> tags(JsonObject body) {
        JsonElement el = body.get("tags");
        if (el == null || el.isJsonNull()) {
            return List.of();
        }
        if (!el.isJsonArray()) {
            throw ApiException.validation("tags 必须是字符串数组");
        }
        JsonArray array = el.getAsJsonArray();
        Set<String> unique = new LinkedHashSet<>();
        for (JsonElement item : array) {
            if (item.isJsonNull() || !item.isJsonPrimitive() || !item.getAsJsonPrimitive().isString()) {
                throw ApiException.validation("tags 的每一项都必须是字符串");
            }
            String tag = item.getAsString().trim();
            if (tag.isEmpty()) {
                continue;
            }
            if (tag.length() > MAX_TAG_LENGTH) {
                throw ApiException.validation("标签 " + tag + " 超过 " + MAX_TAG_LENGTH + " 个字符");
            }
            unique.add(tag);
        }
        if (unique.size() > MAX_TAGS) {
            throw ApiException.validation("标签最多 " + MAX_TAGS + " 个");
        }
        return new ArrayList<>(unique);
    }

    public static String id(String raw, String label) {
        if (raw == null || raw.isEmpty()) {
            throw ApiException.validation(label + " 不能为空");
        }
        if (!raw.matches("^[A-Za-z0-9_-]{1,64}$")) {
            throw ApiException.validation(label + " 只能包含字母、数字、下划线和连字符，长度 1-64");
        }
        return raw;
    }
}
