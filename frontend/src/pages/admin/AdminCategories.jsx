// pages/admin/AdminCategories.jsx
// Drag & drop nativo (sin librerías) para reordenar categorías padre e hijas.
// Al soltar, guarda el nuevo orden en el backend (campo "order") automáticamente.

import { useState, useRef, useCallback } from "react"
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import api from "../../api/client"

// ── API helpers ───────────────────────────────────────────────
const getCategories   = ()           => api.get("/admin/categories/").then(r => r.data)
const saveCategory    = (id, data)   => id
  ? api.patch(`/admin/categories/${id}/`, data).then(r => r.data)
  : api.post("/admin/categories/", data).then(r => r.data)
const deleteCategory  = (id)         => api.delete(`/admin/categories/${id}/`)
const reorderCategory = (id, order)  => api.patch(`/admin/categories/${id}/`, { order })

// ── Drag & Drop hook liviano ──────────────────────────────────
function useDragSort({ items, onReorder }) {
  const dragIdx  = useRef(null)
  const overIdx  = useRef(null)

  const onDragStart = useCallback((i) => () => { dragIdx.current = i }, [])
  const onDragOver  = useCallback((i) => (e) => {
    e.preventDefault()
    overIdx.current = i
  }, [])
  const onDrop = useCallback(() => {
    const from = dragIdx.current
    const to   = overIdx.current
    if (from === null || to === null || from === to) return
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    onReorder(next)
    dragIdx.current  = null
    overIdx.current  = null
  }, [items, onReorder])
  const onDragEnd = useCallback(() => {
    dragIdx.current  = null
    overIdx.current  = null
  }, [])

  return { onDragStart, onDragOver, onDrop, onDragEnd }
}

// ── Modal crear / editar ──────────────────────────────────────
function CategoryModal({ category, roots, onClose, onSave }) {
  const [form, setForm] = useState({
    name:        category?.name        || "",
    description: category?.description || "",
    is_active:   category?.is_active   ?? true,
    parent:      category?.parent      || "",
  })
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState("")

  const handleSave = async () => {
    if (!form.name.trim()) { setError("El nombre es requerido."); return }
    setSaving(true); setError("")
    try {
      await saveCategory(category?.id, { ...form, parent: form.parent || null })
      onSave()
    } catch (e) {
      setError(e?.response?.data?.name?.[0] || "Error al guardar.")
    } finally { setSaving(false) }
  }

  const inputSt = {
    width:"100%", padding:"10px 14px",
    background:"var(--surface-2)", border:"1px solid var(--border)",
    borderRadius:"var(--r-md)", color:"var(--text)", fontSize:"13px", outline:"none",
  }

  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.75)",
      backdropFilter:"blur(8px)", zIndex:200,
      display:"flex", alignItems:"center", justifyContent:"center", padding:"24px" }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
        borderRadius:"var(--r-2xl)", width:"100%", maxWidth:"440px",
        animation:"scaleIn 200ms var(--ease)" }}>

        {/* Header */}
        <div style={{ padding:"20px 24px", borderBottom:"1px solid var(--border)",
          display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <p style={{ fontSize:"15px", fontWeight:500 }}>
            {category?.id ? "Editar categoría" : "Nueva categoría"}
          </p>
          <button onClick={onClose} style={{ background:"none", border:"none",
            cursor:"pointer", color:"var(--text-3)", fontSize:"22px" }}>×</button>
        </div>

        {/* Body */}
        <div style={{ padding:"24px", display:"flex", flexDirection:"column", gap:"14px" }}>
          {error && (
            <div style={{ padding:"10px 14px", borderRadius:"var(--r-md)",
              background:"rgba(255,77,77,0.08)", border:"1px solid rgba(255,77,77,0.2)",
              color:"var(--danger)", fontSize:"13px" }}>{error}</div>
          )}

          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:500,
              color:"var(--text-2)", marginBottom:"7px" }}>Nombre *</label>
            <input value={form.name}
              onChange={e => setForm(f => ({ ...f, name:e.target.value }))}
              style={inputSt} placeholder="Nombre de la categoría"
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e  => e.target.style.borderColor = "var(--border)"} />
          </div>

          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:500,
              color:"var(--text-2)", marginBottom:"7px" }}>Descripción</label>
            <input value={form.description}
              onChange={e => setForm(f => ({ ...f, description:e.target.value }))}
              style={inputSt} placeholder="Descripción opcional"
              onFocus={e => e.target.style.borderColor = "rgba(26,255,110,0.4)"}
              onBlur={e  => e.target.style.borderColor = "var(--border)"} />
          </div>

          <div>
            <label style={{ display:"block", fontSize:"12px", fontWeight:500,
              color:"var(--text-2)", marginBottom:"7px" }}>
              Categoría padre (opcional)
            </label>
            <select value={form.parent}
              onChange={e => setForm(f => ({ ...f, parent:e.target.value }))}
              style={inputSt}>
              <option value="">Sin padre (categoría raíz)</option>
              {roots
                .filter(c => c.id !== category?.id)
                .map(c => <option key={c.id} value={c.id}>{c.name}</option>)
              }
            </select>
            <p style={{ fontSize:"11px", color:"var(--text-3)", marginTop:"5px" }}>
              El orden se ajusta arrastrando desde la lista principal.
            </p>
          </div>

          <label style={{ display:"flex", alignItems:"center", gap:"8px",
            cursor:"pointer", fontSize:"13px" }}>
            <input type="checkbox" checked={form.is_active}
              onChange={e => setForm(f => ({ ...f, is_active:e.target.checked }))}
              style={{ accentColor:"var(--accent)" }} />
            Categoría activa
          </label>
        </div>

        {/* Footer */}
        <div style={{ padding:"16px 24px", borderTop:"1px solid var(--border)",
          display:"flex", gap:"10px", justifyContent:"flex-end" }}>
          <button onClick={onClose} className="btn btn-ghost"
            style={{ padding:"9px 18px", fontSize:"13px" }}>Cancelar</button>
          <button onClick={handleSave} disabled={saving} className="btn btn-accent"
            style={{ padding:"9px 18px", fontSize:"13px", opacity:saving?0.7:1 }}>
            {saving ? "Guardando..." : "Guardar"}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Fila draggable ────────────────────────────────────────────
