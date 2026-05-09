import { Navigation } from "@/components/landing/navigation";

export default function PrivacyLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <Navigation />
      <div className="pt-24">
        {children}
      </div>
    </>
  );
}
