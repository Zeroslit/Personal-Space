package app.pspace;

import app.pspace.model.ProjectInput;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonParser;
import com.google.gson.JsonSyntaxException;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/** 首次启动（projects 为空）时导入种子数据，走与 API 完全相同的校验路径。 */
public final class Seed {
    private Seed() {
    }

    public static int importIfEmpty(Db db, Store store) {
        try {
            if (db.count("projects") > 0) {
                return 0;
            }
        } catch (Exception e) {
            throw new IllegalStateException("检查数据库状态失败：" + e.getMessage(), e);
        }
        JsonArray items = load();
        int imported = 0;
        for (JsonElement item : items) {
            if (!item.isJsonObject()) {
                continue;
            }
            store.create(ProjectInput.parse(item.getAsJsonObject()));
            imported++;
        }
        return imported;
    }

    private static JsonArray load() {
        Path external = Path.of("seed", "projects.json");
        if (Files.isRegularFile(external)) {
            try {
                return parse(Files.readString(external, StandardCharsets.UTF_8), external.toAbsolutePath().toString());
            } catch (IOException e) {
                throw new IllegalStateException("读取种子文件失败：" + e.getMessage(), e);
            }
        }
        try (InputStream in = Seed.class.getResourceAsStream("/seed/projects.json")) {
            if (in == null) {
                return new JsonArray();
            }
            return parse(new String(in.readAllBytes(), StandardCharsets.UTF_8), "classpath:/seed/projects.json");
        } catch (IOException e) {
            throw new IllegalStateException("读取内置种子数据失败：" + e.getMessage(), e);
        }
    }

    private static JsonArray parse(String text, String source) {
        try {
            JsonElement parsed = JsonParser.parseString(text);
            if (!parsed.isJsonArray()) {
                throw new IllegalStateException("种子数据必须是 JSON 数组：" + source);
            }
            return parsed.getAsJsonArray();
        } catch (JsonSyntaxException | IllegalStateException e) {
            throw new IllegalStateException("解析种子数据失败（" + source + "）：" + e.getMessage(), e);
        }
    }
}
