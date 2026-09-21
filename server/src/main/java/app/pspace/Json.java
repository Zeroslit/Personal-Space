package app.pspace;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import java.nio.charset.StandardCharsets;

public final class Json {
    public static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();

    private Json() {
    }

    public static JsonObject parseObject(byte[] body) {
        if (body == null || body.length == 0) {
            throw ApiException.validation("请求体不能为空，需要 JSON 对象");
        }
        JsonElement parsed;
        try {
            parsed = JsonParser.parseString(new String(body, StandardCharsets.UTF_8));
        } catch (JsonSyntaxException | IllegalStateException e) {
            throw ApiException.validation("JSON 解析失败：" + e.getMessage());
        }
        if (!parsed.isJsonObject()) {
            throw ApiException.validation("请求体必须是 JSON 对象");
        }
        return parsed.getAsJsonObject();
    }

    public static JsonObject parseObjectOrEmpty(byte[] body) {
        if (body == null || body.length == 0) {
            return new JsonObject();
        }
        return parseObject(body);
    }

    public static String toJson(Object value) {
        return GSON.toJson(value);
    }
}
