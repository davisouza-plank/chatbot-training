export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex-1 w-full flex items-center justify-center min-h-[calc(100vh-8rem)]">
      {children}
    </div>
  );
}
