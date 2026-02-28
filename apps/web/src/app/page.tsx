export default function HomePage() {
  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">ALI Remote</h1>
      <p className="text-gray-600 mb-8">
        Remote device control platform — Coming soon
      </p>
      <a
        href="/dashboard"
        className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800"
      >
        Dashboard
      </a>
    </main>
  );
}
