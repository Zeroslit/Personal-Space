package app.pspace;

import app.pspace.web.Router;
import app.pspace.web.StaticFiles;
import com.sun.net.httpserver.HttpServer;
import java.net.InetSocketAddress;
import java.nio.file.Path;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public final class Main {

    public static void main(String[] args) {
        Options options;
        try {
            options = Options.parse(args);
        } catch (IllegalArgumentException e) {
            System.err.println("[" + Version.NAME + "] 参数错误：" + e.getMessage());
            System.exit(2);
            return;
        }
        if (options.showHelp) {
            Options.printUsage(System.out);
            return;
        }

        try {
            Path dbPath = options.dbFile.toAbsolutePath();
            Db db = Db.open(dbPath);
            Store store = new Store(db);
            int seeded = Seed.importIfEmpty(db, store);

            StaticFiles staticFiles = StaticFiles.create(options.staticDir);
            long startedAt = System.currentTimeMillis();

            HttpServer server = HttpServer.create(new InetSocketAddress(options.host, options.port), 0);
            ExecutorService pool = Executors.newFixedThreadPool(
                    Math.max(4, Runtime.getRuntime().availableProcessors() * 2));
            server.setExecutor(pool);
            server.createContext("/", new Router(store, staticFiles, startedAt, dbPath));
            server.start();

            banner(options, server, dbPath, staticFiles, seeded);

            Runtime.getRuntime().addShutdownHook(new Thread(() -> {
                System.out.println();
                System.out.println("[" + Version.NAME + "] 正在关闭…");
                server.stop(0);
                pool.shutdown();
            }));
        } catch (Exception e) {
            System.err.println("[" + Version.NAME + "] 启动失败：" + e.getMessage());
            e.printStackTrace(System.err);
            System.exit(1);
        }
    }

    private static void banner(Options options, HttpServer server, Path dbPath, StaticFiles staticFiles, int seeded) {
        String name = "[" + Version.NAME + "]";
        System.out.println(name + " v" + Version.VERSION + " 已启动");
        System.out.println(name + " 地址: http://" + displayHost(options.host) + ":" + server.getAddress().getPort());
        System.out.println(name + " 数据库: " + dbPath);
        System.out.println(name + " 前端资源: " + staticFiles.describe());
        if (seeded > 0) {
            System.out.println(name + " 已导入种子数据 " + seeded + " 条");
        }
        System.out.println(name + " 按 Ctrl+C 停止");
    }

    private static String displayHost(String host) {
        return host.equals("0.0.0.0") || host.equals("::") ? "127.0.0.1" : host;
    }
}
