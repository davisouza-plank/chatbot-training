import Hero from "@/components/hero";

export default async function Home() {
  return (
    <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
      <div className="text-center">
        <div className="text-6xl mb-6">🧙‍♂️ 🏰</div>
        <h1 className="text-4xl font-bold mb-4">Welcome to the Great Wizard Merlin's Tower</h1>
        <p className="text-xl">Ask anything, and let magic guide your way...</p>
      </div>
    </div>
  );
}