function DraggableRow({ cat, isChild, onEdit, onDelete,
  onDragStart, onDragOver, onDrop, onDragEnd, isDragging }) {

  const [hover, setHover] = useState(false)

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        display:     "grid",
        gridTemplateColumns: "28px 2.5fr 1.5fr 1fr 80px",
        padding:     isChild ? "11px 20px 11px 36px" : "13px 20px",
        alignItems:  "center",
        gap:         "8px",
        borderTop:   "1px solid var(--border)",
        background:  isDragging ? "rgba(26,255,110,0.04)"
          : hover ? "var(--surface-2)" : isChild ? "var(--bg)" : "transparent",
        cursor:      "grab",
        transition:  "background var(--dur) var(--ease)",
        opacity:     isDragging ? 0.5 : 1,
        userSelect:  "none",
      }}>

      {/* Handle */}
      <span style={{ fontSize:"14px", color:"var(--text-3)", opacity:0.4,
        cursor:"grab", textAlign:"center" }}>
        ⠿
      </span>

      {/* Nombre */}
      <div style={{ display:"flex", alignItems:"center", gap:"8px" }}>
        {isChild && (
          <span style={{ fontSize:"12px", color:"var(--text-3)", flexShrink:0 }}>└</span>
        )}
        <div>
          <p style={{ fontSize:"13px", fontWeight: isChild ? 400 : 500 }}>
            {cat.name}
          </p>
          {cat.slug && (
            <p style={{ fontSize:"11px", color:"var(--text-3)",
              fontFamily:"monospace" }}>{cat.slug}</p>
          )}
        </div>
      </div>

      {/* Tipo */}
      <span style={{ fontSize:"12px", color:"var(--text-3)" }}>
        {isChild ? "Subcategoría" : "Raíz"}
      </span>

      {/* Estado */}
      <span style={{ padding:"2px 8px", borderRadius:"var(--r-full)",
        fontSize:"11px", fontWeight:500, display:"inline-block",
        color:      cat.is_active ? "var(--accent)" : "var(--text-3)",
        background: cat.is_active ? "var(--accent-dim)" : "var(--surface-2)",
        border:     `1px solid ${cat.is_active ? "var(--accent-glow)" : "var(--border)"}` }}>
        {cat.is_active ? "Activa" : "Inactiva"}
      </span>

      {/* Acciones */}
      <div style={{ display:"flex", gap:"6px" }}>
        <button onClick={e => { e.stopPropagation(); onEdit(cat) }}
          style={{ padding:"4px 8px", borderRadius:"var(--r-sm)", fontSize:"11px",
            cursor:"pointer", color:"#60a5fa",
            background:"rgba(96,165,250,0.1)", border:"1px solid rgba(96,165,250,0.2)" }}>
          ✎
        </button>
        <button onClick={e => { e.stopPropagation(); onDelete(cat) }}
          style={{ padding:"4px 8px", borderRadius:"var(--r-sm)", fontSize:"11px",
            cursor:"pointer", color:"#f87171",
            background:"rgba(248,113,113,0.1)", border:"1px solid rgba(248,113,113,0.2)" }}>
          ×
        </button>
      </div>
    </div>
  )
}

