package app.pspace;

/** 统一的 API 错误：状态码 + 机器可读 error + 人类可读 message。 */
public class ApiException extends RuntimeException {
    public final int status;
    public final String error;

    public ApiException(int status, String error, String message) {
        super(message);
        this.status = status;
        this.error = error;
    }

    public static ApiException validation(String message) {
        return new ApiException(400, "validation_error", message);
    }

    public static ApiException notFound(String message) {
        return new ApiException(404, "not_found", message);
    }

    public static ApiException methodNotAllowed(String message) {
        return new ApiException(405, "method_not_allowed", message);
    }

    public static ApiException conflict(String message) {
        return new ApiException(409, "conflict", message);
    }

    public static ApiException payloadTooLarge(String message) {
        return new ApiException(413, "payload_too_large", message);
    }

    public static ApiException unsupportedMediaType(String message) {
        return new ApiException(415, "unsupported_media_type", message);
    }
}
