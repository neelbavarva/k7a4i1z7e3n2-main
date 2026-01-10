import Image from 'next/image';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Image
        src="/icons/meme.jpg"
        alt="404 - Page not found"
        width={400}
        height={300}
        className="w-[90%] max-w-[400px] h-auto"
      />
    </div>
  );
}
