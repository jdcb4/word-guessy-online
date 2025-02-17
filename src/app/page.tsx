import Link from 'next/link';
import { Button } from '@/components/Button';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      <h1 className="text-4xl font-bold mb-8">Word Guessy</h1>
      
      <div className="flex flex-col gap-4 w-full max-w-md">
        <Link href="/online" className="w-full">
          <Button fullWidth>
            Online Multiplayer
          </Button>
        </Link>
        
        <Link href="/local" className="w-full">
          <Button variant="secondary" fullWidth>
            Pass and Play
          </Button>
        </Link>
      </div>
    </div>
  );
}
