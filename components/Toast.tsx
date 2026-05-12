interface ToastProps {
  message: string | null;
}

export function Toast({ message }: ToastProps) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 -tranzinc-x-1/2 z-50 bg-zinc-800 text-white text-sm px-4 py-2 rounded-full shadow-lg animate-toast-in">
      {message}
    </div>
  );
}
