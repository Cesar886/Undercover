export function Navbar() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 h-12 bg-white/90 backdrop-blur-md border-b border-gray-200">
      <div className="max-w-[600px] mx-auto px-4 flex items-center h-full">
        <span className="font-bold text-lg">
          <span className="bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
            Quemados
          </span>
          <span className="text-gray-900">UM</span>
        </span>
      </div>
    </nav>
  );
}
