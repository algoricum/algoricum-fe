interface LoadingSpinnerProps {
  message?: string;
  size?: "sm" | "md" | "lg";
}

export function LoadingSpinner({ message = "Loading...", size = "md" }: LoadingSpinnerProps) {
  const sizeClasses = {
    sm: "w-6 h-6",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const containerSizeClasses = {
    sm: "p-4",
    md: "p-8",
    lg: "p-12",
  };

  return (
    <div className={`flex flex-col items-center justify-center ${containerSizeClasses[size]}`}>
      {/* Main Spinner */}
      <div className="relative">
        {/* Outer ring */}
        <div className={`${sizeClasses[size]} border-4 border-purple-100 rounded-full animate-spin`}>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-purple-600 rounded-full animate-spin"></div>
        </div>

        {/* Inner pulsing dot */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
          <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse"></div>
        </div>
      </div>

      {/* Loading text with animation */}
      <div className="mt-4 text-center">
        <p className="text-gray-600 font-medium animate-pulse">{message}</p>
        <div className="flex justify-center mt-2 space-x-1">
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }}></div>
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }}></div>
          <div className="w-2 h-2 bg-purple-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }}></div>
        </div>
      </div>
    </div>
  );
}
