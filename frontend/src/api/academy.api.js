// api/academy.api.js

import api from "./client"

// ── Cursos ───────────────────────────────────────────────────
export const getCourses = async (params = {}) => {
  const response = await api.get("/courses/", { params })
  return response.data
}

export const getCourse = async (slug) => {
  const response = await api.get(`/courses/${slug}/`)
  return response.data
}

export const enrollCourse = async (slug) => {
  const response = await api.post(`/courses/${slug}/enroll/`)
  return response.data
}

export const unenrollCourse = async (slug) => {
  await api.delete(`/courses/${slug}/unenroll/`)
}

// ── Inscripciones ────────────────────────────────────────────
export const getEnrollments = async () => {
  const response = await api.get("/enrollments/")
  return response.data
}

// ── Progreso ─────────────────────────────────────────────────
export const getCourseProgress = async (courseSlug) => {
  const response = await api.get("/progress/", {
    params: { course: courseSlug }
  })
  return response.data
}

export const markLessonComplete = async (lessonId, completed = true) => {
  const response = await api.post("/progress/", {
    lesson_id: lessonId,
    completed,
  })
  return response.data
}

export const purchaseCourse = async (slug) => {
  const response = await api.post(`/courses/${slug}/purchase/`)
  return response.data
}