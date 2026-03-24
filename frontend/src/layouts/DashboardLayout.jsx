export default function DashboardLayout({ children }) {
  return (
    <div className="flex">

      <aside className="w-64 bg-gray-900 min-h-screen text-white p-6">
        <h2 className="text-xl font-bold mb-6">LevelPro</h2>

        <ul className="space-y-3">
          <li>Dashboard</li>
          <li>Productos</li>
          <li>Pedidos</li>
        </ul>
      </aside>

      <main className="flex-1 p-8">
        {children}
      </main>

    </div>
  )
}