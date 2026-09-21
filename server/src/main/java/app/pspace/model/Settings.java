package app.pspace.model;

import app.pspace.ApiException;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.time.Instant;
import java.util.List;

/** 全局设置：主题、主色、默认视图/排序/密度、演示视口。 */
public final class Settings {
    public static final List<String> THEMES = List.of(
            "minimal", "midnight", "glass", "terminal", "paper", "neon");
    public static final List<String> VIEWS = List.of("grid", "list", "timeline");
    public static final List<String> SORTS = List.of("manual", "updated", "created", "stars", "title");
    public static final List<String> DENSITIES = List.of("comfortable", "compact");
    public static final List<String> VIEWPORTS = List.of("desktop", "tablet", "phone");

    public String theme = "minimal";
    public String accent;
    public String view = "grid";
    public String sort = "manual";
    public String density = "comfortable";
    public String demoViewport = "desktop";
    public boolean showSnippets = true;
    public String updatedAt;

    public static Settings defaults() {
        Settings settings = new Settings();
        settings.updatedAt = Instant.now().toString();
        return settings;
    }

    /** 从持久化的 JSON 读取；缺字段用默认值补齐，不抛校验异常。 */
    public static Settings fromJson(JsonObject json) {
        Settings settings = defaults();
        if (json == null) {
            return settings;
        }
        settings.theme = text(json, "theme", settings.theme);
        settings.accent = text(json, "accent", settings.accent);
        settings.view = text(json, "view", settings.view);
        settings.sort = text(json, "sort", settings.sort);
        settings.density = text(json, "density", settings.density);
        settings.demoViewport = text(json, "demoViewport", settings.demoViewport);
        if (hasValue(json, "showSnippets")) {
            settings.showSnippets = json.get("showSnippets").getAsBoolean();
        }
        settings.updatedAt = text(json, "updatedAt", settings.updatedAt);
        return settings;
    }

    /** 局部更新：逐字段校验后返回新对象，任一字段非法即 400。 */
    public Settings apply(JsonObject patch) {
        Settings next = copy();
        if (patch != null) {
            if (hasValue(patch, "theme")) {
                next.theme = requireText(patch, "theme", "theme", 32);
            }
            if (patch.has("accent")) {
                next.accent = hasValue(patch, "accent")
                        ? requireText(patch, "accent", "accent", 16)
                        : null;
            }
            if (hasValue(patch, "view")) {
                next.view = requireText(patch, "view", "view", 16);
            }
            if (hasValue(patch, "sort")) {
                next.sort = requireText(patch, "sort", "sort", 16);
            }
            if (hasValue(patch, "density")) {
                next.density = requireText(patch, "density", "density", 16);
            }
            if (hasValue(patch, "demoViewport")) {
                next.demoViewport = requireText(patch, "demoViewport", "demoViewport", 16);
            }
            if (patch.has("showSnippets")) {
                if (!hasValue(patch, "showSnippets")) {
                    throw ApiException.validation("showSnippets 不能为 null");
                }
                JsonElement value = patch.get("showSnippets");
                if (!value.isJsonPrimitive() || !value.getAsJsonPrimitive().isBoolean()) {
                    throw ApiException.validation("showSnippets 必须是 true 或 false");
                }
                next.showSnippets = value.getAsBoolean();
            }
        }
        next.validate();
        next.updatedAt = Instant.now().toString();
        return next;
    }

    public void validate() {
        requireOneOf("theme", theme, THEMES);
        requireOneOf("view", view, VIEWS);
        requireOneOf("sort", sort, SORTS);
        requireOneOf("density", density, DENSITIES);
        requireOneOf("demoViewport", demoViewport, VIEWPORTS);
        if (accent != null && !accent.isEmpty() && !accent.matches("^#?[0-9a-fA-F]{6}$")) {
            throw ApiException.validation("accent 必须是 6 位十六进制颜色，例如 #7c5cff");
        }
    }

    private Settings copy() {
        Settings copy = new Settings();
        copy.theme = theme;
        copy.accent = accent;
        copy.view = view;
        copy.sort = sort;
        copy.density = density;
        copy.demoViewport = demoViewport;
        copy.showSnippets = showSnippets;
        copy.updatedAt = updatedAt;
        return copy;
    }

    private static void requireOneOf(String field, String value, List<String> allowed) {
        if (!allowed.contains(value)) {
            throw ApiException.validation(field + " 只能是 " + String.join(" / ", allowed) + " 之一");
        }
    }

    private static boolean hasValue(JsonObject json, String field) {
        JsonElement element = json.get(field);
        return element != null && !element.isJsonNull();
    }

    private static String text(JsonObject json, String field, String fallback) {
        JsonElement element = json.get(field);
        if (element == null || element.isJsonNull() || !element.isJsonPrimitive()) {
            return fallback;
        }
        return element.getAsString();
    }

    private static String requireText(JsonObject json, String field, String label, int maxLength) {
        JsonElement element = json.get(field);
        if (element == null || element.isJsonNull() || !element.isJsonPrimitive()
                || !element.getAsJsonPrimitive().isString()) {
            throw ApiException.validation(label + " 必须是字符串");
        }
        String value = element.getAsString().trim();
        if (value.isEmpty()) {
            throw ApiException.validation(label + " 不能为空");
        }
        if (value.length() > maxLength) {
            throw ApiException.validation(label + " 长度不能超过 " + maxLength + " 个字符");
        }
        return value;
    }
}
