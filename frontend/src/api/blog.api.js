import api from "./client"

export const getArticles = (params) =>
  api.get("/blog/articles/", { params }).then(r => r.data)

export const getArticle = (slug) =>
  api.get(`/blog/articles/${slug}/`).then(r => r.data)
