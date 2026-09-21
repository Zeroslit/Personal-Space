package app.pspace.web;

import app.pspace.ApiException;
import app.pspace.Json;
import com.sun.net.httpserver.HttpExchange;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.URLDecoder;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;

public final class Http {
    public static final int DEFAULT_MAX_BODY = 8 * 1024 * 1024;

    private Http() {
    }

    public static byte[] readBody(HttpExchange exchange, int limit) throws IOException {
        String declared = exchange.getRequestHeaders().getFirst("Content-Length");
        if (declared != null) {
            try {
                if (Long.parseLong(declared.trim()) > limit) {
                    throw ApiException.payloadTooLarge("请求体过大，最多 " + (limit / 1024) + " KB");
                }
            } catch (NumberFormatException ignored) {
                // 交给下面的流式读取兜底
            }
        }
        try (InputStream in = exchange.getRequestBody();
             ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[16 * 1024];
            int total = 0;
            int read;
            while ((read = in.read(buffer)) != -1) {
                total += read;
                if (total > limit) {
                    throw ApiException.payloadTooLarge("请求体过大，最多 " + (limit / 1024) + " KB");
                }
                out.write(buffer, 0, read);
            }
            return out.toByteArray();
        }
    }

    public static void sendJson(HttpExchange exchange, int status, Object payload) throws IOException {
        byte[] body = Json.toJson(payload).getBytes(StandardCharsets.UTF_8);
        send(exchange, status, "application/json; charset=utf-8", body, null);
    }

    public static void sendError(HttpExchange exchange, ApiException error) throws IOException {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put("error", error.error);
        payload.put("message", error.getMessage() == null ? error.error : error.getMessage());
        sendJson(exchange, error.status, payload);
    }

    public static void send(HttpExchange exchange, int status, String contentType, byte[] body,
                            Map<String, String> headers) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        if (headers != null) {
            headers.forEach((key, value) -> exchange.getResponseHeaders().set(key, value));
        }
        if (status == 204 || status == 304) {
            exchange.sendResponseHeaders(status, -1);
            return;
        }
        exchange.sendResponseHeaders(status, body.length);
        try (OutputStream out = exchange.getResponseBody()) {
            out.write(body);
        }
    }

    public static void sendHeadersOnly(HttpExchange exchange, int status, String contentType,
                                       long contentLength, Map<String, String> headers) throws IOException {
        exchange.getResponseHeaders().set("Content-Type", contentType);
        exchange.getResponseHeaders().set("X-Content-Type-Options", "nosniff");
        if (headers != null) {
            headers.forEach((key, value) -> exchange.getResponseHeaders().set(key, value));
        }
        exchange.sendResponseHeaders(status, contentLength == 0 ? -1 : contentLength);
    }

    public static Map<String, String> query(HttpExchange exchange) {
        Map<String, String> params = new LinkedHashMap<>();
        String raw = exchange.getRequestURI().getRawQuery();
        if (raw == null || raw.isEmpty()) {
            return params;
        }
        for (String pair : raw.split("&")) {
            if (pair.isEmpty()) {
                continue;
            }
            int split = pair.indexOf('=');
            String key = split < 0 ? pair : pair.substring(0, split);
            String value = split < 0 ? "" : pair.substring(split + 1);
            String decodedKey = URLDecoder.decode(key, StandardCharsets.UTF_8);
            String decodedValue = URLDecoder.decode(value, StandardCharsets.UTF_8).trim();
            if (!decodedValue.isEmpty()) {
                params.put(decodedKey, decodedValue);
            }
        }
        return params;
    }

    public static String acceptGzip(HttpExchange exchange) {
        String header = exchange.getRequestHeaders().getFirst("Accept-Encoding");
        return header == null ? "" : header;
    }
}
