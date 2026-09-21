package app.pspace.model;

import app.pspace.Validate;
import com.google.gson.JsonObject;
import java.util.Locale;

public final class SnippetInput {
    public String id;
    public String filename = "";
    public String language = "plaintext";
    public String code = "";
    public int ord;

    public static SnippetInput parse(JsonObject body, int index) {
        String label = "snippets[" + index + "]";
        SnippetInput input = new SnippetInput();
        if (body.has("id") && !body.get("id").isJsonNull()) {
            input.id = Validate.id(body.get("id").getAsString(), label + ".id");
        }
        String filename = Validate.optionalString(body, "filename", label + ".filename", 120);
        input.filename = filename == null ? "" : filename;
        String language = Validate.optionalString(body, "language", label + ".language", 40);
        input.language = language == null || language.isEmpty()
                ? "plaintext"
                : language.toLowerCase(Locale.ROOT);
        String code = Validate.rawString(body, "code", label + ".code", 20000);
        input.code = code == null ? "" : code;
        input.ord = Validate.intValue(body, "ord", label + ".ord", index, 0, 100_000);
        return input;
    }
}
