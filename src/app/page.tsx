import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowRight } from 'lucide-react';

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-b from-green-50 to-white p-4">
      <div className="text-center space-y-6 max-w-lg">
        <div className="mx-auto mb-6 flex h-24 w-24 items-center justify-center rounded-full bg-green-100">
          <span className="text-5xl">🥦</span>
        </div>
        
        <h1 className="text-4xl font-bold text-gray-900">
          MatSvinn Hjelper
        </h1>
        
        <p className="text-lg text-gray-600">
          Reduser matsvinn med AI-assistert matlaging. 
          Hold oversikt over matvarene dine og få smarte opskriftforslag.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
          <Button asChild size="lg" className="bg-green-600 hover:bg-green-700">
            <Link href="/login">
              Kom i gang <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
          <Button asChild variant="outline" size="lg">
            <Link href="/register">Registrer deg</Link>
          </Button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-8 text-sm">
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="text-2xl mb-2">📦</div>
            <div className="font-semibold">Hold oversikt</div>
            <div className="text-gray-500">Organiser kjøleskap, fryser og skuffer</div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="text-2xl mb-2">👨‍🍳</div>
            <div className="font-semibold">AI-assistent</div>
            <div className="text-gray-500">Få opskriftforslag basert på det du har</div>
          </div>
          <div className="p-4 bg-white rounded-lg shadow-sm">
            <div className="text-2xl mb-2">⏰</div>
            <div className="font-semibold">Varsler</div>
            <div className="text-gray-500">Aldri glem varer som utløper</div>
          </div>
        </div>
      </div>
    </div>
  );
}
