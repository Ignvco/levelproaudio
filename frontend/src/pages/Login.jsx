export default function Login() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg w-96">
        <h1 className="text-white text-2xl mb-6">Login</h1>

        <input
          type="email"
          placeholder="Email"
          className="w-full mb-4 p-2 rounded"
        />

        <input
          type="password"
          placeholder="Password"
          className="w-full mb-4 p-2 rounded"
        />

        <button className="bg-blue-500 w-full p-2 rounded text-white">
          Entrar
        </button>
      </div>
    </div>
  )
}