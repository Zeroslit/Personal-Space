package app.pspace.model;

import app.pspace.ApiException;
import app.pspace.Validate;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import java.util.ArrayList;
import java.util.List;

/** POST / PUT 的入参，构造即完成全部校验。 */
public final class ProjectInput {
    public String id;
    public String title;
    public String summary = "";
    public String repoUrl;
    public String siteUrl;
    public String cover = "";
    public List<String> tags = new ArrayList<>();
    public String language = "";
    public String status = "active";
    public int stars;
    public boolean pinned;
    public boolean demoLogin;
    public Integer ord;
    public List<SnippetInput> snippets = new ArrayList<>();

    public static ProjectInput parse(JsonObject body) {
        ProjectInput input = new ProjectInput();
        if (body.has("id") && !body.get("id").isJsonNull()) {
            input.id = Validate.id(body.get("id").getAsString(), "id");
        }
        input.title = Validate.requireString(body, "title", "title", 120);
        String summary = Validate.optionalString(body, "summary", "summary", 500);
        input.summary = summary == null ? "" : summary;
        input.repoUrl = Validate.requireUrl(body, "repoUrl", "repoUrl（GitHub 仓库）");
        input.siteUrl = Validate.url(body, "siteUrl", "siteUrl（演示网址）");
        String cover = Validate.optionalString(body, "cover", "cover", 2048);
        input.cover = cover == null ? "" : cover;
        String language = Validate.optionalString(body, "language", "language", 40);
        input.language = language == null ? "" : language;
        input.status = Validate.status(body, "active");
        input.stars = Validate.intValue(body, "stars", "stars", 0, 0, 1_000_000);
        input.pinned = Validate.boolValue(body, "pinned", "pinned", false);
        input.demoLogin = Validate.boolValue(body, "demoLogin", "demoLogin", false);
        if (body.has("ord") && !body.get("ord").isJsonNull()) {
            input.ord = Validate.intValue(body, "ord", "ord", 0, 0, 1_000_000);
        }
        input.tags = Validate.tags(body);
        input.snippets = parseSnippets(body);
        return input;
    }

    private static List<SnippetInput> parseSnippets(JsonObject body) {
        JsonElement element = body.get("snippets");
        if (element == null || element.isJsonNull()) {
            return List.of();
        }
        if (!element.isJsonArray()) {
            throw ApiException.validation("snippets 必须是数组");
        }
        JsonArray array = element.getAsJsonArray();
        if (array.size() > 30) {
            throw ApiException.validation("每个项目最多 30 段代码");
        }
        List<SnippetInput> snippets = new ArrayList<>();
        for (int index = 0; index < array.size(); index++) {
            JsonElement item = array.get(index);
            if (!item.isJsonObject()) {
                throw ApiException.validation("snippets[" + index + "] 必须是对象");
            }
            snippets.add(SnippetInput.parse(item.getAsJsonObject(), index));
        }
        return snippets;
    }
}
