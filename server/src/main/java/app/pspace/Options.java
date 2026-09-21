package app.pspace;

import java.io.PrintStream;
import java.nio.file.Path;
import java.nio.file.Paths;

public final class Options {
    public String host = env("PSPACE_HOST", "127.0.0.1");
    public int port = parsePort(env("PSPACE_PORT", "8787"));
    public Path dbFile = Paths.get(env("PSPACE_DB", Paths.get("data", "personal-space.db").toString()));
    public Path staticDir = envStaticDir();
    public boolean showHelp;

    public static Options parse(String[] args) {
        Options options = new Options();
        for (int i = 0; i < args.length; i++) {
            String arg = args[i];
            switch (arg) {
                case "-h", "--help" -> options.showHelp = true;
                case "--host" -> options.host = next(args, ++i, arg);
                case "-p", "--port" -> options.port = parsePort(next(args, ++i, arg));
                case "--db" -> options.dbFile = Paths.get(next(args, ++i, arg));
                case "--static-dir" -> options.staticDir = Paths.get(next(args, ++i, arg));
                default -> throw new IllegalArgumentException("无法识别的参数：" + arg + "（用 --help 查看用法）");
            }
        }
        return options;
    }

    public static void printUsage(PrintStream out) {
        out.println("""
                personal-space - 单用户「个人空间」服务端

                用法:
                  java -jar personal-space.jar [选项]

                选项:
                  --host <addr>        监听地址，默认 127.0.0.1
                  -p, --port <port>    监听端口，默认 8787
                  --db <file>          数据库文件，默认 data/personal-space.db
                  --static-dir <dir>   从磁盘目录读取前端产物（开发用；默认读 jar 内置资源）
                  -h, --help           显示帮助

                环境变量: PSPACE_HOST / PSPACE_PORT / PSPACE_DB / PSPACE_STATIC_DIR
                          PSPACE_GITHUB_TOKEN 或 GITHUB_TOKEN：读取 GitHub 简介时提高速率上限（可选）
                """);
    }

    private static String next(String[] args, int index, String flag) {
        if (index >= args.length) {
            throw new IllegalArgumentException(flag + " 缺少取值");
        }
        return args[index];
    }

    private static int parsePort(String raw) {
        try {
            int port = Integer.parseInt(raw.trim());
            if (port < 0 || port > 65535) {
                throw new IllegalArgumentException("端口必须在 0-65535 之间，收到：" + raw);
            }
            return port;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("端口必须是数字，收到：" + raw);
        }
    }

    private static String env(String key, String fallback) {
        String value = System.getenv(key);
        return value == null || value.isBlank() ? fallback : value.trim();
    }

    private static Path envStaticDir() {
        String value = System.getenv("PSPACE_STATIC_DIR");
        return value == null || value.isBlank() ? null : Paths.get(value.trim());
    }
}