// ── Lista draggable de hijos ──────────────────────────────────
function ChildrenList({ children, parentId, onEdit, onDelete, onChildReorder }) {
  const [localChildren, setLocalChildren] = useState(children)
  const [draggingIdx, setDraggingIdx]     = useState(null)

  // Sync si cambian desde afuera
  useState(() => { setLocalChildren(children) }, [children])

  const { onDragStart, onDragOver, onDrop, onDragEnd } = useDragSort({
    items: localChildren,
    onReorder: (next) => {
      setLocalChildren(next)
      setDraggingIdx(null)
      onChildReorder(parentId, next)
    },
  })

  return (
    <>
      {localChildren.map((child, i) => (
        <DraggableRow key={child.id}
          cat={child}
          isChild
          isDragging={draggingIdx === i}
          onEdit={onEdit}
          onDelete={onDelete}
          onDragStart={() => { setDraggingIdx(i); onDragStart(i)() }}
          onDragOver={onDragOver(i)}
          onDrop={() => { onDrop(); setDraggingIdx(null) }}
          onDragEnd={() => { onDragEnd(); setDraggingIdx(null) }}
        />
      ))}
    </>
  )
}

// ── AdminCategories ───────────────────────────────────────────
export default function AdminCategories() {
  const [modal, setModal]           = useState(null)
  const [draggingIdx, setDraggingIdx] = useState(null)
  const [localRoots, setLocalRoots] = useState(null)
  const queryClient                 = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn:  getCategories,
    onSuccess: (d) => {
      if (!localRoots) {
        const cats  = d?.results || d || []
        const roots = cats.filter(c => !c.parent).sort((a,b) => (a.order||0)-(b.order||0))
        setLocalRoots(roots)
      }
    },
  })

  const allCats = data?.results || data || []
  const roots   = localRoots
    || allCats.filter(c => !c.parent).sort((a,b) => (a.order||0)-(b.order||0))
  const getChildren = (parentId) =>
    allCats
      .filter(c => c.parent === parentId || c.parent?.toString() === parentId?.toString())
      .sort((a,b) => (a.order||0)-(b.order||0))

  // Guardar nuevo orden en backend
  const saveOrder = useCallback(async (ordered) => {
    try {
      await Promise.all(
        ordered.map((cat, i) => reorderCategory(cat.id, i))
      )
      queryClient.invalidateQueries(["admin-categories"])
    } catch (e) {
      console.error("Error guardando orden:", e)
    }
  }, [queryClient])

  // Reordenar raíces
  const { onDragStart, onDragOver, onDrop, onDragEnd } = useDragSort({
    items: roots,
    onReorder: (next) => {
      setLocalRoots(next)
      setDraggingIdx(null)
      saveOrder(next)
    },
  })

  // Reordenar hijos de un padre
  const handleChildReorder = useCallback((parentId, nextChildren) => {
    saveOrder(nextChildren)
  }, [saveOrder])

  // Eliminar
  const deleteMutation = useMutation({
    mutationFn: (cat) => deleteCategory(cat.id),
    onSuccess:  () => {
      setLocalRoots(null)
      queryClient.invalidateQueries(["admin-categories"])
    },
  })

  const handleDelete = (cat) => {
    const hasChildren = getChildren(cat.id).length > 0
    const msg = hasChildren
      ? `¿Eliminar "${cat.name}" y sus ${getChildren(cat.id).length} subcategorías?`
      : `¿Eliminar "${cat.name}"?`
    if (window.confirm(msg)) deleteMutation.mutate(cat)
  }

  const handleSave = () => {
    setLocalRoots(null)
    queryClient.invalidateQueries(["admin-categories"])
    setModal(null)
  }

  return (
    <div style={{ padding:"clamp(24px, 4vw, 40px)" }}>

      {modal !== null && (
        <CategoryModal
          category={modal}
          roots={roots}
          onClose={() => setModal(null)}
          onSave={handleSave}
        />
      )}

      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between",
        alignItems:"flex-start", marginBottom:"28px", flexWrap:"wrap", gap:"16px" }}>
        <div>
          <h1 style={{ fontFamily:"var(--font-serif)",
            fontSize:"clamp(1.8rem, 3vw, 2.4rem)", fontWeight:300,
            letterSpacing:"-0.02em", marginBottom:"6px" }}>
            Categorías
          </h1>
          <p style={{ fontSize:"13px", color:"var(--text-3)" }}>
            {allCats.length} categorías · {roots.length} principales ·{" "}
            <span style={{ color:"var(--accent)" }}>
              arrastrá ⠿ para reordenar
            </span>
          </p>
        </div>
        <button onClick={() => setModal({})} className="btn btn-accent"
          style={{ padding:"10px 20px", fontSize:"13px" }}>
          + Nueva categoría
        </button>
      </div>

      {isLoading ? (
        <div style={{ display:"flex", flexDirection:"column", gap:"8px" }}>
          {[...Array(5)].map((_,i) =>
            <div key={i} className="skeleton" style={{ height:"52px" }} />
          )}
        </div>
      ) : roots.length === 0 ? (
        <div style={{ padding:"60px", textAlign:"center",
          background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-2xl)", color:"var(--text-3)" }}>
          <p style={{ fontSize:"36px", marginBottom:"12px" }}>🗂</p>
          <p style={{ fontSize:"14px" }}>No hay categorías todavía.</p>
        </div>
      ) : (
        <div style={{ background:"var(--surface)", border:"1px solid var(--border)",
          borderRadius:"var(--r-xl)", overflow:"hidden" }}>

          {/* Header tabla */}
          <div style={{ display:"grid",
            gridTemplateColumns:"28px 2.5fr 1.5fr 1fr 80px",
            padding:"10px 20px", borderBottom:"1px solid var(--border)",
            fontSize:"11px", fontWeight:500, color:"var(--text-3)",
            textTransform:"uppercase", letterSpacing:"0.08em" }}>
            <span />
            <span>Nombre</span>
            <span>Tipo</span>
            <span>Estado</span>
            <span />
          </div>

          {/* Raíces draggables + sus hijos */}
          {roots.map((cat, i) => {
            const children = getChildren(cat.id)
            return (
              <div key={cat.id}>
                <DraggableRow
                  cat={cat}
                  isChild={false}
                  isDragging={draggingIdx === i}
                  onEdit={() => setModal(cat)}
                  onDelete={handleDelete}
                  onDragStart={() => { setDraggingIdx(i); onDragStart(i)() }}
                  onDragOver={onDragOver(i)}
                  onDrop={() => { onDrop(); setDraggingIdx(null) }}
                  onDragEnd={() => { onDragEnd(); setDraggingIdx(null) }}
                />
                {children.length > 0 && (
                  <ChildrenList
                    children={children}
                    parentId={cat.id}
                    onEdit={() => setModal(cat)}
                    onDelete={handleDelete}
                    onChildReorder={handleChildReorder}
                  />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Instrucción drag */}
      <div style={{ marginTop:"16px", padding:"12px 16px",
        borderRadius:"var(--r-lg)", background:"var(--surface-2)",
        border:"1px solid var(--border)",
        display:"flex", alignItems:"center", gap:"10px" }}>
        <span style={{ fontSize:"18px" }}>⠿</span>
        <div>
          <p style={{ fontSize:"13px", fontWeight:500, marginBottom:"2px" }}>
            Drag & drop para reordenar
          </p>
          <p style={{ fontSize:"12px", color:"var(--text-3)" }}>
            Arrastrá cualquier fila para cambiar el orden. Las raíces se reordenan entre sí
            y las subcategorías dentro de su padre. El orden se guarda automáticamente.
          </p>
        </div>
      </div>
    </div>
  )
}
