import { apiRequest } from "@/utils/apiRequest";
import { articlesRoutes } from "@/utils/routes";

const ArticleService = {
  editArticle: (data: any, articleId: string) => {
    return apiRequest({ url: articlesRoutes.editArticle(articleId), method: "PUT", data });
  },
  createArticle: (data: any) => {
    return apiRequest({ url: articlesRoutes.createArticle, method: "POST", data });
  },
  fetchArticle: (articleId: string) => {
    return apiRequest({ url: articlesRoutes.fetchArticle(articleId), method: "GET" });
  },
  delete: (articleId: string) => {
    return apiRequest({ url: articlesRoutes.delete(articleId), method: "DELETE" });
  },
  fetchArticles: (page: any, per_page: any, search: any) => {
    return apiRequest({ url: articlesRoutes.fetchArticles(page, per_page, search), method: "GET" });
  },
};

export default ArticleService;
