package app.pspace.model;

import java.util.ArrayList;
import java.util.List;

/** 对外输出的项目结构（同时是 GET /api/projects 的元素结构）。 */
public final class Project {
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
    /** 演示页需要登录（GitHub / Google 等），不允许内嵌，点击直接跳转。 */
    public boolean demoLogin;
    public int ord;
    public String createdAt;
    public String updatedAt;
    public List<Snippet> snippets = new ArrayList<>();

    /** 演示预览实际可用的地址：优先 siteUrl。 */
    public String demoUrl() {
        return siteUrl != null && !siteUrl.isEmpty() ? siteUrl : null;
    }
}
