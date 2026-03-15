interface CustomEmojiProps {
  name: string;
  imageUrl: string;
  animated?: boolean;
  jumbo?: boolean;
}

export function CustomEmoji({ name, imageUrl, animated, jumbo }: CustomEmojiProps) {
  const size = jumbo ? 48 : 22;

  return (
    <img
      src={imageUrl}
      alt={`:${name}:`}
      title={`:${name}:`}
      width={size}
      height={size}
      className={`inline-block align-middle ${jumbo ? 'h-12 w-12' : 'h-[22px] w-[22px]'} object-contain`}
      draggable={false}
      loading="lazy"
    />
  );
}
