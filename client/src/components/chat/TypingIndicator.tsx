interface TypingIndicatorProps {
  typingUsers: Array<{ userId: string; username: string }>;
}

export function TypingIndicator({ typingUsers }: TypingIndicatorProps) {
  if (typingUsers.length === 0) return null;

  const text = (() => {
    if (typingUsers.length === 1) {
      return (
        <>
          <strong>{typingUsers[0].username}</strong> is typing
        </>
      );
    }
    if (typingUsers.length === 2) {
      return (
        <>
          <strong>{typingUsers[0].username}</strong> and{' '}
          <strong>{typingUsers[1].username}</strong> are typing
        </>
      );
    }
    return <>Several people are typing</>;
  })();

  return (
    <div className="absolute bottom-0 left-4 right-4 flex items-center gap-1.5 pb-0.5 text-xs text-[#dcddde]">
      {/* Animated dots */}
      <span className="flex gap-0.5">
        <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-white [animation-delay:0ms]" />
        <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-white [animation-delay:150ms]" />
        <span className="inline-block h-1 w-1 animate-bounce rounded-full bg-white [animation-delay:300ms]" />
      </span>
      <span>{text}</span>
    </div>
  );
}
