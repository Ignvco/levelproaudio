import api from "./client"

export const getFavorites    = () => api.get("/favorites/").then(r => r.data)
export const getFavoriteIds  = () => api.get("/favorites/ids/").then(r => r.data)
export const toggleFavorite  = (payload) => api.post("/favorites/toggle/", payload).then(r => r.data)
